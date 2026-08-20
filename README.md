# `<BRAND>` — Romanian civic-participation platform (working title)

A live, public, Romanian civic-participation platform being built as a **hard fork of
[DemocracyOS](https://github.com/DemocracyOS/democracyos)** (GPL-3.0). The final
Romanian brand name is pending an availability check; `<BRAND>` and the temporary npm
scope `@dosrevival/*` are placeholders replaced in a single commit later (plan WU-M2-6).

> **Status: pre-alpha (milestone M0). Nothing is deployed and there is no running
> application yet — do not use this for anything.** What exists today is the monorepo
> scaffold, the quality harness and a development database. Follow
> `docs/plans/2026-08-18-democracyos-revival-plan.md` for what lands when.

## What this repository is

- **A greenfield TypeScript rebuild** against a source-derived specification:
  Express 5 · PostgreSQL 16 + Prisma · Vite + React 18 · Vitest (v8 coverage) · Playwright ·
  Biome + oxlint. Monorepo: `packages/server` (backend), `packages/client`
  (frontend), `packages/shared` (isomorphic midend).
- **`legacy/` is the quarantined 2018 upstream tree (v2.11.16)** — a read-only
  reference that is **never executed, never linted, never covered**. New behaviour is
  derived by reading it and encoding cited specs. See `legacy/README.md`.
- The full plan lives at `docs/plans/2026-08-18-democracyos-revival-plan.md`.

## Development

Requires Node ≥ 22 (CI toolchain: Node 22) and a reachable PostgreSQL 16 — see
`docs/develop/database.md` for the two supported paths (Docker compose or
native/hosted; `DATABASE_URL` is the only contract).

```bash
npm ci                  # install (root + workspaces)
npm run test:coverage   # vitest v8 coverage — 100% line+branch on the ratcheting scope
npm run typecheck       # per-package tsc --noEmit
npm run lint            # oxlint --deny-warnings (warnings fail the gate)
npm run format:check    # biome ci
npx tsx scripts/db/check.ts   # verify the database is reachable and is PostgreSQL >= 16
```

Coverage policy: the thresholds in `vitest.config.ts` are fixed at 100/100/100/100; the
`include` scope only ever grows (plan §5). At M0 the scope deliberately points at a
non-existent path (vacuously green) and is replaced by real globs from M3a on. Each
package also exposes its own `test:coverage`, so the three layers (server, client,
shared) can be reported under separate flags when CI enrollment lands (WU-M2-3).

## License and attribution

GPL-3.0 (see `LICENSE`). This project is a fork of **DemocracyOS** by Democracia en
Red and its contributors (see `CONTRIBUTORS.md`); the upstream repository is
<https://github.com/DemocracyOS/democracyos>. The historical upstream domain is no
longer under the project's control and is intentionally not linked anywhere in this
tree outside the frozen `legacy/` reference.

This project is **not affiliated with, endorsed by, or a continuation of** the
DemocraciaOS product that Democracia en Red currently operates. It is an independent
hard fork of their archived GPL-3.0 codebase, under a different name, run by different
people.

Votes and results on the live platform are **consultative — not a binding secret
ballot**; the full integrity and GDPR posture is documented in the plan (§4.6, M6, M8).
