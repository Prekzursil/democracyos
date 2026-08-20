# `legacy/` — frozen read-only reference. Never executed, never linted, never covered.

This directory is the quarantined 2018-era DemocracyOS v2.11.16 application tree
(Node 6 · Express 4 · Mongoose 4 · React 15 · gulp 3 · Jade), retained for
**behaviour archaeology and GPL-3.0 attribution only**.

Rules (enforced by review, see `docs/plans/2026-08-18-democracyos-revival-plan.md` §8.9):

- **Never executed.** No import, no `require`, no script entry, no CI step, no container
  may reference anything in here. `npm install` is never run in this tree — its manifest
  pins Node 6 / npm <5 and carries a `preinstall` hook; both are inert here by design.
- **Never linted, never covered.** `legacy/**` is excluded from Biome, oxlint, tsc and the
  c8 coverage scope.
- **Read-only.** The new application's behaviour is derived by *reading* this source and
  encoding it as cited semantic Playwright specs and a relational Prisma schema
  (plan M1/M3a). Every derived assertion cites `legacy/<file>:<lines>`.
- The committed `docker-compose.yml` in here (unauthenticated `mongo:3.2` published to the
  host) is retained as the documented example of the anti-pattern the plan's N17 bans —
  it must never be reproduced.
- This tree is deleted (or archived to a signed tag) at WU-M5-13, once every journey spec
  is green and `docs/CHARACTERIZATION.md` records a disposition for every legacy route.

Upstream attribution: this is the source of [DemocracyOS](https://github.com/DemocracyOS/democracyos)
v2.11.16, GPL-3.0. See the root `LICENSE`.
