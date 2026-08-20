# Contributing

This repository is a greenfield TypeScript rebuild of a civic-participation
platform (hard fork of DemocracyOS, GPL-3.0). The 2016 tree under `legacy/` is
**read-only reference material** — never edit it, never import from it. All
work happens in `packages/` (npm workspaces), `e2e/` and `docs/`.

## Toolchain

- **Node.js >= 22** (`package.json` engines; CI runs 22).
- Install with **`npm ci`** — never bare `npm install` in CI or when you want
  the lockfile respected.
- Local Postgres for later milestones: `docker compose -f docker-compose.dev.yml up`.

## The verification entrypoint

```bash
bash scripts/verify
```

runs everything below in order and is the command to run before claiming any
work done (see `AGENTS.md`). The individual gates:

```bash
npm run typecheck      # gate 2 - tsc --noEmit, all workspaces
npm run lint           # gate 1a - oxlint --deny-warnings
npm run format:check   # gate 1b - biome ci (formatter-only)
npm run test:coverage  # gate 3 - vitest, 100% line+branch enforced
```

CI (`.github/workflows/quality.yml`) runs the qzp lean 6-gate workflow, which
additionally runs opengrep SAST (`.quality/opengrep/`), gitleaks and
osv-scanner. The gate set is closed and drift-guarded by
`.quality/charter.yml` + `bash .quality/charter_check.sh`.

**Coverage is 100% line+branch, non-negotiable** (charter gate 3). If a line
genuinely cannot be covered, use a reasoned, greppable pragma — never lower a
threshold, never skip the suite.

## e2e specs are the specification of record

The Playwright suite under `e2e/` encodes journeys J1–J10 derived from reading
the legacy source. Read `e2e/README.md` before touching it. The
non-negotiables it enforces:

- **Selectors:** `getByRole` / `getByLabel` / `getByText` **only**. CSS/DOM
  selectors, XPath, `getByTestId` and screenshot diffing are banned — the
  advisory e2e workflow greps for them and fails.
- **Pending quarantine:** specs for unbuilt functionality are `test.fixme`.
  Activating one = flipping `test.fixme` → `test` **and** the matching
  `e2e/SPEC-LEDGER.md` row **in the same commit**. Never delete a spec quietly.
- **Citations:** every assertion carries a source comment naming the legacy
  file and line range it was derived from
  (`// src: legacy/lib/api-v2/topics/index.js:88-134`) — or, where behaviour is
  deliberately undecided, a citation of the OPEN DECISIONS table
  (`// src: OPEN DECISION OD-1 (grill decisions)`). **An assertion with no
  citation is a review rejection** — it means someone invented behaviour.
  The same rule applies to `docs/CHARACTERIZATION.md` rows.

## Commits

- **Conventional commits** (`feat:`, `fix:`, `docs:`, `ci:`, `test:`,
  `chore:` …), present tense, with the work-unit tag when applicable, e.g.
  `ci(gates): ship real configs for gates 4/5/6 (WU-M2-2)`.
- **Never `--no-verify`.** No exceptions. If a hook is broken, fix or report
  the hook.
- Format before committing: `npm run format` (Biome writes; `format:check`
  verifies).
- Never commit secrets. `.env*` files are gitignored except `.env.example`
  (placeholders only). Anything ever committed is treated as public —
  see `docs/ops/secrets.md`.

## Dependencies

Dependabot proposes npm updates weekly (`.github/dependabot.yml`); osv-scanner
gates known vulnerabilities in CI. Renovate and Snyk are charter-banned — do
not add their config.
