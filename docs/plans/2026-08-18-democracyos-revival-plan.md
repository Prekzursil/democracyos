# DemocracyOS Revival (`<BRAND>`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: after this plan passes the plan-review gate and the user picks an execution method, use the chosen execution skill (subagent-driven-development or executing-plans) to implement task-by-task.

**Goal:** Revive the dead GPL-3.0 DemocracyOS fork (`Prekzursil/democracyos`) into a live, public Romanian civic-participation platform, modernized to a TypeScript monorepo under qzp's lean quality gates with 100% line+branch coverage across backend/frontend/midend, green semantic e2e, multi-OS Docker release, and full GDPR/DPIA/DSA compliance.

**Architecture:** Option B — a TypeScript monorepo (`packages/server` + `packages/client` + `packages/shared`) ported **strangler-style** behind the dockerized legacy app (node:6 + mongo:3.2). A new Express 5 + Mongoose 8 server on Node 22 progressively takes over routes from the legacy container; the legacy app stays the behavioral reference until every route group is migrated and characterized by e2e tests. `packages/shared` is the "midend": isomorphic code (API contracts, config schema, validators, i18n helper, privileges) executing on both sides of the wire.

**Tech Stack:** TypeScript, Node 22, Express 5, Mongoose 8 (MongoDB 7), Vite + React 18, Playwright (semantic selectors), c8 coverage, Biome + oxlint (qzp gate 1), `jose` (JWT), argon2id, zod (shared contracts), Cloudflare Turnstile, Docker → GHCR. Subordinate to `quality-zero-platform` via Option A sibling-caller enrollment.

---

## How to read this plan

This is a **program** (many weeks, solo-plus-automation). It is organized as sequential **milestones (M0–M10 + v2)**. Each milestone has: Goal · Deliverables · Coverage ratchet (exact `include[]` globs reaching 100% at that milestone) · e2e/characterization · qzp phase · Entry/Exit criteria · Dependencies. Milestones **M0–M2** (the executable starting point) are broken into bite-sized TDD tasks; later milestones are specified at work-unit granularity and will each be expanded into bite-sized tasks by the executing skill when reached (re-expansion keeps the plan honest as the codebase changes under it).

**Non-negotiable invariants (from the decision log):**
- 100% line+branch is a **fixed bar**; only the measured **scope ratchets** (`c8`, `"all": true`, thresholds in the repo's own `.nycrc` — qzp gate 3 passes no JS threshold flag).
- e2e is **semantic** (role/text/API), never DOM-selector — it must survive the client rewrite.
- No `.coverage-thresholds.json` is created until its `enforcement.command` actually runs green (home CLAUDE.md rule: a gate whose command can't run is worse than no gate).
- Never commit with `--no-verify`; never force-push; stay in declared file scope; TDD throughout.
- Votes are GDPR Art. 9 data — the vote-record model (aggregate-only public + pseudonymized + hash-chained audit log + "consultative, not a binding secret ballot" label) is a hard constraint, not a feature.
- **Unreachable-branch discipline:** genuinely unreachable defensive branches (Mongoose getter/virtual edge cases, config-load fallbacks) are marked with explicit `/* c8 ignore next */` + a one-line justification, reviewed in PR — never by lowering the threshold. 100% means every *reachable* branch tested + every ignored branch justified.
- **No legacy production data exists** (the fork has zero users). The mongo 3.2 → Mongo 7 "dump/restore" decision therefore applies to dev/characterization fixtures only; there is no production data-migration workstream at launch. A real migration path is designed only if a legacy instance is ever populated before cutover (not planned).

---

## Milestone M0 — Legacy baseline + semantic characterization suite

**Goal:** Boot the legacy app unchanged in Docker and capture its behavior as a green semantic Playwright suite. This is the safety net every later port is validated against. Nothing is modernized here.

**qzp phase:** none yet (pre-enrollment). **Coverage ratchet:** `include: []` (no unit-coverage scope yet; characterization is e2e-only).

**Deliverables:**
- Running `docker compose up` instance (node:6 + mongo:3.2) with a seeded fixture dataset (users across privilege levels, a forum, topics using all 5 voting methods, comments).
- `e2e/` Playwright project (Chromium), semantic selectors only, `retries: 2` on CI, trace `on-first-retry`, artifacts on failure.
- Characterization specs for the golden journeys: signup/login → create topic → cast each of the 5 vote types → comment + reply + up/down vote → forgot-password → admin panel (create forum, tag, whitelist user, moderate comment) → REST API v1/v2 read + CSV export.
- `docs/CHARACTERIZATION.md` recording observed behaviors (including known-buggy ones, flagged) so the port preserves intent, not bugs.

**Bite-sized tasks (representative):**

### Task M0.1: Bring up the legacy stack
**Files:** Create `docker/README-legacy.md`.
- Step 1: Run `docker compose up -d` from repo root; capture logs.
- Step 2: Confirm the app serves on its port and connects to `mongo:3.2` (expected: HTTP 200 on the landing page).
- Step 3: If boot fails, record the exact failure in `docker/README-legacy.md` and fix only compose/env (no app code).
- Step 4: Commit `docker/README-legacy.md`.

### Task M0.2: Seed fixtures
**Files:** Create `e2e/fixtures/seed.js` (runs against the legacy container's Mongo), `e2e/fixtures/README.md`.
- Step 1: Write a seed script inserting the fixture dataset via the legacy models or a direct Mongo insert.
- Step 2: Run it; verify documents exist (expected counts printed).
- Step 3: Commit.

### Task M0.3: First characterization journey (auth)
**Files:** Create `e2e/journeys/auth.spec.ts`, `playwright.config.ts`.
- Step 1: Write a **failing** semantic spec: `getByRole('button', { name: /sign ?up|înregistrare/i })` flow → assert logged-in state by role/text, not DOM class.
- Step 2: Run `npx playwright test e2e/journeys/auth.spec.ts` — expected FAIL (selectors/flow unconfirmed).
- Step 3: Adjust selectors to the legacy UI's actual roles/labels until PASS; record quirks in `CHARACTERIZATION.md`.
- Step 4: Commit spec + config.

### Tasks M0.4–M0.9: One spec per golden journey
Same pattern for: topic creation, each of the 5 vote types (separate specs — they have different UX), comments/threading, forgot-password, admin panel, REST API v1/v2 + CSV. Each: write semantic spec → run → stabilize → record behavior → commit.

**Boot fallback (M0 is a single point of failure — everything depends on it):** if `docker compose up` will not run the legacy app on Windows Docker (Scout A verified the images are pullable and the tree resolves, but did NOT run the compose build), fall back in order: (a) WSL2 + Docker; (b) WSL2 + nvm Node 6 + Mongo 3.x native (Scout A path 2, closest to the original dev loop, avoids the Unix-only npm-script-syntax problem). Do not spend more than a bounded spike on any single boot path before trying the next. M0 does not exit until a legacy instance runs and the characterization suite is green against it.

**Also in M0:** add `upstream` as a read-only remote (already done by the clone scout) and cherry-pick/reference the two useful upstream branches — `add/api-tests` (free test material to inform characterization specs) and `add/i18next` (i18n-modernization groundwork for M9). Do NOT merge upstream master; hard-fork and diverge.

**Entry criteria:** repo cloned (done), Docker available (verified: Docker 29.6.2).
**Exit criteria:** a legacy instance runs (via compose or a documented fallback); `npx playwright test` green for all golden journeys; `CHARACTERIZATION.md` complete. This suite becomes the regression oracle for M3–M8.
**Dependencies:** none (starts immediately).

---

## Milestone M1 — Monorepo scaffold + `packages/shared` at 100%

**Goal:** Stand up the TypeScript monorepo and port the isomorphic "midend" first — it's small (~0.7k JS LOC), pure, and unlocks typed contracts every later layer imports.

**qzp phase:** pre-enrollment (local `c8` only). **Coverage ratchet:** `include: ["packages/shared/src/**/*.ts"]` → **100%** (fixed bar, first real scope). `"all": true`.

**Deliverables:**
- npm workspaces monorepo: `packages/{server,client,shared}`, root `tsconfig` base, `#lib/*`-style path aliases replacing `NODE_PATH=.`.
- `packages/shared`: zod schemas for the API contracts (topics, comments, forums, votes, users), config schema, validators (ported from `lib/validators`, `lib/regexps`, `lib/normalize-email`), i18n helper (port the `mout`-based merge, ~63 LOC), `privileges` (pure authorization logic), `url-builder`.
- `c8` + `.nycrc` (thresholds 100/100/100/100, `"all": true`, `include` scoped to shared), root `test:coverage` script (single `npm run test:coverage`, no shell metacharacters — satisfies qzp gate-3 discovery + the metaswarm CI validator).
- Vitest (or node:test) unit suites, written **test-first**, giving 100% on shared.

**Bite-sized task pattern (per shared module):** write failing unit test from the legacy module's observed behavior → run (FAIL) → port to TS → run (PASS) → confirm `c8` shows 100% for that file → commit. Repeat for validators, regexps, email-normalize, privileges, config, i18n, url-builder.

**Entry criteria:** M0 green (characterization exists to validate contract semantics).
**Exit criteria:** `npm run test:coverage` = 100% on `packages/shared`; monorepo builds; no source outside `packages/shared` yet in scope.
**Dependencies:** M0.

---

## Milestone M2 — qzp enrollment (shadow) + lean CI + format baseline

**Goal:** Wire the repo to qzp's lean 6-gate CI in **shadow** mode (gates report, never block), do the one-time Biome format-only commit, and get 3 green shadow runs before anything blocks.

**qzp phase:** **shadow** → (after 3 green runs on the `packages/shared` scope) **absolute** for the shared scope only. **Coverage ratchet:** unchanged from M1 (`packages/shared` at 100%); the gate now runs in CI.

**Deliverables:**
- `.github/workflows/quality.yml` — 5-line caller of `Prekzursil/quality-zero-platform/.github/workflows/reusable-quality.yml@<SHA>` (pinned), **plus** caller-side `concurrency: cancel-in-progress` and `timeout-minutes` (the reusable workflow omits both).
- Gate configs: `biome.json` (from qzp `biome.template.json`), `.gitleaks.toml`, `osv-scanner.toml`, `.quality/opengrep/*.yaml`, `.quality/charter.yml` + `charter_check.sh`, `.github/dependabot.yml`, `scripts/verify` (Node-flavored, per the qzp draft), minimal repo `AGENTS.md` pointing back to strict-zero.
- One isolated **Biome format-only commit** across the tree, its SHA added to `.git-blame-ignore-revs` (never mixed with logic).
- qzp control-plane registration (separate PR on the qzp repo): `inventory/repos.yml` entry + `profiles/repos/democracyos.yml` at `phase: shadow`, `issue_policy: audit` (the documented legacy-debt recipe); run `scripts/quality/validate_control_plane.py` before opening the bootstrap PR.
- e2e advisory workflow (separate from the 6 gates — **not** a 7th charter gate; charter_check.sh fails on gate-set drift): runs the M0 Playwright suite, Chromium, non-blocking; promote to required only after 10 consecutive green runs.
- **Create `.coverage-thresholds.json` now** — but only after `npm run test:coverage` runs green in CI (M1 satisfied), honoring the "no gate whose command can't run" rule.

**Entry criteria:** M1 exit (coverage command runs green).
**Exit criteria:** 3 green shadow CI runs; `packages/shared` scope flipped to `absolute`; format baseline committed; qzp inventory PR merged.
**Dependencies:** M1.

---

## Milestone M3 — `packages/server`: models + api-v2 behind the strangler proxy

**Goal:** Stand up the Express 5 + Mongoose 8 server, port the Mongo models (schemas verbatim) and the already-promise-based `api-v2` (2.6k LOC, cleanest), and put a **strangler proxy** in front that routes ported endpoints to the new server and everything else to the legacy container.

**qzp phase:** shadow for new scope → absolute per module as tests land. **Coverage ratchet:** add `packages/server/src/{models,db,api-v2}/**/*.ts` → 100%.

**Deliverables:**
- Express 5 server; Mongoose 8 models ported from `lib/models` (schemas carry verbatim; promisify the ~42 callback sites; inline the 3 abandonware plugins — `mongoose-validators`, `mongoose-gravatar`, and critically `passport-local-mongoose` whose **password-hash format must be preserved** — see Risks).
- `api-v2` ported with shared zod validators replacing the legacy JSON-schema validators.
- **Strangler proxy** (e.g. a thin reverse-proxy layer): ported routes → new server; unported → legacy node:6 container. **The proxy shares the session/JWT secret so a token issued by either side validates on both** (see the dedicated Strangler Seam Risk).
- Unit tests test-first for every ported model method and api-v2 route → 100%. M0 e2e still green through the proxy.

**Entry criteria:** M2 exit. **Exit criteria:** models + api-v2 at 100%; e2e green through the proxy; legacy still serves unported routes.
**Dependencies:** M2 (shared contracts, CI).

---

## Milestone M4 — v1 `api` + auth (passport-local, remove Facebook, `jose` sessions)

**Goal:** Port the callback-style v1 `api` (1.1k) and `db-api` (1.2k), and rebuild auth: keep passport-local, **remove Facebook OAuth** (with a password-reset path for any FB-only accounts), replace **`jwt-simple` with `jose`** (pinned algorithm — kills the algorithm-confusion class).

**qzp phase:** absolute per module. **Coverage ratchet:** add `packages/server/src/{api,db,auth,jwt,middlewares}/**` → 100% (whole server approaching full scope).

**Deliverables:** ported v1 api + db-api; `jose`-based short-lived access + rotating refresh tokens in httpOnly+Secure+SameSite cookies, invalidated on password change; argon2id password hashing (with a verified migration path from the legacy hash format — see Risks); CSRF protection on mutating routes; per-route rate limiting + zod validation (eliminates Mongoose operator-injection). Auth characterization journeys still green.

**Entry criteria:** M3 exit. **Exit criteria:** all server route groups served by the new server; legacy container no longer serves any API; server scope at 100%.
**Dependencies:** M3.

---

## Milestone M5 — `packages/client`: Vite + React 18 (site → admin → settings)

**Goal:** Rewrite the client into Vite + React 18 + TS (forced rewrite under every architecture — React 15/page.js/gulp/browserify/jadeify are all dead). Port feature-by-feature, e2e green throughout.

**qzp phase:** absolute per feature. **Coverage ratchet:** add `packages/client/src/<feature>/**` → 100% per converted feature, in order: shared UI/layout → site (topics, voting, comments) → admin → settings.

**Deliverables:** Vite+React 18 SPA; `page.js` → react-router v7; hand-rolled stores → modern state; Jade→(server shell Pug or JSX) rendered by the new server; Stylus → retained or migrated (decide at task granularity); all 5 voting-method UIs; WCAG 2.1 AA from the start (semantic HTML, ARIA, keyboard nav). Component/integration tests test-first → 100%; M0 e2e now runs against the new client (semantic selectors survive the rewrite by design).

**Entry criteria:** M4 exit. **Exit criteria:** legacy container retired; single new stack serves everything; client scope at 100%; e2e green against new UI.
**Dependencies:** M4.

---

## Milestone M6 — Schema-debt remediation (interleaved, not standalone)

**Goal:** Fix the 8 verified schema bugs. **Safe subset is fixed in M3 BEFORE characterization tests freeze behavior** (so tests don't enshrine bugs as contract); risky ones after e2e green.

**Fix in M3 (safe):** (1) `topic.title` arrow-fn virtual → always-undefined live bug; (2) dead `content` virtual; (3) pre-save xss-filter on a non-existent field; (4) add missing `{forum:1}` index; (6) make the **email index unique**.
**Fix post-e2e (behavior-affecting):** (5) recompute denormalized `comment.score` + bound embedded `votes[]/flags[]`; (7) replace forum-name uniqueness pre-save race with a unique partial index; (8) add an enum to `vote.value`.

**Coverage:** folded into M3–M8 scopes. **This milestone is a checklist overlaid on the port, not a separate phase.**

---

## Milestone M7 — Integrity, hardening, verification ladder, Art. 9 vote model

**Goal:** Implement the trust & safety bundle and the mandatory vote-record model.

**Coverage ratchet:** all new integrity code at 100% within its package.

**Deliverables:**
- **Vote-record model (hard constraint):** aggregate-only public results by default; pseudonymize vote payload from identity where the method allows; append-only **hash-chained tally audit log** (userId-hash, topic, choice, timestamp, prev-hash; publish chain head at consultation close); "consultative, not a binding secret ballot" label on every results page.
- **Pluggable verification ladder:** Stage 1 email + Turnstile + account-age (comment/debate); Stage 2 phone/SMS (vote); Stage 3 Romanian eID (ROeID/EUDI) for high-stakes — as a pluggable authorization layer keyed per-consultation. (ROeID relying-party integration tracked as a workstream; see Risks.)
- Admin MFA (TOTP, mandatory) + DB-backed RBAC replacing the STAFF email list.
- Moderation: report-content on every item, flag-threshold auto-hide + queue, user mute/ban with reason log, per-consultation freeze.
- Edge/hardening: Cloudflare (Turnstile + WAF + origin hidden), helmet + strict CSP, HSTS/TLS, SPF/DKIM/DMARC `p=reject`, secrets externalized (no secrets in repo/compose), MongoDB auth + private bind, rehearsed backup+restore drill, abuse-signal logging/alerting.
- **Secrets hygiene:** audit the fork's git history and `docker/.env` (currently holds a MONGO_URL) — rotate/rebuild any value ever committed; ensure production secrets are injected at runtime, never in the image or repo.
- **Incident-response runbook** (`docs/RUNBOOK.md`) for the solo operator: enable read-only mode, rotate secrets, block an ASN at Cloudflare, restore from backup, and the GDPR 72h breach-notification path — plus a pre-drafted user-notice template. A rehearsed 30-minute "kill-switch + restore" drill is an M7 exit item.

**Entry criteria:** M5 exit (single modern stack). **Exit criteria:** launch-blocker hardening checklist all green; vote model implemented + covered.
**Dependencies:** M5.

---

## Milestone M8 — Product features

**Goal:** Build the decided product surface beyond parity.

**Coverage ratchet:** all new feature code at 100%.

**Deliverables:** content-type split (debate / proposal / poll as distinct types over existing voting methods); lightweight proposal lifecycle (open → closed → outcome-published) with a **forced "what happens with the result" declaration** at forum creation (the key historical lesson); keep the multi-forum hub (self-serve multi-tenancy); **participatory-budgeting module** (budgets, phases, evaluation, shopping-cart voting — the largest single build; scope-flag it, see Risks); notification digests; admin analytics dashboard; RO+EN i18n only (drop the other 16 legacy locales).

**Entry criteria:** M7 exit. **Exit criteria:** feature set complete + 100% covered; e2e extended to new features.
**Dependencies:** M7.

---

## Milestone M9 — Compliance: GDPR / DPIA / DSA / accessibility

**Goal:** Ship the legal/compliance surface for a live public Art. 9 platform.

**Deliverables:** consent-centric flows (contract for accounts + explicit granular consent for voting/opinions + legit-interest for anti-abuse); data-subject rights (access/erasure/portability) with a deletion pipeline that honors erasure while preserving aggregate tallies; **DPIA completed pre-launch** (doubles as the security design record); privacy notice + records of processing; breach runbook (72h ANSPDCP); **DSA hosting baseline** (ToS moderation terms, notice-and-action, statement-of-reasons, published contact point); age-16 gate; cookie/ePrivacy consent (non-essential only); impressum (Law 365/2002); WCAG 2.1 AA audit + remediation; GPL-3.0 source link beside the GHCR image.

**Entry criteria:** M8 exit. **Exit criteria:** DPIA signed off; compliance checklist complete; accessibility audit passed.
**Dependencies:** M8. (Legal-vehicle note: operate personally at launch; stand up the asociație before real vote data accumulates at scale.)

---

## Milestone M10 — Release pipeline + deploy + launch

**Goal:** Ship the multi-OS artifact and go live.

**Deliverables:** Docker image → GHCR, tagged semver + commit SHA (covers Win/Linux/Mac via Docker; no native installers/desktop wrapper); production `docker-compose` (app + MongoDB 7, secrets externalized, TLS via Let's Encrypt, Cloudflare in front); `<BRAND>` + `.ro` domain baked in (pending availability check); `security.txt`; automated encrypted off-site Mongo backups with a rehearsed restore; one-command redeploy. Release workflow added **only now** (deferred until gate 3 green, per decision).

**Entry criteria:** M9 exit. **Exit criteria:** live public instance; release automation green; the full Definition of Done met.
**Dependencies:** M9.

---

## v2 — Native opinion-clustering (signature feature)

**Goal:** Polis-style opinion clustering over the slider/hierarchy/poll data — the platform's differentiator. Built after the core is live and stable. Clustering math + visualization + interpretation UX; 100% coverage on new code. Out of the launch critical path by decision.

---

## Definition of Done (maps to every hard requirement)

- **Working & up-to-date:** single modern stack (Node 22, Express 5, Mongoose 8, React 18) serves all golden journeys; legacy container retired. (M5)
- **Green e2e:** semantic Playwright suite green in CI; promoted to required after 10 consecutive green runs. (M0→M8)
- **Lean CI, qzp-subordinate:** enrolled Option A, 6 gates green, phase `absolute`, pinned `@sha`. (M2+)
- **100% line+branch across backend/frontend/midend:** `packages/server`, `packages/client`, `packages/shared` each report 100% via their own `c8`/`.nycrc`; scope covers the full shipped tree. (M1→M8)
- **Win/Linux/Mac release:** Docker image on GHCR, semver+SHA. (M10)
- **Live public platform:** deployed, `<BRAND>`.ro, Cloudflare + TLS. (M10)
- **GDPR/DPIA/DSA:** DPIA signed pre-launch; Art. 9 vote model; DSA baseline; WCAG 2.1 AA; age 16. (M7, M9)

---

## Risks & unknowns

1. **Strangler seam (highest execution risk).** During M3–M5 two servers run concurrently; a session/JWT token must validate on **both** the legacy (`jwt-simple`) and new (`jose`) side. Mitigation: during transition the new server verifies legacy-format tokens with a compatibility shim pinned to the legacy algorithm/secret, and issues new `jose` tokens; cut the legacy verifier only when the legacy container is retired (M5). Test both token paths explicitly. If dual-validation proves too fragile, fall back to a hard cutover per route-group with forced re-login.
2. **`passport-local-mongoose` password-hash carry-over (NOT-CHECKED).** Existing user passwords are hashed in the legacy plugin's format. Migrating to argon2id must be transparent (verify-on-login-then-rehash) — but only if the legacy hash format is reproducible in Node 22. If not, users need a forced password reset. **Verify the exact hash format in code before M4.**
3. **ROeID relying-party feasibility (NOT-CHECKED).** Whether a private/personally-operated (then NGO) platform can become a ROeID relying party is unknown and is the single biggest identity-tier unknown. Mitigation: build the verification layer pluggable; ship with email+Turnstile+phone; treat eID as a stage that slots in when access is granted. Send the relying-party inquiry early (it's a letter, not code) — but it must not block launch.
4. **Native-module build on Node 22.** 2016-era native deps won't build on Node 22; the port replaces them, but if any survive into `packages/server`, the coverage lane can't run. Mitigation: eliminate node-sass/node-gyp deps entirely in the rewrite; if the *app* ever needs a legacy runtime, pin it in the Dockerfile and override `coverage.setup.node` per qzp profile.
5. **PB module scope (largest single build).** Participatory budgeting (budgets, phases, evaluation, cart voting) is a heavy module competing with a free incumbent. Mitigation: scope-flag it as its own sub-milestone; consider shipping M10 launch **without** PB and adding it as the first post-launch feature if the schedule slips — flag to the user, since the decision was to build it.
6. **Solo-maintainer schedule.** This is a months-long program for one person; the automation-first posture (M2 gates + Dependabot + e2e smoke + one-command redeploy) is the mitigation, but feature velocity will be slow. Biggest schedule risks: M5 (full client rewrite) and M8 (PB).
7. **arm64 image availability (NOT-CHECKED).** node:6/mongo:3.2 arm64 manifests unverified — only affects M0 on Apple Silicon; the modernized stack targets current images so this is transitional.

---

## Judgment calls made where the decision log was ambiguous (flag for user confirmation)

- **Schema-debt split timing (M6):** I placed the "safe" fixes in M3 (before characterization freeze) and behavior-affecting ones after e2e green. Confirm this split matches your intent.
- **PB as a potential launch-descope (Risk 5):** the decision was to BUILD PB, but I flag it as the most likely descope-to-post-launch if the schedule slips. Confirm PB must be in the launch release vs. acceptable as fast-follow.
- **Stylus handling (M5):** left as a task-time decision (keep vs migrate) rather than pre-deciding — confirm you're fine deferring that.
- **Jade→Pug vs JSX-only for server-rendered shell (M5):** left open; the client is a React SPA, so the server shell may not need Pug at all. Confirm no server-rendered template requirement beyond the SPA host page.
