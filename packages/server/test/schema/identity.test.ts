/**
 * WU-M3a-2 constraint probes — identity core (User, Session, Token, Whitelist).
 * Each constraint from docs/design/data-model.md that this migration ships is
 * proven to bite: a violating statement shows the real Postgres error, a
 * legitimate statement succeeds. Defect IDs refer to docs/CHARACTERIZATION.md.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectSqlFailure, loadDatabaseUrl, newPool } from './helpers.js';

const databaseUrl = loadDatabaseUrl();

describe.skipIf(!databaseUrl)('WU-M3a-2 identity schema constraints', () => {
  const pool = newPool(databaseUrl ?? '');
  const hash = (label: string): Buffer => Buffer.from(`identity-probe:${label}`);

  async function createUser(email: string): Promise<string> {
    const res = await pool.query<{ id: string }>(
      'INSERT INTO "User" (email) VALUES ($1) RETURNING id',
      [email],
    );
    return res.rows[0]!.id;
  }

  beforeAll(async () => {
    await pool.query('TRUNCATE "User", "Whitelist" CASCADE');
  });

  afterAll(async () => {
    await pool.query('TRUNCATE "User", "Whitelist" CASCADE');
    await pool.end();
  });

  describe('U1 — User.email citext UNIQUE (kills plan §2.4 row 6 / AU-4; AU-7 case-insensitivity)', () => {
    it('accepts two users with distinct emails', async () => {
      await createUser('u1-a@example.test');
      await createUser('u1-b@example.test');
      const res = await pool.query('SELECT count(*)::int AS n FROM "User" WHERE email LIKE $1', [
        'u1-%',
      ]);
      expect(res.rows[0].n).toBe(2);
    });

    it('rejects a duplicate that differs only by case — unique AND case-insensitive at once', async () => {
      await createUser('U1-Dupe@Example.test');
      const failure = await expectSqlFailure(pool, 'INSERT INTO "User" (email) VALUES ($1)', [
        'u1-dupe@example.test',
      ]);
      expect(failure.code).toBe('23505'); // unique_violation
      expect(failure.constraint).toBe('User_email_key');
    });

    it('citext lookup finds the row regardless of query-side case (AU-7)', async () => {
      const res = await pool.query('SELECT email FROM "User" WHERE email = $1', [
        'u1-DUPE@EXAMPLE.TEST',
      ]);
      expect(res.rows).toHaveLength(1);
    });
  });

  describe('User defaults + enums (AU-2 emailValidated; C8 locale; G-10 stage)', () => {
    it('a bare insert gets the designed defaults', async () => {
      const id = await createUser('defaults@example.test');
      const res = await pool.query(
        `SELECT "emailValidated", locale::text, "verificationStage"::text AS stage,
                "notifyReplies", "notifyNewTopic"
           FROM "User" WHERE id = $1`,
        [id],
      );
      expect(res.rows[0]).toEqual({
        emailValidated: false,
        locale: 'ro',
        stage: 'stage1_email',
        notifyReplies: true,
        notifyNewTopic: false,
      });
    });

    it('rejects a locale outside {ro,en} (E1 — legacy allowed 18)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "User" (email, locale) VALUES ($1, 'de')`,
        ['locale-bad@example.test'],
      );
      expect(failure.code).toBe('22P02'); // invalid_text_representation
      expect(failure.message).toContain('invalid input value for enum locale');
    });

    it('rejects a verification stage outside the G-10 ladder (E12)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "User" (email, "verificationStage") VALUES ($1, 'stage4_dna')`,
        ['stage-bad@example.test'],
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum verification_stage');
    });
  });

  describe('Token — SEC-3 expiry, E2 scope enum, U2 tokenHash UNIQUE', () => {
    it('accepts a well-formed token for each scope', async () => {
      const userId = await createUser('token-ok@example.test');
      for (const scope of ['password_reset', 'email_validation']) {
        await pool.query(
          `INSERT INTO "Token" ("userId", scope, "tokenHash", "expiresAt")
             VALUES ($1, $2::token_scope, $3, now() + interval '1 hour')`,
          [userId, scope, hash(`token-${scope}`)],
        );
      }
      const res = await pool.query('SELECT count(*)::int AS n FROM "Token" WHERE "userId" = $1', [
        userId,
      ]);
      expect(res.rows[0].n).toBe(2);
    });

    it('rejects a token WITHOUT expiresAt — SEC-3: the field cannot be omitted', async () => {
      const userId = await createUser('token-noexpiry@example.test');
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Token" ("userId", scope, "tokenHash")
           VALUES ($1, 'password_reset', $2)`,
        [userId, hash('token-noexpiry')],
      );
      expect(failure.code).toBe('23502'); // not_null_violation
      expect(failure.message).toContain('"expiresAt"');
    });

    it('rejects a NULL scope — SEC-1/SEC-2 shape half: no scope-less token exists', async () => {
      const userId = await createUser('token-noscope@example.test');
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Token" ("userId", scope, "tokenHash", "expiresAt")
           VALUES ($1, NULL, $2, now() + interval '1 hour')`,
        [userId, hash('token-noscope')],
      );
      expect(failure.code).toBe('23502');
      expect(failure.message).toContain('"scope"');
    });

    it('rejects a scope outside {password_reset,email_validation} (E2 verbatim from legacy)', async () => {
      const userId = await createUser('token-badscope@example.test');
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Token" ("userId", scope, "tokenHash", "expiresAt")
           VALUES ($1, 'session', $2, now() + interval '1 hour')`,
        [userId, hash('token-badscope')],
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum token_scope');
    });

    it('rejects a duplicate tokenHash (U2 — forgery-by-collision; consume-once substrate)', async () => {
      const userId = await createUser('token-duphash@example.test');
      const insert = `INSERT INTO "Token" ("userId", scope, "tokenHash", "expiresAt")
                        VALUES ($1, 'password_reset', $2, now() + interval '1 hour')`;
      await pool.query(insert, [userId, hash('token-duphash')]);
      const failure = await expectSqlFailure(pool, insert, [userId, hash('token-duphash')]);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('Token_tokenHash_key');
    });
  });

  describe('Session — U25 tokenHash UNIQUE, NOT NULL expiry', () => {
    it('accepts a session and rejects a second one with the same tokenHash', async () => {
      const userId = await createUser('session-dup@example.test');
      const insert = `INSERT INTO "Session" ("userId", "tokenHash", "expiresAt")
                        VALUES ($1, $2, now() + interval '15 days')`;
      await pool.query(insert, [userId, hash('session-dup')]);
      const failure = await expectSqlFailure(pool, insert, [userId, hash('session-dup')]);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('Session_tokenHash_key');
    });

    it('rejects a session without expiresAt (AU-8: no eternal sessions)', async () => {
      const userId = await createUser('session-noexpiry@example.test');
      const failure = await expectSqlFailure(
        pool,
        'INSERT INTO "Session" ("userId", "tokenHash") VALUES ($1, $2)',
        [userId, hash('session-noexpiry')],
      );
      expect(failure.code).toBe('23502');
      expect(failure.message).toContain('"expiresAt"');
    });
  });

  describe('F1 — Session/Token die with the account (ON DELETE CASCADE)', () => {
    it('deleting a user removes their sessions and tokens', async () => {
      const userId = await createUser('cascade@example.test');
      await pool.query(
        `INSERT INTO "Session" ("userId", "tokenHash", "expiresAt")
           VALUES ($1, $2, now() + interval '1 day')`,
        [userId, hash('cascade-session')],
      );
      await pool.query(
        `INSERT INTO "Token" ("userId", scope, "tokenHash", "expiresAt")
           VALUES ($1, 'email_validation', $2, now() + interval '1 day')`,
        [userId, hash('cascade-token')],
      );
      await pool.query('DELETE FROM "User" WHERE id = $1', [userId]);
      const res = await pool.query(
        `SELECT (SELECT count(*) FROM "Session" WHERE "userId" = $1)::int AS sessions,
                (SELECT count(*) FROM "Token" WHERE "userId" = $1)::int AS tokens`,
        [userId],
      );
      expect(res.rows[0]).toEqual({ sessions: 0, tokens: 0 });
    });
  });

  describe('U21 — Whitelist.email citext UNIQUE', () => {
    it('accepts distinct emails, rejects a case-variant duplicate', async () => {
      await pool.query('INSERT INTO "Whitelist" (email) VALUES ($1)', ['wl-a@example.test']);
      await pool.query('INSERT INTO "Whitelist" (email) VALUES ($1)', ['wl-b@example.test']);
      const failure = await expectSqlFailure(pool, 'INSERT INTO "Whitelist" (email) VALUES ($1)', [
        'WL-A@Example.Test',
      ]);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('Whitelist_email_key');
    });
  });
});
