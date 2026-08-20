# Data-model design record — WU-M3a-1

**Status:** DESIGN, awaiting adversarial review. Per plan §4.4, this document is reviewed and
merged **before a single migration is written**. No `schema.prisma` change and no migration
accompanies this commit.

**Inputs of record:** the revival plan §2.4 + §4.4 (`docs/plans/2026-08-18-democracyos-revival-plan.md`),
the characterization record (`docs/CHARACTERIZATION.md` — defect IDs `DI-*`, `SEC-*`, `COR-*`, `CM-*`,
`VO-*`, `FR-*`, `TL-*`, `P-*`, `Q-*` cited below), the locked decisions and OPEN DECISIONS table
(`docs/plans/2026-08-18-democracyos-grill-decisions.md` — `G-*`, `C*`, `D*`, `E*`, `N11`, `OD-1…OD-8`),
the legacy Mongoose models under `legacy/lib/models/`, and the fixture contract
(`docs/develop/fixtures.md`). Every claim about legacy behaviour carries a `legacy/...:<lines>`
citation; nothing about legacy is asserted from memory.

**Design rule (why this document exists):** the CHARACTERIZATION data-integrity defects must be
impossible **by construction** — a constraint, not a code path (plan §2.4: "It is a constraint,
not a code path, and therefore cannot be bypassed by a bug"). Where a property cannot be made
structural, this document says so explicitly rather than pretending (§14).

---

## 1. Conventions

- **Primary keys:** `uuid` (v7 or `gen_random_uuid()`), never a sequence exposed in a URL. Every
  place legacy exposed a Mongo `_id` in a URL gets a separate human-facing `slug`
  (plan §2.4 "Identifiers"; legacy `lib/url-builder/`).
- **Time:** every legacy `createdAt: Date.now` (an *application* clock, e.g.
  `legacy/lib/models/vote.js:9`) becomes `timestamptz NOT NULL DEFAULT now()` — the database
  clock, one source of truth (plan §2.4 "Time").
- **Soft delete:** `deletedAt timestamptz NULL` only where legacy specified soft-delete semantics
  (Forum — P-9, `legacy/lib/models/forum/index.js:100-103`; Topic — `legacy/lib/models/topic.js:81`).
  Nothing else gets a speculative `deletedAt`.
- **Naming:** Prisma models in PascalCase; Postgres enums in snake_case; raw-SQL objects
  (partial indexes, triggers, policies) named `<table>_<purpose>`.
- **`Mixed` is banned.** Every legacy `Schema.Types.Mixed` / bare `Object` / untyped `Array` is
  either modelled relationally, dropped with its dead feature, or appears on the `jsonb`
  allow-list (§6) with a justification. There is no fourth category.

---

## 2. Legacy-model → relational mapping

One row per legacy model or embedded/field group. "Shape" is the target Postgres shape;
constraint details are expanded in §3–§5.

| # | Legacy model / field group | Citation | Target shape | Reason / notes |
|---|---|---|---|---|
| M1 | `User` (identity core: `firstName`, `lastName`, `email`, `emailValidated`, `locale`, `profilePictureUrl`, `disabledAt`, timestamps) | `legacy/lib/models/user.js:14-42` | **`User`** table. `email citext UNIQUE NOT NULL`; `emailValidated boolean NOT NULL DEFAULT false` (AU-2); `locale locale NOT NULL DEFAULT 'ro'` (C8 — legacy's 18-locale enum at `user.js:18` shrinks to `{ro,en}`); names `varchar(100)` (`user.js:15-16`); `passwordHash text` (argon2id, D8 — replaces the passport-local-mongoose `hash`/`salt` pair stripped at `user.js:64-69`); `verificationStage` (§11). | Legacy's email index is **not unique** (`user.js:50`) — dedupe was app-logic only (AU-4 via passport-local-mongoose). `citext` makes AU-7 case-insensitivity structural instead of relying on the lowercase setter (`user.js:19-25,129-132`). |
| M2 | `User.notifications` (`replies` default true, `new-topic` default false) | `legacy/lib/models/user.js:36-39` | Two boolean columns on `User`: `notifyReplies NOT NULL DEFAULT true`, `notifyNewTopic NOT NULL DEFAULT false`. | Exactly two types end to end (SE-4, P-15, COR-21). Two booleans, not a prefs table, not jsonb — the enum of types is closed. |
| M3 | `User.profiles` (`facebook`, `twitter`, `custom` — bare `Object`s) | `legacy/lib/models/user.js:27-31` | **Dropped.** No column. | Facebook OAuth is landmine #2, not ported (plan §2.5); twitter/custom have no consumer in any journey. A `Mixed` that must NOT become a blob — it becomes nothing. |
| M4 | `User.extra` (`Mixed`), `User.badge`, `User.username` | `legacy/lib/models/user.js:40-41,17` | **Dropped.** | `extra` is an untyped grab-bag with no journey behaviour; `badge` is staff-surface residue (SE-1 "badges only staff" — staff dies with D6 RBAC); `username` is written nowhere in the characterized flows. |
| M5 | `User.staff` virtual (config email array) | `legacy/lib/models/user.js:118-121` | **Dropped**; replaced by DB-backed RBAC at WU-M4-7 (decision D6, plan WU-M3a-2: "no `staff` column"). | Header-based staff trust is landmine #3 (plan §2.5). The platform-admin role table is deliberately **out of scope here** — it lands with WU-M4-7's design, not smuggled into identity. |
| M6 | NEW: age gate | decision G-3/E4; CHARACTERIZATION §5 (J1: required birth-date field, under-16 refused) | **No stored birth date.** The sign-up flow verifies age ≥ 16 and records `ageAttestedAt timestamptz NOT NULL`. | Data minimization: the check needs a yes/no at one instant, not a permanent DOB (Art. 9-adjacent platform must hold the minimum). Flagged in §15 — if the DPIA (E3) wants stronger evidence, the column is an additive migration. |
| M7 | `Token` (`user`, `scope` enum, `meta`, `createdAt`; **no expiry field**) | `legacy/lib/models/token.js:5-14` | **`Token`** table: `userId FK`, `scope token_scope NOT NULL`, `tokenHash bytea UNIQUE NOT NULL` (sha-256 of the secret; the secret itself is never stored), `expiresAt timestamptz NOT NULL` (**new** — SEC-3), `meta jsonb` (§6), `createdAt`. Single-use = the consuming transaction `DELETE`s the row (AU-6/AU-12); re-issue = delete-then-create per scope (P-5, `legacy/lib/db-api/token.js:81-106`). | SEC-3: legacy tokens live forever. SEC-1/SEC-2: legacy looks tokens up **by id only**, scope-blind in both directions (`legacy/lib/api/signup/lib/signup.js:110-136`; `legacy/lib/api/forgot/lib/forgotpassword.js:71-81`; `legacy/lib/db-api/token.js:19-31`) — the worst finding in the register. `scope` is NOT NULL here, and the **only sanctioned lookup is `WHERE tokenHash = $1 AND scope = $2 AND expiresAt > now()`** — encoded as the repository contract (M4) because a schema cannot force a query's WHERE clause; see §14 "not schema-fixable". |
| M8 | Session (legacy: stateless 15-day JWT cookie, `lib/jwt/*`) | AU-8/AU-9 (`legacy/lib/jwt/index.js:8-10,20-72` per spec) | **`Session`** table: `id uuid PK`, `userId FK`, `tokenHash bytea UNIQUE`, `createdAt`, `expiresAt NOT NULL`, `revokedAt NULL`. | Plan WU-M3a-2 names Session explicitly. A server-side row makes sign-out (AU-9), revoke-all and erasure real operations instead of cookie-expiry hopes; jwt-simple is landmine #1, replaced by jose (D8). |
| M9 | `Forum` core (`name`, `title`, `summary`, `coverUrl`, `owner`, `visibility`, `deletedAt`) | `legacy/lib/models/forum/index.js:34-66` | **`Forum`** table: `name text NOT NULL` + format CHECK (FR-4) + reserved-name CHECK (`legacy/lib/models/forum/reserved-names.js:5-24`) + partial unique index (§4 U3); `title text NOT NULL`; `summary` CHECK `char_length ≤ 300` **inclusive** (COR-12 kills the `< 300` off-by-one at `forum/index.js:43-53`); `ownerId uuid NULL FK` + CHECK (§5 F3); `visibility forum_visibility NOT NULL DEFAULT 'public'` (FR-5/FR-6, `forum/visibilities.js:5-10`); `deletedAt` (FR-10/P-9). | The pre-save find-then-save uniqueness race (`forum/index.js:76-88`, DI-4) is replaced by a real partial unique index. |
| M10 | `Forum.permissions[]` (embedded `PermissionSchema`: user + role) | `legacy/lib/models/forum/index.js:16-28,61` | **`ForumPermission`** table: `forumId FK`, `userId FK`, `role forum_role NOT NULL`, `@@unique([forumId,userId])`, `grantedAt`. | Embedded array → table. The unique pair makes "one permission per forum, a new grant replaces" (FR-8/P-8, `forum/index.js:156-176`) an upsert against a constraint. "Owner can never hold a role" (`forum/index.js:157-162`) is a **cross-table** rule → constraint trigger (§4 T2). |
| M11 | `Forum.topicsAttrs[]` (discriminated embedded schemas: Number/String/LongString/Enum/Boolean) | `legacy/lib/models/forum/topics-attrs.js:3-40` | **`ForumTopicAttr`** table: `forumId FK`, `name varchar(32)`, `title varchar(128)`, `description varchar(256)`, `mandatory boolean`, `kind topic_attr_kind NOT NULL`, `min int NULL`, `max int NULL`, `@@unique([forumId, name])`; **`ForumTopicAttrOption`** child table (`attrId FK`, `name`, `title`) for `kind = 'enum'`. | A Mongoose discriminator is just a tagged union — `kind` + nullable bounds + an option child table model it fully relationally. Feeds the topics-CSV columns (AD-6). Not jsonb. |
| M12 | `Forum.extra` (`Mixed`), `Forum.initialTags` (untyped array) | `legacy/lib/models/forum/index.js:63,65` | **Dropped.** | No characterized behaviour reads either; `initialTags` is written by no journey flow. |
| M13 | `Topic` core (`forum`, `owner`, `tag`, `mediaTitle`, `officialTitle`, `author`, `authorUrl`, `source`, `coverUrl`, dates) | `legacy/lib/models/topic.js:50-84` | **`Topic`** table: `forumId uuid NOT NULL FK` (**legacy's is optional** — `topic.js:52` has no `required`; the relational model closes that hole), `authorId uuid NULL FK` (was `owner`, `topic.js:53`), `tagId uuid NOT NULL FK` (`topic.js:54`, TL-5), `slug` + `@@unique([forumId, slug])`, `mediaTitle text NOT NULL` + one CHECK limit (COR-11 — the single number lives in `packages/shared`, WU-M3b; recommended 200, the user-visible form limit), `externalAuthor varchar(100)` + `externalAuthorUrl` (display strings, `topic.js:58-63`), `source`, `coverUrl`, `closingAt`, `publishedAt` (TL-6/TL-7), `deletedAt`, timestamps. | `title` virtual (COR-1, `topic.js:157`) and `content` virtual (COR-2, `topic.js:167-175`) are **not ported** — plan §2.4 rows 1–2. `topicId: String` (`topic.js:51`) is dead import residue, dropped. `tags: [String]` (`topic.js:55`) duplicates the `tag` ref, dropped. |
| M14 | `Topic.action` (`method` enum-with-`''`, `results: Array`, `count: Number`) | `legacy/lib/models/topic.js:72-76` | Split three ways: `votingMethod voting_method NULL` on Topic (NULL = legacy `''`, pending C4/Q-7 — see §3 E9); `contentType content_type NOT NULL` (C4); **`TopicOption`** table for poll/hierarchy option sets; **`TallyCounter`** table for denormalized counts (§7). The polymorphic `action.results` bag (DI-7) is **not ported in any form**. | DI-7: legacy's first hierarchy vote overwrites seeded `{value,percentage,votes}` rows with `{value,position}` rows. Separating the immutable option set from the derived tally makes shape mutation inexpressible. |
| M15 | `Topic.clauses[]` (embedded `ParagraphSchema`: markup/position/empty) | `legacy/lib/models/topic.js:40-44,64` | **`Clause`** table: `topicId FK`, `position int NOT NULL`, `markup text`, `empty boolean NOT NULL DEFAULT false`, `@@unique([topicId, position])`. | Plan §2.4 row 2. The unique pair replaces per-serialization re-sorting (TL-9, `topic.js:107-111`) with an ordered-by-construction child table. Sanitization is a write+read pipeline (plan §2.4 row 3), not a schema concern. |
| M16 | `Topic.links[]` (embedded `LinkSchema`) | `legacy/lib/models/topic.js:21-28,65` | **`TopicLink`** table: `topicId FK`, `text`, `url varchar(250)`, `position int`. | Embedded array → table. Trivial. |
| M17 | `Topic.extra`, `Topic.attrs` (both `Mixed`) | `legacy/lib/models/topic.js:82-83` | `extra`: **dropped** (only ext-hook residue, `topic.js:130-143`). `attrs`: **`TopicAttrValue`** table — `topicId FK`, `attrId FK → ForumTopicAttr`, `value text NOT NULL`, `@@unique([topicId, attrId])`. | `attrs` values are keyed by the forum's attr definitions (M11) and surface in the topics CSV (AD-6, `legacy/lib/api-v2/topics/csv.js:12-55`); typed per-kind validation happens against `ForumTopicAttr.kind` at the boundary. Storing them as jsonb would re-create the blob the CSV import/export round-trip has to parse. |
| M18 | NEW: lifecycle + outcome declaration | C3/N11 (no legacy analogue; legacy "closed" is derived from `closingAt` — TL-8, `legacy/lib/models/topic.js:184-190`) | On Topic: `lifecycle lifecycle NOT NULL DEFAULT 'open'`, `outcomeDeclaration text NULL`, CHECK **C1** (§4). | See §4 C1 for the closing/declaration interaction and the TL-8 tension. |
| M19 | NEW: per-consultation verification requirement | G-10; CHARACTERIZATION §7 row 7 / Q-17 | On Topic: `requiredStageToVote verification_stage NOT NULL DEFAULT 'stage2_phone'`. | Resolves the *modelling* half of Q-17 (which stage a consultation demands); which fixture topic gets which value is a contract decision (§12). |
| M20 | `Vote` (`topic`, `author`, free-string `value`, `createdAt`; unique `(topic, author)`) | `legacy/lib/models/vote.js:5-10,16-17` | **`Vote`** table — the Art. 9 core, §8: `id uuid PK`, `topicId uuid NOT NULL FK`, `method voting_method NOT NULL` (composite-FK-pinned to the topic, §4 U7), **`voterPseudonym bytea NULL`** (NOT NULL while `status='active'` — §9), `status vote_status NOT NULL DEFAULT 'active'`, per-method payload columns `choice vote_choice NULL` / `sliderValue smallint NULL` / `pollOptionId uuid NULL`, `commitmentSalt bytea NULL` (§8.3), `createdAt`. **No `userId` column exists** (G-7). | DI-3 in full: the free string becomes per-method typed columns + CHECKs (§4 C2–C5). The `(topic, author)` unique index (`vote.js:16-17`) becomes the partial unique U14 on `(topicId, voterPseudonym)` — plan WU-M3a-5. |
| M21 | Hierarchy ballots (legacy: CSV string in `Vote.value`, `legacy/lib/api-v2/db-api/topics/utils.js:48-50`) | VO-12/VO-13; DI-3 | **`VoteRanking`** table: `voteId FK`, `topicId`, `optionId FK`, `rank int`, `@@unique([voteId, rank])`, `@@unique([voteId, optionId])`, + deferred permutation trigger (§4 T4). | A full permutation of the option set — every option exactly once — becomes rows, not a parsable string. Partial rankings, duplicates and unknown options (all storable in legacy) become constraint violations. |
| M22 | `Comment` core (`author`, `text`, `context`/`reference`, `topicId`, dates) | `legacy/lib/models/comment.js:70-86` | **`Comment`** table: `id uuid PK`, `topicId uuid NOT NULL FK` (**indexed** — COR-20: legacy's `topicId` has no index and api-v2 never sets it, `comment.js:80,88-90`), `authorId uuid NULL FK`, `parentId uuid NULL self-FK` (one level — CM-4, trigger T3), `text` CHECK non-empty + `char_length ≤ 4096` (CM-3, `comment.js:42-53`), `editedAt` (CM-8), timestamps. | The `reference: Mixed` + `context` enum pair (`comment.js:75-77`) existed for five contexts; the characterized product has one (CM-2: context `topic`). `reference` collapses into the typed `topicId` FK — a `Mixed` field that must NOT become a blob, and doesn't. Clause-level side comments are cut; if ever revived, `clauseId uuid NULL FK` is an additive migration. |
| M23 | `Comment.replies[]` (embedded `CommentReplySchema`) | `legacy/lib/models/comment.js:35-40,73` | Same `Comment` table via `parentId` (self-FK). Depth limited to one level by trigger T3 (CM-4). | Embedded flat array → self-referential rows; `repliesCount` virtual (`comment.js:128-130`) becomes a COUNT. |
| M24 | `Comment.votes[]` + `score`, `Comment.flags[]` (embedded, unbounded) | `legacy/lib/models/comment.js:10-14,20-24,81-83` | **`CommentVote`** (`commentId`, `userId`, `commentAuthorId`, `value comment_vote_value`, `@@unique([commentId,userId])`) and **`CommentFlag`** (same shape, `value comment_flag_value`). `score` is **derived** — §7.3. | DI-6 (16 MB growth + full arrays on every list read) and DI-5 (score drift) die together. The self-vote/self-flag bans (CM-5/CM-6) become **structural** via the composite-FK trick — §4 U18/C6. |
| M25 | `Tag` (`hash`, `name`, `color`, `image`, `createdAt`) | `legacy/lib/models/tag.js:12-18,24-25` | **`Tag`** table: `slug text UNIQUE NOT NULL` (the legacy `hash`, `tag.js:13,25`), `name varchar(50) NOT NULL` (`tag.js:14`), `color` CHECK hex (`tag.js:15`, `legacy/lib/regexps`), `image tag_image NOT NULL DEFAULT 'arts'` (§3 E7), `createdAt`. Platform-global — **no `forumId`** (AD-5; per-forum tags are open Q-11). No delete route exists (P-16) — backed by `ON DELETE RESTRICT` from `Topic.tagId` (§5). | P-12 dedupe-by-slug is the unique constraint. COR-18 (rename never regenerates the slug) is an app-layer rule recorded for WU-M4-15: slug follows name, or search queries by name. |
| M26 | `Notification` (`user`, `type` enum, `comment`, `relatedUser`, `topic`) | `legacy/lib/models/notification.js:13-20` | **`Notification`** table: `userId NOT NULL FK`, `type notification_type NOT NULL` (`notification.js:15`), `commentId FK`, `relatedUserId FK`, `topicId FK`, `readAt NULL`, `createdAt`. | Plan WU-M3a-7. The `translationKey` virtual (`notification.js:30-32`) is presentation, not ported. |
| M27 | `Whitelist` (`type` enum `['email']`, `value`) | `legacy/lib/models/whitelist.js:13-16` | **`Whitelist`** table: `email citext UNIQUE NOT NULL`, `createdAt`. The single-member `type` enum is dropped — the table *is* the email whitelist. | Config-gated feature, default off (AD-2, `config/defaults.json:128` per spec). Kept because plan WU-M3a-7 names it. |
| M28 | NEW: consent records | E2 (granular, versioned, withdrawable consent); OD-1 | **`ConsentRecord`** table: `userId uuid NULL FK`, `purpose consent_purpose NOT NULL`, `policyVersion text NOT NULL`, `grantedAt NOT NULL`, `withdrawnAt NULL`; partial unique U23. | Art. 9(2)(a) explicit consent needs an accountable record of *what* was consented to and *when withdrawn*. `userId` is nullable so erasure can sever identity while keeping the accountability timeline (§5 F5). |
| M29 | NEW: verification events | G-10 | **`VerificationEvent`** table: `userId FK`, `stage verification_stage NOT NULL`, `method text NOT NULL` (`email`, `phone_sms`, `ro_eid`), `occurredAt NOT NULL`, `evidenceRef text NULL`. Current stage is denormalized to `User.verificationStage` (§11). | **No raw phone number column.** `evidenceRef` is an opaque provider reference; storing MSISDNs is a DPIA decision (E3) this schema deliberately does not pre-empt — §15. |
| M30 | NEW: audit substrate | D3/G-7; plan WU-M3a-9 | **`AuditEntry`** table — §8.3. | Append-only, hash-chained, UPDATE/DELETE rejected by trigger + REVOKE. |
| M31 | NEW: consultation key reference | G-7/OD-5 | **`ConsultationKeyRef`** table: `topicId UNIQUE FK`, `keyRef text NOT NULL`, `createdAt`. Holds a key *reference* (env name / KMS URI), **never key material**. | §8.2. Custody is OD-5 (OPEN) — the schema stores a pointer so that *whatever* custody the owner picks, no migration is needed. |

**Totals:** 25 tables (`User`, `Session`, `Token`, `VerificationEvent`, `ConsentRecord`, `Whitelist`,
`Forum`, `ForumPermission`, `ForumTopicAttr`, `ForumTopicAttrOption`, `Tag`, `Topic`, `Clause`,
`TopicLink`, `TopicOption`, `TopicAttrValue`, `Vote`, `VoteRanking`, `TallyCounter`,
`ConsultationKeyRef`, `AuditEntry`, `Comment`, `CommentVote`, `CommentFlag`, `Notification`)
plus 1 view (`comment_score`, §7.3).

---

## 3. Enums — every one, with provenance

Legacy free strings become real Postgres enums; where legacy already had a Mongoose enum the
values carry verbatim. Adding a value is an additive migration; that is the deliberate cost of
type safety.

| # | Enum | Values | Derived from |
|---|---|---|---|
| E1 | `locale` | `ro`, `en` | Decision C8. Legacy allowed 18 (`legacy/lib/models/user.js:18` ← `config.availableLocales`). |
| E2 | `token_scope` | `password_reset`, `email_validation` | Verbatim (kebab→snake) from `legacy/lib/models/token.js:7`. |
| E3 | `forum_role` | `admin`, `collaborator`, `author`, `participant` | Verbatim `legacy/lib/models/forum/roles.js:7-13`. `owner` is **not** a role (lives on `Forum.ownerId` — FR-1, `roles.js:8` comment); `moderator` (`roles.js:15`, config-gated, default off) is **omitted** until the product decides the flag survives — adding it later is additive. |
| E4 | `forum_visibility` | `private`, `closed`, `public`, `collaborative` | Verbatim `legacy/lib/models/forum/visibilities.js:5-10` (FR-6). |
| E5 | `voting_method` | `vote`, `poll`, `cause`, `slider`, `hierarchy` | `legacy/lib/models/topic.js:73` **minus** the `''` member. Legacy's "no action" empty string becomes `Topic.votingMethod IS NULL`; whether "no method" survives as NULL or is subsumed by `content_type = 'debate'` is open Q-7 (C4) — **the schema supports both**, so Q-7's resolution costs no migration. |
| E6 | `content_type` | `debate`, `proposal`, `poll` | Decision C4 / plan WU-M3b-9. No legacy analogue. |
| E7 | `lifecycle` | `open`, `closed`, `outcome_published` | Decision C3/N11 / plan WU-M3b-9. Legacy's closed state is derived (TL-8); see CHECK C1 for how the two coexist. |
| E8 | `vote_choice` | `positive`, `neutral`, `negative` | Method `vote`'s exact option set (VO-2; server seed at `legacy/lib/api-v2/db-api/topics/index.js:138-140` per spec). In legacy this was a **free string** (`legacy/lib/models/vote.js:8`) — the root of DI-3. |
| E9 | `comment_vote_value` | `positive`, `negative` | Verbatim `legacy/lib/models/comment.js:12` (CM-5). |
| E10 | `comment_flag_value` | `spam` | Verbatim `legacy/lib/models/comment.js:22` (CM-6). Single-member on purpose: adding flag reasons later is additive. |
| E11 | `notification_type` | `reply`, `upvote`, `downvote` | Verbatim `legacy/lib/models/notification.js:15` (plan WU-M3a-7). |
| E12 | `verification_stage` | `stage1_email`, `stage2_phone`, `stage3_eid` | Decision G-10; mirrors `e2e/fixtures/users.ts:30`. Ordered — comparisons use enum order (§11). |
| E13 | `topic_attr_kind` | `number`, `string`, `long_string`, `enum`, `boolean` | The five discriminators at `legacy/lib/models/forum/topics-attrs.js:17-39`. |
| E14 | `tag_image` | `arts`, `scale`, `police`, `signs`, `transportation`, `people`, `parks`, `agora`, `internet` | The nine keys of `legacy/lib/tags-images/index.js:5-43` (AD-5's "fixed 9-image dictionary"; legacy enum at `legacy/lib/models/tag.js:16`). |
| E15 | `vote_status` | `active`, `withdrawn` | NEW — the OD-1 keep-all-options mechanism (§9). No legacy analogue. |
| E16 | `consent_purpose` | `voting_opinions`, `notifications_email` | Decision E2's granular consent surface. Deliberately minimal; additive later. |
| E17 | `audit_event_kind` | `vote_cast`, `vote_replaced`, `vote_withdrawn`, `consent_granted`, `consent_withdrawn`, `tally_published`, `tally_corrected`, `erasure_executed` | NEW — D3 substrate event taxonomy (§8.3). |

**Non-enum typed values:** slider intensity is `smallint` + CHECK C3 (nine buckets −100…+100 step
25, VO-10) — a CHECK, not a 9-member enum, because the value is arithmetically meaningful
(distribution buckets, VO-11). Cause has **no payload at all** (§4 C4): the seeded single
`support` value (VO-8, `legacy/lib/api-v2/db-api/topics/index.js:138-140` per spec) is carried by
the row's existence, which is exactly the endorse/withdraw semantic (P-4).

---

## 4. Unique constraints, partial indexes, CHECKs, triggers — each with the defect it kills

### 4.1 Unique / partial-unique (U-rows)

| # | Constraint | Kills / enforces |
|---|---|---|
| U1 | `User.email citext UNIQUE` | Plan §2.4 row 6: legacy's email index is **not unique** (`legacy/lib/models/user.js:50`) — AU-4 was app-logic-only dedupe. Two concurrent sign-ups can no longer both land. Also AU-7 (case-insensitive identity) via `citext`. |
| U2 | `Token.tokenHash UNIQUE` | Token forgery-by-collision; also makes "consume exactly once" an atomic `DELETE … WHERE tokenHash=… AND scope=…` (AU-6). |
| U3 | `CREATE UNIQUE INDEX forum_name_live ON "Forum" (lower(name)) WHERE "deletedAt" IS NULL` — **raw SQL** | **DI-4** (find-then-save race, `legacy/lib/models/forum/index.js:76-88`). The `WHERE` clause preserves P-9: deletion frees the name. Plan WU-M3a-3 verbatim. |
| U4 | `ForumPermission @@unique([forumId, userId])` | FR-8/P-8: one permission per user per forum; a new grant is an upsert, never a second row (`legacy/lib/models/forum/index.js:156-176` did it by array mutation). |
| U5 | `Tag.slug UNIQUE` | P-12/AD-5 (`legacy/lib/models/tag.js:25`): same-slug tags can never coexist. The *silent* duplicate success (COR-17) is fixed in the API layer by surfacing the conflict. |
| U6 | `Topic @@unique([forumId, slug])` | Slug-addressed URLs (plan §2.4 "Identifiers") without cross-forum collisions; J9 targets rows by slug. |
| U7 | `Topic @@unique([id, votingMethod])` — FK-support | Enables the composite FK `Vote(topicId, method) → Topic(id, votingMethod)`: **a vote's method can never disagree with its topic's method**, which is what lets per-method CHECKs (C2–C5) live on the Vote table at all. This is the structural half of DI-3. |
| U8 | `Clause @@unique([topicId, position])` | Plan §2.4 row 2 — clause order is stored order, not per-read sort (TL-9). |
| U9/U10 | `TopicOption @@unique([topicId, position])`, `@@unique([topicId, label])` | Option sets are well-ordered and duplicate-free (TL-4, VO-7/VO-12). |
| U11 | `TopicOption @@unique([topicId, id])` — FK-support | Enables `Vote(topicId, pollOptionId) → TopicOption(topicId, id)`: **a poll ballot can only reference an option of its own topic** — the off-option poll ballot of DI-3 becomes an FK violation. |
| U12 | `TopicAttrValue @@unique([topicId, attrId])` | One value per attr per topic (CSV round-trip, AD-6). |
| U13 | `ForumTopicAttr @@unique([forumId, name])` | Attr names are column headers in the CSV (AD-6) — duplicates would be ambiguous columns. |
| U14 | `CREATE UNIQUE INDEX vote_one_per_voter ON "Vote" (topicId, voterPseudonym) WHERE status = 'active'` — **raw SQL** (partial) | **DI-1 and DI-2.** One `(topic, voter)` active vote at all times (P-3, legacy index `legacy/lib/models/vote.js:16-17`). Re-vote = atomic upsert **on this constraint** — the read-recount-write window (`legacy/lib/api-v2/db-api/topics/utils.js:26`) that produced spurious `ALREADY_VOTED` (DI-1) and the permanent cause-withdrawal lockout (DI-2) has no schema to live in: there is no denormalized `votedBy`/`count` gate, only the row. Partial (`WHERE status='active'`) so §9's option C can retain withdrawn rows without blocking a re-consented voter. |
| U15/U16 | `VoteRanking @@unique([voteId, rank])`, `@@unique([voteId, optionId])` | DI-3 hierarchy half: no duplicate ranks, no option ranked twice. With T4, ballots are full permutations. |
| U17 | `TallyCounter @@unique([topicId, key])` | One counter row per bucket/option/choice (§7). |
| U18 | `Comment @@unique([id, authorId])` — FK-support | Enables the composite FK in C6 that makes self-voting structurally impossible (CM-5). |
| U19 | `CommentVote @@unique([commentId, userId])` | CM-5 replace-semantics (unvote-then-push at `legacy/lib/models/comment.js:142-148` becomes an upsert); DI-6's unbounded array is gone by construction. |
| U20 | `CommentFlag @@unique([commentId, userId])` | CM-6: one flag per user, withdrawable — same mechanism. |
| U21 | `Whitelist.email UNIQUE` | Trivial hygiene. |
| U22 | `AuditEntry.seq` (identity PK) + `AuditEntry.hash UNIQUE` | Chain ordering + no two entries share a hash (§8.3). |
| U23 | `CREATE UNIQUE INDEX consent_one_active ON "ConsentRecord" (userId, purpose) WHERE "withdrawnAt" IS NULL` — **raw SQL** (partial) | At most one live consent per purpose per user; grant/withdraw history stays append-friendly. |
| U24 | `ConsultationKeyRef.topicId UNIQUE` | One key reference per consultation (§8.2). |
| U25 | `Session.tokenHash UNIQUE` | Session fixation hygiene. |

### 4.2 CHECK constraints (C-rows)

| # | CHECK | Kills / enforces |
|---|---|---|
| C1 | On Topic: `CHECK (lifecycle = 'open' OR (outcomeDeclaration IS NOT NULL AND btrim(outcomeDeclaration) <> ''))` **and** `CHECK (closingAt IS NULL OR (outcomeDeclaration IS NOT NULL AND btrim(outcomeDeclaration) <> ''))` — **raw SQL** | **C3/N11**: a close attempt without a declaration is refused *by the database* (plan WU-M3a-4). The second clause resolves the TL-8 tension: legacy "closed" is **derived** from `closingAt` passing (`legacy/lib/models/topic.js:184-190`), with no human at the moment of transition — so the declaration must exist **before `closingAt` may be set**, not at the instant of closing. This is a deliberate reading of open Q-8 (declaration editable beforehand vs on the closing form): requiring it at `closingAt`-set time is the only variant a constraint can enforce under derived closing. Flagged in §15 for the Q-8 owner decision; if Q-8 lands on "closing form only", the second clause is simply how the form is forced to deliver it. |
| C2 | On Vote: `CHECK (method <> 'vote' OR (choice IS NOT NULL AND sliderValue IS NULL AND pollOptionId IS NULL))` | DI-3 (method `vote`): payload is exactly one `vote_choice`. |
| C3 | On Vote: `CHECK (method <> 'slider' OR (sliderValue IS NOT NULL AND sliderValue BETWEEN -100 AND 100 AND sliderValue % 25 = 0 AND choice IS NULL AND pollOptionId IS NULL))` | DI-3 (slider): the `'42'` off-bucket value that inflated `action.count` and deflated every percentage is a constraint violation. Nine buckets exactly (VO-10). |
| C4 | On Vote: `CHECK (method <> 'cause' OR (choice IS NULL AND sliderValue IS NULL AND pollOptionId IS NULL))` | Cause carries no payload — endorsement is the row (VO-8, P-4). Nothing off-value is storable because there is no value. |
| C5 | On Vote: `CHECK (method <> 'poll' OR (pollOptionId IS NOT NULL AND choice IS NULL AND sliderValue IS NULL))` + composite FK via U11; `CHECK (method <> 'hierarchy' OR (choice IS NULL AND sliderValue IS NULL AND pollOptionId IS NULL))` (payload in `VoteRanking`) | DI-3 (poll + hierarchy halves). |
| C6 | On CommentVote/CommentFlag: `FOREIGN KEY (commentId, commentAuthorId) REFERENCES Comment(id, authorId)` (via U18) + `CHECK (userId <> commentAuthorId)` | **CM-5/CM-6 self-vote and self-flag become structurally impossible** — legacy refused them in code (`legacy/lib/api-v2/db-api/comments/index.js:97-121,372-379`); here the row cannot exist. (COR-9's wrong HTTP status is an API concern that now can't even arise from a race.) Note: `Comment.authorId` is nullable after erasure (§5); the composite FK uses `MATCH SIMPLE` semantics so reaction rows on anonymized comments remain valid, and new votes on them are permitted — acceptable, since the self-vote ban protects a living author. |
| C7 | On Vote: `CHECK (status <> 'active' OR voterPseudonym IS NOT NULL)` and `CHECK (status <> 'active' OR commitmentSalt IS NOT NULL)` | §9: an active vote is always attributable-via-pseudonym and always commitment-openable; only non-active rows may be severed. |
| C8 | On Forum: `CHECK (name ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$')` and `CHECK (name <> ALL (ARRAY['admin','dashboard','forum','forums','login','logout','mine','profiles','register','settings','signin','signout','signup','status','topic','topics','user','users']))` — **raw SQL** | FR-4 format: legacy's `/^([a-zA-Z0-9]{1,2}|[a-zA-Z0-9][a-zA-Z0-9-]{1,78}[a-zA-Z0-9])$/i` (`legacy/lib/regexps/index.js:14-17`) accepts the same string set as this CHECK once input is lowercased, which storage already guarantees (`legacy/lib/models/forum/index.js:39` lowercases; the new API normalizes likewise) — 1–80 chars, alphanumeric or `-`, no edge hyphens. Reserved names verbatim from `legacy/lib/models/forum/reserved-names.js:5-24`. The friendly *naming* of the error (COR-13) stays an API concern; the constraint is the backstop. |
| C9 | On Forum: `CHECK (char_length(summary) <= 300)`; `CHECK ("deletedAt" IS NOT NULL OR "ownerId" IS NOT NULL)` | First: COR-12 — 300 **inclusive**, honouring the UI contract. Second: a *live* forum always has an owner, while erasure may orphan a *deleted* one (§5 F3). |
| C10 | On Comment: `CHECK (btrim(text) <> '' AND char_length(text) <= 4096)` | CM-3 (`legacy/lib/models/comment.js:42-53`). Line-break collapsing (3+ → 2) is write-normalization in the API, recorded here so no one "fixes" it into the DB. |
| C11 | On TallyCounter: `CHECK (count >= 0)` | Tally can never go negative even under a bugged decrement (§7). |

### 4.3 Constraint triggers (T-rows) — cross-row/cross-table rules a CHECK cannot express

| # | Trigger | Enforces |
|---|---|---|
| T1 | `audit_entry_immutable`: `BEFORE UPDATE OR DELETE ON "AuditEntry" … RAISE` + `REVOKE UPDATE, DELETE ON "AuditEntry" FROM app_runtime, app_readonly` | D3 append-only (plan WU-M3a-9). Belt (trigger) and braces (grant). |
| T2 | `forum_permission_not_owner`: `BEFORE INSERT OR UPDATE ON "ForumPermission"` — reject when `userId = (SELECT ownerId FROM "Forum" WHERE id = NEW.forumId)` | FR-8's `FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE` (`legacy/lib/models/forum/index.js:157-162`), cross-table so not a CHECK. |
| T3 | `comment_depth_one`: `BEFORE INSERT OR UPDATE ON "Comment"` — reject when `NEW.parentId` refers to a row whose own `parentId IS NOT NULL` | CM-4: threading is exactly one level (`legacy/lib/models/comment.js:35-40`). A reply can never have children. |
| T4 | `vote_ranking_permutation`: `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED` on `VoteRanking` — at commit, for each touched `voteId`, assert the set of `optionId`s equals the topic's full `TopicOption` set and ranks are exactly `1..n` | DI-3 hierarchy: a ballot is a **full permutation** (VO-12); partial ballots become commit failures, not skewed `countByPosition` inputs. Deferred, because the rows arrive one-by-one inside the vote transaction. |
| T5 | `audit_entry_chain`: `BEFORE INSERT ON "AuditEntry"` — assert `NEW.prevHash` = the `hash` of the current maximum `seq` (advisory-locked), recompute and assert `NEW.hash` | §8.3 — the chain link is verified *in the database*, so even a buggy writer cannot fork or skip. |
| T6 | `topic_method_frozen`: `BEFORE UPDATE ON "Topic"` — reject changes to `votingMethod` when an active `Vote` for the topic exists; `BEFORE UPDATE OR DELETE ON "TopicOption"` — reject when the topic has any vote | TL-3 (method/options frozen once voting starts, `legacy/lib/api-v2/middlewares/topics.js:100-108` per spec) becomes structural instead of a middleware courtesy; also protects VoteRanking/pollOption referential meaning. CR-2's hanging edit-guard is thereby unreachable, though its user-visible fix (a real validation error) stays in the API. |

Prisma cannot express partial indexes, CHECKs of this kind, constraint triggers, `citext`, or
composite FKs onto non-PK uniques — all of the above are **raw-SQL migrations** (§13).

### 4.4 Plain (non-unique) indexes for the queries the journeys actually make

| Index | Query it serves |
|---|---|
| `Topic (forumId, publishedAt)` | Public listing = published-only per forum (TL-7); admin draft-inclusive list (AD-3). Plan §2.4 row 4 — legacy had **no** forum index at all (`legacy/lib/models/topic.js:90-93`). |
| `Topic (closingAt)` | Closed-state derivation and closing sweeps (TL-8). |
| `Topic (tagId)` | Tag filtering (J9; legacy `topic.js:92`). |
| `Comment (topicId, createdAt)` and `Comment (topicId)` covering score joins | CM-1 list sorts (`-score` default, `createdAt` alternates). **COR-20 kill**: legacy indexed `(reference, context)` and never even set `topicId` (`legacy/lib/models/comment.js:80,88-90`); here `topicId` is the one indexed FK. |
| `Comment (parentId)` | Reply expansion (CM-4). |
| `CommentVote (commentId, value)` | Score aggregation (§7.3). |
| `Token (userId, scope)`; `Token (expiresAt)` | P-5 delete-then-create per scope; the expiry cleanup job (SEC-3 intended behaviour). |
| `Vote (topicId)` (prefix of U14) | Tally recomputation per topic (§7.1). |
| `Notification (userId, createdAt)` | Notification list. |
| `VerificationEvent (userId)`; `Session (userId)`; `ForumPermission (userId)` | Erasure transaction fan-out (§5) and settings surfaces. |

---

## 5. `ON DELETE` map — every FK, with its GDPR justification

Erasure (Art. 17; decisions E2/E3; plan WU-M6-14) is a **transaction with declared semantics**:
*identity dies; the pseudonymous aggregates and the audit chain survive.* The FK graph is designed
so that `DELETE FROM "User" WHERE id = $1` (plus the vote-side steps in §9) completes without ever
touching the audit table, and every survival/deletion choice below is deliberate.

| # | FK | ON DELETE | Justification |
|---|---|---|---|
| F1 | `Session.userId → User`, `Token.userId → User` | **CASCADE** | Pure identity artifacts; keeping any of them after erasure would be a live credential for a dead identity. |
| F2 | `VerificationEvent.userId → User` | **CASCADE** | Verification evidence (email/phone/eID trail) is identity data of the strongest kind; minimization demands it dies with the account. Aggregate stats never read this table. |
| F3 | `Forum.ownerId → User` | **SET NULL** (nullable) + CHECK C9b | A forum is a community artifact that must outlive its founder's account, but a **live** forum without an owner would be unadministrable (FR-10 owner-only delete; P-17 no transfer exists). CHECK C9b (`deletedAt IS NOT NULL OR ownerId IS NOT NULL`) forces the erasure transaction to first soft-delete the user's live forums (or the flow refuses until the user does) — the DB makes silent orphaning impossible; which of refuse-vs-auto-delete the flow picks is WU-M6-14's UX call (§15). |
| F4 | `ForumPermission.userId → User` (and `.forumId → Forum` CASCADE) | **CASCADE** | A role grant is a pure identity↔forum edge; meaningless after erasure. |
| F5 | `ConsentRecord.userId → User` | **SET NULL** (nullable) | Accountability (Art. 7(1): demonstrate consent existed) vs erasure. Severing the FK keeps the *timeline* (purpose, version, grantedAt, withdrawnAt) as anonymous accountability data while the identity dies. The chained `consent_granted`/`consent_withdrawn` audit events (§8.3) carry only commitments, so this row is the only consent trace and it is identity-free after erasure. |
| F6 | `Topic.authorId → User` | **SET NULL** (nullable) | Published deliberation content is the community's record (P-10: closing hides nothing); attribution is the personal data. Erasure anonymizes attribution ("utilizator șters"), the topic survives. |
| F7 | `Topic.forumId → Forum` | **RESTRICT** | Forum deletion is **soft** (P-9, `legacy/lib/models/forum/index.js:100-103`); a hard forum purge must be a deliberate future transaction that consciously handles topics, votes and audit references — RESTRICT makes an accidental hard cascade impossible. |
| F8 | `Topic.tagId → Tag` | **RESTRICT** | No tag delete exists for anyone (P-16, `legacy/lib/api/tag/index.js:21-81` per spec); RESTRICT backs the invariant so even a rogue admin query cannot orphan topics. If Q-11 ever adds tag deletion, the product must decide what happens to carrying topics first — exactly what RESTRICT forces. |
| F9 | `Clause.topicId`, `TopicLink.topicId`, `TopicOption.topicId`, `TopicAttrValue.topicId → Topic`; `TopicAttrValue.attrId → ForumTopicAttr`; `ForumTopicAttr.forumId → Forum`; `ForumTopicAttrOption.attrId → ForumTopicAttr` | **CASCADE** | Pure content children with no independent identity or personal data; they live and die with their parent. (Topic delete is itself soft in normal operation, `legacy/lib/models/topic.js:81`; the cascade exists for a deliberate hard purge only.) |
| F10 | `Vote.topicId → Topic` | **RESTRICT** | Votes are Art. 9 records under an audit substrate (E1, D3). A topic hard-delete with recorded votes must be a deliberate, chained operation (an `erasure_executed`/`tally_corrected` event), never a cascade side-effect. |
| F11 | `Vote → User` | **does not exist** | The core of G-7 (§8.1): there is no FK — no join path — from a vote row to an identity. Erasure of votes is the OD-1 machinery (§9), driven through the pseudonym, not the FK graph. |
| F12 | `VoteRanking.voteId → Vote` | **CASCADE** | A ballot's rank rows are the vote's payload; they follow it (including OD-1 option A deletion). |
| F13 | `VoteRanking (topicId, optionId) → TopicOption` | **RESTRICT** | An option with recorded rankings can never vanish (TL-3, T6 — belt and braces). |
| F14 | `TallyCounter.topicId → Topic` | **CASCADE** | Derived data; recomputable from votes (§7 invariant). |
| F15 | `Comment.topicId → Topic` | **CASCADE** | Comments are topic-bound discussion content; a deliberate topic hard-purge removes the thread. GDPR: comment *authorship* is handled by F16, not by this edge. |
| F16 | `Comment.authorId → User` | **SET NULL** (nullable) | Same reasoning as F6: the discussion thread survives (other people's replies depend on it — CM-9's `HAS_REPLIES` shows even legacy protected thread integrity); the identity edge dies. **Whether erasure additionally deletes/redacts the *text* of authored comments is a genuinely open product/DPIA question** — the schema supports both (delete rows vs keep anonymized); flagged in §15. |
| F17 | `Comment.parentId → Comment` | **CASCADE** | Legacy delete is hard and takes embedded replies with it (CM-9); replies die with their root. |
| F18 | `CommentVote.userId → User`, `CommentFlag.userId → User` | **CASCADE** | An up/down/flag is the user's own expressed reaction — their personal data, gone on erasure. Because `score` is **derived** (§7.3), the cascade cannot cause DI-5-style drift: the score is recomputed truth by definition. |
| F19 | `CommentVote.commentId → Comment`, `CommentFlag.commentId → Comment` | **CASCADE** | Reactions die with their target. |
| F20 | `Notification.userId → User` | **CASCADE**; `relatedUserId → User` **SET NULL**; `commentId/topicId` **CASCADE** | A notification inbox is the recipient's personal data (dies with them); the *actor* reference is attribution (anonymized); target edges are content-bound. |
| F21 | `AuditEntry` | **no FKs at all** | Append-only tamper evidence must be immune to every cascade: a CASCADE would let erasure rewrite history (chain break), a RESTRICT would let history block erasure. Payloads reference entities by bare uuid values + commitments (§8.3); the chain never blocks and is never mutated. This is what makes "the audit chain survives" (E2, WU-M6-14) true *by construction*. |
| F22 | `ConsultationKeyRef.topicId → Topic` | **CASCADE** | A pointer, not key material; follows its consultation. |
| F23 | `TopicAttrValue`, others above | — | (covered by F9). |

**The erasure transaction, in FK terms:** soft-delete live owned forums (or refuse — C9b decides
nothing silently) → per-consultation vote handling per OD-1 (§9) → `DELETE FROM "User"` → cascades
fire F1/F2/F4/F18/F20, SET NULLs fire F3/F5/F6/F16 → append one `erasure_executed` audit event
(commitment only). A test proves both halves: the identity is gone; the aggregates and the chain
verify (plan WU-M6-14).

---

## 6. The `jsonb` allow-list

Plan §2.4: "`jsonb` is a last resort." Anything **not** in this table is forbidden from being
jsonb; a PR adding one is a design change to this document first.

| Field | Why it cannot be relational | Boundary discipline |
|---|---|---|
| `AuditEntry.payload` | The substrate records heterogeneous event kinds (E17) whose shapes will grow (tally publications, corrections, erasures). A table per kind would freeze the chain format in DDL and make hash canonicalization span joins. The payload is **written once, never row-queried, never updated** — the one workload jsonb is actually for. | Canonical JSON (sorted keys, no floats where exactness matters) — the hash input must be byte-stable (§8.3); zod-parsed per `kind` at write; carries commitments/uuids, **never** raw identity and never a raw choice+pseudonym pair (§8.3). |
| `Token.meta` | Legacy stores request forensics — "user's ip, user-agent, etc" (`legacy/lib/api/signup/lib/signup.js:165-169`, passed through `legacy/lib/db-api/token.js:45-64,81-93`) — a genuinely open shape named by plan §2.4 as the canonical allowed example. Anti-abuse basis is E2's legitimate-interest leg. | zod-parsed at the boundary; retention bounded by the token's own `expiresAt` + cleanup job; OD-2 governs any longer retention. |

Explicitly **rejected** from jsonb, with their relational fate: `Topic.attrs` → `TopicAttrValue`
(M17); `Topic.extra` → dropped (M17); `comment.reference` → the typed `topicId` FK (M22);
`User.profiles`/`User.extra` → dropped (M3/M4); `Forum.extra`/`initialTags` → dropped (M12);
`Topic.action.results` → dropped in favour of `TopicOption` + derived tallies (M14, DI-7).

---

## 7. Tally integrity — how counts and results are produced

Legacy denormalizes `action.results`/`action.count` onto the topic and recomputes them at the end
of a **non-transactional** read-recount-write (VO-1, `legacy/lib/api-v2/db-api/topics/index.js:333-338`).
That one design produced all three tally defects: DI-1 (stale count → spurious ALREADY_VOTED),
DI-2 (stale count → permanent withdrawal lockout), DI-7 (polymorphic results bag whose shape
depends on vote history).

**The replacement, stated as an invariant:**

> **The `Vote` table is the sole source of truth. For every topic and every tally key,**
> `TallyCounter.count = SELECT count(*) FROM "Vote" WHERE topicId = … AND status = 'active' AND <key matches>`
> **at every transaction boundary.**

1. **Writes are transactional.** Cast/replace/withdraw runs in ONE serializable-enough transaction:
   upsert/delete the `Vote` row against U14, adjust the affected `TallyCounter` rows *in the same
   transaction* (plan WU-M3a-5: "Tally written in the same transaction as the vote"), append the
   audit event (§8.3). There is no window in which a reader can see a count that disagrees with the
   rows — DI-1/DI-2's root (the stale denormalized count consulted as a *gate*) has no equivalent:
   **no code path ever reads a counter to decide whether a vote exists**; only U14 decides.
2. **Keys per method:** `vote` → the three `vote_choice` values; `poll` → option uuids; `cause` →
   the single key `support` (VO-8's participants-box count, VO-9); `slider` → the nine bucket
   values (the distribution — VO-11: never a mean). `hierarchy` → **no counters**: the positional
   consensus (VO-13) is computed on read from `VoteRanking` by the tally feature with a
   deterministic, documented final tie-break (CR-1/COR-3 are application-layer obligations —
   §14 honestly lists them as not schema-fixable; the schema's contribution is that ballots are
   guaranteed full permutations, removing DI-3's garbage inputs from the tally function).
3. **Reconciliation test** (plan WU-M3a-6's discipline generalized): a test recomputes every
   counter from raw votes over the fixture corpus and asserts equality — the invariant is proven,
   not assumed. If measurement later shows counters are unnecessary, they collapse into a view
   without schema change to `Vote`.
4. **DI-7 cannot recur:** the option set (`TopicOption`) is immutable once voting starts (T6),
   counters are single-shape rows, and ranking output is computed, never stored over the seed.

**7.3 Comment score.** `comment_score` is a **view** (`score = count(positive) − count(negative)`
from `CommentVote`), which kills DI-5 *by definition* — a derived number cannot drift, and the
CM-1 `-score` sort reads the view (indexes in §4.4). WU-M3a-6 retains the option to materialize a
transactional counter **only** on measured read-shape need, with the plan-mandated reconciliation
test proving view and counter agree. Recommendation recorded here: start with the view; do not
build the counter speculatively.

---

## 8. The Art. 9 vote-record model (G-7) and the audit substrate (D3)

### 8.1 Payload/identity separation

- The `Vote` row (M20) carries **no `userId`** — F11: no FK, no join path from ballot to identity.
- `voterPseudonym = HMAC-SHA-256(K_c, userId)` where `K_c` is a **per-consultation** key. The same
  person gets *different* pseudonyms in different consultations, so cross-consultation profiling
  by join is impossible even with full table access.
- The server derives the pseudonym inside the vote/read-own transaction (it knows the session's
  `userId` and the consultation), which is how "the API exposes only the requester's OWN `voted`"
  (VO-5/P-14) works without any identity column: recompute, look up by U14.

### 8.2 Pseudonym key custody — interface only (OD-5 is OPEN)

This document specifies the **interface** and refuses to invent custody:

```
PseudonymService.derive(consultationId, userId) → 32 bytes   // HMAC-SHA-256(K_c, userId)
```

- `ConsultationKeyRef(topicId UNIQUE, keyRef)` stores a *reference* (env var name / KMS URI),
  **never key material** — so any custody decision (env, KMS, HSM, split-key) is a config change,
  not a migration.
- **Rotation warning fed to OD-5:** rotating `K_c` mid-consultation orphans every stored pseudonym —
  own-vote reads, re-votes and OD-1 withdrawal all break, because derivation no longer matches
  storage. Rotation therefore requires either a re-mapping pass (a linkability event that must
  itself be chained) or a per-consultation freeze. What rotation does to published tallies: nothing
  — tallies are aggregates (§7) — but the *audit commitments* (§8.3) remain openable only with the
  stored salts, unaffected by key rotation. Custody, readers, and rotation policy = **OD-5, owner
  decision, blocking for WU-M6-7, not for this schema.**

### 8.3 Append-only hash-chained audit substrate (D3, plan WU-M3a-9)

Table shape:

```
AuditEntry (
  seq        bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       audit_event_kind NOT NULL,
  payload    jsonb   NOT NULL,           -- §6 discipline: commitments + uuids only
  prevHash   bytea   NOT NULL,           -- hash of seq-1; 32 zero bytes at genesis
  hash       bytea   NOT NULL UNIQUE,    -- sha256(seq ‖ kind ‖ canonical(payload) ‖ createdAt ‖ prevHash)
  createdAt  timestamptz NOT NULL DEFAULT now()
)
```

- **What is chained:** every vote-affecting event (`vote_cast`, `vote_replaced`, `vote_withdrawn`),
  consent transitions, tally publications/corrections, erasures (E17). For vote events the payload
  contains a **salted commitment**, not the data: `commit = sha256(salt128 ‖ voterPseudonym ‖ canonicalBallot)`
  with the random per-event `salt128` stored **outside the chain** — on the `Vote` row
  (`commitmentSalt`, C7). The chain therefore *proves* an event happened without *containing* the
  opinion or the pseudonym. This is the single design move that lets OD-1's deletion option
  coexist with D3 (§9).
- **Enforcement:** T1 (UPDATE/DELETE rejected + revoked), T5 (`prevHash`/`hash` verified in a
  `BEFORE INSERT` trigger under an advisory lock — a buggy or malicious writer cannot fork, skip
  or splice).
- **What "tamper-evident" concretely means here:** at consultation close, the head `hash` is
  published (WU-M6-8: public verification endpoint + UI affordance). From then on, *any*
  modification, deletion, insertion or reordering of entries up to that head is detectable by any
  third party re-running the hash walk — including by the operator's future self. It does **not**
  mean tamper-*proof*: a superuser can rewrite the table, but cannot rewrite the copies of the
  published head. Trust anchor = publication, verification = recomputation; that is the honest
  consultation-grade claim of G-7 ("consultative, not a binding secret ballot"), not a ballot
  system.
- **Aggregate-only public reads:** no API scope ever exposes a `Vote` row or a pseudonym; public
  read surfaces are `TallyCounter`, computed rankings, and `AuditEntry` (which by construction
  contains only commitments). Legacy's weaker analogue (P-14: only own `voted`, aggregates
  otherwise, no voter list in any scope — `legacy/lib/api-v2/db-api/topics/scopes.js:8-47,75-83`)
  is preserved and strengthened by RLS (§10).

---

## 9. OD-1 — consent withdrawal for votes: keep all three options implementable

**OD-1 is OPEN. This section does not decide it.** It designs the schema so that *delete*,
*anonymize* and *retain-but-exclude* are each implementable later **without a destructive
migration**, states precisely what each does to the chain and to published tallies, and ends with
a recommendation for the owner.

**The mechanism already in the schema** (nothing below requires new DDL at decision time):

- `Vote.status vote_status` (`active` | `withdrawn`) — E15;
- U14 unique is **partial** (`WHERE status='active'`) — retained rows never block anything;
- `voterPseudonym` and `commitmentSalt` are nullable, with C7 guaranteeing active rows are whole;
- audit vote-events carry **salted commitments only** (§8.3) — the chain never contains the thing
  erasure must destroy;
- tallies count `status='active'` rows only (§7 invariant) — exclusion is the *default* tally
  semantics, not a bolt-on.

| Option | Mechanics at withdrawal | Effect on the hash chain | Effect on published tallies | Trade-offs |
|---|---|---|---|---|
| **A — delete** | In one transaction: `DELETE` the `Vote` row (cascades `VoteRanking`, F12) **including `commitmentSalt`**, decrement counters, append `vote_withdrawn` (commitment-only). | **Chain intact.** No entry is touched; hashes verify unchanged. The prior `vote_cast` commitment becomes permanently unopenable — without the 128-bit salt it is not brute-forceable even over a tiny choice space. This is crypto-shredding: the chain says "a vote happened and was withdrawn", nothing more. | Open topic: live tally shrinks (correct). Closed/published topic: the published aggregate is an **anonymous statistic** — Art. 17 reaches the personal data (the row), not the number; the snapshot stands as history, with a chained `tally_corrected` event only if the operator chooses to republish. | Cleanest erasure (E2/E3): nothing personal remains. Cost: the platform can no longer *re-derive* a closed tally from rows (recount ≠ snapshot after withdrawals) — the audit chain, not recount, is the integrity story for closed consultations. |
| **B — anonymize** | Set `voterPseudonym = NULL`, delete `commitmentSalt`, keep the payload row `active` (or a new status — additive enum value). | Chain intact (never touched). Commitment unopenable, as in A. | **None** — the opinion still counts, unattributed. | Tally stability is maximal. But with `K_c` alive, "pseudonymous" data was linkable until this moment, and the *retained opinion* was collected under a consent that is now withdrawn — processing it further leans on a basis the DPIA would have to construct (Art. 9 has no "anonymized enough" comfort here; whether an unlinkable ballot is still personal data is exactly the argument counsel must own — OD-8). Re-vote after re-consent needs care: the NULL-pseudonym row still counts, so a re-vote double-counts unless the flow also flips it out — semantics get muddy. |
| **C — retain-but-exclude** | Set `status='withdrawn'`, keep pseudonym+salt (or shred salt too — sub-choice), decrement counters, append `vote_withdrawn`. | Chain intact; additionally the *row-level* history remains internally reconstructible (strongest auditability). | Same as A: active-only tallies shrink; closed snapshots stand. | Strongest audit posture, **weakest erasure**: an Art. 9 opinion, still linkable to the person while `K_c` exists, is retained against an explicit withdrawal — the hardest option to defend in the DPIA (E3). Partial U14 already permits a later re-consented re-vote. |

**What deleting a row does NOT do in this design:** break the chain. That fear is real only if
vote rows or raw ballots are chained; §8.3's commitment design exists precisely so OD-1 stays a
*policy* choice, not a cryptographic hostage.

**Recommendation to the owner (not a decision):** choose **A — delete**, with closed-consultation
published tallies standing as anonymous historical aggregates and every post-publication change
surfaced as a chained `tally_corrected` event. A is the only option whose erasure story needs no
legal construction (the personal data is *gone*; the chain survives via crypto-shredded
commitments), it matches what J10 already promises ("identity dies, the pseudonymous aggregates
and the audit chain survive"), and its single cost — closed tallies become snapshots rather than
recountable sums — is honest for a consultative platform (G-7's label says exactly this). B and C
both retain an Art. 9 opinion past consent withdrawal and push the burden onto the DPIA/counsel
(E3/OD-8); C additionally keeps linkability alive. Fixing OD-1 = one line in the withdrawal flow;
the schema is already whichever answer the owner picks.

---

## 10. Row-level security (OD-4 — OPEN; plan WU-M3a-8, Q14)

**Approach put forward** (the decision itself is OD-4's): application-layer authorization remains
the primary gate; RLS is **defence-in-depth that must be proven to bite** — an untested policy is
treated as absent (plan Q14 verbatim).

- **Protected tables:** `Vote`, `VoteRanking`, `ConsentRecord`, `VerificationEvent`,
  `ConsultationKeyRef`, `Token`, `Session` (Art. 9 data and identity secrets).
  `ENABLE ROW LEVEL SECURITY` + **`FORCE`** on each.
- **Roles (raw-SQL migration):** `app_migrator` (DDL owner; runs migrations), `app_runtime`
  (the server; owns nothing, `NOBYPASSRLS`, no DDL), `app_readonly` (ops/exports; aggregate
  views only). The runtime never being the table owner is what makes `FORCE` meaningful.
- **Prisma mechanics** (Prisma has no native RLS): every protected-table access runs inside an
  **interactive transaction** that first executes
  `SELECT set_config('app.current_user_id', $1, true)` (the parameterizable form of
  `SET LOCAL`), then the Prisma queries; policies reference
  `current_setting('app.current_user_id', true)`. Raw-unsafe variants are lint-banned (WU-M2-2),
  so the session variable cannot be forged by string concatenation.
- **Sketch policies:** on `Vote`: no `SELECT` for `app_runtime` **except** through the
  own-vote path (pseudonym equality against a value derived in the transaction) — public tallies
  read `TallyCounter`, never rows; on `ConsentRecord`/`VerificationEvent`/`Session`/`Token`:
  `userId = current_setting(...)`; on `ConsultationKeyRef`: no runtime read at all if OD-5 lands
  the key outside the DB (the reference is then resolved by deployment config).
- **A policy is "real" only when tests prove, against a live Postgres:**
  1. `app_runtime` **without** the session variable reads **zero** rows from every protected table;
  2. with user A's variable set, a query for user B's rows returns empty (cross-user block — the
     plan's Q14 test);
  3. `FORCE` holds: the policy applies even though the connection is the app's own (non-owner);
  4. `pg_roles` asserts `rolbypassrls = false` and non-ownership for `app_runtime`;
  5. a migration-drift check confirms the policies exist in the target DB (an RLS migration that
     silently failed is an absent policy).
  Until all five run green in CI, the design posture is "RLS is absent" and the app layer is the
  only gate — stated, not assumed.

---

## 11. Verification ladder (G-10) as data

- **Stages:** enum E12 (`stage1_email`, `stage2_phone`, `stage3_eid`), ordered.
- **Where a user's stage lives:** `User.verificationStage verification_stage NOT NULL DEFAULT
  'stage1_email'` — the current stage, meaningful only alongside `emailValidated` (AU-2: an
  unvalidated account is stage-nothing; the app treats `emailValidated=false` as below stage 1).
  The *evidence trail* lives in `VerificationEvent` (M29) — one row per attained stage, so the
  denormalized column is auditable against history (same reconciliation discipline as §7).
- **Per-consultation requirement:** `Topic.requiredStageToVote` (M19), default `stage2_phone`
  (G-10: phone is required to vote; stage 3 reserved for high-stakes consultations, configurable
  per consultation). This resolves the data-modelling half of open Q-17; fixture values are §12's
  business.
- **"May comment but not vote", relationally:** commenting requires only a validated session
  (CM-2 + G-10 stage 1) — `Comment.authorId` is an ordinary FK and no stage gate exists on the
  table. Voting is gated **inside the vote-write transaction** (the only place that knows
  `userId`, since `Vote` deliberately has no identity column — F11): the transaction loads
  `User.verificationStage`, compares against `Topic.requiredStageToVote` by enum order, and
  refuses before any write. It cannot be a foreign key or CHECK precisely *because* G-7 severed
  the identity edge — this is a documented, tested app-layer gate (the J5–J7 stage-1 refusal
  tests, CHARACTERIZATION §5 G-10 row), with the RLS session variable (§10) as the second wall.
  Whether comment up/downvotes join the stage-2 tier is open Q-10 — schema-indifferent either way
  (the gate is app-layer on `CommentVote` too, if Q-10 lands that way).

---

## 12. What the seed (WU-M3a-10) must be able to produce — contract cross-check

Checked row-by-row against `docs/develop/fixtures.md` (20.08.2026 revision):

| Fixture | Expressible? | Notes |
|---|---|---|
| Forum `agora-fixture`, public | ✔ | M9; `name` passes C8. |
| Six users, role × stage axes | ✔ | Roles via `ForumPermission` (`dan-owner` via `Forum.ownerId`, **not** a permission row — T2 would reject one, matching FR-1); stages via `User.verificationStage` + one `VerificationEvent` each. |
| Topics `t-vote/t-poll/t-cause/t-slider/t-hierarchy`, open | ✔ | `t-poll`/`t-hierarchy` carry their three named options as `TopicOption` rows (TL-4 mandatory-options rule holds at the API layer; the seed writes rows directly but must respect it). |
| `t-poll-closed`, non-tied | ✔ | Closed = `closingAt` in the past + `lifecycle='closed'`; votes by distinct pseudonyms across options; counters per §7. **But see gap G1.** |
| `t-cause-closed`, supporter ≠ elena | ✔ | One active cause `Vote` row by another fixture user's pseudonym. Gap G1 applies. |
| `t-slider-closed`, ≥3 buckets incl. neutral `0` | ✔ | Three `Vote` rows with `sliderValue ∈ {-50, 0, 25}` e.g.; C3 admits `0`. Gap G1 applies. |
| `t-hierarchy-closed`, elena's ballot + ≥2 differing, non-tied | ✔ | `Vote` + `VoteRanking` permutations; T4 is satisfied by full ballots. Gap G1 applies. |
| `t-closed-outcome` with outcome declaration | ✔ | `lifecycle='outcome_published'` (or `closed`) + `outcomeDeclaration` — C1 satisfied. |
| Tags `urbanism`, `transport` | ✔ | M25; `transport` referenced by no topic (its stated purpose). |
| Comment tree on `t-vote` (root A + 1 reply + up/downvote + flagged root B) | ✔ | `Comment` self-FK depth 1 (T3 admits it), `CommentVote`/`CommentFlag` rows; self-vote impossible by C6 — the fixture's distinct-author votes comply. |
| Seed idempotency, synthetic-only | ✔ | Truncate-and-reseed inside a transaction; no personal data anywhere. |

**Gaps the schema exposes in the contract (must go back to the contract, not be hacked around):**

- **G1 — closed fixtures lack outcome declarations.** CHECK C1 (C3/N11: a close attempt without a
  declaration is refused, enforced in the DB per plan WU-M3a-4) makes `t-poll-closed`,
  `t-cause-closed`, `t-slider-closed` and `t-hierarchy-closed` **unseedable as specified**:
  `docs/develop/fixtures.md` gives them state "closed" but no declaration text. The contract must
  add a declaration line per closed fixture (any honest sentence works). This is a fixture-contract
  gap, not a schema retreat — weakening C1 would reopen N11.
- **G2 — per-topic stage requirements unassigned** (CHARACTERIZATION §7 row 7 / Q-17): the schema
  now has `Topic.requiredStageToVote`; the contract must state each topic's value (proposed:
  `stage2_phone` everywhere, matching G-10's default) so J5/J6/J7's stage-1 refusal tests bind to
  seeded data.
- **G3 — display titles** (Q-21 / §7 row 8): `mediaTitle` is NOT NULL; the contract fixes slugs
  only. The seed will synthesize titles containing the slug unless the contract adds a title
  column — pre-existing gap, restated because the schema now forces *some* title to exist.
- **G4 — seed pseudonyms need a dev key:** recorded votes require `HMAC(K_c, userId)`; the seed
  must derive them via a dev-only `K_c` from env (never committed), which is OD-5-compatible
  (custody of a throwaway dev key is not custody policy).

---

## 13. Migration plan sketch

Order deviates from the WU-M3a-1 task brief's listed order (*identity, forums+permissions, topics,
votes+audit, comments, tags, notifications*) in exactly one place, and says so: **tags must land
with (or before) topics** because `Topic.tagId` is a NOT NULL FK (M13, TL-5) — a topics migration
without `Tag` cannot compile. The plan's own WU rows (WU-M3a-4 bundles "Topics, clauses, tags")
already agree with this order; the conflict is with the brief's list, not the plan.

| # | Migration | Adds | Raw SQL vs Prisma-generated |
|---|---|---|---|
| 0 | `..._extensions` | `CREATE EXTENSION IF NOT EXISTS citext;` (and `pgcrypto` if uuid/hash helpers need it — PG 16 has `sha256()` and `gen_random_uuid()` built in) | **raw** |
| 1 | `..._identity` (WU-M3a-2) | enums E1/E2/E12/E16; `User`, `Session`, `Token`, `VerificationEvent`, `ConsentRecord`, `Whitelist`; U1/U2/U21/U23/U25 | Prisma, **except** U23 partial unique + `citext` column types (raw) |
| 2 | `..._forums` (WU-M3a-3) | enums E3/E4/E13; `Forum`, `ForumPermission`, `ForumTopicAttr`, `ForumTopicAttrOption`; U3/U4/U13; C8/C9; T2 | Prisma models; U3 partial index, C8/C9 CHECKs, T2 trigger = **raw** |
| 3 | `..._topics` (WU-M3a-4; includes tags) | enums E5/E6/E7/E14; `Tag`, `Topic`, `Clause`, `TopicLink`, `TopicOption`, `TopicAttrValue`; U5–U13; C1; §4.4 indexes | Prisma; C1 CHECK + U7/U11 composite-unique FK targets = **raw** |
| 4 | `..._votes_audit` (WU-M3a-5 + WU-M3a-9) | enums E8/E15/E17; `Vote`, `VoteRanking`, `TallyCounter`, `ConsultationKeyRef`, `AuditEntry`; U14–U17/U22/U24; C2–C5/C7/C11; T1/T4/T5/T6 | Prisma models; **everything that matters is raw**: partial unique U14, all per-method CHECKs, composite FKs, append-only + chain triggers, permutation trigger, freeze trigger. Votes and audit land together deliberately — a vote table without its audit substrate would invite unchained writes. |
| 5 | `..._comments` (WU-M3a-6) | enums E9/E10; `Comment`, `CommentVote`, `CommentFlag`; U18–U20; C6/C10; T3; `comment_score` view | Prisma; composite FK + CHECK C6, depth trigger T3, view = **raw** |
| 6 | `..._notifications` (WU-M3a-7) | enum E11; `Notification`; F20 edges | Prisma throughout |
| 7 | `..._rls` (WU-M3a-8) | roles `app_migrator`/`app_runtime`/`app_readonly`; `ENABLE/FORCE ROW LEVEL SECURITY`; policies of §10; REVOKEs of T1 | **raw, entirely**; shipped with the five Q14 proof-tests or treated as absent |

Discipline (WU-M3a-11): forward-only; one migration per WU; never edit an applied migration;
expand→migrate→contract for anything destructive; `prisma migrate diff` drift check in CI. Every
constraint above ships with a test that proves it **fires** (plan M3a DoD: duplicate email
rejected, duplicate vote rejected, out-of-enum rejected, forum-name race rejected under concurrent
inserts, audit row immutable, RLS blocks a cross-user read).

---

## 14. Defect disposition — structural vs not (honesty section)

**Made structurally impossible by this schema** (constraint cited):
DI-1 (U14 + §7 no-gate-counter), DI-2 (U14; withdrawal = delete-if-exists on the row itself),
DI-3 (C2–C5, U7, U11, U15/U16, T4), DI-4 (U3), DI-5 (§7.3 derived score), DI-6 (M24 relations),
DI-7 (M14/T6 + computed tallies), COR-20 (M22 indexed NOT NULL `topicId`), COR-12 (C9 inclusive
limit), plan-§2.4 row 6 email dupes (U1), N11/C3 unclosed-without-declaration (C1), CM-5/CM-6
self-vote/self-flag (C6), FR-8/P-8 duplicate permissions (U4) and owner-with-role (T2), P-12
duplicate tags (U5), CM-4 deep threading (T3), TL-3 method/option mutation after votes (T6),
SEC-3's *missing field* (Token.expiresAt NOT NULL — the field cannot be omitted).

**Supported but NOT schema-enforceable — the schema provides the shape, M4+ must enforce and test:**
SEC-1/SEC-2 (scope is NOT NULL, but only the repository's `(tokenHash, scope, expiresAt)` query
contract prevents scope-blind lookups — a schema cannot dictate WHERE clauses), SEC-3's *refusal*
of expired tokens at use, SEC-5 (password minimum is checked before hashing — nothing rational to
CHECK on a hash), SEC-7 (draft visibility is a query predicate), SEC-8/D7 (the flag threshold is
derivable from `CommentFlag` counts — the queue and server-side veil are app features), CM-8/CM-9
(edit/delete authority rules), CR-1/COR-3 (tie-breaks live in the tally function; the schema only
guarantees clean permutation inputs), COR-11 (the single limit constant lives in `packages/shared`;
the DB CHECK mirrors it), COR-18 (slug-follows-rename policy), G-10 vote gating (§11 — app-layer by
G-7's own design), erasure orchestration (§5), OD-1 flow (§9), RLS effectiveness (§10 — real only
when the five tests pass).

**Out of schema reach entirely:** SEC-4, SEC-6, SEC-9, SEC-10, SEC-11, CR-2, COR-1/2/4–10,
COR-13–17, COR-19, COR-21–23, COPY-1–4, A11Y-1, I18N-1 — API/UI/process defects owned by their
journeys' activation WUs.

---

## 15. Open items requiring an owner decision (none invented, none silently picked)

| # | Item | Where it bites | Status |
|---|---|---|---|
| O1 | **OD-1** withdrawal semantics — recommendation in §9 (option A) | Withdrawal flow (WU-M6-14); schema already supports all three | **OPEN (OD-1)** |
| O2 | **OD-4** RLS-primary vs app-primary — §10 proposes app-primary + proven RLS | WU-M3a-8 / M4 | **OPEN (OD-4)** |
| O3 | **OD-5** pseudonym key custody + rotation — interface in §8.2 | WU-M6-7; dev seed uses a throwaway env key (§12 G4) | **OPEN (OD-5)** |
| O4 | Q-8 declaration timing: C1 requires the declaration whenever `closingAt` is set — the only constraint-enforceable reading under TL-8's derived closing | Topic close UX (WU-M6-2) | Flagged; C1 is the DB floor either way |
| O5 | Erasure of a forum owner: refuse-until-user-soft-deletes vs auto-soft-delete (C9b forces one of them, silently orphaning nothing) | WU-M6-14 | New, surfaced by F3 |
| O6 | Does account erasure delete authored **comment text**, or only attribution (F16)? Thread integrity vs completeness of erasure | WU-M6-14 / DPIA (E3) | New, surfaced by F16 |
| O7 | Age-gate storage: no DOB column, `ageAttestedAt` only (M6) — confirm minimization posture satisfies the DPIA | WU-M4-4 / E3 | New, recommendation recorded |
| O8 | Phone-number storage: none (M29 `evidenceRef` only) — confirm with DPIA; SMS-provider data flows are E3's problem | WU-M6 verification work | New, recommendation recorded |
| O9 | Q-7/C4: does `votingMethod IS NULL` survive as "no action", or does `content_type='debate'` subsume it? Schema supports both | WU-M3b-9 | **OPEN (Q-7)** |
| O10 | Fixture-contract gaps G1–G3 (§12) — contract edits needed before the seed WU | `docs/develop/fixtures.md` / WU-M3a-10 | New, blocking for the seed |
| O11 | `moderator` role (config-gated in legacy, `legacy/lib/models/forum/roles.js:15`) — omitted from E3; additive if revived | any moderation WU | Recorded |

---

*End of design record. Reviewed-before-migrations per plan §4.4; the adversarial reviewer should
attack §9 (OD-1 mechanics), C1's Q-8 reading, C6's MATCH SIMPLE nuance, and every "structural"
claim in §14 against the cited constraints.*
