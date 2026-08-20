# AGENTS.md

## Operating model

This repository is enrolled in the **quality-zero-platform (qzp) strict-zero
control plane**. CI is the lean 6-gate reusable workflow, called SHA-pinned
from `.github/workflows/quality.yml`; the closed gate set and its caller-side
drift guard live in `.quality/charter.yml` + `.quality/charter_check.sh`.

## Canonical verification command

Run this before claiming completion of any work:

```bash
bash scripts/verify
```

It runs the local mirror of the gates (typecheck, oxlint, biome, vitest at
100% line+branch coverage, the charter drift-guard) and prints an explicit
`NOT-CHECKED` line for any scanner whose binary is absent locally — a skip is
always visible, never silent.

## Repository contract (qzp)

- `bash scripts/verify` is the canonical entrypoint (above).
- `.github/workflows/quality.yml` stays a thin caller: SHA-pinned `uses:`,
  `node-version: "22"`, concurrency — nothing else. Gate logic belongs to the
  control plane, caller-side config to `.quality/` and the root dotfiles.
- The pin is bumped by qzp's bump wave or a deliberate manual commit (plan
  Q10) — never by ad-hoc edits, never to a mutable ref (`@main`/`@vN`).

## Hard rules

- **Never `git commit --no-verify`, never `git push --force`.**
- **`legacy/` is read-only.** Never edit, never import from it, never "fix" it.
  It is quarantined reference material (see `legacy/README.md`).
- **100% line+branch coverage** on the new stack; a reasoned greppable pragma
  is the only escape (charter gate 3).
- **e2e assertions require source citations** (`e2e/README.md`); activating a
  spec flips its `e2e/SPEC-LEDGER.md` row in the same commit.
- Never commit secrets; anything ever committed is public and must be rotated
  (`docs/ops/secrets.md`).

## Context for agents

The authoritative plan is `docs/plans/2026-08-18-democracyos-revival-plan.md`
(milestones M0–M9, work-unit tables, risk register, open questions). Undecided
product/legal questions live in the OPEN DECISIONS table of
`docs/plans/2026-08-18-democracyos-grill-decisions.md` — cite them, never
invent an answer. Behavioural truth about the legacy system is
`docs/CHARACTERIZATION.md`.
