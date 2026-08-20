# Security Policy

## Project status — read this first

This project is **pre-alpha**. There is **no live instance, no deployment and no
user data anywhere**. The repository contains a greenfield TypeScript rebuild in
progress (`packages/`) and a quarantined, never-executed 2016 reference tree
(`legacy/`). That changes what a useful report looks like — see scope below.

## Reporting a vulnerability

Use **GitHub private vulnerability reporting** on this repository
(*Security → Report a vulnerability* on
[github.com/Prekzursil/democracyos](https://github.com/Prekzursil/democracyos/security)).
That is the only private channel; please do not open a public issue for
anything you believe is sensitive.

- Expect an acknowledgement within **7 days** (single-maintainer project).
- Please include: affected file/line, an impact sketch, and — if you can — a
  proof-of-concept. There is no bug bounty.
- If it concerns a **committed credential**, note that the standing policy in
  [`docs/ops/secrets.md`](docs/ops/secrets.md) already treats anything ever
  committed as public-and-rotate; the WU-M0-7 full-history audit found no live
  credential of this fork. A new finding means that inventory is stale — say so
  in the report.

## Scope

| Tree | In scope? |
|---|---|
| `packages/`, `e2e/`, `scripts/`, `.github/`, `.quality/` | **Yes** — the live stack and its CI. |
| `legacy/` | **No, with one exception.** It is a read-only, never-executed reference (see `legacy/README.md`); its 2016 dependencies are known-vulnerable and will never be fixed. The exception: evidence that anything under `legacy/` can influence the live stack, CI, or a release artifact — that is a **high-value, in-scope** finding, because it would break the quarantine assumption the whole repo rests on. |

## Standing controls

Every commit on the governed branch passes the lean 6-gate CI (see
`.quality/charter.yml`): oxlint/biome, tsc, tests at 100% coverage, opengrep
SAST (`.quality/opengrep/`), gitleaks secret scanning, and osv-scanner +
Dependabot for dependencies.
