# DemocracyOS Revival — Extensive Grill Decision Ledger

- Date started: 18.08.2026
- Process: grill-me-extensive (7-step), modes: **modernization + red-team + scope-change + better-ideas + prioritization**
- Scope source: user request — clone/analyze Prekzursil/democracyos fork, analyze upstream + forks + alternatives, make it work and up to date, map capabilities, multi-OS releases (Win/Linux/Mac), subordinate to qzp, green e2e, lean CI per qzp model, 100% backend/frontend/midend line+branch coverage.
- This file is the running decision queue + audit trail. It will be relocated into the democracyos repo (docs/plans/) once the clone is complete. Final deliverable: one authoritative "Resolved Decisions" log.

## Scouts (SCOUT phase, launched 18.08.2026 ~15:25 EEST)

| Scout | Charter | Status |
|---|---|---|
| A — Fork Analysis | clone Prekzursil/democracyos to ~/source/democracyos; stack/feature/LOC/test/CI inventory; boot probe; fork-vs-upstream delta; release-meaning reality check | **COMPLETE 18.08.2026** |
| B — Ecosystem Research | upstream status 2026, fork landscape, successors (Consul/Decidim/Polis/…), modernization prior art, security, wildcard | **COMPLETE 18.08.2026** |
| C — qzp Harness (harness-optimizer) | qzp-lean lean-CI/coverage/e2e conventions, "midend" definition, subordination options, draft thresholds/CI skeletons, metaswarm-setup expectations | **COMPLETE 18.08.2026** |

### Scout A key findings (compressed; full report in agent transcript)
- Fork = exact mirror of upstream (0 ahead / 0 behind, created 18.08.2026, zero fork-only commits). Last real code: 2018-12-19 (v2.11.16). Cloned to `~/source/democracyos`, `upstream` remote added.
- ~37.6k tracked LOC (19.9k JS, 8.1k JSON, 3.7k Stylus, 856 Jade). **No backend/frontend split** — interleaved under `lib/`: server ≈7.5k (api, api-v2, db-api, models, middlewares, server), client ≈15k+ (site 7.5k, admin 3.1k, settings), shared (config, translations 6.2k incl. **Romanian locale ro.json**, utils, validators).
- Boot probes: `npm install` on Node 24 fails (ERESOLVE jadeify↔browserify peer conflict; with --legacy-peer-deps: node-sass/node-gyp needs Python 2). **Zero registry 404s — tree still fully resolves.** `node:6` + `mongo:3.2` images still pullable → **repo's own docker-compose = cheapest run path (<1h est)**. Runtime version check bypassable via CHECK_NODE_VERSION=false. npm scripts use Unix-only env syntax (fail in PowerShell).
- Min boot env: MONGO_URL, JWT_SECRET, STAFF. Auth: passport local + Facebook + basic; jwt-simple cookie sessions. Mongoose 4 wire ceiling ≈ Mongo 3.6/4.0.
- Features: multi-forum hub mode, topics with Quill rich text, **5 voting methods** (vote/poll/cause/slider/hierarchy), threaded comments with votes+spam flags, in-app+email notifications, admin panel, REST API v1+v2 + CSV export, reCAPTCHA option, 18 locales.
- Tests: **2 Jasmine spec files** (gulp-jasmine, needs live Mongo). Coverage: NONE. e2e: NONE. CI: NONE (never had .travis.yml). Committed secrets: none found. `.snyk` patch file = CVE firefighting already in 2017.
- Salvageable upstream branches for cherry-picking: `add/api-tests` (free test material), `add/i18next` (i18n modernization groundwork).

### Scout C key findings (compressed; full report in agent transcript)
- qzp-lean = **quality-zero-platform**, a strict-zero control plane governing other repos. Documented mechanism for exactly our case: `reusable-quality.yml` lean 6-gate workflow (lint/format, types, tests+coverage, opengrep SAST, gitleaks, osv+dependabot), ~5-line caller adoption, zero secrets, single job/no matrix, SHA-pinned actions; `docs/ONBOARDING.md` 9 steps; phase ladder shadow → (ratchet) → absolute.
- **Subordination recommendation: Option A — sibling caller enrollment** (`inventory/repos.yml` + `profiles/repos/democracyos.yml`, `phase: shadow`, pin `@<sha>`). Submodule and legacy 10-SaaS model rejected (latter scheduled for demolition).
- **Coverage doctrine: the percentage never moves (100×4); the SCOPE ratchets** — qzp itself enforces fail_under=100 on 3 narrow paths with documented scope expansion. TRAP: qzp gate 3 passes NO threshold flag for JS/TS — the 100% bar must live in democracyos's own c8/.nycrc (`"all": true`); enforcement.command must be a single `npm run test:coverage` (metaswarm CI validator rejects `&&` chains). Do NOT create `.coverage-thresholds.json` until the command actually executes.
- **"midend" DOES NOT EXIST in qzp** (verified zero matches; one home-dir hit = base64 false positive). User's own vocabulary — must be defined by user. Scout's best guess: the Express/BFF tier between browser client and domain/DB logic.
- **e2e: NO qzp convention exists.** Cannot be a 7th gate without amending `.quality/charter.yml` (drift guard fails; Chromatic/Applitools/Percy explicitly banned). Rec: separate advisory Playwright workflow (Chromium-only, retries 2, trace on-first-retry), promote to required after 10 green runs. What we design BECOMES the fleet convention.
- **Releases: NO qzp convention** (Pages docs publish only). Rec: Docker image → GHCR, semver+SHA tags — a NEW convention, unconstrained.
- `/harness-audit` deterministic engine (`scripts/harness-audit.js`) **does not exist anywhere on disk**; its 12 categories cannot be ported; 5/12 score SaaS deploy integrations irrelevant here.
- Sequencing musts: one isolated Biome format-only commit first + `.git-blame-ignore-revs`; Node 22 CI toolchain with app runtime possibly legacy-pinned in Docker; caller adds concurrency-cancel + timeout (reusable workflow has neither).
- Honesty note: qzp does not fully self-apply its charter (gates 5-6 would skip on itself — no .gitleaks.toml/osv-scanner.toml).

### Cross-scout convergences (independent agreement = highest confidence)
1. **Legacy Docker boot as frozen characterization baseline BEFORE modernization** (A rec; B: every actor in history froze or rewrote; C: shadow-phase philosophy).
2. **Coverage = 100% fixed percentage + scope ratchet** (A rec #6 ≈ C doctrine, arrived independently).
3. **Docker image as the sole official release artifact** (A rec #7 ≈ C Q3, arrived independently).
4. **e2e = Playwright journeys written from zero against the legacy baseline, doubling as the modernization safety net** (A rec #5; C confirms nothing to inherit).
5. **Modernization = staged rewrite of the delivery layer** (gulp3/browserify/jadeify unsalvageable), not a dependency bump (A path 4 ≈ B blocker list).

### Scout B key findings (compressed; full cited report in agent transcript)
- Upstream `DemocracyOS/democracyos`: not archived but dead — last human commit 2020-05-28, last tag 2.11.16 (2018-12-19), engines pinned node 6 / npm <5, ~90 unmerged snyk-fix branches through 2025. README self-declares unmaintained.
- **No fork ever modernized it in place.** Copyright holder Democracia en Red froze v2 in Docker (consultas-digitales, Pug+Docker, →2024) then rewrote on Nuxt/Vue3+TS+Prisma (deployments pushed Aug 2026). v3 (Next.js) died as a 2018 alpha branch.
- Modernization blockers (verified): node-6 preinstall wall; gulp 3 breaks on Node ≥12; Jade 1.11 deprecated (→Pug); client on dead component(1)-era modules (rewrite, no upgrade path); React 15 + browserify; Mongoose ~4.10; no lockfile possible under npm <5 (unreproducible dep tree). Verdict: staged rewrite, not upgrade.
- **democracyos.org + docs.democracyos.org are SQUATTED** (TikTok-downloader spam since Nov 2024). All legacy links (README, package.json homepage, npm metadata) are hostile → URL scrub required.
- **Brand collision:** "DemocraciaOS" is an actively marketed brand of the copyright holder with 2026 gov deployments. Trademark registries NOT-CHECKED. npm name `democracyos` is occupied (0.8.26).
- Licensing: upstream GPL-3.0; all major successors AGPL-3.0 → borrowing successor code pulls the combined work to AGPL (decision needed).
- Security: no CVEs against DemocracyOS itself (weak evidence of safety); dominant risk = Node 6 runtime unpatched since 2019-04-30; era-typical ReDoS/XSS/prototype-pollution classes throughout the pinned tree. Facebook login almost certainly non-functional (pre-GDPR auth).
- Successors alive in 2026 (for parity/borrowing only per G-1): Consul Democracy 2.5.1 (Jun 2026; **Code for Romania prior art: Brașov/Sinaia/Dumbrăvița**), Decidim 0.32.1 (Jul 2026), Polis (docker-compose, vTaiwan), Loomio 3.1.7, adhocracy+ v2607.1.

## Resolved Decisions

### G-1 — Foundation: What is this revival ultimately FOR?
- **Decision: FULL COMMITMENT.** Every stated goal is a hard requirement; no go/no-go re-scoping gates.
- Hard requirements locked: (1) app working and brought up to date; (2) green e2e suite; (3) lean CI following the qzp model; (4) 100% line+branch coverage across backend/frontend/midend; (5) releases for Windows, Linux, macOS; (6) repo subordinated to qzp governance.
- Rejected alternatives: staged program with gates (recommended by agent), evaluation-only, outcome-over-codebase (successor platforms as alternatives are OUT — successor research is used for feature parity/borrowing only).
- Red-team note (recorded): 100% branch coverage on a ~2013-2016 legacy codebase is the dominant cost driver; user accepts this without an evidence gate.

### G-2 — Foundation: Is a live instance in scope?
- **Decision: LIVE INSTANCE IS IN SCOPE.** The program adds a deployment track: hosting, domain/TLS, backups, GDPR compliance, security hardening.
- Rejected alternatives: deployment-ready-only (recommended by agent), repo-only-defer.
- Consequence: production-grade choices (auth, email, secrets, data protection) are made for real operation now, not retrofitted. Romanian locale becomes a verification item.

### G-3 — Foundation: Audience/jurisdiction of the live instance
- **Decision: PUBLIC ROMANIAN CIVIC PLATFORM FROM DAY ONE.** Full GDPR compliance (lawful basis, data-subject rights flows, breach procedures), DPIA, and content-moderation obligations are in scope immediately. Vote/opinion data treated as sensitive.
- Rejected alternatives: invite-only at public-grade security (recommended by agent), personal/demo, internal-org tool.
- Consequences: Romanian locale is mandatory; public-service obligations (DPIA, moderation duty, possibly DSA considerations for a public platform) are program workstreams, not deferrables; security hardening is to public-internet grade.

### G-4 — Branding/identity of the public platform
- **Decision: FRESH ROMANIAN BRAND + .ro DOMAIN.** The repo keeps honest "fork of DemocracyOS (GPL-3.0)" attribution; the public service carries a new Romanian identity (clean for GDPR notices/DPIA, no collision with the living DemocraciaOS brand, no association with the squatted democracyos.org).
- Rejected alternatives: "DemocracyOS România" lineage name, plain DemocracyOS, defer-to-launch.
- Follow-up (not yet decided): the actual name — agent to propose a shortlist with .ro domain availability during the STRUCTURE walk. Package/npm rename folds into this.

## Foundation Summary (locked 18.08.2026)
Full-commitment program, no re-scoping gates: revive the fork → up-to-date → green e2e → lean CI (qzp model) → 100% line+branch coverage (backend/frontend/midend) → Win/Linux/Mac releases → qzp subordination → LIVE PUBLIC Romanian civic platform with full GDPR/DPIA/moderation track.

## Open Decision Queue (details — asked grounded, after scout synthesis)
- G-4 (asked 18.08.2026): branding/identity — rebrand vs keep "DemocracyOS" (grounded by Scout B: brand collision + squatted domain + occupied npm name)
- Hosting target + monthly budget for the live instance (needs Scout A runtime requirements + Scout C deploy conventions)
- Modernization strategy: in-place upgrade vs staged rewrite vs strangler (Scout B verdict: staged rewrite; sizing needs Scout A LOC/boot data)
- License posture: stay GPL-3.0 vs accept AGPL pull if borrowing successor code (new, from Scout B)
- Auth replacement for public RO platform: email+password / OAuth / gov eID (new, from Scout B: Facebook login dead, pre-GDPR)
- Sequencing interaction: rewrite BEFORE 100% coverage push to avoid double work (new, from Scout B)
- Meaning of Win/Linux/Mac "release" for a server app (needs Scouts A+C)
- Definition of "midend" for this codebase (needs Scout C's qzp definition)
- Coverage mechanics: day-one hard gate vs ratchet to 100% (needs Scouts A+C)
- e2e strategy, CI shape, qzp subordination mechanics, GDPR workstream breakdown — queue completed at STRUCTURE step.

## Build-task items surfaced by scouts (not decisions — go straight to backlog)
- Scrub every democracyos.org/docs.democracyos.org URL from code/docs (hostile squat).
- Regenerate dependency tree with a modern lockfile (no lockfile can exist under npm <5).
- Romanian locale verification + GDPR data-subject tooling (does not exist in legacy stack).

## DIVERGE lenses (LAUNCHED 18.08.2026, running)
Four lenses grounded in scout findings. First launch batch hit a transient infra timeout; security lens also tripped Anthropic's cyber-content safeguard under a "red-team/attack" framing and was reframed as defensive trust-and-safety. Per user request, relaunched lenses run on Claude Fable 5 (claude-fable-5-thinking-high).
1. GDPR / legal / compliance — RO public civic platform, DSA, accessibility, GPL/AGPL (running; inherit model)
2. Trust & safety / platform-integrity / defensive hardening — abuse/sybil/identity-assurance/vote-secrecy (running; Fable 5)
3. Product / feature parity / Romanian civic context — vs Consul/Decidim 2026; niche; differentiation (running; Fable 5)
4. Target-architecture steelman — 3 end-states (in-place / TS port / rewrite); midend definition; coverage-scope mapping (running; Fable 5)

Note: architecture/coverage/release/qzp-process questions are folded into lens 4 + already-resolved Scout C findings rather than separate lenses, to avoid over-decomposition.

### Lens 1 — GDPR/legal findings (COMPLETE 18.08.2026; full cited report in agent transcript)
Disclaimer: legal research to frame decisions, not legal advice.
- **Votes/opinions = almost certainly Art. 9 "political opinions" (special-category) data.** Private operator's only realistic gate = explicit consent Art. 9(2)(a). Design storage/access/breach for sensitive data from day one. (High)
- **DPIA effectively mandatory** — ANSPDCP Decision 174/2018 item (b) lists large-scale processing of political opinions. Do it pre-launch; it doubles as the security design doc.
- Lawful basis structure: 6(1)(b) contract for accounts + 6(1)(a)+9(2)(a) explicit granular consent for voting/opinions + 6(1)(f) legitimate interest for anti-abuse logs. 9(2)(e) "manifestly public" only as supplement, never for stored vote records.
- **DSA: hosting + online-platform baseline applies, BUT micro-enterprise exemption (Art. 19) removes heavy Section-3 duties.** Irreducible baseline: ToS moderation terms, notice-and-action reporting, statement-of-reasons on removals, published contact point. Enforcer = ANCOM (Law 50/2024).
- **EAA/Law 232/2022 likely does NOT bind a free civic platform** (enumerated consumer services + microenterprise exemption) — but adopt WCAG 2.1 AA / EN 301 549 anyway (legitimacy + future municipal partnerships).
- Age gate **16** (Romania kept GDPR default). Cookie consent (Law 506/2004) for non-essential only. Impressum (Law 365/2002 art.5) + illegal-activity notification duty (art.16).
- **GHCR image publish = GPL-3.0 "conveying" → Corresponding Source owed for all layers** (easiest: keep fork public + source link next to image, §6(d)). AGPL borrowing permitted via §13 bridge but adds network-use source duty + forecloses any future closed-source option.
- NIS2: not at this scale. DPO: likely yes if it scales, borderline at launch. Never collect CNP (Law 190/2018 art.4 safeguards).
- Legal vehicle recommended: **asociație (OG 26/2000)** — nonprofit fits civic mission, shields personal liability, provides controller/impressum identity. SRL if paid services foreseen.
- 8 decision items delivered (Art.9 posture, lawful-basis, vote-record architecture identifiable-vs-pseudonymized, DPIA timing, age gate, legal vehicle, DSA posture, license strategy) — folded into the decision queue below.
- Interfaces to other lenses: vote-record pseudonymization decision is JOINT with architecture (72f25b07) + trust&safety (927bd8bb); Art.9 breach severity is the strongest argument for the security hardening budget.

### Lens 2 — Trust & safety findings (COMPLETE 18.08.2026; full cited report in agent transcript)
- **Product label: consultation-grade (attributable votes), NOT a ballot system.** Add hash-chained tally audit log for tamper-evidence; true secret ballot out of scope for a solo operator (say so publicly).
- **Binding integrity constraint is IDENTITY, not crypto.** Launch: two-tier like Decidim/Consul — email+Turnstile+account-age "registered" tier can comment; "verified" tier (email + phone step-up per high-stakes consultation) can vote. Build verification layer PLUGGABLE so ROeID/RoEUDIW slots in later.
- **2026 Romanian eID reality (verified):** CEI e-ID card nationwide since Aug 2026; ROeID national SSO operational since 2023 (but whether a private/NGO platform can be a relying party = NOT-CHECKED, highest-priority follow-up); RoEUDIW/EUDI wallet legally due Dec 2026 but Romania in laggard tier — DO NOT launch-depend on it.
- **Romania threat model is real:** 2024 presidential first round annulled over coordinated inauthentic amplification (~25k fake TikTok accounts). Must ship abuse-signal logging + moderation tooling + per-consultation freeze at launch.
- **Launch-blocker hardening:** argon2id + login rate-limit/lockout; replace jwt-simple with pinned-algorithm lib (jose); MongoDB auth + private bind (kill the no-auth mongo:3.2 compose); per-route rate limiting + schema validation (kills Mongoose operator-injection); helmet+CSP; SPF/DKIM/DMARC p=reject; Cloudflare in front; admin MFA + DB-backed RBAC (replace STAFF email list); rehearsed backup restore.
- **CAPTCHA 2026 rec: Cloudflare Turnstile** (free, best privacy posture; note all major options are US processors → GDPR interface).
- **5 legacy landmines to kill during port (code hypotheses):** jwt-simple algorithm-confusion (CVE-2016-10555 class); Facebook OAuth removal + reset flow for FB-only accounts; header-based staff-trust check; marked-0.3/Quill server-side sanitization; the no-auth mongo compose.
- Interfaces: individual-vote visibility + phone-number footprint are JOINT with GDPR (15791320); vote-record model JOINT with architecture (72f25b07).
- 8 decision items delivered (verification tier, ROeID pursuit, vote visibility, CAPTCHA vendor, Cloudflare, MFA policy, moderation model, hash-chained audit log) — folded into queue below.

## Decision queue additions from Lens 2
- Voting verification tier at launch (rec: email+Turnstile+account-age floor, phone step-up switchable per consultation)
- Pursue ROeID relying-party inquiry now (rec: send inquiry now, integrate post-launch — must not block launch)
- CAPTCHA vendor (rec: Turnstile), Cloudflare front (rec: yes), admin MFA (rec: mandatory admins)
- Moderation model (rec: post-moderate + throttle + flag auto-hide)
- Hash-chained tally audit log (rec: yes)

### Lens 3 — Product / feature-parity findings (COMPLETE 18.08.2026; full cited report in agent transcript)
- **Don't chase Consul/Decidim parity — it's a multi-year losing race.** Position as a deliberately SMALLER citizen-side product, not an institutional suite.
- **Launch-blockers (product-level):** moderation queue + user reporting (legacy only has comment spam-flag); tiered identity/participation-rights model (view < comment < vote); debate/proposal/poll separation (cheap UX layer over existing voting methods); accessibility (WCAG — legacy 2016 front end almost certainly fails).
- **SKIP participatory budgeting** — Code for Romania's free Consul fork (Brașov since 2022) + Cluj own it. Do not compete there.
- **Unserved niche (the opportunity):** citizen/NGO-owned structured deliberation on national/community topics. e-consultare.gov.ro is one-way; Declic is petitions-only; PB platforms are city-owned. Maps onto legacy DNA (multi-forum hub + varied voting methods).
- **3 first user communities:** advocacy NGOs consulting on draft laws (with output path into e-consultare); diaspora organizations; small communes without PB budgets (currently on Facebook).
- **Historical lessons:** visible outcome path IS the product (force every forum to declare "what happens with the result"); grassroots leverage precedes institutional buy-in; simplicity was the adoption engine (own it); the project died of maintenance/org failure not code — need a year-3 maintenance answer; plan for the second visit (digests, outcome notifications).
- **Honest differentiation:** thin on features; real on positioning — lightweight self-serve multi-tenant hub + slider/hierarchy voting methods (genuinely absent in comparators) + citizen-owned framing + Polis-style opinion-mapping as the eventual signature/flagship.
- 5 EXPANSION candidates flagged: embeddable vote widget, NGO consultation API, standalone opinion-mapping module, e-consultare watcher (auto-import draft acts as deliberation topics), white-label commune "consultation kit."
- 8 decision items (skip PB, primary segment, proposal lifecycle depth, content-type split, keep-all-5-voting-methods, opinion-clustering flagship, keep multi-forum hub, launch languages RO+EN drop other 16).

## Decision queue additions from Lens 3
- Skip participatory budgeting (rec: skip)
- Primary launch segment (rec: NGOs + citizen communities, diaspora second — NOT municipalities)
- Proposal lifecycle depth (rec: lightweight open→closed→outcome-published states day one)
- Content-type separation debate/proposal/poll (rec: split)
- Keep all 5 voting methods, headline slider+hierarchy (rec: keep all 5)
- Opinion-clustering module as v2 flagship (rec: yes, native-or-integrated)
- Keep multi-forum hub as self-serve multi-tenancy (rec: keep — core differentiator)
- Launch languages (rec: RO+EN, drop other 16 legacy locales)
- Interfaces: multi-tenant moderation surface JOINT with trust & safety; opinion-mapping builds on slider/poll data.

### Lens 4 — Target-architecture findings (COMPLETE 18.08.2026; full report in agent transcript)
- **"Conservative in-place" (A) is a mirage:** on Node 22 the entire client toolchain + client code are a FORCED rewrite under every option (gulp3/browserify/jadeify/React15/react-router2/page.js/component(1) all dead). Real choice = where rewritten code lands.
- **Recommendation: Option B — full TypeScript monorepo port, strangler-style** against the dockerized legacy baseline, Express 5 + Mongoose 8 (NOT Fastify/Nest). Rationale: 100% coverage is a byproduct of test-first porting (vs A's legacy-archaeology retrofit — the most expensive coverage there is); C (Nuxt/Vue rewrite) burns the e2e DOM investment + the fork itself.
- Effort: first-deploy A 1.0 : B 1.3 : C 1.5; full-DoD A ≈1.6-1.8 : **B ≈1.3** : C ≈1.5.
- **Verified layer LOC:** backend ≈7.4k JS, frontend ≈10.5k JS (+4k Jade/Stylus), midend ≈0.66k JS (+6.1k locale data).
- **"midend" = code executing on BOTH sides of the wire** (repo already encodes this via package.json `browser` field + `privileges/`). Proposed: backend = api/api-v2/db-api/models/middlewares/server/auth/jwt/notifications/…; frontend = site/admin/settings/stores/…; midend = config/translations-helper/utils/validators/regexps/normalize-email/privileges/url-builder. Under B it becomes a physical `packages/shared`.
- **8 schema-debt bugs found (fix safe subset BEFORE characterization tests):** (1) topic `title` virtual is arrow-fn → always undefined [live bug]; (2) dead `content` virtual; (3) pre-save xss-filter on non-existent field; (4) missing `{forum:1}` index; (5) denormalized comment.score drift + unbounded embedded arrays; (6) **email index not unique**; (7) forum-name uniqueness race; (8) vote.value free string, no enum.
- Mongo schemas carry verbatim to A/B (Mongoose 8, promisify ~42 callback sites, inline 3 abandonware plugins incl. passport-local-mongoose which holds the password-hash format — verify carry-over); to C/Prisma only with losses (Mixed→Json, no Prisma Migrate).
- 6 decision items: end-state A/B/C (rec B); server framework (rec Express 5); data layer (rec Mongoose 8); e2e spec style (rec semantic/role-text not DOM); Mongo data path (rec dump/restore); schema-debt timing (rec fix safe subset first).

---

# ============ STRUCTURE: MASTER DECISION QUEUE (built 18.08.2026) ============
Foundation G-1..G-4 already resolved (see Resolved Decisions). Remaining decisions grouped by category with TIER tags. TIER-0 = reversible, clear recommendation, will be adopted-as-recommended unless user vetoes (batched, not walked). WALK = load-bearing, asked one-at-a-time. Numbering assigned as walked.

## Cross-lens CONVERGENCES (independent agreement = highest confidence)
- **Two-tier verified voting** (Consul/Decidim pattern): surfaced by trust&safety AND feature lenses independently. View<comment<vote rights model.
- **Vote-record model** (attributable + aggregate-only public + pseudonymize where possible): GDPR + trust&safety + architecture all touch it → JOINT decision, highest cross-lens weight.
- **Docker image as sole release artifact**: Scout A + Scout C + architecture lens independently.
- **Legacy Docker baseline first + semantic e2e as characterization net**: Scout A + architecture lens; feature lens' "second visit"/outcome lessons reinforce test-anchoring.
- **Position smaller / don't chase Consul-Decidim parity**: feature lens; architecture lens' "medium rewrite wins" reinforces a bounded surface.

## Category A — ARCHITECTURE & BUILD STRATEGY (WALK the first, rest mostly follow)
- A1 [WALK] End-state architecture A/B/C — rec B (TS monorepo, strangler)
- A2 [TIER-0] Server framework — rec Express 5
- A3 [TIER-0] Data layer — rec Mongoose 8
- A4 [TIER-0] Mongo data path — rec dump/restore into Mongo 7
- A5 [WALK] e2e spec style — rec semantic (role/text/API), not DOM selectors
- A6 [TIER-0] Schema-debt timing — rec fix safe subset (dead virtuals, indexes, unique email) before characterization tests
- A7 [WALK] Confirm "midend" 3-layer definition as proposed
- A8 [TIER-0] Node 22 CI toolchain; app runtime legacy-pinned in Docker if needed
- A9 [TIER-0] Upstream: hard-fork + keep `upstream` read-only for cherry-picking add/api-tests, add/i18next

## Category B — COVERAGE, CI, qzp SUBORDINATION (mostly TIER-0 from Scout C)
- B1 [WALK] Coverage model: 100% fixed percentage + ratcheting scope (c8, "all":true, bar in .nycrc) — rec yes
- B2 [TIER-0] qzp subordination = Option A sibling caller enrollment, phase: shadow → 3 green → absolute
- B3 [TIER-0] Pin reusable workflow @<sha>; caller adds concurrency-cancel + timeout
- B4 [TIER-0] e2e = separate advisory Playwright workflow (not a 7th charter gate), Chromium, retries 2, trace on-first-retry; promote after 10 green
- B5 [TIER-0] Biome format-only commit first + .git-blame-ignore-revs
- B6 [TIER-0] Do NOT create .coverage-thresholds.json until enforcement.command actually runs

## Category C — PRODUCT SCOPE & POSITIONING (WALK segment; rest follow)
- C1 [WALK] Primary launch segment — rec NGOs + citizen communities, diaspora second (NOT municipalities)
- C2 [TIER-0] Skip participatory budgeting — rec skip
- C3 [TIER-0] Proposal lifecycle — rec lightweight open→closed→outcome-published states
- C4 [TIER-0] Content-type separation debate/proposal/poll — rec split
- C5 [TIER-0] Keep all 5 voting methods, headline slider+hierarchy — rec keep
- C6 [WALK] Opinion-clustering (Polis-style) as v2 flagship — rec yes
- C7 [TIER-0] Keep multi-forum hub (self-serve multi-tenancy) — rec keep
- C8 [TIER-0] Launch languages RO+EN, drop other 16 — rec yes
- C9 [WALK] Brand name shortlist + .ro domain (follow-up to G-4)
- C10 [DEFER] 5 EXPANSION candidates (embeddable widget, NGO API, opinion-mapping service, e-consultare watcher, commune kit) — revisit post-launch

## Category D — TRUST & SAFETY / INTEGRITY (WALK vote model; rest TIER-0)
- D1 [WALK] Vote-record model — rec attributable + aggregate-only public + pseudonymize where methods allow (JOINT w/ legal)
- D2 [WALK] Voting verification tier at launch — rec email+Turnstile+account-age floor, phone step-up per high-stakes consultation
- D3 [TIER-0] Hash-chained tally audit log — rec yes
- D4 [TIER-0] CAPTCHA = Cloudflare Turnstile
- D5 [TIER-0] Cloudflare in front — rec yes
- D6 [TIER-0] Admin MFA mandatory + DB-backed RBAC (replace STAFF email list)
- D7 [TIER-0] Moderation = post-moderate + new-account throttle + flag auto-hide + per-consultation freeze
- D8 [TIER-0] Launch-blocker hardening bundle (argon2id, replace jwt-simple w/ jose, Mongo auth+private bind, per-route rate limit + schema validation, helmet/CSP, SPF/DKIM/DMARC, rehearsed backup restore)
- D9 [WALK] Pursue ROeID relying-party inquiry now — rec yes (send inquiry; must not block launch)

## Category E — LEGAL / COMPLIANCE (WALK vehicle; rest TIER-0)
- E1 [TIER-0] Treat votes as Art. 9 special-category data — rec yes
- E2 [TIER-0] Lawful basis = contract (accounts) + explicit granular consent (voting/opinions) + legit-interest (anti-abuse)
- E3 [TIER-0] DPIA pre-launch as a program workstream — rec yes
- E4 [TIER-0] Age gate 16
- E5 [WALK] Legal vehicle — rec asociație (OG 26/2000)
- E6 [TIER-0] Implement DSA hosting baseline (ToS, notice-and-action, statement-of-reasons, contact point)
- E7 [TIER-0] License: stay GPL-3.0, public repo + source link next to GHCR image; take AGPL deps only knowingly
- E8 [TIER-0] Accessibility target WCAG 2.1 AA / EN 301 549 (even if not strictly mandated)

## Category F — RELEASE & PLATFORM
- F1 [TIER-0] Release = Docker image → GHCR, semver+SHA tags (cross-OS via Docker Desktop covers Win/Linux/Mac); defer release workflow until gate 3 green
- F2 [WALK] Whether "Win/Linux/Mac release" needs anything BEYOND Docker (native installers / desktop wrapper) — rec no, Docker only

## Category G — PROCESS / SUSTAINABILITY
- G-maint [WALK] Year-3 maintenance answer (who patches CVEs?) — the org-failure lesson from history
- G-dpo [TIER-0] DPO: revisit if platform scales (borderline at launch)

## Walk order (load-bearing first, prioritization mode)
A1 → A7(midend) → D1(vote model, JOINT) → C1(segment) → A5(e2e style) → B1(coverage) → D2(verification tier) → C6(flagship) → E5(vehicle) → F2(release) → D9(ROeID) → C9(brand) → G-maint. Then batch-confirm all TIER-0 items. Then CONVERGE to locked decision log.

## Resolved Decisions (detail walk) — appended as answered
### TIER-0 BATCH — **ALL ADOPTED AS RECOMMENDED** (confirmed 18.08.2026). Full list: A2 Express 5, A3 Mongoose 8, A4 dump/restore→Mongo 7, A5 semantic e2e selectors, A6 fix-safe-schema-bugs-first, A8 Node 22 CI (app runtime Docker-pinned if needed), A9 hard-fork + upstream read-only cherry-pick, B1 100% fixed + ratcheting scope (c8 all:true), B2 qzp Option A shadow→absolute, B3 pin @sha + caller concurrency/timeout, B4 e2e advisory workflow (not a gate), B5 Biome format-only commit first, B6 no thresholds file until command runs, C3 lightweight proposal lifecycle, C4 content-type split, C5 keep all 5 voting methods, C7 keep multi-forum hub, C8 RO+EN drop other 16 locales, D3 hash-chain audit log, D4 Turnstile, D5 Cloudflare front, D6 admin MFA+RBAC, D7 post-moderate+throttle+flag+freeze, D8 hardening bundle (argon2id/jose/Mongo-auth/rate-limit+validation/helmet-CSP/SPF-DKIM-DMARC/backup-restore), E1 Art.9 votes, E2 consent-centric lawful basis, E3 DPIA pre-launch, E4 age 16, E6 DSA baseline, E7 GPL-3.0, E8 WCAG 2.1 AA, F1 Docker→GHCR release, F2 Docker-only (no installers/desktop wrapper).

### G-14 (C9) — Brand: **Agora-based direction is 1st choice**, Participă 2nd, Dezbatem 3rd/4th, Vocea Ta also retained. ~28 candidates generated; .ro domain + OSIM/EUIPO trademark availability check DELEGATED (running). Final name picked once availability report returns.

---

# ============ CONVERGE: AUTHORITATIVE LOCKED DECISION LOG (18.08.2026) ============
The grill deliverable. All decisions locked except final brand name (pending availability check). This is the input to the planning gate.

**Mission:** Revive Prekzursil/democracyos (fork of the dead GPL-3.0 DemocracyOS) into a LIVE, PUBLIC Romanian civic-participation platform — full commitment, no re-scoping gates. Fresh Romanian brand (Agora-leaning) + .ro domain.

**Product:** Serve ALL segments (NGOs, citizen communities, diaspora, municipalities, national deliberation). BUILD participatory budgeting (compete with Code for Romania). Keep multi-forum hub + all 5 voting methods (headline slider/hierarchy). Split debate/proposal/poll. Lightweight proposal lifecycle (open→closed→outcome-published) with a forced "what happens with the result" declaration. RO+EN only. Native Polis-style opinion-clustering as the v2 signature feature. Successor platforms (Consul/Decidim) are parity/borrowing references only, NOT replacements.

**Architecture:** Option B — TypeScript monorepo (packages/server + client + shared), strangler-ported behind the dockerized legacy baseline. Express 5 + Mongoose 8. Coverage layers: backend=packages/server, frontend=packages/client, **midend=packages/shared** (isomorphic: API contracts, config, validators, i18n helper, privileges). Mongo schemas carry verbatim; fix the 8 schema bugs (safe subset before characterization tests). Data path dump/restore → Mongo 7. Node 22 CI toolchain.

**Quality/qzp:** Subordinate to qzp via Option A sibling caller enrollment (phase shadow → 3 green → absolute), pinned @sha + caller concurrency/timeout. Lean 6-gate CI. 100% line+branch coverage as a fixed bar on a ratcheting scope (c8, all:true; bar in .nycrc, not the reusable workflow). e2e = semantic Playwright suite written FIRST against the legacy baseline as characterization tests, run as an advisory workflow (not a 7th charter gate). Biome format-only commit first. No .coverage-thresholds.json until its command runs.

**Identity/integrity:** Pluggable verification ladder — email+Turnstile+account-age (comment) → phone/SMS (vote) → Romanian eID ROeID/EUDI (top stage, high-stakes). ROeID relying-party access = active workstream. Votes = Art. 9 data: aggregate-only public + pseudonymized payload + hash-chained audit log + "consultative, not binding secret ballot" label. Admin MFA + RBAC. Post-moderation + throttle + flag auto-hide + per-consultation freeze. Turnstile + Cloudflare front. Launch-blocker hardening bundle. Kill 5 legacy landmines in the port (jwt-simple→jose, Facebook OAuth, header-staff-trust, marked/Quill sanitization, no-auth mongo compose).

**Legal:** LIVE public RO platform, full GDPR + DPIA (pre-launch) + DSA hosting baseline + moderation duty. Consent-centric lawful basis. Age 16. WCAG 2.1 AA. Stay GPL-3.0 (source link by GHCR image; AGPL deps only knowingly). Operate PERSONALLY now → form asocia?ie before real vote data at scale (liability window recorded as a risk). Never collect CNP.

**Release:** Docker image → GHCR (semver+SHA), covering Win/Linux/Mac via Docker. No native installers/desktop wrapper. Defer release workflow until gate 3 green.

**Sustainability:** Automation-first (qzp gates + Dependabot auto-PRs + e2e smoke + 1-command Docker redeploy); recruit co-maintainers from civic-tech orbit post-launch.

**Open items:** final brand name (availability check running); ROeID relying-party feasibility (NOT-CHECKED); confirm passport-local-mongoose password-hash carry-over during port.

**Next stage:** PLAN (per metaswarm workflow: plan → plan-review-gate → choose execution method → build waves: legacy Docker boot + characterization e2e → qzp enrollment/CI → strangler port with ratcheting 100% coverage → features/PB/clustering → GDPR/DPIA + hardening → public launch).

---

# ============ PLAN + EXECUTION STAGE (18.08.2026) ============
- **Plan written:** `C:\Users\Prekzursil\source\democracyos\docs\plans\2026-08-18-democracyos-revival-plan.md` (M0–M10 + v2; per-milestone coverage-ratchet globs; DoD mapped to every hard requirement; risks; judgment-call flags).
- **Plan-review gate:** subagent infra was down (7 launch timeouts) → 3-lens gate (Feasibility/Completeness/Scope&Alignment) run INLINE by orchestrator (disclosed: weaker independence). **PASS ×3.** Fixes applied: c8-ignore discipline; M0 WSL2 boot fallback + M0 flagged single-point-of-failure; A9 upstream cherry-pick placed in M0; no-legacy-prod-data clarification; secrets-history + incident-response runbook added to M7.
- **Open user confirmations:** PB in launch vs fast-follow descope; Stylus keep-vs-migrate (task-time); server shell Pug-vs-JSX (task-time).
- **EXECUTION DECISION (user, 18.08.2026 18:15): "implement everything e2e in workflow ultracode full"** → interpreted as FULL metaswarm-orchestrated execution, all milestones end-to-end, starting M0. Work units sequential with IMPLEMENT→VALIDATE→ADVERSARIAL REVIEW→COMMIT per unit; orchestrator validates independently; workers never --no-verify / never force-push.
- **Branch:** all revival work on `revival` branch; `master` stays the pristine upstream mirror.
- **Pending:** brand-availability report (agent 2eab0a21 — status being checked); <BRAND> placeholder remains until it lands.

---

# ============ PLAN STAGE (18.08.2026) ============
- **Plan written:** `C:\Users\Prekzursil\source\democracyos\docs\plans\2026-08-18-democracyos-revival-plan.md` (11 milestones M0–M10 + v2; per-milestone coverage-ratchet globs; DoD mapped to every hard requirement; risks; judgment-call flags).
- **Plan-review gate:** subagent launch infra was DOWN (7 consecutive bubble-creation timeouts), so the 3-reviewer gate (Feasibility / Completeness / Scope&Alignment) was run INLINE by the orchestrator instead of via fresh-context subagents (weaker independence — disclosed to user). **Result: PASS on all three.** Fixes applied: c8-ignore discipline for unreachable branches; M0 boot fallback (WSL2) + made M0 an explicit single-point-of-failure gate; A9 upstream cherry-pick (add/api-tests, add/i18next) placed in M0; clarified there is NO legacy production data (dump/restore = dev fixtures only); secrets-history hygiene + incident-response runbook added to M7.
- **Open user confirmations from the plan:** (1) PB stays inside launch vs acceptable fast-follow descope; (2) schema-debt safe/risky split timing; (3) Stylus keep-vs-migrate deferred to task time; (4) server-shell Pug-vs-JSX-only deferred.
- **Pending:** brand-availability report (agent 2eab0a21 running); execution-method choice (NOT auto-picked, per CLAUDE.md).
- **NOTE:** background-subagent launch infra intermittently failing this session — affects execution methods 1 & 2 (subagent-based) until it recovers.

#### Brand candidate shortlist (ranked by user preference; availability = PENDING check)
Tier 1 — Agora family (user 1st): Agora, AgoraRO, Agora Civică, Agora Publică, AgoraTa, NoiÎnAgora, AgoraNoastră
Tier 2 — Participă family (user 2nd): Participă, Participăm, Implică-te, ParticipăRO
Tier 3/4 — Debate family (user 3rd/4th): Dezbatem, Dezbatere, Dezbateri, DezbatemRO
Also retained — Voice family: VoceaTa, VoceaNoastră, GlasCivic, Glas, SpuneȚi
Additional civic candidates: Deliberăm, Delibero, Decidem, Forul, ForulCivic, Cetatea, Consultă, VreauSăDecid
(≈28 candidates — availability triage to shortlist the viable ones.)

### G-13 (G-maint) — Sustainability: **automation-first** — qzp lean gates (osv-scanner + Dependabot auto-PRs) + green e2e smoke suite + one-command Docker redeploy as the primary "maintainer"; recruit 1-2 co-maintainers from the NGO/civic-tech (Code for Romania) orbit post-launch. Accepts slow feature velocity in exchange for a security/patching floor that keeps a sensitive-data platform lawful. Directly answers the historical failure mode.

### G-12 (C6) — Signature feature: **native Polis-style opinion-clustering as the v2 flagship** (after core port + launch stable). Leverages existing slider/hierarchy voting data; the one place the platform leads rather than chases Consul/Decidim. Rejected: integrate-external-Polis, uncommitted, skip.

### G-11 (E5) — Legal vehicle: **operate personally NOW, form an asociație (OG 26/2000) later.** RISK (recorded): personal liability for Art. 9 controller duties + user-content/defamation during the personal-operation window. Mitigation: stand up the asociație before the platform holds real vote data at meaningful scale; keep data-minimization tight until then.

### G-10 (D2) — Voting verification: **pluggable escalation ladder** — Stage 1 email+Turnstile+account-age (comment/debate), Stage 2 phone/SMS verification (can be required for all voting as it scales), Stage 3 Romanian eID (ROeID/EUDI) as the top stage for highest-stakes consultations. Configurable per consultation. Subsumes/resolves D9: **ROeID relying-party access is now an ACTIVE workstream** (eID is the top verification stage, not optional-later). Build verification as a pluggable authorization layer from day one.

### G-9 (C2) — Participatory budgeting: **BUILD PB** — compete directly for the municipal budgeting use case (against Code for Romania's Consul fork). Heavy module (budgets, phases, evaluation, shopping-cart voting) added to roadmap. Overrides the feature lens' skip recommendation; consistent with maximal-ambition posture.

### G-8 (C1) — Primary segment: **ALL segments in scope** — NGOs + citizen communities + diaspora + municipalities + national-topic public deliberation. Maximal ambition, consistent with G-1 full-commitment. CONSEQUENCE: municipalities now in scope → re-opens the "skip PB" recommendation (C2 promoted from TIER-0 to WALK as G-9); increases moderation/scale/scope surface (feed to trust&safety + maintenance planning).

### G-7 (D1) — Vote-record model: **aggregate-only public by default + pseudonymize vote payload from identity where the method allows + append-only hash-chained tally audit log + "consultative, not a binding secret ballot" label on every result page.** Consultation-grade done honestly (Consul/Decidim pattern). True cryptographic secret ballot OUT of scope. Rejected: attributable-internally-only, radical public attribution, full secret ballot. JOINT satisfies GDPR E1/E2 + trust&safety D3. Collapses Art. 9 breach severity.

### G-6 (A7) — "midend" definition: **isomorphic shared code** = `packages/shared` (API contracts/zod schemas, config schema, validators, translations helper, privileges, url-builder, email normalization). Coverage measured as 3 layers: backend=packages/server, frontend=packages/client, midend=packages/shared — one 100% report + flag each. Rejected BFF-tier and domain-layer readings.

### G-5 (A1) — Architecture end-state: **Option B** — TypeScript monorepo (packages/server + client + shared), strangler-ported behind the dockerized legacy baseline, Express 5 + Mongoose 8. Rejected A (in-place) and C (Nuxt/Vue rewrite). Consequence: A2 (Express 5) + A3 (Mongoose 8) confirmed as part of this choice; midend becomes physical packages/shared.

## New Directions Captured Mid-Grill
- (none yet)
