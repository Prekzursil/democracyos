/**
 * WU-M3a-4 constraint probes — topics + tags (Tag, Topic, Clause, TopicLink,
 * TopicOption, TopicAttrValue, plus the U13b unique and the Forum(ownerId)
 * index added by the WU-M3a-3 review). Each constraint from
 * docs/design/data-model.md that this migration ships is proven to bite:
 * violating statements show the real Postgres error (asserted by constraint
 * name), legitimate ones succeed. Defect IDs refer to docs/CHARACTERIZATION.md.
 *
 * NOT probed here, on purpose: the composite FKs themselves (Vote → Topic /
 * Vote → TopicOption) belong to migration 4 — this suite proves their U7/U11
 * TARGETS pin correctly by pointing a scratch referencing table at them, so
 * migration 4 cannot discover a broken target. "Options mandatory at poll/
 * hierarchy creation" (TL-4) is an API-layer rule per the design (§12), so a
 * zero-option topic INSERT is deliberately shown to be a DB-legal state.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectSqlFailure, loadDatabaseUrl, newPool } from './helpers.js';

const databaseUrl = loadDatabaseUrl();

describe.skipIf(!databaseUrl)('WU-M3a-4 topics schema constraints', () => {
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

  async function createTag(slug: string): Promise<string> {
    const res = await pool.query<{ id: string }>(
      'INSERT INTO "Tag" (slug, name) VALUES ($1, $2) RETURNING id',
      [slug, `Tag ${slug}`],
    );
    return res.rows[0]!.id;
  }

  // Two FIXED statements selected by the presence of votingMethod, every value
  // a $n parameter — no SQL is ever built by interpolation (WU-M3a-4 review
  // F2: the previous extraCols/extraVals template build tripped our own
  // js-sql-built-by-template-string gate, correctly).
  async function createTopic(
    slug: string,
    opts: {
      forumId?: string;
      tagId?: string;
      votingMethod?: 'vote' | 'poll' | 'cause' | 'slider' | 'hierarchy';
    } = {},
  ): Promise<string> {
    const base = [opts.forumId ?? forumId, opts.tagId ?? tagId, slug, `Topic ${slug}`];
    const res = opts.votingMethod
      ? await pool.query<{ id: string }>(
          `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", "votingMethod")
             VALUES ($1, $2, $3, $4, 'debate', $5) RETURNING id`,
          [...base, opts.votingMethod],
        )
      : await pool.query<{ id: string }>(
          `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType")
             VALUES ($1, $2, $3, $4, 'debate') RETURNING id`,
          base,
        );
    return res.rows[0]!.id;
  }

  let ownerId: string;
  let forumId: string;
  let tagId: string;

  beforeAll(async () => {
    await pool.query('TRUNCATE "User", "Forum", "Tag" CASCADE');
    ownerId = await createUser('topics-owner@example.test');
    forumId = await createForum('topics-fixture', ownerId);
    tagId = await createTag('urbanism');
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS "_probe_vote_method"');
    await pool.query('DROP TABLE IF EXISTS "_probe_vote_option"');
    await pool.query('TRUNCATE "User", "Forum", "Tag" CASCADE');
    await pool.end();
  });

  describe('U5 — Tag.slug UNIQUE (P-12 dedupe-by-slug)', () => {
    it('accepts distinct slugs, rejects a duplicate — same-slug tags can never coexist', async () => {
      await createTag('transport');
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Tag" (slug, name) VALUES ('transport', 'Transport (dup)')`,
      );
      expect(failure.code).toBe('23505'); // unique_violation
      expect(failure.constraint).toBe('Tag_slug_key');
    });
  });

  describe('Tag — hex-color CHECK (M25) and tag_image enum (E14)', () => {
    it('accepts a valid hex color, the legacy default, and NULL (color is optional)', async () => {
      await pool.query(`INSERT INTO "Tag" (slug, name, color) VALUES ('color-ok', 'C', '#091A33')`);
      await pool.query(`INSERT INTO "Tag" (slug, name) VALUES ('color-null', 'C')`);
    });

    it.each([
      ['a word', 'rosu'],
      ['5 hex digits', '#0AB12'],
      ['non-hex chars', '#GGGGGG'],
      ['missing #', '091A33'],
    ])('rejects a malformed color (%s)', async (_label, color) => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Tag" (slug, name, color) VALUES ('color-bad', 'C', $1)`,
        [color],
      );
      expect(failure.code).toBe('23514'); // check_violation
      expect(failure.constraint).toBe('tag_color_hex');
    });

    it(`rejects an image outside the fixed 9-image dictionary and defaults to 'arts' (AD-5)`, async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Tag" (slug, name, image) VALUES ('image-bad', 'I', 'castle')`,
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum tag_image');

      const res = await pool.query(`SELECT image::text FROM "Tag" WHERE slug = 'color-null'`);
      expect(res.rows[0].image).toBe('arts');
    });
  });

  describe('Topic NOT NULLs — forumId (legacy hole closed), tagId (TL-5), mediaTitle, contentType', () => {
    it('rejects a topic without a forum — legacy topic.forum had no `required` (topic.js:52)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("tagId", slug, "mediaTitle", "contentType")
           VALUES ($1, 'no-forum', 'T', 'debate')`,
        [tagId],
      );
      expect(failure.code).toBe('23502'); // not_null_violation
      expect(failure.message).toContain('"forumId"');
    });

    it('rejects a topic without a tag (TL-5: a tag is mandatory at creation)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", slug, "mediaTitle", "contentType")
           VALUES ($1, 'no-tag', 'T', 'debate')`,
        [forumId],
      );
      expect(failure.code).toBe('23502');
      expect(failure.message).toContain('"tagId"');
    });

    it('rejects a topic without mediaTitle — the display title IS mediaTitle (TL-9); no computed title exists', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "contentType")
           VALUES ($1, $2, 'no-title', 'debate')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('23502');
      expect(failure.message).toContain('"mediaTitle"');
    });

    it('rejects a topic without contentType (C4: NOT NULL, deliberately no default)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle")
           VALUES ($1, $2, 'no-content-type', 'T')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('23502');
      expect(failure.message).toContain('"contentType"');
    });
  });

  describe('U6 — Topic slug unique per forum (plan §2.4 identifiers)', () => {
    it('accepts the same slug in two forums, rejects it twice in one', async () => {
      const otherForum = await createForum('topics-other', ownerId);
      await createTopic('t-shared-slug');
      await createTopic('t-shared-slug', { forumId: otherForum }); // other forum — fine
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType")
           VALUES ($1, $2, 't-shared-slug', 'Dup', 'debate')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('Topic_forumId_slug_key');
    });
  });

  describe('mediaTitle length CHECK — ONE limit (kills COR-11: form said 200, model said 225)', () => {
    it('accepts exactly 200 chars, rejects 201 (and the legacy-model 225)', async () => {
      await pool.query(
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType")
           VALUES ($1, $2, 't-title-200', $3, 'debate')`,
        [forumId, tagId, 't'.repeat(200)],
      );
      for (const length of [201, 225]) {
        const failure = await expectSqlFailure(
          pool,
          `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType")
             VALUES ($1, $2, 't-title-too-long', $3, 'debate')`,
          [forumId, tagId, 't'.repeat(length)],
        );
        expect(failure.code).toBe('23514');
        expect(failure.constraint).toBe('topic_media_title_length');
      }
    });
  });

  describe(`E5/E6/E7 — enums; legacy's '' method member is dead (votingMethod IS NULL instead)`, () => {
    it(`rejects the empty string as a voting method — the '' enum member was NOT ported`, async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", "votingMethod")
           VALUES ($1, $2, 't-empty-method', 'T', 'debate', '')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('22P02');
      expect(failure.message).toContain('invalid input value for enum voting_method');
    });

    it('accepts votingMethod NULL ("no action" — Q-7 stays open at zero migration cost)', async () => {
      const id = await createTopic('t-null-method');
      const res = await pool.query('SELECT "votingMethod" FROM "Topic" WHERE id = $1', [id]);
      expect(res.rows[0].votingMethod).toBeNull();
    });

    it('rejects an out-of-enum method, contentType and lifecycle', async () => {
      const method = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", "votingMethod")
           VALUES ($1, $2, 't-bad-method', 'T', 'debate', 'referendum')`,
        [forumId, tagId],
      );
      expect(method.code).toBe('22P02');
      expect(method.message).toContain('invalid input value for enum voting_method');

      const content = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType")
           VALUES ($1, $2, 't-bad-content', 'T', 'petition')`,
        [forumId, tagId],
      );
      expect(content.code).toBe('22P02');
      expect(content.message).toContain('invalid input value for enum content_type');

      const lifecycle = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", lifecycle)
           VALUES ($1, $2, 't-bad-lifecycle', 'T', 'debate', 'archived')`,
        [forumId, tagId],
      );
      expect(lifecycle.code).toBe('22P02');
      expect(lifecycle.message).toContain('invalid input value for enum lifecycle');
    });
  });

  describe('C1 — outcome declaration forced by the DATABASE (C3/N11, kills the silent close)', () => {
    it('rejects INSERTing a closed topic with no declaration', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", lifecycle)
           VALUES ($1, $2, 't-closed-bare', 'T', 'debate', 'closed')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('23514');
      expect(failure.constraint).toBe('topic_closed_requires_outcome');
    });

    it('rejects a whitespace-only declaration (btrim guards the loophole)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", lifecycle, "outcomeDeclaration")
           VALUES ($1, $2, 't-closed-blank', 'T', 'debate', 'closed', '   ')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('23514');
      expect(failure.constraint).toBe('topic_closed_requires_outcome');
    });

    it('rejects outcome_published with no declaration (only `open` is exempt)', async () => {
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", lifecycle)
           VALUES ($1, $2, 't-published-bare', 'T', 'debate', 'outcome_published')`,
        [forumId, tagId],
      );
      expect(failure.code).toBe('23514');
      expect(failure.constraint).toBe('topic_closed_requires_outcome');
    });

    it('rejects the UPDATE close attempt without a declaration, accepts it with one', async () => {
      const id = await createTopic('t-close-attempt');
      const failure = await expectSqlFailure(
        pool,
        `UPDATE "Topic" SET lifecycle = 'closed' WHERE id = $1`,
        [id],
      );
      expect(failure.code).toBe('23514');
      expect(failure.constraint).toBe('topic_closed_requires_outcome');

      await pool.query(
        `UPDATE "Topic"
            SET lifecycle = 'closed',
                "outcomeDeclaration" = 'Rezultatul a fost transmis comisiei de urbanism.'
          WHERE id = $1`,
        [id],
      );
      const res = await pool.query(
        'SELECT lifecycle::text, "outcomeDeclaration" FROM "Topic" WHERE id = $1',
        [id],
      );
      expect(res.rows[0].lifecycle).toBe('closed');
      expect(res.rows[0].outcomeDeclaration).not.toBe('');
    });

    it('accepts INSERTing a closed topic WITH a declaration (the fixtures.md corpus shape)', async () => {
      await pool.query(
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", lifecycle, "outcomeDeclaration")
           VALUES ($1, $2, 't-closed-outcome', 'T', 'debate', 'outcome_published',
                   'Propunerea a fost adoptată cu majoritate de voturi.')`,
        [forumId, tagId],
      );
    });
  });

  describe('C1 (second clause) — the TL-8 reading: closingAt demands the declaration up front', () => {
    it('rejects setting closingAt without a declaration — derived closing has no human at the transition', async () => {
      const insert = await expectSqlFailure(
        pool,
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", "closingAt")
           VALUES ($1, $2, 't-closing-bare', 'T', 'debate', now() + interval '7 days')`,
        [forumId, tagId],
      );
      expect(insert.code).toBe('23514');
      expect(insert.constraint).toBe('topic_closing_requires_outcome');

      const id = await createTopic('t-closing-update');
      const update = await expectSqlFailure(
        pool,
        `UPDATE "Topic" SET "closingAt" = now() + interval '7 days' WHERE id = $1`,
        [id],
      );
      expect(update.code).toBe('23514');
      expect(update.constraint).toBe('topic_closing_requires_outcome');
    });

    it('accepts closingAt once the declaration exists (still lifecycle=open — TL-8 derived closing)', async () => {
      await pool.query(
        `INSERT INTO "Topic" ("forumId", "tagId", slug, "mediaTitle", "contentType", "closingAt", "outcomeDeclaration")
           VALUES ($1, $2, 't-closing-ok', 'T', 'debate', now() + interval '7 days',
                   'Rezultatul va fi publicat ca aviz consultativ.')`,
        [forumId, tagId],
      );
      const res = await pool.query(
        `SELECT lifecycle::text FROM "Topic" WHERE slug = 't-closing-ok' AND "forumId" = $1`,
        [forumId],
      );
      expect(res.rows[0].lifecycle).toBe('open');
    });
  });

  describe('U8 — Clause order is stored order (TL-9: no per-read re-sorting)', () => {
    it('accepts distinct positions, rejects a duplicate position within one topic', async () => {
      const id = await createTopic('t-clauses');
      const other = await createTopic('t-clauses-other');
      const insert = `INSERT INTO "Clause" ("topicId", position, markup) VALUES ($1, $2, '<p>x</p>')`;
      await pool.query(insert, [id, 0]);
      await pool.query(insert, [id, 1]);
      await pool.query(insert, [other, 0]); // same position, other topic — fine
      const failure = await expectSqlFailure(pool, insert, [id, 1]);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('Clause_topicId_position_key');
    });
  });

  describe('U9/U10 — TopicOption sets are well-ordered and duplicate-free (TL-4, VO-7/VO-12)', () => {
    let pollId: string;
    let otherPollId: string;

    beforeAll(async () => {
      pollId = await createTopic('t-poll', { votingMethod: 'poll' });
      otherPollId = await createTopic('t-poll-other', { votingMethod: 'poll' });
    });

    it('rejects a duplicate position within one topic (U9)', async () => {
      const insert = `INSERT INTO "TopicOption" ("topicId", position, label) VALUES ($1, $2, $3)`;
      await pool.query(insert, [pollId, 1, 'Dimineața (08:00–12:00)']);
      await pool.query(insert, [pollId, 2, 'După-amiaza (12:00–17:00)']);
      const failure = await expectSqlFailure(pool, insert, [pollId, 2, 'Seara (17:00–21:00)']);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('TopicOption_topicId_position_key');
    });

    it('rejects a duplicate label within one topic (U10), accepts it on another topic', async () => {
      const insert = `INSERT INTO "TopicOption" ("topicId", position, label) VALUES ($1, $2, $3)`;
      const failure = await expectSqlFailure(pool, insert, [pollId, 3, 'Dimineața (08:00–12:00)']);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('TopicOption_topicId_label_key');
      await pool.query(insert, [otherPollId, 1, 'Dimineața (08:00–12:00)']); // other topic — fine
    });

    it('a zero-option poll topic is DB-legal on purpose: TL-4 mandatory-options is an API-layer rule (design §12)', async () => {
      const bare = await createTopic('t-poll-bare', { votingMethod: 'poll' });
      const res = await pool.query(
        'SELECT count(*)::int AS n FROM "TopicOption" WHERE "topicId" = $1',
        [bare],
      );
      expect(res.rows[0].n).toBe(0); // stored, not rejected — the API must refuse it
    });
  });

  describe('U7/U11 — composite-unique FK targets pin migration 4 down (structural half of DI-3)', () => {
    it('U7: a scratch FK onto Topic(id, votingMethod) rejects a method that disagrees with the topic', async () => {
      const pollId = await createTopic('t-pin-method', { votingMethod: 'poll' });
      // CREATE TABLE itself proves the unique target exists — Postgres refuses
      // an FK onto columns without a unique constraint (SQLSTATE 42830).
      await pool.query('DROP TABLE IF EXISTS "_probe_vote_method"');
      await pool.query(
        `CREATE TABLE "_probe_vote_method" (
           "topicId" UUID NOT NULL,
           method voting_method NOT NULL,
           CONSTRAINT probe_vote_method_pin FOREIGN KEY ("topicId", method)
             REFERENCES "Topic"(id, "votingMethod")
         )`,
      );
      await pool.query(`INSERT INTO "_probe_vote_method" ("topicId", method) VALUES ($1, 'poll')`, [
        pollId,
      ]);
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "_probe_vote_method" ("topicId", method) VALUES ($1, 'slider')`,
        [pollId],
      );
      expect(failure.code).toBe('23503'); // foreign_key_violation
      expect(failure.constraint).toBe('probe_vote_method_pin');
      await pool.query('DROP TABLE "_probe_vote_method"');
    });

    it('U11: a scratch FK onto TopicOption(topicId, id) rejects an option of ANOTHER topic', async () => {
      const topicA = await createTopic('t-pin-option-a', { votingMethod: 'poll' });
      const topicB = await createTopic('t-pin-option-b', { votingMethod: 'poll' });
      const optionB = await pool.query<{ id: string }>(
        `INSERT INTO "TopicOption" ("topicId", position, label)
           VALUES ($1, 1, 'Opțiunea B1') RETURNING id`,
        [topicB],
      );
      await pool.query('DROP TABLE IF EXISTS "_probe_vote_option"');
      await pool.query(
        `CREATE TABLE "_probe_vote_option" (
           "topicId" UUID NOT NULL,
           "pollOptionId" UUID NOT NULL,
           CONSTRAINT probe_vote_option_pin FOREIGN KEY ("topicId", "pollOptionId")
             REFERENCES "TopicOption"("topicId", id)
         )`,
      );
      // The option referenced through its OWN topic: accepted.
      await pool.query(
        `INSERT INTO "_probe_vote_option" ("topicId", "pollOptionId") VALUES ($1, $2)`,
        [topicB, optionB.rows[0]!.id],
      );
      // The same option smuggled under topic A: FK violation, not a stored row.
      const failure = await expectSqlFailure(
        pool,
        `INSERT INTO "_probe_vote_option" ("topicId", "pollOptionId") VALUES ($1, $2)`,
        [topicA, optionB.rows[0]!.id],
      );
      expect(failure.code).toBe('23503');
      expect(failure.constraint).toBe('probe_vote_option_pin');
      await pool.query('DROP TABLE "_probe_vote_option"');
    });

    it('both raw targets exist under their designed names (pg_constraint)', async () => {
      const res = await pool.query(
        `SELECT conname FROM pg_constraint
          WHERE conname IN ('topic_id_voting_method_fk_target', 'topic_option_own_topic_fk_target')
          ORDER BY conname`,
      );
      expect(res.rows.map((r) => r.conname)).toEqual([
        'topic_id_voting_method_fk_target',
        'topic_option_own_topic_fk_target',
      ]);
    });
  });

  describe('U12 — one attr value per attr per topic (AD-6 CSV round-trip)', () => {
    it('accepts one value per attr, rejects a second row for the same pair', async () => {
      const attr = await pool.query<{ id: string }>(
        `INSERT INTO "ForumTopicAttr" ("forumId", name, title, kind)
           VALUES ($1, 'budget', 'Buget', 'number') RETURNING id`,
        [forumId],
      );
      const attrId = attr.rows[0]!.id;
      const id = await createTopic('t-attr-value');
      const insert = `INSERT INTO "TopicAttrValue" ("topicId", "attrId", value) VALUES ($1, $2, $3)`;
      await pool.query(insert, [id, attrId, '120000']);
      const failure = await expectSqlFailure(pool, insert, [id, attrId, '99999']);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('TopicAttrValue_topicId_attrId_key');
    });
  });

  describe('U13b — ForumTopicAttrOption names unique per attr (added by the WU-M3a-3 review)', () => {
    it('rejects the duplicate option name that previously inserted freely, accepts it on another attr', async () => {
      const mk = async (name: string): Promise<string> => {
        const res = await pool.query<{ id: string }>(
          `INSERT INTO "ForumTopicAttr" ("forumId", name, title, kind)
             VALUES ($1, $2, $2, 'enum') RETURNING id`,
          [forumId, name],
        );
        return res.rows[0]!.id;
      };
      const attrA = await mk('priority');
      const attrB = await mk('district');
      const insert = `INSERT INTO "ForumTopicAttrOption" ("attrId", name, title) VALUES ($1, $2, $3)`;
      await pool.query(insert, [attrA, 'medium', 'Mediu']);
      const failure = await expectSqlFailure(pool, insert, [attrA, 'medium', 'Mediu (dup)']);
      expect(failure.code).toBe('23505');
      expect(failure.constraint).toBe('ForumTopicAttrOption_attrId_name_key');
      await pool.query(insert, [attrB, 'medium', 'Mediu']); // other attr — fine
    });
  });

  describe('F6/F7/F8/F9 — ON DELETE semantics with their GDPR/product justification', () => {
    it('F8: deleting a referenced tag is refused — no tag delete exists for anyone (P-16)', async () => {
      const guarded = await createTag('tag-guarded');
      await createTopic('t-tag-guard', { tagId: guarded });
      const failure = await expectSqlFailure(pool, 'DELETE FROM "Tag" WHERE id = $1', [guarded]);
      expect(failure.code).toBe('23503');
      expect(failure.constraint).toBe('Topic_tagId_fkey');
    });

    it('F7: deleting a forum with topics is refused — forum deletion is soft (P-9), never a cascade', async () => {
      const doomed = await createForum('topics-doomed', ownerId);
      await createTopic('t-forum-guard', { forumId: doomed });
      const failure = await expectSqlFailure(pool, 'DELETE FROM "Forum" WHERE id = $1', [doomed]);
      expect(failure.code).toBe('23503');
      expect(failure.constraint).toBe('Topic_forumId_fkey');
    });

    it('F6: erasing an author anonymizes attribution; the topic survives (P-10)', async () => {
      const author = await createUser('topic-author@example.test');
      const id = await createTopic('t-erased-author');
      await pool.query('UPDATE "Topic" SET "authorId" = $1 WHERE id = $2', [author, id]);
      await pool.query('DELETE FROM "User" WHERE id = $1', [author]);
      const res = await pool.query('SELECT "authorId" FROM "Topic" WHERE id = $1', [id]);
      expect(res.rows[0].authorId).toBeNull(); // content is the community's record
    });

    it('F9: clauses, links, options and attr values die with their topic (hard-purge path only)', async () => {
      const id = await createTopic('t-cascade');
      const attr = await pool.query<{ id: string }>(
        `INSERT INTO "ForumTopicAttr" ("forumId", name, title, kind)
           VALUES ($1, 'cascade-attr', 'A', 'string') RETURNING id`,
        [forumId],
      );
      await pool.query(
        `INSERT INTO "Clause" ("topicId", position, markup) VALUES ($1, 0, '<p>x</p>')`,
        [id],
      );
      await pool.query(
        `INSERT INTO "TopicLink" ("topicId", text, url, position) VALUES ($1, 'Sursa', 'https://example.test', 0)`,
        [id],
      );
      await pool.query(
        `INSERT INTO "TopicOption" ("topicId", position, label) VALUES ($1, 1, 'O1')`,
        [id],
      );
      await pool.query(
        `INSERT INTO "TopicAttrValue" ("topicId", "attrId", value) VALUES ($1, $2, 'v')`,
        [id, attr.rows[0]!.id],
      );
      await pool.query('DELETE FROM "Topic" WHERE id = $1', [id]);
      const res = await pool.query(
        `SELECT (SELECT count(*) FROM "Clause" WHERE "topicId" = $1)::int AS clauses,
                (SELECT count(*) FROM "TopicLink" WHERE "topicId" = $1)::int AS links,
                (SELECT count(*) FROM "TopicOption" WHERE "topicId" = $1)::int AS options,
                (SELECT count(*) FROM "TopicAttrValue" WHERE "topicId" = $1)::int AS attrs`,
        [id],
      );
      expect(res.rows[0]).toEqual({ clauses: 0, links: 0, options: 0, attrs: 0 });
    });
  });

  describe('§4.4 indexes — Forum(ownerId) from the WU-M3a-3 review, plus the three Topic indexes', () => {
    it('all four plain indexes exist (an index cannot be "violated"; existence is the honest probe)', async () => {
      const res = await pool.query(
        `SELECT indexname FROM pg_indexes
          WHERE indexname IN ('Forum_ownerId_idx', 'Topic_forumId_publishedAt_idx',
                              'Topic_closingAt_idx', 'Topic_tagId_idx')
          ORDER BY indexname`,
      );
      expect(res.rows.map((r) => r.indexname)).toEqual([
        'Forum_ownerId_idx',
        'Topic_closingAt_idx',
        'Topic_forumId_publishedAt_idx',
        'Topic_tagId_idx',
      ]);
    });
  });
});
