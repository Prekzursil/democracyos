# DemocracyOS Revival (`<BRAND>`) Implementation Plan

> ## ⚠️ PIVOT LOG — 18.08.2026
>
> Two locked decisions changed after the grill (recorded in the ledger's `⚠️ PIVOT` block,
> `~/Cowork/output/democracyos-grill-ledger_2026-08-18.md:254-257`). This revision of the plan implements them.
>
> 1. **Data layer: MongoDB / Mongoose 8 → PostgreSQL 16 + Prisma.** Supersedes TIER-0 A3 (Mongoose 8) and A4
>    (Mongo dump/restore). Rationale: hard uniqueness constraints for 1-person-1-vote, transactional tally
>    integrity, clean relational GDPR erasure, and row-level security for Art. 9 vote data. Prisma is the data
>    layer (migrations + typegen).
> 2. **No legacy runtime. The legacy app is never booted.** Behaviour is characterized by **reading** the legacy
>    source under `legacy/lib/` and encoding it as semantic Playwright specs written against the **new** app as
>    it is built. Removed entirely: the M0 "boot the legacy Docker baseline" work unit, the GHCR freeze of the
>    legacy image, the Mongo 3.2 → 7 dump/restore rehearsal, and the strangler proxy that shared a Mongo-backed
>    legacy session.
>
> **Consequences threaded through this document:** the architecture is now a *greenfield rebuild with a
> source-derived executable specification*, not a strangler port; M0/M1/M2 are re-scoped; the "8 schema bugs"
> section becomes "relational schema design decisions" (§2.4); DB hardening is Postgres-shaped (§4.6); three
> risks are **dropped as moot** (legacy Docker boot, native modules on Node 22, `passport-local-mongoose` hash
> carry-over) and three are **added** (no running reference, document→relational redesign, Prisma/RLS learning
> curve). Everything else from the locked log is unchanged.

> **Plan-review gate: PASSED** (feasibility · completeness · scope & alignment) — reviewer fixes merged and
> **retained across the pivot**: unreachable-branch discipline (§8.3), the incident-response runbook + rehearsed
> 30-minute kill-switch/restore drill (§4.11), secrets-history hygiene (WU-M0-7), the upstream cherry-pick
> posture (WU-M0-8), and the "no legacy production data" clarification (§4.1, Q5). The M0 *boot* fallback ladder
> is deleted — there is nothing to boot; its spirit survives as the **dev-Postgres two-path rule** in §4.1, which
> exists because the local Docker daemon is currently broken.

> **For Claude:** This is the output of the PLAN stage of the metaswarm workflow. **Execution method is NOT
> chosen by this document** — per the workflow-enforcement rule the orchestrator MUST ask the user to pick
> between (1) metaswarm orchestrated 4-phase loop per work unit, (2) `superpowers:subagent-driven-development`,
> (3) `superpowers:executing-plans` in a parallel session. Do not auto-pick.

**Goal:** Turn the dead-fork mirror at `Prekzursil/democracyos` into a live, public, Romanian
civic-participation platform (fresh Agora-leaning brand, `.ro` domain) on a TypeScript monorepo, under qzp
governance, with 100% line+branch coverage on a ratcheting scope and a green semantic e2e suite.

**Architecture:** **Greenfield rebuild against a source-derived specification.** The legacy Node 6 / Express 4 /
Mongoose 4 / React 15 / gulp3 / jade app is quarantined into `legacy/` as a **read-only reference that is never
executed**. Its behaviour is extracted by reading the source and encoded as semantic Playwright journeys and as
a relational Prisma schema; a TypeScript monorepo (`packages/server`, `packages/client`, `packages/shared`) is
then grown test-first on PostgreSQL until every journey is green, at which point `legacy/` is deleted. There is
no proxy, no dual runtime, no shared session, and no data migration.

**Tech Stack:** TypeScript · Express 5 · **PostgreSQL 16 + Prisma** · Vite + React 18 · Zod · Vitest + c8 ·
Playwright (semantic role/text selectors) · Biome + Oxlint · Docker / GHCR (release artifact) · Node 22 CI
toolchain · jose · argon2id · Cloudflare + Turnstile.

**`<BRAND>` placeholder:** the final Romanian brand name is still pending an availability check (Q1). Every
occurrence of `<BRAND>` in this plan — domain, image name, UI copy — is a single literal placeholder. Because
the monorepo root now exists from M0 (before Q1 can realistically close), npm package scopes start as the
temporary literal scope **`@dosrevival/*`** and are renamed in exactly one commit at **WU-M2-6**. Do not invent
a name locally.

**Plan granularity note:** the `writing-plans` skill asks for 2–5 minute steps. A 10-milestone program at that
granularity would be unreadable and would rot before it is executed. This plan therefore decomposes to
**metaswarm work units (WU)** — each WU is one orchestrated 4-phase loop (IMPLEMENT → VALIDATE → ADVERSARIAL
REVIEW → COMMIT), sized at roughly a half-day to two days — and gives fully expanded bite-sized TDD steps for
the representative/highest-risk WUs plus a reusable WU template (§12). Exact file paths are given everywhere.

---

## 1. Overview

### 1.1 What this is

Revival of a 2013–2018-era civic deliberation platform (~37.6k tracked LOC; ~19.9k JS, ~8.1k JSON, ~3.7k
Stylus, ~856 Jade) into a live public service under Romanian jurisdiction. The fork is an exact mirror of
upstream with zero fork-only commits, so there is no divergence to reconcile — every line is upstream 2018 code.

The program is **not** a dependency bump. The client toolchain (gulp 3, browserify, jadeify, component(1)-era
modules, React 15, react-router 2, page.js) is a forced rewrite under any option; the server is now a forced
rewrite too, because the data layer changes paradigm (documents → relations). What survives from the legacy
tree is **behaviour and domain knowledge**, not code.

### 1.2 Non-negotiables (locked — do not relitigate)

| # | Constraint |
|---|---|
| N1 | **Full commitment, no re-scoping gates.** Every goal is a hard requirement. |
| N2 | **Live PUBLIC Romanian platform** from day one — GDPR + DPIA + DSA baseline + moderation duty in scope immediately. |
| N3 | **Fresh Romanian brand `<BRAND>`** (Agora-leaning, name TBD) + `<BRAND>.ro` domain; repo keeps honest "fork of DemocracyOS (GPL-3.0)" attribution. |
| N4 | **Architecture Option B**: TypeScript monorepo `packages/{server,client,shared}`, built greenfield against the quarantined legacy reference. **Express 5 + PostgreSQL 16 + Prisma** *(pivoted from Mongoose 8 / Mongo 7)*. |
| N5 | **Coverage layers**: backend = `packages/server`, frontend = `packages/client`, **midend = `packages/shared`** (isomorphic: API contracts/zod schemas, config, validators, i18n helper, privileges, url-builder, email normalization). |
| N6 | **100% line + branch is a FIXED bar on a RATCHETING `include[]` scope** (c8, `"all": true`). The bar lives in `.nycrc`/c8 flags — qzp gate 3 passes no threshold flag for JS. |
| N7 | **`enforcement.command` = a single `npm run test:coverage`** — no `&&` chains (the metaswarm CI validator rejects shell metacharacters). **Do NOT create `.coverage-thresholds.json` until that command actually runs green.** |
| N8 | **qzp subordination = Option A sibling caller enrollment** (`inventory/repos.yml` + `profiles/repos/democracyos.yml`), `phase: shadow` → 3 green runs → `absolute`; reusable workflow pinned `@<sha>`; caller adds concurrency-cancel + timeout. Lean 6-gate CI. |
| N9 | **e2e = semantic (role/text) Playwright**, written FIRST as characterization specs — now **derived from legacy source-reading and targeting the new app** — run as a **separate advisory workflow**, never a 7th charter gate. |
| N10 | **One Biome format-only commit first** + `.git-blame-ignore-revs`. |
| N11 | **Keep all 5 voting methods** (vote/poll/cause/slider/hierarchy), headline slider + hierarchy; keep the multi-forum hub; split debate/proposal/poll content types; lightweight lifecycle open → closed → outcome-published with a forced "what happens with the result" declaration. |
| N12 | **RO + EN locales only** (drop the other 16). |
| N13 | **BUILD participatory budgeting.** Native Polis-style opinion clustering is the v2 flagship. Consul/Decidim are parity/borrowing references only. |
| N14 | **Pluggable verification ladder**: email+Turnstile+account-age (comment) → phone/SMS (vote) → ROeID/EUDI (top stage), configurable per consultation. |
| N15 | **Votes are GDPR Art. 9 data**: aggregate-only public + pseudonymized payload + hash-chained tally audit log + "consultative, not a binding secret ballot" label on every result page. *(Postgres makes the hash chain and the append-only audit table materially cleaner — see WU-M3a-9.)* |
| N16 | **Never collect CNP.** Age gate 16. WCAG 2.1 AA target. Stay GPL-3.0 (source link next to the GHCR image; AGPL deps only knowingly). |
| N17 | **Kill the 5 legacy landmines — they must never appear in the new code**: jwt-simple patterns → jose, Facebook OAuth removal, header-based staff trust, marked-0.3/Quill server-side sanitization, and the unauthenticated-DB-published-to-host pattern (`mongo:3.2` compose → must not be reproduced by the dev Postgres). |
| N18 | **Release = Docker image → GHCR** (semver + SHA tags). No native installers, no desktop wrapper. Defer the release workflow until gate 3 is green. **Built in CI** — unaffected by the broken local Docker daemon. |
| N19 | **Hard-fork.** Keep the `upstream` remote **read-only**, to cherry-pick `add/api-tests` and `add/i18next` only. Never merge upstream `master`. |
| N20 | **Operate personally now**, form an asociație (OG 26/2000) before the platform holds real vote data at scale. |

---

## 2. Ground truth verified in the repo (18.08.2026)

Everything in this section was read directly from `C:/Users/Prekzursil/source/democracyos`. Anything not
verifiable from the working tree is marked **NOT-CHECKED**. Post-pivot, this section is **reference material for
the rewrite** — nothing here is a runtime dependency any more.

### 2.1 Layout

- No backend/frontend split. Everything is interleaved under `lib/`: 87 `index.js` entry points.
- Server: `lib/api/` (v1: `signin`, `signup`, `forgot`, `forum`, `tag`, `topic`, `settings`, `notification`,
  `whitelist`, `boot`), `lib/api-v2/` (`topics`, `comments`, `forums`, `search`, `validate`, `middlewares`,
  `db-api`), `lib/db-api/`, `lib/models/`, `lib/middlewares/`, `lib/auth/`, `lib/jwt/`, `lib/server/`,
  `lib/boot/`, `lib/notifications/`.
- Client: `lib/site/` (140 files incl. Stylus), `lib/admin/`, `lib/settings/`, `lib/stores/`, `lib/view/`.
- Isomorphic ("midend") candidates confirmed present: `lib/config/` (with the `browser` field mapping in
  `package.json:228-230`), `lib/validators/`, `lib/regexps/`, `lib/normalize-email/`, `lib/translations/`,
  `lib/url-builder/`, `lib/utils/`, `lib/visibility/`, `lib/whitelists/`.
- Locales: 18 JSON files under `lib/translations/lib/`; **`ro.json` and `en.json` both exist** (N12 is
  therefore a deletion + enum change, not a translation project).
- Mongoose models to be re-expressed relationally: `lib/models/{user,topic,comment,vote,tag,notification,token,whitelist}.js`
  and `lib/models/forum/{index,roles,visibilities,reserved-names}.js`.

### 2.2 Runtime and build (why nothing here is ever executed)

- `package.json` pins `engines.node: "6"`, `npm: ">=3 <5"` — so **no lockfile can exist**.
- `"preinstall": "bin/dos-ext-install"` runs on every install. This is one reason the legacy manifest cannot
  live at the repo root (see WU-M0-1/WU-M0-2).
- Scripts use Unix-only inline env syntax (`NODE_PATH=. node index.js`) — they fail in PowerShell.
- `docker-compose.yml` builds `docker/development.Dockerfile` (`FROM node:6`), volume-mounts
  `public/ bin/ config/ lib/ migrations/ test/`, and runs `mongo:3.2` **with no authentication and port 27017
  published to the host**. **Post-pivot this file is moved under `legacy/` and never invoked**; it survives only
  as the documented example of the anti-pattern N17 forbids.
- `docker/.env` contains only `MONGO_URL` and `DEBUG` — no credential today, but it is a committed env file
  and therefore in scope for the secrets-history audit (WU-M0-7).

### 2.3 Configuration

- Config is JSON-file based via `democracyos-config` (`lib/config/index.js`), reading `config/`.
  Only `MONGO_URL`/`MONGODB_URI` and the SendGrid pair are read from the environment (`lib/config/index.js:29-45`).
- `config/defaults.json` carries the whole surface, including `jwtSecret` (default sentinel string; a random
  one is generated at boot if unset, which silently invalidates all sessions on restart —
  `lib/config/index.js:14-19`), `staff: []`, `auth.basic`, `auth.facebook`, `recaptchaSite/Secret`,
  `availableLocales` (18 entries, `config/defaults.json:135-154`), and hard-coded `democracyos.org` strings.
  **The new config surface is env + zod (WU-M3b-1); `DATABASE_URL` replaces `MONGO_URL` as the single DB knob.**
- `democracyos.org` appears in: `package.json`, `README.md`, `IMPLEMENTATIONS.md`, `app.json`, `Dockerfile`,
  `docker/development.Dockerfile`, `config/defaults.json`, `lib/layout/includes/ssl-warning.jade`,
  `docs/index.md`, `docs/install.md`, `docs/configuration.md`, `docs/develop/index.md`. **All hostile
  (squatted domain) — scrub list is exactly these 12 files** (most of which move under `legacy/`; the rule is
  that no *root-level* document may carry the string).

### 2.4 Relational schema design decisions (replaces "the 8 schema bugs")

The eight defects catalogued in the grill were Mongoose-shaped. Under Postgres + Prisma, **six of them dissolve
into ordinary schema declarations and two become genuine design tasks.** They are re-mapped here so nothing is
lost in the pivot; each row names where the decision is implemented.

| # | Legacy defect (location) | Relational resolution | Implemented in |
|---|---|---|---|
| 1 | `title` virtual is an arrow fn → `this` is the module, always `undefined` (`lib/models/topic.js:157`) | **Dissolves.** No virtuals in Prisma: `Topic.title` is a real `text` column; anything derived is computed in the API/serializer layer with a test. | WU-M3a-4 |
| 2 | Dead `content` virtual reading fields `ParagraphSchema` never had (`lib/models/topic.js:167-175`, schema `:40-44`) | **Dissolves by deletion.** `Clause { id, topicId, position, markup, empty }` with `@@unique([topicId, position])`; nothing dead is ported. | WU-M3a-4 |
| 3 | `pre('save')` xss filter applied to `this.body`, a field not in the schema (`lib/models/topic.js:123-128`) | **Becomes a real pipeline**, not a hook: sanitize `Clause.markup` on write **and** on read, in the server, on an allow-list. | WU-M4-11 |
| 4 | Missing `{ forum: 1 }` index — collection scan per listing (`lib/models/topic.js:90-93`) | **Dissolves.** `forumId` is a foreign key with `@@index([forumId, publishedAt])`; the FK also gives referential integrity Mongo never had. | WU-M3a-3/-4 |
| 5 | Denormalized `comment.score` drift + unbounded embedded `votes`/`flags`/`replies` (`lib/models/comment.js:81-83,142-148,169-188`) | **Genuine design task.** Child tables `CommentVote` / `CommentFlag` (each `@@unique([commentId, userId])`) and a self-referential `parentId` tree. `score` is **either** a view **or** a counter maintained in the same transaction as the vote — decided at task time on measured read/write shape, with a reconciliation test that proves view and counter agree. | WU-M3a-6 |
| 6 | `email` index is **not unique** (`lib/models/user.js:50`) | **Dissolves.** `citext` (or `lower(email)` expression index) with a `UNIQUE` constraint. No dedupe migration is needed — there is no data. | WU-M3a-2 |
| 7 | Forum-name uniqueness enforced by a racy `pre('save')` (`lib/models/forum/index.js:76-88`, index `:71`) | **Dissolves.** Partial unique index `UNIQUE (lower(name)) WHERE "deletedAt" IS NULL`. The race is structurally impossible; the friendly-error path becomes a pre-check that *may* be wrong without being unsafe. | WU-M3a-3 |
| 8 | `vote.value` is a free `String` with no enum (`lib/models/vote.js:8`; method enum lives on the topic, `lib/models/topic.js:73`) | **Dissolves into two constraints.** A Postgres `enum` for the simple methods plus a `CHECK` tying the stored value shape to the topic's `VotingMethod`; the typed contract in `packages/shared` (WU-M3b-8) is the third layer. | WU-M3a-5 |

**Additional relational decisions the document model never forced** (all recorded in `docs/design/data-model.md`,
WU-M3a-1):

- **Identifiers:** `ObjectId` → `uuid` primary keys, plus a separate human-facing `slug` where the legacy app
  exposed an id in a URL (`lib/url-builder/`). URLs must not leak enumeration order.
- **Time:** every `createdAt: Date.now` becomes `timestamptz` with a DB default; no application clock.
- **1-person-1-vote:** `@@unique([topicId, voterPseudonym])` — the integrity property that motivated the pivot.
  It is a constraint, not a code path, and therefore cannot be bypassed by a bug.
- **Tally integrity:** tallies are written inside the same transaction as the vote, or computed from votes;
  never "eventually reconciled".
- **GDPR erasure:** identity lives in `User`; vote payloads reference a pseudonym, so erasure is
  `DELETE FROM "User"` + pseudonym-map deletion, with `ON DELETE` behaviour chosen per relation and asserted by
  a test (the aggregate and the audit chain survive; the person does not).
- **`jsonb` is a last resort**, allowed only where the legacy shape is genuinely open (e.g. `Token.meta`), and
  always with a zod parse at the boundary.
- **Token expiry:** legacy `TokenSchema` has **no expiry field** (`lib/models/token.js:5-10`). The relational
  version adds `expiresAt` (NOT NULL) and a cleanup job — a security fix the pivot makes free.

### 2.5 The 5 landmines — confirmed locations (now "patterns banned from the new code")

1. **jwt-simple** — `package.json:135`, used by `lib/jwt/index.js` + `lib/jwt/token.js`. The middleware also
   accepts the token from `req.query.access_token` **and** the `x-access-token` header (`lib/jwt/index.js:29-30`).
   *New code: jose, alg pinned, cookie only. There is no legacy server to co-run with, so there is no dual-token
   shim and no shared secret — the whole class of problem is deleted rather than mitigated.*
2. **Facebook OAuth** — `passport-facebook` (`package.json:159`), `lib/auth/strategy.js`,
   `lib/site/auth-facebook/`, `lib/site/sign-in/btn-facebook/`, `config.facebookSignin` branch in
   `lib/jwt/index.js:52-58`, `profiles.facebook` on the user schema (`lib/models/user.js:28`). *Not ported. No
   FB-only-account reset flow is needed either — there are no accounts.*
3. **Header-based staff trust** — `staff` is a virtual computed from a config email array
   (`lib/models/user.js:118-121`, `config/defaults.json:14`). *New code: DB-backed RBAC + admin MFA (WU-M4-7).*
4. **marked 0.3 / Quill sanitization** — `package.json:97,144`, `lib/richtext/`, `lib/richtext/lib/xss-filter.js`,
   applied to the wrong field per decision #3 above. *New code: maintained sanitizer, allow-list, write+read.*
5. **No-auth `mongo:3.2` published to the host** — `docker-compose.yml:24-30`. *The dev Postgres (WU-M0-5) binds
   `127.0.0.1` only, requires a password, and is never the production topology; production Postgres hardening is
   WU-M4-12.*

### 2.6 Tests / CI / coverage today

- 2 Jasmine spec files (`test/index.js`, `test/api/forum/index.js`) run via `gulp test`, requiring a live Mongo.
  **Never executed post-pivot** — they are read as behavioural documentation only.
- Coverage: none. e2e: none. CI: none (no `.github/workflows/` in the repo).
- `.snyk` patch file present (2017-era CVE firefighting) and a `snyk-protect` prepublish hook (`package.json:224-225`).
- Upstream branches worth harvesting (hard-fork posture, cherry-pick only): **`add/api-tests`** (the single most
  valuable characterization input now that nothing is running — it documents expected request/response shapes)
  and **`add/i18next`** (i18n modernization groundwork for WU-M3b-6).

### 2.7 qzp reusable workflow — the four constraints it imposes on us

Read from `C:/Users/Prekzursil/source/qzp-lean/.github/workflows/reusable-quality.yml`:

1. **Gate 1 (js/ts) is self-contained and scans the whole tree**: `oxlint@1.69.0 --deny-warnings` plus
   `@biomejs/biome@2.5.0 ci --formatter-enabled`, with only `node_modules|dist|build|out|.venv|vendor|*.min.js`
   ignored (`reusable-quality.yml:318-370`). **The quarantined `legacy/` tree will still be linted** unless
   ignored — 19.9k lines of ES5/ES2015-era code under `--deny-warnings` will not pass. Mitigation: WU-M0-1's
   quarantine + WU-M0-3's ignore configuration; worst case, `legacy/` moves out of the linted tree entirely (R8).
2. **Gate 3 (js/ts) runs in the ROOT project when a root `package.json` exists**, doing `npm ci || npm install`
   then `npm run test:coverage` (`reusable-quality.yml:551-609`). The root manifest must be Node-22-installable
   and expose a single `test:coverage`. The legacy manifest (Node 6 engines, `preinstall`, no lockfile) breaks
   this — hence it moves to `legacy/package.json` in WU-M0-1, **before** any CI exists.
3. **Gates 4/5/6 are config-gated**: opengrep runs only if `.quality/opengrep/` exists, gitleaks only if
   `.gitleaks.toml` exists, osv-scanner only if `osv-scanner.toml` exists (`reusable-quality.yml:200-202`).
   Omitting them is a silent skip, not a pass — WU-M2-2 ships all three plus `.quality/charter.yml`
   (which triggers `charter_check.sh`, `reusable-quality.yml:678-680`).
4. **`node-version` input defaults to `"20"`** (`reusable-quality.yml:92-96`) — the caller must pass `"22"`.

Onboarding mechanics (from `qzp-lean/docs/ONBOARDING.md`): inventory entry → `profiles/repos/democracyos.yml`
(`mode.phase: shadow`) → `python scripts/quality/validate_control_plane.py` → bootstrap PR → 3 green shadow
runs → flip to `absolute`. Stack profile: **`fullstack-web`** (the `event-link`/`Reframe` family).

---

## 3. Sequence changes forced by the pivot (and why)

1. **M0 is no longer "boot the legacy baseline"; it is "quarantine the legacy tree and scaffold the new one".**
   With no runtime to reproduce, the program's old single point of failure (does the 2018 container boot?)
   disappears — and with it the boot fallback ladder, the GHCR image freeze, and the Mongo dump/restore
   rehearsal. What replaces them is a much cheaper M0 that nevertheless *must* end with `npm ci &&
   npm run test:coverage` green on Node 22 and `prisma migrate dev` reaching a real Postgres.
2. **The relocation moved from M2 to M0 and stopped being risky.** It used to be "the milestone's riskiest WU"
   because the moved tree had to keep running behind a proxy. It is now a pure `git mv` of code that is never
   executed: nothing points at it, so nothing can break. The M1-before-M2 *safety* argument dies with it.
3. **M1 keeps its position, for a different reason.** The specs are no longer a regression net around a
   relocation; they are the **specification of record for the rewrite**, and they must exist before the port
   starts so that porting is spec-driven rather than transliteration-driven. They start **red-by-design**
   (`test.fixme`-quarantined) and are activated slice by slice — with an activation schedule, because
   permanently-pending specs would be worse than no specs (R13).
4. **The old M3a ("behaviour-changing schema fixes on the legacy baseline") is replaced by M3a
   ("Prisma relational schema + migrations + RLS").** There is no legacy database to migrate, so there are no
   dedupe migrations; the same eight concerns are now expressed as constraints in a fresh schema (§2.4).
5. **M4 loses the strangler apparatus.** No proxy, no route table, no dual-verify JWT shim, no
   password-hash carry-over proof, no "retire the legacy half" WU. It gains Prisma repositories, transactional
   tallies, and Postgres hardening.
6. **M8 (legal/compliance) remains a workstream that starts at M0** — DPIA, ToS, privacy notice,
   notice-and-action and the asociație question have multi-week external latency. Unchanged by the pivot,
   except that the DPIA's data-flow section is now easier to write because the schema is explicit.

Everything else — M3b before M4 and M5, server before client, PB after the content-type split, clustering as
v2 — is unchanged.

---

## 4. Milestones

Legend: **WU** = one metaswarm work unit. **Ratchet** = the `include[]` globs added to `.nycrc` at the *end*
of that milestone, at which point they must be at 100% line + branch. **Journeys** = the semantic e2e journeys
that must be green at milestone exit (defined in M1, §4.2).

---

### 4.1 M0 — Quarantine the legacy tree, scaffold the monorepo, stand up Postgres

**Goal:** a clean, Node-22-installable TypeScript monorepo at the root; the entire 2018 codebase preserved but
inert under `legacy/`; Prisma initialized against a real PostgreSQL 16 that a developer can obtain **with or
without Docker**; no secret and no hostile URL at the root of the tree.

**Depends on:** nothing. **Blocks:** everything.

| WU | Title | Files | Notes |
|---|---|---|---|
| WU-M0-1 | **Quarantine the legacy tree** | `git mv` `lib/ bin/ config/ migrations/ public/ test/ docker/ index.js gulpfile.js package.json Dockerfile docker-compose.yml Procfile app.json .snyk` → `legacy/`; create `legacy/README.md` | Pure move; **no path re-pointing is required because nothing executes**. `legacy/README.md` states in the first line: *read-only reference, never executed, retained for behaviour archaeology and GPL-3.0 attribution*. Keep `LICENSE`, `README.md` (rewritten), `docs/` at the root. |
| WU-M0-2 | Monorepo workspace root | create root `package.json` (npm workspaces `packages/*`), `package-lock.json`, `tsconfig.base.json`, `packages/{server,client,shared}/{package.json,tsconfig.json,src/index.ts}` | The new root has **no `preinstall`**, no `engines.node: 6`, and a real lockfile. `"test:coverage"` is a single command (N7). Scopes start as `@dosrevival/*` (temporary literal, renamed once at WU-M2-6). |
| WU-M0-3 | Biome + oxlint + format-only commit | create `biome.json`, `.oxlintrc.json`, `.gitignore`, `.git-blame-ignore-revs` | One isolated format-only commit, zero semantic changes (N10); `git config blame.ignoreRevsFile .git-blame-ignore-revs`. **NOT-CHECKED (Q6):** whether `.oxlintrc.json` `ignorePatterns` survive the workflow's CLI `--ignore-pattern` flags — discovered in M2's shadow phase, where it cannot block. |
| WU-M0-4 | Coverage plumbing with an empty ratchet | create `.nycrc`, `vitest.config.ts` per package, root `test:coverage` script | `.nycrc`: `{"all": true, "check-coverage": true, "lines": 100, "branches": 100, "functions": 100, "statements": 100, "include": [], "exclude": ["legacy/**", "e2e/**", "**/*.d.ts", "**/*.config.ts", "**/prisma/migrations/**", "**/generated/**"]}`. **Do NOT create `.coverage-thresholds.json` yet (N7).** |
| WU-M0-5 | **Prisma init + dev Postgres, two independent paths** | create `packages/server/prisma/schema.prisma` (datasource + generator only), `.env.example`, `docker-compose.dev.yml`, `scripts/db/check.ts`, `docs/develop/database.md` | See the two-path rule below. The **only** interface the repo knows is `DATABASE_URL`. |
| WU-M0-6 | Fixture inventory (contract, not code) | create `docs/develop/fixtures.md` | One forum; one user per role (visitor/registered/collaborator/admin/owner); one topic per voting method (`vote`, `poll`, `cause`, `slider`, `hierarchy`); a threaded comment tree; one closed topic with a published outcome. This is the shared contract for the e2e suite **and** the seed script; the executable seed lands in WU-M3a-10, once a schema exists to seed. |
| WU-M0-7 | **Secrets hygiene: history audit + rotation** | `legacy/docker/.env`, `legacy/config/**`, full git history; create `docs/ops/secrets.md` | Run gitleaks over the **entire history** (`gitleaks detect --log-opts="--all"`), not just the working tree, plus a manual sweep of `legacy/docker/.env`, `legacy/config/*.json`, `legacy/app.json`, `legacy/Procfile`. Scout A found no committed credential, but "found none" is not "rotate nothing": **any value that has ever been committed is treated as public and rotated**. Record the rotation inventory in `docs/ops/secrets.md`. Production secrets are injected at runtime only — never in an image layer, never in the repo. |
| WU-M0-8 | **Upstream posture + cherry-pick inventory** | `.git/config` (remote), create `docs/develop/upstream.md` | Confirm `upstream` is present and **read-only** (`git remote set-url --push upstream DISABLED`). Fetch and inventory the two harvest branches: **`add/api-tests`** — now the highest-value characterization input (consumed by WU-M1-13); **`add/i18next`** — i18n groundwork (consumed by WU-M3b-6). Cherry-pick only; **never merge upstream `master`** (N19). |
| WU-M0-9 | Scrub squatted URLs + honest root README | the 12 files in §2.3 (most now under `legacy/`), new root `README.md` | No **root-level** document may contain `democracyos.org`. The root README states: hard fork of DemocracyOS, GPL-3.0, upstream attribution, and that `legacy/` is a non-executed reference. |

**The dev-Postgres two-path rule (WU-M0-5) — the repo must never hard-depend on Docker.**
The local Docker daemon on this machine is **currently broken** (R12). That must not block M0, so `DATABASE_URL`
is the only contract and both paths are first-class and documented side by side in `docs/develop/database.md`:

| Path | How | When to use |
|---|---|---|
| **A — Docker** | `docker compose -f docker-compose.dev.yml up -d db` → `postgres:16-alpine`, **bound to `127.0.0.1:5432` only**, password from `.env.local`, named volume for data | Once the daemon is repaired. Closest to CI. |
| **B — Native or hosted** | A native Windows/WSL2 PostgreSQL 16 install, **or** a hosted dev instance (managed Postgres free tier). Configuration is *only* `DATABASE_URL` in `.env.local` | **The default today.** If hosted, the instance holds fixture data only — never personal data (see the note below), and the choice feeds Q3. |

`scripts/db/check.ts` (a real, covered script — it is in the ratchet from M3a) asserts connectivity, prints
`server_version` and fails loudly if it is below 16, and reports which path is in use. Every downstream WU,
every test and CI itself talk only to `DATABASE_URL`; **no script, test, Makefile or npm script may invoke
`docker` as a prerequisite for development.** CI provisions Postgres as a service container, which is unrelated
to the local daemon.

**No legacy production data exists — and post-pivot there is no migration at all.** The fork has zero users and
no deployed instance. The old Mongo 3.2 → 7 dump/restore rehearsal is **deleted from the plan**, not deferred:
there is no source database, no dual-write window and no cutover. Fixtures are generated by the seed script
(WU-M3a-10) from the inventory in WU-M0-6. If a legacy instance is ever populated before launch (not planned),
a migration is designed at that point as a new work unit.

**Ratchet at exit:** `include: []` — deliberately empty. The bar is armed and passing vacuously; every later
milestone only ever *adds* globs, never lowers the percentage (N6).

**Journeys:** none yet (M1 writes them).

**Definition of done:** a clean clone on Node 22 runs `npm ci && npm run test:coverage` green (vacuously);
`npx prisma migrate dev` and `npx tsx scripts/db/check.ts` succeed against a Postgres 16 obtained by **either**
path, with the Docker path documented as untested-locally if the daemon is still down (`NOT-CHECKED`, not
"works"); `rg -n 'democracyos\.org'` returns hits only under `legacy/` and in attribution lines; no root-level
file executes, imports or references anything under `legacy/`; the history secrets audit is complete and any
ever-committed value is rotated; `upstream` is read-only with both harvest branches inventoried.

---

### 4.2 M1 — Semantic characterization specs, derived from source, targeting the new app

**Goal:** an executable specification of what the platform must do, written in role/text selectors, derived by
**reading** `legacy/lib/` rather than by observing a running system. This suite is the definition of "ported"
for every subsequent milestone.

**Depends on:** M0. **Blocks:** M3b, M4, M5 (nothing may be ported without its spec).

**What changed with the pivot, stated plainly:** there is no running reference to diff against. The safety net
is weaker and the plan must not pretend otherwise. Two compensating controls are mandatory:

1. **Every assertion cites its source.** Each spec block carries a comment naming the legacy file and line range
   it was derived from (e.g. `// src: legacy/lib/api-v2/topics/index.js:88-134`). An assertion with no citation
   is a review rejection — it means someone invented behaviour.
2. **A fresh reviewer re-derives, they do not re-read.** The adversarial reviewer for each journey WU opens the
   cited sources independently and confirms the assertion matches, exactly as a second pair of eyes on a
   translation. This is the substitute for "run it and see".

**The golden journeys** (each is one WU; all 10 are mutually independent → maximum parallelism):

| ID | Journey | Derived from |
|---|---|---|
| J1 | Sign-up → email validation → sign-in → sign-out | `legacy/lib/api/{signup,signin}/`, `legacy/lib/jwt/` |
| J2 | Forgot password → reset → sign-in with the new password | `legacy/lib/api/forgot/`, `legacy/lib/models/token.js` |
| J3 | Create a forum (multi-forum hub) → set visibility → grant a collaborator role | `legacy/lib/api/forum/`, `legacy/lib/models/forum/{index,roles,visibilities}.js` |
| J4 | Admin creates a topic per voting method → publish → appears on the forum home | `legacy/lib/api-v2/topics/`, `legacy/lib/admin/admin-topics-form/` |
| J5 | Vote with method `vote` (yes/no/abstain) and see the tally update | `POST /topics/:id/vote`, `legacy/lib/site/topic-layout/topic-article/vote/` |
| J6 | Vote with `poll` and `cause` | same route, `poll/` + `cause/` components |
| J7 | Vote with `slider` and `hierarchy` (the differentiators — highest fidelity required) | `slider/` + `hierarchy/` components |
| J8 | Comment → reply → upvote/downvote → flag as spam → author edits → author deletes | `legacy/lib/api-v2/comments/`, `legacy/lib/models/comment.js` |
| J9 | Admin panel: topic list, tag CRUD, permissions, CSV export of topics and comments | `legacy/lib/admin/`, the `.csv` routes |
| J10 | Settings: profile, password change, notification prefs; locale switch EN ↔ RO | `legacy/lib/settings/**`, `legacy/lib/api/settings/` |

| WU | Title | Files |
|---|---|---|
| WU-M1-1 | Playwright harness, fixtures, and the **pending-quarantine mechanism** | create `e2e/playwright.config.ts`, `e2e/fixtures/app.ts`, `e2e/fixtures/users.ts`, `e2e/README.md` |
| WU-M1-2 … WU-M1-11 | One WU per journey J1…J10 | `e2e/journeys/j01-signup.spec.ts` … `e2e/journeys/j10-settings.spec.ts` |
| WU-M1-12 | Advisory e2e workflow | create `.github/workflows/e2e.yml` |
| WU-M1-13 | Harvest upstream `add/api-tests` as characterization input | read + cherry-pick into `legacy/test/api/**`; every behaviour it reveals becomes an assertion or an explicit "not ported" line in `docs/CHARACTERIZATION.md` |
| WU-M1-14 | Characterization record | create `docs/CHARACTERIZATION.md` — observed behaviours **with source citations**, including the known-buggy ones, explicitly flagged, so the rebuild preserves **intent**, not bugs |
| WU-M1-15 | **Spec activation ledger** | create `e2e/SPEC-LEDGER.md` — one row per journey: status (`pending` / `active`), the milestone that must activate it, and the WU that does |

**Red-by-design, and how it is kept honest.** These specs target an app that does not exist yet, so on day one
they all fail. They are therefore written as `test.fixme(...)` (or tagged `@pending` and filtered), which reports
them as **pending, not failing** — an amber suite, never a red one, so the signal stays meaningful. The danger
is obvious: pending specs that never activate are decorative. Controls: (a) `e2e/SPEC-LEDGER.md` assigns every
spec an activation milestone; (b) each milestone's definition of done names the specs it must flip to active;
(c) the advisory workflow prints the pending/active ratio on every run, and the ratio is a milestone-exit
number, not a vibe.

**Spec style (N9 — enforced, not advisory):** `page.getByRole('button', { name: /votează/i })`, `getByLabel`,
`getByText`. **Banned:** CSS/DOM selectors, XPath, `data-testid` as a primary selector, screenshot diffing
(Chromatic/Applitools/Percy are charter-banned). Because the target is a *new* client, the specs get something
the legacy markup could never give them: they define the accessible names the new UI must have. Writing the spec
first is therefore how M1 seeds WCAG 2.1 AA (N16) instead of retrofitting it in M8.

**`.github/workflows/e2e.yml` shape:** `workflow_dispatch` + `push`/`pull_request`, `concurrency: { group:
e2e-${{ github.ref }}, cancel-in-progress: true }`, `timeout-minutes: 30`, Chromium only, `retries: 2`,
`trace: on-first-retry`, a Postgres service container, artifacts on failure, **and advisory semantics: it is
never added to `.quality/charter.yml`.** Promote to required only after 10 consecutive green runs with zero
pending specs.

**Ratchet:** none — e2e is not measured by c8 and never contributes to the coverage bar.

**Definition of done:** all 10 journeys written and reviewed; **every assertion carries a source citation** and
a fresh reviewer has independently re-derived it; the suite runs green-with-pendings (zero failures, N pendings)
in CI; `docs/CHARACTERIZATION.md` and `e2e/SPEC-LEDGER.md` complete, with an activation milestone for every spec;
zero DOM selectors (enforced by a grep check in the workflow).

---

### 4.3 M2 — qzp enrollment, lean CI, brand substitution

**Goal:** the repo becomes a governed project whose CI is green *and honest* (no silently skipped gate), with the
coverage ratchet armed and empty.

**Depends on:** M0 (the scaffold), M1 (the advisory lane exists and is separate). **Blocks:** M3a onwards —
after M2, every commit is governed.

| WU | Title | Files | Risk |
|---|---|---|---|
| WU-M2-1 | Caller workflow | create `.github/workflows/quality.yml` | Calls `Prekzursil/quality-zero-platform/.github/workflows/reusable-quality.yml@<sha>` (pinned, N8) with `node-version: "22"`; caller adds `concurrency: { group: quality-${{ github.ref }}, cancel-in-progress: true }` and `timeout-minutes: 20` (the reusable workflow has neither). |
| WU-M2-2 | Ship the gate configs | create `.gitleaks.toml`, `osv-scanner.toml`, `.quality/opengrep/*.yml`, `.quality/charter.yml`, `.quality/charter_check.sh` | Without these, gates 4/5/6 **silently skip**. The opengrep ruleset must at minimum cover: JWT alg confusion, **raw-SQL interpolation (`$queryRawUnsafe` / `$executeRawUnsafe` / template-built SQL)**, XSS sinks, and secrets in log calls. |
| WU-M2-3 | qzp control-plane enrollment | in `qzp-lean`: `inventory/repos.yml` (+1 entry), create `profiles/repos/democracyos.yml` | `stack: fullstack-web`, `mode.phase: shadow`, `issue_policy: audit`, `coverage.command` = `npm ci` + `npm run test:coverage`, `coverage.inputs` = three lcov files with flags `server`/`client`/`shared`, `codeql.languages: [actions, javascript-typescript]`, `dependabot.updates: [npm /]`. Validate with `python scripts/quality/validate_control_plane.py`. **This is a PR against a different repo — a separate work unit with its own review.** |
| WU-M2-4 | Legacy-tree lint containment | `.oxlintrc.json`, `biome.json`, possibly `.github/workflows/quality.yml` inputs | Resolves Q6 empirically **in shadow**. If ignore-patterns lose to the workflow's CLI flags, escalate per R8 (up to moving `legacy/` out of the linted tree onto an archive tag). |
| WU-M2-5 | Dependabot + repo hygiene | create `.github/dependabot.yml`, `SECURITY.md`, `CONTRIBUTING.md`, repo `AGENTS.md` pointing back at strict-zero; delete `legacy/.snyk` references from any live config | Automation-first sustainability (the year-3 maintenance answer). |
| WU-M2-6 | **`<BRAND>` substitution** | root `package.json`, `packages/*/package.json`, `README.md`, docs | The single commit that replaces `@dosrevival/*` and every `<BRAND>` token. Requires Q1 closed. If Q1 is still open when M2 would otherwise exit, **M2 exits without it** and this WU is re-dispatched later — it blocks nothing technical, only WU-M9-6. |

**Ratchet at exit:** still `include: []`.

**Journeys:** unchanged (all still pending; the ratio is reported, not improved, by this milestone).

**Definition of done:** three green shadow runs of the qzp caller workflow on `main`; every one of the 6 gates
either *ran* or is documented as legitimately absent (no silent skips); `npm ci && npm run test:coverage` works
on a clean Node 22 checkout; the format-only commit is in `.git-blame-ignore-revs`; Q6 answered with evidence.

**Exit action:** flip `profiles/repos/democracyos.yml` to `phase: absolute` (ONBOARDING step 7) — and only
then create `.coverage-thresholds.json` with `enforcement.command: "npm run test:coverage"` (N7 satisfied,
because the command now demonstrably runs).

---

### 4.4 M3a — The Prisma relational data model

**Goal:** a designed, migrated, constraint-enforced PostgreSQL schema that makes the integrity properties in
§2.4 true by construction — plus row-level security for Art. 9 data and an append-only audit substrate.

**Depends on:** M0 (Prisma initialized), M1 (behaviour is written down), M2 (CI governs the migrations).
**Blocks:** M3b, M4.

| WU | Title | Files |
|---|---|---|
| WU-M3a-1 | **Data-model design record** | create `docs/design/data-model.md` — the legacy-model → relational mapping table (§2.4 expanded), every enum, every unique/partial index, every `ON DELETE` choice with its GDPR justification, and the `jsonb` allow-list. Reviewed before a single migration is written. |
| WU-M3a-2 | Identity: `User`, `Token`, `Session` | `packages/server/prisma/schema.prisma`, migration `..._identity` — `citext` email `UNIQUE`; `emailValidated`; `locale` enum `{ro,en}`; `Token.scope` enum `{password_reset,email_validation}` **with the new NOT NULL `expiresAt`**; no `staff` column (RBAC is WU-M4-7) |
| WU-M3a-3 | Forums + permissions | migration `..._forums` — `UNIQUE (lower(name)) WHERE "deletedAt" IS NULL`; `ForumPermission(forumId,userId,role)` with `@@unique([forumId,userId])`; `visibility` enum; reserved-name check from `legacy/lib/models/forum/reserved-names.js` |
| WU-M3a-4 | Topics, clauses, tags | migration `..._topics` — `Topic.forumId` FK + `@@index([forumId, publishedAt])`; `Clause` child table with `@@unique([topicId, position])`; `Tag.hash` unique; `VotingMethod` enum (the 5 methods); `ContentType` and `Lifecycle` enums; `outcomeDeclaration` with a `CHECK` that it is non-empty once lifecycle ≥ `closed` (N11 enforced in the database, not only the UI) |
| WU-M3a-5 | Votes + tallies | migration `..._votes` — **`@@unique([topicId, voterPseudonym])` (1-person-1-vote)**; value modelled per method with an enum + `CHECK`; `Tally` written in the same transaction as the vote; no public row-level read path |
| WU-M3a-6 | Comment tree + reactions | migration `..._comments` — self-FK `parentId`; `CommentVote` / `CommentFlag` with `@@unique([commentId,userId])`; **`score` as a view or a transactionally-maintained counter — decided here, with a reconciliation test that proves the two agree on the fixture corpus** |
| WU-M3a-7 | Notifications + whitelist | migration `..._notifications` — `Notification.type` enum `{reply,upvote,downvote}` (from `legacy/lib/models/notification.js:15`), FKs to user/comment/topic with explicit `ON DELETE` |
| WU-M3a-8 | **Row-level security + least-privilege roles** | raw-SQL migration `..._rls` + `packages/server/src/db/rls.ts` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `FORCE`, policies on vote/consent/pseudonym tables, three DB roles (`app_migrator`, `app_runtime`, `app_readonly`), `app_runtime` owning nothing and having no `BYPASSRLS`. **Q14: the Prisma mechanism (interactive transaction + `SET LOCAL app.current_user`) must be proven by a test that shows a policy actually blocks a cross-tenant read** — RLS that is never demonstrated to bite is decoration. |
| WU-M3a-9 | Append-only audit substrate | migration `..._audit` — `AuditEntry(prevHash, hash, payload, createdAt)` with a trigger rejecting `UPDATE`/`DELETE`, and a `BEFORE INSERT` hash-chain check. The M6-8 tally chain (N15) is built on this. |
| WU-M3a-10 | Seed script + fixture corpus | `packages/server/prisma/seed.ts` implementing the WU-M0-6 inventory; `npm run db:seed` |
| WU-M3a-11 | Migration discipline | `.github/workflows/quality.yml` (extra step) or a test — `prisma migrate diff` drift check (schema ↔ migrations ↔ database), plus `docs/develop/migrations.md`: forward-only, one migration per WU, never edit an applied migration, expand→migrate→contract for anything destructive |

**Ratchet at exit:** `include: ["packages/server/src/db/**/*.ts", "scripts/db/**/*.ts"]` at 100% (the generated
Prisma client is excluded — it is generated, not authored).

**Journeys:** still pending, but the **seed** they depend on now exists; J-activation begins in M4.

**Definition of done:** `docs/design/data-model.md` reviewed and merged before the migrations; every §2.4 row is
implemented and has a **test that proves the constraint fires** (duplicate email rejected, duplicate vote
rejected, out-of-enum value rejected, forum-name race rejected under concurrent inserts, audit row immutable,
RLS policy blocks a cross-user read); `prisma migrate deploy` from scratch reproduces the schema exactly; the
drift check is green in CI; the seed produces the full fixture corpus.

---

### 4.5 M3b — `packages/shared` (the midend), ported test-first

**Goal:** the first 100% covered package, and the contract layer everything else will import.

**Depends on:** M1 (behaviour written down), M3a (the enums and shapes it must mirror). **Blocks:** M4, M5.

| WU | Title | Legacy source → target |
|---|---|---|
| WU-M3b-1 | Config schema | `legacy/lib/config/` + `legacy/config/defaults.json` → `packages/shared/src/config/schema.ts` (zod), `.../config/load.ts` — **env-first**, `DATABASE_URL` required, no JSON config files, no boot-time random `jwtSecret` (the legacy footgun at `legacy/lib/config/index.js:14-19` becomes a startup failure instead) |
| WU-M3b-2 | Email normalization | `legacy/lib/normalize-email/` → `packages/shared/src/email/normalize.ts` |
| WU-M3b-3 | Regexps + validators | `legacy/lib/regexps/`, `legacy/lib/validators/` → `packages/shared/src/validation/` |
| WU-M3b-4 | Privileges / roles / visibility | `legacy/lib/visibility/`, `legacy/lib/models/forum/{roles,visibilities,reserved-names}.js` → `packages/shared/src/privileges/` |
| WU-M3b-5 | URL builder | `legacy/lib/url-builder/` → `packages/shared/src/url/build.ts` (slug-based, no raw ids — §2.4) |
| WU-M3b-6 | i18n helper + RO/EN locales | `legacy/lib/translations/` (keep `en.json`, `ro.json`; drop the other 16) → `packages/shared/src/i18n/`; **consume the upstream `add/i18next` branch inventoried in WU-M0-8** (cherry-pick, never merge). No locale migration is needed — there are no users. |
| WU-M3b-7 | API contracts (zod) | derived from the route inventory in §2.1 → `packages/shared/src/contracts/{auth,forums,topics,comments,votes,notifications}.ts` |
| WU-M3b-8 | Voting-method contracts | the 5 methods (`legacy/lib/models/topic.js:73`) → `packages/shared/src/contracts/voting.ts`, incl. per-method value schemas — the type-level half of decision #8, whose DB half is WU-M3a-5 |
| WU-M3b-9 | Content-type + lifecycle contracts | new → `packages/shared/src/contracts/content.ts`: `debate | proposal | poll`, lifecycle `open → closed → outcome-published`, and the **required** `outcomeDeclaration` (N11), mirroring the DB `CHECK` from WU-M3a-4 |

Every WU is strict TDD: failing Vitest spec → minimal implementation → green → commit.

**Ratchet at exit:** `+ packages/shared/src/**/*.ts` — at 100% line + branch.

**Definition of done:** `npm run test:coverage` green with the shared glob included; `packages/shared` has zero
runtime dependency on Express, Prisma, React or the DOM (isomorphic by definition — enforced with a `tsconfig`
`lib` restriction and a dependency-cruiser check); contracts and Prisma enums are proven consistent by a test,
not by eyeballing.

---

### 4.6 M4 — `packages/server` (Express 5 + Prisma + TypeScript)

**Goal:** every route the legacy app served is re-implemented on the new stack, spec-first, with the landmine
patterns dead and Postgres hardened.

**Depends on:** M3a, M3b. **Blocks:** M5, M6.

**There is no seam.** The old strangler apparatus (reverse proxy, route table, dual-verify JWT shim,
password-hash carry-over proof, "retire the legacy half") is **deleted**. Nothing co-runs; there is no shared
cookie, no shared secret and no shared database. The correctness argument is no longer "the proxy makes the
switch invisible" but "the journey specs cited to legacy source go from pending to green". Each route group's WU
therefore names the journeys it activates, and activation is the acceptance test.

| WU | Title | Files |
|---|---|---|
| WU-M4-1 | Express 5 app skeleton, config load, health/readiness | create `packages/server/src/{app.ts,server.ts,routes/health.ts}` |
| WU-M4-2 | Prisma client lifecycle + repository layer | create `packages/server/src/db/{client.ts,tx.ts,repositories/*.ts}` — one place that owns connection pooling, transactions and the RLS session variable; **`$queryRawUnsafe`/`$executeRawUnsafe` are banned by lint (WU-M2-2), raw SQL only via tagged templates in reviewed migrations** |
| WU-M4-3 | jose auth + argon2id | create `packages/server/src/auth/{jwt.ts,password.ts,session.ts}` — alg pinned, short-lived access + rotating refresh in httpOnly+Secure+SameSite cookies, invalidated on password change; **cookie only — never `req.query.access_token`, never `x-access-token`** (landmines #1 and #3 die by never being written); argon2id from birth, so there is no legacy hash format to verify (the whole carry-over risk is gone) |
| WU-M4-4 | Sign-up / sign-in / sign-out | `legacy/lib/api/{signup,signin}/` → `packages/server/src/api/auth/` — **activates J1** |
| WU-M4-5 | Password reset with expiring tokens | `legacy/lib/api/forgot/` → `.../api/auth/forgot.ts` — **activates J2**; tokens now expire (WU-M3a-2) |
| WU-M4-6 | Forums + permissions API | `legacy/lib/api/forum/`, `legacy/lib/api-v2/forums/` → `.../api/forums/` — **activates J3** |
| WU-M4-7 | DB-backed RBAC + admin MFA | `packages/server/src/auth/{rbac.ts,mfa.ts}` — retires the `config.staff` email-list pattern (landmine #3) |
| WU-M4-8 | Topics API (incl. publish) | `legacy/lib/api-v2/topics/`, `legacy/lib/api/topic/` → `.../api/topics/` — **activates J4** |
| WU-M4-9 | Votes API + transactional tally | `.../api/votes/`, `.../features/tally/` — the unique constraint from WU-M3a-5 is the authority; a duplicate vote returns a domain error, never a second row — **activates J5, J6, J7** |
| WU-M4-10 | Comments API | `legacy/lib/api-v2/comments/` → `.../api/comments/` — **activates J8** |
| WU-M4-11 | Server-side sanitization | `legacy/lib/richtext/` → `packages/server/src/richtext/sanitize.ts` — maintained sanitizer on an allow-list, applied on write **and** on read, to `Clause.markup` (landmine #4 + decision #3) |
| WU-M4-12 | **Postgres hardening** | `packages/server/src/db/*`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `docs/ops/database.md` | SCRAM-SHA-256 auth; **no public bind and no published port in production**; TLS to the database (`sslmode=verify-full` where the host supports it); the `app_runtime` least-privilege role from WU-M3a-8 (no superuser, no `CREATEDB`, no `BYPASSRLS`, migrations run as `app_migrator` in a separate step); RLS `FORCE` verified by test; injection handled **structurally** by Prisma's parameterization plus the raw-unsafe lint ban; `DATABASE_URL` injected at runtime only, never baked into an image layer or logged |
| WU-M4-13 | Per-route rate limiting + zod validation at the edge | create `packages/server/src/middlewares/{rate-limit.ts,validate.ts}` — every body/query parsed by a `packages/shared` contract before it reaches a repository |
| WU-M4-14 | helmet/CSP, CORS, TLS posture | `packages/server/src/app.ts` |
| WU-M4-15 | Admin + CSV exports | `legacy/lib/admin/**` server side, `.csv` routes → `.../api/admin/` — **activates J9**; exports are Art. 9-filtered (no per-user vote, ever) |
| WU-M4-16 | Settings + notifications + mailer | `legacy/lib/api/{settings,notification}/`, `legacy/lib/notifications/` → `.../api/settings/`, `.../notifications/` — **activates J10** |

**Ratchet, staged inside the milestone** (each stage must hit 100% before the next group starts):

1. after WU-M4-2/3: `packages/server/src/db/**`, `packages/server/src/auth/**`
2. after WU-M4-11/13/14: `packages/server/src/middlewares/**`, `packages/server/src/richtext/**`
3. after WU-M4-16: `packages/server/src/**/*.ts` (whole package)

**Journeys:** J1–J10 all flip from **pending to active** during this milestone — this is the milestone where the
suite becomes a real net. They are exercised API-level here and re-pointed at the real UI during M5.

**Definition of done:** every legacy route has either a new implementation or an explicit "not ported" line in
`docs/CHARACTERIZATION.md`; `jwt-simple`, `passport-facebook` and `marked@0.3` patterns exist nowhere in
`packages/`; Postgres requires auth, is unreachable from the host in the production compose, and RLS is proven
by test; every route validates input against a shared contract; `packages/server/src/**` at 100%; **zero pending
specs in the API-level journey set**.

---

### 4.7 M5 — `packages/client` (Vite + React 18 + TS)

**Goal:** the browser stops running 2016 code, and the journeys pass through a real UI.

**Depends on:** M3b, M4. **Blocks:** M6 UI surfaces, M8 accessibility audit.

| WU | Title | Legacy source → target |
|---|---|---|
| WU-M5-1 | Vite + React 18 + TS shell, routing | new → `packages/client/src/{main.tsx,app.tsx,router.tsx}` (replaces `page.js` + react-router 2) |
| WU-M5-2 | Design tokens + Stylus decision | `legacy/lib/**/styles.styl` (~3.7k lines) → `packages/client/src/styles/` — keep-vs-migrate is a task-time decision recorded in the WU (Q12) |
| WU-M5-3 | Data layer | `legacy/lib/stores/**` → `packages/client/src/api/` (typed clients generated from `packages/shared` contracts; `react-refetch` dies) |
| WU-M5-4 | Auth pages | `legacy/lib/site/{sign-in,sign-up,forgot,reset}/` → `.../pages/auth/` — **re-points J1, J2 at the UI** |
| WU-M5-5 | Forum home + multi-forum hub | `legacy/lib/site/{home-forum,home-multiforum}/` → `.../pages/forum/` — J3 |
| WU-M5-6 | Topic layout + article | `legacy/lib/site/topic-layout/**` → `.../pages/topic/` — J4 |
| WU-M5-7 | The 5 voting components | `.../topic-article/{vote,poll,cause,slider,hierarchy}/` → `.../features/voting/` — **slider + hierarchy get the most care (N11)** — J5, J6, J7 |
| WU-M5-8 | Comments tree | `.../topic-article/comments/**` → `.../features/comments/` — J8 |
| WU-M5-9 | Notifications + user menu | `legacy/lib/site/notifications/`, `.../user/` → `.../features/notifications/` |
| WU-M5-10 | Admin panel | `legacy/lib/admin/**` → `.../pages/admin/` — J9 |
| WU-M5-11 | Settings | `legacy/lib/settings/**` → `.../pages/settings/` — J10 |
| WU-M5-12 | Rich-text editor replacement | `democracyos-quill@0.19` → a maintained editor whose output round-trips `Clause.markup` and is re-sanitized server-side by WU-M4-11 (Q9) |
| WU-M5-13 | **Delete `legacy/`** | remove the quarantined tree (or archive it on a signed tag `legacy-reference-2026-08`), delete every `democracyos-*` component package reference | Allowed **only** when `e2e/SPEC-LEDGER.md` shows zero pending specs and `docs/CHARACTERIZATION.md` records a disposition for every legacy route. |

**Ratchet, staged:** `packages/client/src/api/**` → `.../features/**` → `.../pages/**` →
`packages/client/src/**/*.{ts,tsx}`.

**Journeys:** J1–J10 re-pointed at the new client one journey at a time. A journey may only be re-pointed when
it passes **without editing its assertions**. An assertion edit means the rebuild changed behaviour — which is
allowed, but only as an explicit reviewed decision recorded in `docs/CHARACTERIZATION.md`, never as a quiet fix.

**Definition of done:** `legacy/` is gone from `main`; no gulp/browserify/jade/Stylus anywhere; the whole client
at 100%; all journeys green against the new client through a real browser; the bundle is built by Vite and
served by `packages/server`.

---

### 4.8 M6 — New product capabilities

**Goal:** the things that make this a Romanian civic platform rather than a restored 2018 app.

**Depends on:** M4, M5. **Blocks:** M7, M8 (DPIA needs the final data model), v2 clustering.

| WU | Title | Files |
|---|---|---|
| WU-M6-1 | Content-type split debate/proposal/poll | `packages/{shared/src/contracts/content.ts, server/src/api/topics, client/src/pages/topic}` + the migration that adds the enum column |
| WU-M6-2 | Proposal lifecycle + forced outcome declaration | `packages/server/src/features/lifecycle/`, `packages/client/src/features/lifecycle/` — `open → closed → outcome-published`; **closing is blocked until "what happens with the result" is filled in** — enforced by the DB `CHECK` from WU-M3a-4 as well as the UI (N11) |
| WU-M6-3 | Verification ladder core (pluggable) | create `packages/server/src/features/verification/{ladder.ts,provider.ts,stages.ts}` — stage resolution is per-consultation config, providers are interchangeable |
| WU-M6-4 | Stage 1: email + Turnstile + account age | `.../verification/providers/turnstile.ts`; retire the reCAPTCHA config surface |
| WU-M6-5 | Stage 2: phone/SMS | `.../verification/providers/sms.ts` — **provider TBD (Q4)**; numbers are minimized, hashed at rest, in their own table, and **never joined to a vote row** (the FK simply does not exist) |
| WU-M6-6 | Stage 3: ROeID/EUDI adapter behind a feature flag | `.../verification/providers/roeid.ts` — the interface ships even if the relying-party agreement does not (N14); flag defaults off |
| WU-M6-7 | Art. 9 vote model completion | `packages/server/src/features/tally/`, pseudonym service — aggregate-only public output; the pseudonym is a per-consultation HMAC (Q15: key custody + rotation); RLS (WU-M3a-8) means even a leaked runtime credential cannot read raw vote rows outside a policy-approved path (N15) |
| WU-M6-8 | Hash-chained tally audit log | `packages/server/src/features/audit/chain.ts` on the WU-M3a-9 append-only table — pseudonym, topic, choice, timestamp, prev-hash; publish the chain head at close; public verification endpoint + a "verify this tally" UI affordance |
| WU-M6-9 | "Consultative, not a binding secret ballot" label | `packages/client/src/features/voting/ResultDisclaimer.tsx` — on **every** result surface |
| WU-M6-10 | Moderation tooling | `packages/server/src/features/moderation/` + `packages/client/src/pages/admin/moderation/` — post-moderation queue, report-content on every item, new-account throttle, flag auto-hide threshold, user mute/ban with reason log, per-consultation freeze switch |
| WU-M6-11 | Search | `legacy/lib/api-v2/search/` → `packages/server/src/features/search/` — **Postgres full-text (`tsvector` + GIN) instead of a second datastore**; a dividend of the pivot |
| WU-M6-12 | RO + EN i18n end to end | `packages/{shared/src/i18n,client/src/i18n}` — RO is the default locale; every new string ships in both |
| WU-M6-13 | Age gate 16 + consent capture | `packages/server/src/features/consent/` — granular explicit consent for voting/opinions (Art. 9(2)(a)), versioned, withdrawable, auditable |
| WU-M6-14 | Data-subject rights tooling | `packages/server/src/features/gdpr/{export.ts,erase.ts}` — access/portability/erasure. Erasure is now a **transaction with declared `ON DELETE` semantics** (WU-M3a-1): identity dies, the pseudonymous aggregate and the audit chain survive, and a test proves both halves. |
| WU-M6-15 | Notification digests + outcome notifications | `packages/server/src/notifications/digests.ts` — the "plan for the second visit" lesson from the platform's own history |

**Ratchet:** every new module is included in `.nycrc` from birth — new code is written test-first and never
enters a ratchet backlog.

**Journeys:** J1–J10 plus new ones: J11 verification-ladder escalation, J12 moderation queue, J13 outcome
publication, J14 data-subject export/erasure, J15 tally-chain verification.

**Definition of done:** all 15 WUs at 100%; the DPIA (workstream W-LEGAL) can be finalized because the data
model is frozen; no public surface exposes an individual vote; the erasure test proves tally integrity survives
a deletion.

---

### 4.9 M7 — Participatory budgeting module

**Goal:** the heavy differentiating module (N13), competing head-on with the Consul forks already deployed in
Brașov/Sinaia/Dumbrăvița.

**Depends on:** M6 (content types, lifecycle, verification ladder, moderation, Art. 9 vote model are all
prerequisites — PB reuses every one).

| WU | Title | Files |
|---|---|---|
| WU-M7-1 | Budget domain model | `packages/shared/src/contracts/budget.ts` + a Prisma migration — budget → headings → projects, each with a cost; money as `numeric`, never a float |
| WU-M7-2 | PB phase machine | `packages/server/src/features/pb/phases.ts` — accepting → review → selecting → finished, with dated transitions |
| WU-M7-3 | Project submission + eligibility review | `.../features/pb/submission.ts`, admin review UI |
| WU-M7-4 | Feasibility/evaluation workflow | `.../features/pb/evaluation.ts` — evaluator role, published verdicts with reasons |
| WU-M7-5 | Shopping-cart / knapsack voting | `.../features/pb/cart.ts` + `packages/client/src/features/pb/Cart.tsx` — budget-constrained selection enforced by a transactional `CHECK` on the server, not by the UI |
| WU-M7-6 | Support/approval voting alternative | `.../features/pb/support.ts` |
| WU-M7-7 | Results, allocation and outcome publication | `.../features/pb/results.ts` — reuses M6-8's audit chain and M6-2's outcome declaration |
| WU-M7-8 | Geographic scoping (district/commune) | `.../features/pb/scope.ts` — **without** collecting an address more precise than the operator needs (data minimization) |
| WU-M7-9 | PB admin dashboard | `packages/client/src/pages/admin/pb/` |

**Ratchet:** `packages/*/src/features/pb/**` from birth.
**Journeys:** J16 full PB cycle (submit → review → cart-vote → results published).
**Definition of done:** one complete PB cycle executed end-to-end on staging with fixture data, including a
mid-cycle freeze and an evaluation rejection with a published reason.

---

### 4.10 M8 — Compliance, accessibility, hardening completion

**Goal:** everything a live Romanian platform must have before it accepts a real citizen's vote. The *documents*
in this milestone were started in workstream W-LEGAL at M0; here they land, get reviewed and get wired into
the product.

**Depends on:** M6 (frozen data model) for the DPIA; M5 for the a11y audit; M4 for the hardening close-out.

| WU | Title | Files |
|---|---|---|
| WU-M8-1 | DPIA finalization | `docs/compliance/dpia.md` — ANSPDCP Decision 174/2018 item (b) applies (large-scale processing of political opinions). Doubles as the security design doc; cites the RLS policies and the erasure transaction as technical measures. |
| WU-M8-2 | Privacy notice + lawful-basis register | `docs/compliance/privacy-notice.{ro,en}.md`, `docs/compliance/ropa.md` — 6(1)(b) accounts, 6(1)(a)+9(2)(a) voting/opinions, 6(1)(f) anti-abuse. **If the dev/prod database is hosted outside the EEA, the transfer analysis lands here (Q3).** |
| WU-M8-3 | ToS + DSA hosting baseline | `docs/legal/tos.{ro,en}.md`, notice-and-action endpoint, statement-of-reasons on every removal, published contact point (enforcer: ANCOM, Law 50/2024) |
| WU-M8-4 | Cookie consent (non-essential only) + impressum + `security.txt` | Law 506/2004, Law 365/2002 art. 5 |
| WU-M8-5 | WCAG 2.1 AA audit + remediation | `packages/client/**` + `docs/compliance/accessibility.md` — axe in CI (advisory lane), keyboard-only pass on all 5 voting methods, Romanian screen-reader spot check |
| WU-M8-6 | Cloudflare + Turnstile production posture | `docs/ops/cloudflare.md` — proxy, WAF, origin hidden, edge rate limits |
| WU-M8-7 | Mail deliverability | SPF/DKIM/DMARC `p=reject`; `docs/ops/email.md` |
| WU-M8-8 | Encrypted off-site backups | `scripts/ops/{backup.sh,restore.sh}`, `docs/ops/backup-restore.md` — `pg_dump`/`pg_basebackup`, automated, encrypted, off-site, with documented RTO/RPO **and a point-in-time-recovery decision (WAL archiving yes/no)** |
| WU-M8-9 | **Incident-response runbook** | create **`docs/RUNBOOK.md`** — the solo-operator playbook, written as executable steps with exact commands, not prose: (a) **enable read-only mode** (platform-wide switch that keeps content readable but blocks writes/votes — cleanly implementable now as a Postgres role swap plus an app flag); (b) **rotate every secret** (JWT signing key, `DATABASE_URL` credentials, mailer, Turnstile, Cloudflare tokens) in the order that avoids locking yourself out; (c) **block an ASN / country / IP range at Cloudflare** during a coordinated-inauthentic-amplification event (the 2024 Romanian threat model is not hypothetical); (d) **restore from backup** into a clean environment; (e) the **GDPR 72-hour breach-notification path** to ANSPDCP with the "is this notifiable" decision tree; (f) a **pre-drafted user-notice template** in RO and EN, so nobody drafts a breach notice under pressure at 2 a.m. |
| WU-M8-10 | **Rehearsed 30-minute kill-switch + restore drill** | `docs/ops/drill-log.md` | **Exit item for this milestone, not a nice-to-have.** From a cold start, on the clock: trip read-only mode → rotate the signing key → restore the database from the most recent off-site backup into a clean environment → verify with the e2e smoke suite → stand the platform back up. Target: under 30 minutes. Log the actual elapsed time, what went wrong, and the runbook corrections. A runbook that has never been executed is fiction. |
| WU-M8-11 | Retention + deletion schedule | implemented as a job, not a promise: `packages/server/src/features/gdpr/retention.ts` (expired tokens, stale unverified accounts, log retention) |
| WU-M8-12 | Secrets rotation re-check + runtime injection audit | re-run the WU-M0-7 history sweep against everything added since; confirm no secret reaches an image layer, a log line, or `docker-compose.prod.yml`; update `docs/ops/secrets.md` |
| WU-M8-13 | Security review pass | run the `security-review` skill over the full diff; opengrep/semgrep + gitleaks + osv clean; explicit check that no `$queryRawUnsafe` slipped in |

**Ratchet:** any new code (retention job, notice-and-action endpoint, read-only switch) at 100%.
**Journeys:** J17 notice-and-action report → statement of reasons; J18 cookie consent gating; J19 read-only
mode blocks writes while keeping reads green.
**Definition of done:** DPIA signed off; all legal documents published in RO and EN; `docs/RUNBOOK.md` exists
**and has been executed** in the WU-M8-10 drill with the elapsed time logged; restore performed from a real
backup into a clean environment; axe clean on the golden journeys; no secret anywhere it should not be.

---

### 4.11 M9 — Release pipeline and launch

**Depends on:** gate 3 green (N18 defers this workflow until then) and M8.

| WU | Title | Files |
|---|---|---|
| WU-M9-1 | Production Dockerfile (multi-stage, non-root, Node 22) | `Dockerfile` — **built by CI**, so the broken local Docker daemon is irrelevant (R12) |
| WU-M9-2 | GHCR release workflow | `.github/workflows/release.yml` — semver + SHA tags, provenance, **GPL-3.0 corresponding-source link in the package description** (N16) |
| WU-M9-3 | One-command deploy + rollback | `scripts/ops/deploy.sh`, `docs/ops/deploy.md`, `docker-compose.prod.yml` (app + **PostgreSQL 16**, secrets injected at runtime, `prisma migrate deploy` as an explicit pre-start step run as `app_migrator`, TLS via Let's Encrypt, Cloudflare in front, DB port unpublished) |
| WU-M9-4 | Staging environment + smoke suite | the e2e suite pointed at staging, run post-deploy |
| WU-M9-5 | Observability | health/readiness endpoints, structured logs, uptime alerting, error tracking, slow-query logging (no PII in logs — Art. 9 discipline) |
| WU-M9-6 | `<BRAND>` landing + attribution | `<BRAND>.ro` live, fork attribution, source link, contact point, the "consultative" explainer |
| WU-M9-7 | Launch runbook + go/no-go checklist | `docs/ops/launch.md` — includes the R1 asociație trigger check, a confirmation that the WU-M8-10 drill was rehearsed, and a migration-rollback rehearsal |

**Definition of done:** an image tagged `v3.0.0` + SHA in GHCR; a one-command deploy to production from a
clean machine; migrations applied by `app_migrator` and the runtime connecting as `app_runtime`; the e2e suite
green against production; the go/no-go checklist signed.

---

### 4.12 v2 — Native Polis-style opinion clustering (post-launch flagship)

Deliberately out of the launch critical path. Depends on real slider/hierarchy/poll data volume from M6.

| WU | Title |
|---|---|
| WU-V2-1 | Opinion-matrix collection from existing vote data (a SQL problem now, not a map-reduce one) |
| WU-V2-2 | Dimensionality reduction + clustering (PCA/UMAP + k-means, deterministic seeds so results are reproducible and auditable) |
| WU-V2-3 | Consensus/divisive statement surfacing |
| WU-V2-4 | Cluster visualization UI |
| WU-V2-5 | Statement submission + routing (the Polis interaction loop) |
| WU-V2-6 | Art. 9 review of clustering output — cluster membership is itself an inference about political opinion and must not be individually attributable |

---

## 5. Coverage ratchet — the whole schedule in one table

`.nycrc` `include[]` grows monotonically. The percentage never moves (100/100/100/100). `exclude[]` always
holds `legacy/**`, `e2e/**`, `**/*.d.ts`, `**/*.config.ts`, `**/prisma/migrations/**`, `**/generated/**`
(the Prisma client is generated code, not authored code).

| After | `include[]` |
|---|---|
| M0 | `[]` |
| M2 | `[]` (unchanged — M2 adds governance, not code) |
| M3a | `packages/server/src/db/**/*.ts`, `scripts/db/**/*.ts` |
| M3b | `+ packages/shared/src/**/*.ts` |
| M4 stage 1 | `+ packages/server/src/auth/**/*.ts` |
| M4 stage 2 | `+ packages/server/src/middlewares/**/*.ts`, `+ packages/server/src/richtext/**/*.ts` |
| M4 stage 3 | `+ packages/server/src/**/*.ts` (collapses the above) |
| M5 stage 1 | `+ packages/client/src/api/**/*.ts` |
| M5 stage 2 | `+ packages/client/src/features/**/*.{ts,tsx}` |
| M5 stage 3 | `+ packages/client/src/**/*.{ts,tsx}` |
| M6 → v2 | no new globs needed — `packages/*/src/**` already covers new code, which is written test-first |

**Rules:**

- A ratchet entry is added in the same commit that brings that scope to 100%, never before. A WU that cannot
  reach 100% on its scope is not "done with a follow-up" — it is not done.
- **The threshold is never lowered, and the scope never shrinks.** The only sanctioned escape hatch for a
  genuinely unreachable branch is the `/* c8 ignore next */` discipline in §8.3 — never a threshold edit,
  never an `exclude[]` addition to dodge a hard file.
- Generated Prisma output is excluded because it is not authored; **hand-written wrappers around it are not**,
  and that boundary is where the repository layer (WU-M4-2) earns its coverage.

---

## 6. Parallelization map

The orchestrator can run these as concurrent workstreams. **The spine is strictly sequential; everything else
is not.**

### 6.1 Strictly sequential spine

```
M0 ─▶ M1 ─▶ M2 ─▶ M3a ─▶ M3b ─▶ M4 ─▶ M5 ─▶ M6 ─▶ M7
                                                 └▶ M8(code) ─▶ M9
```

Non-negotiable orderings and why:
- **M0 first** — nothing can be written until the workspace, the coverage plumbing and a reachable Postgres exist.
- **M1 before M3b/M4/M5** — the specs are the specification of record; porting without them is transliteration.
  (Post-pivot, M1-before-M2 is *convention*, not safety: the relocation it used to protect now happens in M0 and
  cannot break anything, because nothing executes `legacy/`.)
- **M3a before M3b/M4** — contracts and repositories mirror the schema; designing them in the other order means
  designing twice.
- **M3b before M4 and M5** — both import the contracts.
- **M4 before M5** — the client is built against stable typed endpoints, not a moving target.
- **M6 before M7** — PB reuses the lifecycle, verification ladder, moderation and Art. 9 vote model wholesale.
- **gate 3 green before M9's release workflow** (N18).

### 6.2 Parallel workstreams (start date → end)

| Workstream | Starts | Runs until | Independent of |
|---|---|---|---|
| **W-LEGAL** — DPIA drafting, privacy notice, ToS/DSA texts, asociație research, retention schedule | M0 | M8 | all code milestones; only *finalization* needs M6's frozen data model |
| **W-BRAND** — name shortlist → OSIM/EUIPO + `.ro` availability → registration → logo/tokens | M0 | needed by WU-M2-6 (`<BRAND>` substitution) and WU-M9-6 | everything else |
| **W-ROeID** — relying-party inquiry, terms, sandbox access | M0 (longest external latency in the program) | WU-M6-6 | everything; the adapter ships behind a flag regardless |
| **W-INFRA** — hosting selection (**including managed-vs-self-hosted Postgres and its transfer analysis**), DNS, TLS, Cloudflare, SMTP + SPF/DKIM/DMARC, backup target | M0 (earlier than before — the dev-DB decision is immediate) | M8/M9 | the port |
| **W-SMS** — SMS provider selection, GDPR processor agreement, cost model | M4 | WU-M6-5 | the port |
| **W-A11Y** — WCAG audit tooling, Romanian screen-reader testing | M5 | M8 | server work |
| **W-PB-DESIGN** — PB information architecture, cart UX prototypes, Consul/Decidim parity study | M5 | feeds M7 | server work |
| **W-DOCKER** — repair the local Docker daemon | any time | when it is fixed | **everything** — this is explicitly *not* on any critical path (R12) |

### 6.3 Intra-milestone parallelism

| Milestone | Parallel | Serial |
|---|---|---|
| M0 | -3, -6, -7, -8, -9 parallel after -1; -5 parallel with -4 | -1 → -2 first (the move, then the root manifest); -4 after -2 |
| **M1** | **WU-M1-2 … WU-M1-11 (all 10 journeys) fully parallel after WU-M1-1** — the widest parallelism in the program | -1 first; -13 feeds the journeys; -12, -14, -15 last |
| M2 | -1/-2 parallel; -5, -6 parallel | -3 after -1/-2; -4 during shadow |
| M3a | -2, -3, -4, -7 parallel after -1; -8, -9 parallel | **-1 (design record) strictly first**; -5 after -4; -6 after -4; -10 after all tables; -11 last |
| M3b | -1 … -6 parallel; -7/-8/-9 parallel after them | contracts depend on validators and on M3a's enums |
| M4 | -4 … -6, -8 … -10, -15, -16 parallel per route group after -1/-2/-3; -11, -13, -14 parallel | -1 → -2 → -3 first; -7 before -15; -12 before the milestone exits |
| M5 | -4 … -11 parallel per page area after -1/-2/-3 | -13 strictly last, and only on a zero-pending ledger |
| M6 | -1/-2 pair; -3 → (-4,-5,-6) parallel; -7/-8/-9 chain; -10/-11 pair; -12 … -15 parallel | -3 gates the three providers |
| M7 | -3, -4 parallel after -1/-2; -5/-6 parallel; -8, -9 parallel | -1 → -2 first, -7 after voting |
| M8 | nearly everything parallel | -1 needs M6 frozen; **-9 before -10** (the runbook must exist before it can be drilled); -13 last |
| M9 | -4, -5, -6 parallel after -1/-2 | -1 → -2 → -3; -7 last |

### 6.4 Practical dispatch shape

Three concurrent lanes is the sustainable maximum for a solo maintainer with agent assistance: **one code lane
on the spine**, **one document/external lane (W-LEGAL + W-BRAND + W-ROeID + W-INFRA)**, **one review lane**
(fresh adversarial reviewers, never the implementer). M1 is the exception — dispatch all 10 journey WUs at once.

---

## 7. Risk register

**Dropped by the pivot (recorded so nobody re-adds them):** *legacy Docker boot failure* — nothing is booted;
*native modules on Node 22 / the lockfile-less 2018 install wall* — the legacy tree is never installed;
*`passport-local-mongoose` hash carry-over* — there are no accounts to carry over, argon2id is used from the
first user; *strangler session-sharing across two servers* — there is no second server. Four risks deleted, three
added.

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Personal-liability window.** Operating a live Art. 9 processor personally exposes the owner to controller duties, user-content and defamation liability with no corporate shield (N20). | **High** | Hard rule: the asociație (OG 26/2000) must exist **before** the platform holds real vote data at meaningful scale. Until then: data minimization to the bone, invite-limited pilot forums, no municipal partnership signed, insurance question raised in W-LEGAL. Make the trigger explicit and measurable (Q8) and put the check in the WU-M9-7 go/no-go list. |
| R2 | **ROeID relying-party access is NOT-CHECKED** — whether a private/NGO platform can be a relying party at all is unknown, and RoEUDIW is legally due Dec 2026 with Romania in the laggard tier. | **High** (feature) / Low (launch) | The ladder is *pluggable by design* (WU-M6-3): stage 3 is an adapter behind a flag. Launch on stages 1–2. W-ROeID starts at M0 because the latency is administrative. **Never make launch depend on it.** |
| R3 | **NEW — no running reference.** Behaviour is derived by reading 2016-era JavaScript, so a misread becomes a silently wrong specification, and there is no "diff against the old system" to catch it. | **High** | Three controls, all mandatory: (a) **every assertion cites `file:line`** and an unsourced assertion is a review rejection (§4.2); (b) the **adversarial reviewer re-derives from the cited source independently**, never from the spec author's summary; (c) `docs/CHARACTERIZATION.md` records a disposition — *ported / changed deliberately / not ported* — for **every** legacy route, so silence is never mistaken for coverage. Accepted residual: this is a rewrite, so "different from 2018" is frequently correct; the control catches *unintentional* difference only. Upstream `add/api-tests` (WU-M1-13) is the one place where legacy expectations are written down by their own authors — harvest it first. |
| R4 | **NEW — document → relational redesign.** The legacy model leans on embedded arrays (`Comment.votes[]`, `flags[]`, `replies[]`), free-form values and Mongoose virtuals. A naive 1:1 translation produces either a `jsonb` swamp or an over-normalized schema that is painful to query. | **Medium-High** | WU-M3a-1 makes the mapping an explicit, reviewed design document **before any migration is written**, with §2.4 as its skeleton and a stated `jsonb` allow-list. Each decision ships with a constraint test that proves the intended integrity property actually fires. The redesign is *the point of the pivot*, so it gets a dedicated milestone rather than being smuggled into the server port. |
| R5 | **NEW — Prisma + RLS learning curve and migration discipline.** Prisma does not model row-level security natively; RLS needs raw-SQL migrations plus a session variable set inside an interactive transaction, and a misconfigured runtime role (or an accidental `BYPASSRLS`) silently disables the whole protection. Migration mistakes are also harder to undo than a schemaless write. | **Medium-High** | WU-M3a-8 ships RLS **with a test that proves a policy blocks a read** — an untested policy is treated as absent (Q14). Three DB roles with `app_runtime` owning nothing. WU-M3a-11 enforces forward-only migrations, one per WU, an expand→migrate→contract rule for destructive changes, and a `prisma migrate diff` drift check in CI. `$queryRawUnsafe`/`$executeRawUnsafe` are lint-banned (WU-M2-2). Budget a deliberate spike inside M3a rather than learning during M4. |
| R6 | **PB scope size.** M7 is a product in its own right against incumbents with years of deployment. | Medium-High | M7 is deliberately *after* launch-critical M6/M8 — the platform can go live without PB. PB reuses M6 primitives instead of inventing parallel ones (a hard review criterion). Ship the simplest complete cycle first (WU-M7-1/2/3/5/7). **Flag:** the locked decision is to BUILD PB; if the schedule slips it is the most defensible fast-follow — a user decision (Q11), not a plan decision. |
| R7 | **Solo-maintainer load** — the failure mode that actually killed DemocracyOS (organizational, not technical). | **High** | Automation-first: qzp gates + Dependabot auto-PRs + advisory e2e + one-command redeploy form the "maintainer of last resort". Accept slow feature velocity explicitly. Recruit 1–2 co-maintainers from the Code for Romania / civic-tech orbit **post-launch, with a working platform as the pitch**. Every milestone's docs are written for a stranger, because the stranger might be the next maintainer. |
| R8 | **qzp gate 1 red-walls the quarantined tree** — `oxlint --deny-warnings` over 19.9k lines of 2016 JS that will never be modernized. | Medium | Discovered *in shadow*, where it cannot block. Primary mitigation is the `legacy/` quarantine plus ignore configuration (WU-M0-3, WU-M2-4); the `.oxlintrc.json`-vs-CLI-flag precedence is **ANSWERED (Q6, WU-M2-4): config ignorePatterns merge with the CLI flags, so `legacy/` is contained** — the archive-tag escalation is not needed. Residual until the 3 shadow runs confirm on ubuntu. |
| R9 | **100% branch coverage on rebuilt behaviour** — the ledger's own red-team note calls this the dominant cost driver. | Medium | The ratchet is the mitigation: coverage is a *byproduct of test-first building*, never a retrofit. A legacy branch that cannot be justified by a spec is not ported at all — deletion is an allowed and preferred outcome, and the pivot makes it easier (nothing has to keep running). Genuinely unreachable defensive branches use the §8.3 `/* c8 ignore next */` discipline, never a threshold change. |
| R10 | **Brand/domain unavailability** could force a rename after package names are baked in. | Low-Medium | Scopes start as the greppable literal `@dosrevival/*`; WU-M2-6 is the single rename commit; nothing technical blocks on it. |
| R11 | **A secret may already exist in the fork's git history**, and history is public. | Medium | WU-M0-7 audits the **whole history** and rotates anything ever committed on the "assume public" principle; WU-M8-12 re-checks before launch; gitleaks runs as gate 5 on every subsequent commit. Production secrets are runtime-injected only. |
| R12 | **The local Docker daemon is currently broken.** | **Low — flagged, not blocking** | It affects exactly one optional thing: the local dev Postgres container (path A in §4.1). Path B (native or hosted Postgres, `DATABASE_URL` only) is the documented default, and **no script may require Docker for development**. It does **not** affect the release artifact: the GHCR image (N18, WU-M9-1/-2) is built by CI on GitHub runners, and CI provisions Postgres as a service container. W-DOCKER repairs it opportunistically. |
| R13 | **NEW — permanently pending specs.** M1 writes specs that are red by design; if activation slips, the suite becomes decorative amber and the program loses its only correctness signal. | Medium | `e2e/SPEC-LEDGER.md` assigns every spec an activation milestone and WU; each milestone's definition of done names the specs it must flip to active; the advisory workflow prints the pending/active ratio every run; **M5 may not delete `legacy/` while any spec is pending**, which makes the ratio a hard gate rather than a metric. |

---

## 8. Cross-cutting non-negotiables — every work unit must honor these

Every WU's adversarial review checks all ten. A WU failing any one of them is rejected regardless of feature completeness.

1. **TDD, always.** Write the failing test, watch it fail for the right reason, implement minimally, watch it
   pass, commit. Applies to rebuilt behaviour too: the test is written against the *characterized behaviour*
   (with its source citation), not against the legacy implementation's shape.
2. **100% line + branch on the current ratchet scope.** Run the project's own `npm run test:coverage`. Never
   quote a coverage number from memory; if the scope is not yet ratcheted, say `NOT-CHECKED` rather than implying a pass.
3. **Unreachable-branch discipline.** 100% means *every reachable branch tested and every ignored branch
   justified*. A genuinely unreachable defensive branch — a config-load fallback that cannot fire under a
   validated schema, an exhaustive-switch `default`, a Prisma error class the constraint makes impossible — is
   marked with an explicit `/* c8 ignore next */` (or `ignore next N` / `ignore else`) **plus a one-line
   justification comment on the same or preceding line**, and is called out in the PR description for review.
   **Never lower a threshold. Never widen `exclude[]` to dodge a hard file. Never add a bare ignore with no
   reason.** An unjustified or unreviewed ignore is a review rejection, exactly like an untested branch.
4. **Never `--no-verify`. Never `git push --force`** without explicit owner approval. Never skip hooks.
5. **GPL-3.0 discipline.** Keep the license and the upstream attribution; new files carry the project header;
   AGPL dependencies only knowingly and only after a recorded decision (borrowing Consul/Decidim *code* pulls the
   combined work to AGPL — borrowing their *ideas* does not). Upstream stays a **read-only** remote: cherry-pick
   `add/api-tests` and `add/i18next`, never merge `master` (N19).
6. **Never collect CNP.** Not in a form, not in a log, not in a "temporary" verification field, not in a comment.
7. **Art. 9 handling for votes and opinions.** Aggregate-only public output; pseudonymized payload; no endpoint,
   log line, CSV export or admin screen may reveal an individual's vote; RLS is enforced and tested, not assumed;
   every result surface carries the "consultative, not a binding secret ballot" label.
8. **Secrets never enter the repo or an image layer.** Runtime injection only; anything ever committed is
   treated as public and rotated (WU-M0-7); gitleaks gate 5 is not optional. `DATABASE_URL` is a secret.
9. **Stay in declared file scope**, and **never execute anything under `legacy/`.** It is a read-only reference:
   no import, no require, no script entry, no CI step, no container. Reading it is the point; running it is a
   review rejection.
10. **No silent passes, semantic e2e only.** A gate that skips is reported as skipped; a check that could not
    run emits `NOT-CHECKED`; a coverage lane with nothing to measure says so; a pending spec is reported as
    pending, never quietly deleted. e2e uses role/text selectors — no DOM selectors, no visual-diff services —
    and every activated journey stays green at every commit that touches a runtime path.

Plus the process rules from the repo's own workflow enforcement: run `/self-reflect` and commit the
knowledge-base updates **before** the PR that finishes a development branch, and never self-certify — the
orchestrator validates independently with fresh reviewers.

---

## 9. Open questions

Must be resolved **before** the milestone in the "needed by" column. An unresolved question is a blocker, not a footnote.

| # | Question | Needed by | Owner / route | Status |
|---|---|---|---|---|
| Q1 | **Final brand name `<BRAND>`** + `.ro` domain + OSIM/EUIPO clearance. Shortlist ranked: Agora family (1st), Participă family (2nd), Dezbatem family (3rd/4th), Voce family retained. | WU-M2-6 (substitution), WU-M9-6 | W-BRAND; availability check dispatched | **Pending** — availability report outstanding |
| Q2 | **ROeID relying-party terms** — can a private/NGO platform be a relying party; cost; sandbox; timeline. RoEUDIW as the fallback path. | WU-M6-6 | W-ROeID inquiry, sent at M0 | **NOT-CHECKED** |
| Q3 | **Hosting target + monthly budget — now including whether Postgres is self-hosted or managed**, and if managed, the provider's region and the GDPR transfer analysis for Art. 9 data. | M0 (dev choice), WU-M8-2, WU-M8-6, WU-M9-3 | W-INFRA | **Open — escalated by the pivot** |
| Q4 | **SMS provider** for verification stage 2 — cost per message in RO, deliverability, GDPR processor agreement, whether numbers can be stored hashed-only. | WU-M6-5 | W-SMS | **Open** |
| Q5 | **Is there legacy production data to migrate?** | — | Owner | **RESOLVED — no, and now moot.** Zero users, no deployed instance; post-pivot there is no migration path at all (fresh Postgres, seeded fixtures). |
| Q6 | **Does `.oxlintrc.json` `ignorePatterns` win over the workflow's CLI `--ignore-pattern` flags?** Determines whether `legacy/` can stay in-repo at all. | WU-M2-4 | Verify empirically in shadow phase | **ANSWERED (WU-M2-4, 20.08.2026) — YES, they survive: they MERGE with the CLI flags rather than being replaced.** Both-states, workflow-exact command (`oxlint@1.69.0 --deny-warnings` + the 7 `--ignore-pattern` flags, run locally on this tree): config present → 0 legacy findings, exit 0, and a planted warning in `packages/shared` still fires (so the scan is real); config removed → 145 legacy warnings, exit 1. Biome side: the workflow honors the caller `biome.json` (auto-discovery); its `files.includes` negation excludes `legacy/**` — workflow-exact `biome@2.5.0 ci` checked 27 files, exit 0. `legacy/` stays in-repo; no R8 escalation. Residual: measured on Windows; the 3 shadow runs (ubuntu) are the confirming environment. |
| Q7 | **Does `passport-local-mongoose` v4's hash format verify under the new stack?** | — | — | **RESOLVED — moot.** No legacy accounts exist; argon2id is used from the first registration. |
| Q8 | **Asociație trigger** — the precise, measurable threshold at which personal operation must stop. | Before the first real consultation | W-LEGAL + owner | **Open** |
| Q9 | **Rich-text editor replacement** for `democracyos-quill@0.19` — must round-trip `Clause.markup`. | WU-M5-12 | Decide during M5 | **Open** |
| Q10 | **Which qzp reusable-workflow SHA** to pin, and who bumps it (wave dispatcher vs. manual). | WU-M2-1 | Read from qzp `bump-workflow-shas-wave.yml` at enrollment time | **Open** |
| Q11 | **Is PB required in the launch release**, or acceptable as the first post-launch feature if the schedule slips? Locked decision says BUILD; R6 flags it as the most defensible descope. | Before M7 starts | Owner | **Open — flagged, not assumed** |
| Q12 | **Stylus: keep or migrate** (WU-M5-2), and does the server need a server-rendered shell beyond the SPA host page? | WU-M5-1/-2 | Decide at task time during M5 | **Open** |
| Q13 | **NEW — which dev-Postgres path is the default for this machine right now:** native Windows/WSL2 install, or a hosted dev instance? (Docker is broken; both paths are supported, but `docs/develop/database.md` should name the one actually in use, and a hosted instance interacts with Q3.) | WU-M0-5 | Owner | **Open — needs a decision at M0** |
| Q14 | **NEW — how is RLS enforced through Prisma?** Interactive transaction + `SET LOCAL app.current_user` with a non-`BYPASSRLS` runtime role, versus enforcing in the application layer with RLS as defence-in-depth only. Whichever is chosen must be **proven by a test that shows a policy blocking a read**. | WU-M3a-8 | Decide + prove in M3a | **NOT-CHECKED** |
| Q15 | **NEW — vote-pseudonym key custody.** Per-consultation HMAC key: where is it stored (KMS? env? DB?), who can read it, is it rotated, and what happens to old tallies when it rotates? Getting this wrong turns "pseudonymous" into "identifiable" and breaks the Art. 9 posture (N15). | WU-M6-7 (design input to WU-M3a-5) | Owner + W-LEGAL, feeds the DPIA | **Open** |

*Task-time decisions (recorded in their WU, not blocking):* `comment.score` as a view versus a maintained
counter (WU-M3a-6); WAL archiving / point-in-time recovery (WU-M8-8).

---

## 10. Milestone dependency graph

```
W-LEGAL   ════════════════════════════════════════════════════════▶ M8 docs
W-BRAND   ════════════════▶ (WU-M2-6 <BRAND> substitution)  ═══════▶ M9-6
W-ROeID   ════════════════════════════════════════▶ WU-M6-6
W-INFRA   ═════▶ (dev DB choice, Q13) ═══════════════════════════════▶ M8/M9
W-SMS                      ══════════════════════▶ WU-M6-5
W-A11Y                              ══════════════════════▶ M8-5
W-PB-DESIGN                         ═══════════════════════════▶ M7
W-DOCKER  ┄┄┄┄ opportunistic, on no critical path ┄┄┄┄

M0 ──▶ M1 ──▶ M2 ──▶ M3a ──▶ M3b ──▶ M4 ──▶ M5 ──▶ M6 ──┬──▶ M7
                                                          └──▶ M8 ──▶ M9 ──▶ (v2 clustering)
```

---

## 11. Success criteria (program level)

- [ ] The app is modern: Node 22, Express 5, **PostgreSQL 16 + Prisma**, React 18, TypeScript throughout; zero
      gulp/browserify/jade/Stylus; **no MongoDB or Mongoose anywhere**; `legacy/` deleted.
- [ ] Green semantic e2e suite (J1–J19) against production, run post-deploy, with **zero pending specs**.
- [ ] Lean 6-gate qzp CI, `phase: absolute`, pinned SHA, caller concurrency + timeout.
- [ ] 100% line + branch across `packages/server`, `packages/client`, `packages/shared` — three flags, one
      report — with every `c8 ignore` justified and PR-reviewed.
- [ ] Database integrity proven by test: one-person-one-vote enforced by a unique constraint, tallies written
      transactionally, RLS blocking a cross-user read, the audit table rejecting `UPDATE`/`DELETE`.
- [ ] Releases: Docker image on GHCR, semver + SHA, built in CI; no native installers.
- [ ] Live public Romanian platform on `<BRAND>.ro`, RO + EN.
- [ ] GDPR: DPIA done, lawful bases documented, data-subject tooling working (erasure preserves tally
      integrity, proven by test), age gate 16, no CNP anywhere.
- [ ] DSA hosting baseline: ToS, notice-and-action, statement-of-reasons, published contact point.
- [ ] WCAG 2.1 AA on the golden journeys.
- [ ] All 5 voting methods + multi-forum hub + content-type split + lifecycle with forced outcome declaration.
- [ ] Verification ladder live at stages 1–2, stage 3 adapter present behind a flag.
- [ ] Hash-chained tally audit log, publicly verifiable; "consultative" label on every result surface.
- [ ] Participatory budgeting: one complete cycle executed.
- [ ] `docs/RUNBOOK.md` written **and rehearsed**: the 30-minute kill-switch + restore drill executed with the
      elapsed time logged, and no secret ever committed left unrotated.
- [ ] (v2) Native opinion clustering shipped.

---

## 12. Work-unit template

Every WU is dispatched with this shape, and its adversarial review checks §8 in full.

````markdown
### WU-<Mx>-<n>: <Title>

**Milestone:** M<x> · **Depends on:** WU-… · **Parallel with:** WU-…

**Files:**
- Create: `exact/path/new.ts`
- Modify: `exact/path/existing.ts:LINE-LINE`
- Test:   `exact/path/new.spec.ts`
- Migration (if any): `packages/server/prisma/migrations/<ts>_<name>/migration.sql`

**Characterized behaviour (for rebuild WUs):** the journey/assertion that defines correct behaviour, quoted,
**with its legacy source citation** (`legacy/lib/...:LINE-LINE`).

**Specs activated by this WU:** J<n>… (moved from `pending` to `active` in `e2e/SPEC-LEDGER.md`)

**Step 1 — Write the failing test**
```ts
import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../src/email/normalize';

// src: legacy/lib/normalize-email/index.js:12-38
describe('normalizeEmail', () => {
  it('strips gmail dots and plus-aliases when aliases are disallowed', () => {
    expect(normalizeEmail('First.Last+civic@Gmail.com', { allowEmailAliases: false }))
      .toBe('firstlast@gmail.com');
  });
});
```

**Step 2 — Run it and confirm it fails for the right reason**
Run: `npm run test -w packages/shared -- normalize`
Expected: FAIL — `Cannot find module '../src/email/normalize'`

**Step 3 — Minimal implementation** (no speculative generality — YAGNI)

**Step 4 — Run tests + coverage**
Run: `npm run test:coverage`
Expected: PASS, and 100% line + branch on the current ratchet scope.

**Step 5 — Any unreachable branch?**
Add `/* c8 ignore next */` **with a one-line justification** and call it out in the PR body.
Never lower a threshold, never widen `exclude[]`.

**Step 6 — Ratchet (only if this WU completes a scope)**
Add the glob to `.nycrc` `include[]` in this same commit.

**Step 7 — Journeys**
Run: `npx playwright test` — the activated journeys must be green; the pending count must not grow.

**Step 8 — Commit** (never `--no-verify`)
```bash
git add <exact paths>
git commit -m "feat(shared): implement email normalization in packages/shared"
```

**Definition of done:**
- [ ] Tests written first, failed first, now pass
- [ ] 100% line + branch on the ratcheted scope (or explicit `NOT-CHECKED` if out of scope)
- [ ] Every `c8 ignore` justified and flagged for review
- [ ] Named journeys activated and green; pending ledger updated
- [ ] Source citations present for every characterized behaviour
- [ ] No files touched outside the declaration; nothing under `legacy/` executed
- [ ] §8 cross-cutting rules honored
````

---

## 13. Provenance

- **Decision source:** `~/Cowork/output/democracyos-grill-ledger_2026-08-18.md` (grill-me-extensive, 3 scouts +
  4 lenses, CONVERGE locked 18.08.2026), **plus the `⚠️ PIVOT` block at `:254-257` (18.08.2026, post-grill)**
  which supersedes TIER-0 A3 (Mongoose 8) and A4 (Mongo dump/restore) and changes the characterization strategy.
  This plan derives from the locked log and does not relitigate it.
- **Repo grounding:** `C:/Users/Prekzursil/source/democracyos` @ v2.11.16 mirror, read-only, 18.08.2026.
  Models re-read for the relational mapping: `lib/models/{topic,comment,vote,user,tag,notification,token}.js`,
  `lib/models/forum/index.js`.
- **qzp grounding:** `C:/Users/Prekzursil/source/qzp-lean` — `.github/workflows/reusable-quality.yml`,
  `docs/ONBOARDING.md`, `inventory/repos.yml`, `profiles/repos/{reframe,codeblocks-pretty-prints-stable}.yml`.
- **Plan-review gate:** PASSED (feasibility · completeness · scope & alignment). Reviewer fixes retained across
  the pivot: unreachable-branch discipline (§5 rules, §8.3, §12 step 5), `docs/RUNBOOK.md` + the rehearsed
  30-minute kill-switch/restore drill (WU-M8-9/-10, M8 exit criteria, §11), secrets-history audit and rotation
  (WU-M0-7, WU-M8-12, R11, §8.8), upstream cherry-pick posture (WU-M0-8, WU-M1-13, WU-M3b-6, N19, §8.5), and the
  "no legacy production data" clarification (§4.1, Q5). The M0 boot fallback ladder was **superseded**, not
  dropped: it is replaced by the dev-Postgres two-path rule (§4.1), which serves the same purpose — never let a
  single unavailable runtime block the program.
- **NOT-CHECKED in this plan:** ROeID relying-party feasibility (Q2); `.oxlintrc.json` vs. CLI ignore-flag
  precedence (Q6); brand/domain/trademark availability (Q1); the current qzp reusable-workflow SHA (Q10); the
  Prisma-plus-RLS enforcement mechanism (Q14); the contents of upstream `add/api-tests` and `add/i18next`
  (inventoried from the ledger, branches not fetched); OSIM/EUIPO registries; **the local Docker daemon (known
  broken — path A of §4.1 is unverified on this machine)**; and, by design and permanently, **the runtime
  behaviour of the legacy application, which is never executed** — its behaviour is asserted from source with
  citations, and R3 is the risk that buys.
