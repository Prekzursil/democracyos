/**
 * WU-M3a-3 constraint probes — forums + permissions (Forum, ForumPermission,
 * ForumTopicAttr, ForumTopicAttrOption). Each constraint from
 * docs/design/data-model.md that this migration ships is proven to bite:
 * violating statements show the real Postgres error, legitimate ones succeed.
 * Defect IDs refer to docs/CHARACTERIZATION.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectSqlFailure, loadDatabaseUrl, newPool } from './helpers.js';

const databaseUrl = loadDatabaseUrl();

describe.skipIf(!databaseUrl)('WU-M3a-3 forums schema constraints', () => {
  const pool = newPool(databaseUrl ?? '');

  async function createUser(email: string): Promise<string> {
    const res = await pool.query<{ id: string }>(
      'INSERT INTO "User" (email) VALUES ($1) RETURNING id',
      [email],
    );
    return res.rows[0]!.id;
  }

  async function createForum(name: string, ownerId: string): Promise<string> {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO "Forum" (name, title, "ownerId") VALUES ($1, $2, $3) RETURNING id`,
      [name, `Forum ${name}`, ownerId],
    );
    return res.rows[0]!.id;
  }

  let ownerId: string;

  beforeAll(async () => {
    await pool.query('TRUNCATE "User", "Forum" CASCADE');
    ownerId = await createUser('forum-owner@example.test');
  });

  afterAll(async () => {
    await pool.query('TRUNCATE "User", "Forum" CASCADE');
    await pool.end();
  });

  describe('U3 — partial unique on lower(name) WHERE deletedAt IS NULL (kills DI-4)', () => {
    it('accepts a live forum, rejects a second live forum with the same name', async () => {
      await createForum('agora-unique', ownerId);
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Forum" (name, title, "ownerId") VALUES ('agora-unique', 'Dup', $1)`,
        [ownerId],
      );
      expect(failure.code).toBe('23505'); // unique_violation — no race window exists
      expect(failure.constraint).toBe('forum_name_live');
    });

    it('soft deletion frees the name (P-9: the index is partial, not total)', async () => {
      const id = await createForum('agora-recycled', ownerId);
      await pool.query('UPDATE "Forum" SET "deletedAt" = now() WHERE id = $1', [id]);
      // Same name again, now that the previous holder is soft-deleted:
      const reused = await createForum('agora-recycled', ownerId);
      expect(reused).not.toBe(id);
      // …and the LIVE copy is protected again:
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Forum" (name, title, "ownerId") VALUES ('agora-recycled', 'Dup', $1)`,
        [ownerId],
      );
      expect(failure.constraint).toBe('forum_name_live');
    });
  });

  describe('C8 — name format (FR-4) + reserved names', () => {
    it('accepts a 1-char name and a hyphenated name', async () => {
      await createForum('x', ownerId);
      await createForum('a-2b', ownerId);
    });

    it.each([
      ['Uppercase', 'Agora-Fixture'],
      ['space', 'bad name'],
      ['leading hyphen', '-edge'],
      ['trailing hyphen', 'edge-'],
      ['81 chars', 'a'.repeat(81)],
    ])('rejects a malformed name (%s)', async (_label, name) => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Forum" (name, title, "ownerId") VALUES ($1, 'Bad', $2)`,
        [name, ownerId],
      );
      expect(failure.code).toBe('23514'); // check_violation
      expect(failure.constraint).toBe('forum_name_format');
    });

    it('accepts an 80-char name (the format upper bound is inclusive)', async () => {
      await createForum('a'.repeat(80), ownerId);
    });

    it('rejects a reserved name (verbatim legacy list)', async () => {
      for (const name of ['admin', 'topics', 'signup']) {
        const failure = await expectSqlFailure(
          pool,
          `INSERT INTO "Forum" (name, title, "ownerId") VALUES ($1, 'Reserved', $2)`,
          [name, ownerId],
        );
        expect(failure.code).toBe('23514');
        expect(failure.constraint).toBe('forum_name_not_reserved');
      }
    });
  });

  describe('C9 — summary ≤ 300 INCLUSIVE (kills COR-12) and C9b live-forum-has-owner', () => {
    it('accepts a summary of exactly 300 chars (legacy refused it — the off-by-one)', async () => {
      await pool.query(
        `INSERT INTO "Forum" (name, title, summary, "ownerId") VALUES ('summary-300', 'S', $1, $2)`,
        ['s'.repeat(300), ownerId],
      );
    });

    it('rejects a summary of 301 chars', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Forum" (name, title, summary, "ownerId") VALUES ('summary-301', 'S', $1, $2)`,
        ['s'.repeat(301), ownerId],
      );
      expect(failure.code).toBe('23514');
      expect(failure.constraint).toBe('forum_summary_length');
    });

    it('C9b: rejects a LIVE forum without an owner…', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Forum" (name, title) VALUES ('ownerless-live', 'O')`,
      );
      expect(failure.code).toBe('23514');
      expect(failure.constraint).toBe('forum_live_has_owner');
    });

    it('…but allows a DELETED forum without an owner (erasure may orphan only the dead)', async () => {
      await pool.query(
        `INSERT INTO "Forum" (name, title, "deletedAt") VALUES ('ownerless-dead', 'O', now())`,
      );
    });
  });

  describe('E3/E4 — role and visibility enums verbatim from legacy', () => {
    it(`rejects 'owner' as a role — FR-1: owner lives on Forum.ownerId, not in permissions`, async () => {
      const forumId = await createForum('enum-owner-role', ownerId);
      const other = await createUser('enum-owner-role@example.test');
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'owner')`,
        [forumId, other],
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum forum_role');
    });

    it(`rejects 'moderator' — config-gated in legacy, omitted until the flag's fate is decided`, async () => {
      const forumId = await createForum('enum-moderator', ownerId);
      const other = await createUser('enum-moderator@example.test');
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'moderator')`,
        [forumId, other],
      );
      expect(failure.code).toBe('22P02');
    });

    it('rejects an out-of-enum visibility and defaults to public (FR-5/FR-6)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Forum" (name, title, visibility, "ownerId") VALUES ('vis-bad', 'V', 'secret', $1)`,
        [ownerId],
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum forum_visibility');

      const forumId = await createForum('vis-default', ownerId);
      const res = await pool.query('SELECT visibility::text FROM "Forum" WHERE id = $1', [forumId]);
      expect(res.rows[0].visibility).toBe('public');
    });
  });

  describe('U4 — one permission per user per forum (FR-8/P-8)', () => {
    it('accepts one grant per user, rejects a second row for the same pair', async () => {
      const forumId = await createForum('perm-unique', ownerId);
      const alice = await createUser('perm-alice@example.test');
      const bob = await createUser('perm-bob@example.test');
      await pool.query(
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'author')`,
        [forumId, alice],
      );
      await pool.query(
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'participant')`,
        [forumId, bob],
      );
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'admin')`,
        [forumId, alice],
      );
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('ForumPermission_forumId_userId_key');
    });

    it('a new grant is an upsert against the constraint, never a second row', async () => {
      const forumId = await createForum('perm-upsert', ownerId);
      const alice = await createUser('perm-upsert@example.test');
      const grant = `INSERT INTO "ForumPermission" ("forumId", "userId", role)
                       VALUES ($1, $2, $3::forum_role)
                       ON CONFLICT ("forumId", "userId") DO UPDATE SET role = EXCLUDED.role`;
      await pool.query(grant, [forumId, alice, 'participant']);
      await pool.query(grant, [forumId, alice, 'admin']);
      const res = await pool.query(
        'SELECT role::text FROM "ForumPermission" WHERE "forumId" = $1 AND "userId" = $2',
        [forumId, alice],
      );
      expect(res.rows).toEqual([{ role: 'admin' }]); // one row, replaced role
    });
  });

  describe('T2 — the owner can never hold another role (FR-8, cross-table trigger)', () => {
    it('rejects INSERTing a permission for the forum owner', async () => {
      const forumId = await createForum('t2-insert', ownerId);
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'admin')`,
        [forumId, ownerId],
      );
      expect(failure.code).toBe('P0001'); // raise_exception from trigger T2
      expect(failure.message).toContain('FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE');
    });

    it('rejects UPDATEing an existing permission onto the owner', async () => {
      const forumId = await createForum('t2-update', ownerId);
      const alice = await createUser('t2-update@example.test');
      await pool.query(
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'author')`,
        [forumId, alice],
      );
      const failure = await expectSqlFailure(
        pool,
        `UPDATE "ForumPermission" SET "userId" = $1 WHERE "forumId" = $2 AND "userId" = $3`,
        [ownerId, forumId, alice],
      );
      expect(failure.code).toBe('P0001');
      expect(failure.message).toContain('FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE');
    });

    it('accepts a permission for a non-owner (the trigger only bites the owner)', async () => {
      const forumId = await createForum('t2-ok', ownerId);
      const alice = await createUser('t2-ok@example.test');
      await pool.query(
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'collaborator')`,
        [forumId, alice],
      );
    });
  });

  describe('U13 — ForumTopicAttr names unique per forum (AD-6 CSV columns)', () => {
    it('accepts the same attr name in two different forums, rejects it twice in one', async () => {
      const forumA = await createForum('attr-forum-a', ownerId);
      const forumB = await createForum('attr-forum-b', ownerId);
      const insert = `INSERT INTO "ForumTopicAttr" ("forumId", name, title, kind)
                        VALUES ($1, 'budget', 'Buget', 'number')`;
      await pool.query(insert, [forumA]);
      await pool.query(insert, [forumB]); // same name, other forum — fine
      const failure = await expectSqlFailure(pool, insert, [forumA]);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('ForumTopicAttr_forumId_name_key');
    });

    it('rejects an out-of-enum attr kind (E13: the five legacy discriminators)', async () => {
      const forumId = await createForum('attr-kind-bad', ownerId);
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "ForumTopicAttr" ("forumId", name, title, kind) VALUES ($1, 'x', 'X', 'json')`,
        [forumId],
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum topic_attr_kind');
    });

    it('enum-kind options live in the child table and die with their attr (F9 cascade)', async () => {
      const forumId = await createForum('attr-cascade', ownerId);
      const attr = await pool.query<{ id: string }>(
        `INSERT INTO "ForumTopicAttr" ("forumId", name, title, kind)
           VALUES ($1, 'district', 'Cartier', 'enum') RETURNING id`,
        [forumId],
      );
      const attrId = attr.rows[0]!.id;
      await pool.query(
        `INSERT INTO "ForumTopicAttrOption" ("attrId", name, title) VALUES ($1, 'nord', 'Nord')`,
        [attrId],
      );
      await pool.query('DELETE FROM "ForumTopicAttr" WHERE id = $1', [attrId]);
      const res = await pool.query(
        'SELECT count(*)::int AS n FROM "ForumTopicAttrOption" WHERE "attrId" = $1',
        [attrId],
      );
      expect(res.rows[0].n).toBe(0);
    });
  });

  describe('F3/F4 — ON DELETE semantics with GDPR justification', () => {
    it('deleting a user SET NULLs forum ownership only on their DELETED forums (C9b guards live ones)', async () => {
      const victim = await createUser('erasure-owner@example.test');
      const deadForum = await pool.query<{ id: string }>(
        `INSERT INTO "Forum" (name, title, "ownerId", "deletedAt")
           VALUES ('erasure-dead-forum', 'E', $1, now()) RETURNING id`,
        [victim],
      );
      await pool.query('DELETE FROM "User" WHERE id = $1', [victim]);
      const res = await pool.query('SELECT "ownerId" FROM "Forum" WHERE id = $1', [
        deadForum.rows[0]!.id,
      ]);
      expect(res.rows[0].ownerId).toBeNull(); // forum survives, identity edge dies
    });

    it('C9b blocks erasing a user who still owns a LIVE forum (no silent orphaning)', async () => {
      const victim = await createUser('erasure-blocked@example.test');
      await createForum('erasure-live-forum', victim);
      const failure = await expectSqlFailure(pool, 'DELETE FROM "User" WHERE id = $1', [victim]);
      expect(failure.code).toBe('23514'); // the SET NULL violates forum_live_has_owner
      expect(failure.constraint).toBe('forum_live_has_owner');
    });

    it('permissions die with the user and with the forum (F4 cascades)', async () => {
      const forumId = await createForum('cascade-perm', ownerId);
      const alice = await createUser('cascade-perm@example.test');
      await pool.query(
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'participant')`,
        [forumId, alice],
      );
      await pool.query('DELETE FROM "User" WHERE id = $1', [alice]);
      const afterUser = await pool.query(
        'SELECT count(*)::int AS n FROM "ForumPermission" WHERE "userId" = $1',
        [alice],
      );
      expect(afterUser.rows[0].n).toBe(0);

      const bob = await createUser('cascade-perm-bob@example.test');
      await pool.query(
        `INSERT INTO "ForumPermission" ("forumId", "userId", role) VALUES ($1, $2, 'participant')`,
        [forumId, bob],
      );
      await pool.query('DELETE FROM "Forum" WHERE id = $1', [forumId]);
      const afterForum = await pool.query(
        'SELECT count(*)::int AS n FROM "ForumPermission" WHERE "forumId" = $1',
        [forumId],
      );
      expect(afterForum.rows[0].n).toBe(0);
    });
  });
});
