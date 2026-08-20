# Spec activation ledger (plan §4.2, WU-M1-15; control for R13)

**The rule:** a spec ledger row is a **milestone-exit number, not a vibe**.
Each milestone's definition of done names the specs it must flip to active,
and the advisory workflow prints the active/pending ratio on every run.
**M5 may not delete `legacy/` while anything is pending** (WU-M5-13 is allowed
only at zero pending) — that makes this ratio a hard gate, not a metric.

Activating a spec means replacing `test.fixme` with `test` **and** flipping
the `status` cell here, in the same commit. A spec is never quietly deleted;
a pending spec is reported as pending (§8, rule 10).

Per plan §4.6, all ten journeys flip pending → active during **M4**, exercised
API-level, each by the named route-group WU ("each route group's WU names the
journeys it activates, and activation is the acceptance test"). M5 then
**re-points** each journey at the real UI — without editing its assertions
(an assertion edit is a reviewed `docs/CHARACTERIZATION.md` decision, never a
quiet fix).

| Journey | Spec file | Status | Activation milestone | Activating WU | UI re-point (M5) |
|---|---|---|---|---|---|
| J1 — sign-up → email validation → sign-in → sign-out | `e2e/journeys/j01-signup.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-4 | WU-M5-4 |
| J2 — forgot password → reset → sign-in | `e2e/journeys/j02-forgot-password.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-5 | WU-M5-4 |
| J3 — create forum → visibility → collaborator role | `e2e/journeys/j03-forum-roles.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-6 | WU-M5-5 |
| J4 — admin creates topic per method → publish | `e2e/journeys/j04-topics.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-8 | WU-M5-6 |
| J5 — vote (yes/no/abstain) + tally update | `e2e/journeys/j05-vote.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-9 | WU-M5-7 |
| J6 — vote with poll and cause | `e2e/journeys/j06-poll-cause.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-9 | WU-M5-7 |
| J7 — vote with slider and hierarchy | `e2e/journeys/j07-slider-hierarchy.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-9 | WU-M5-7 |
| J8 — comment → reply → votes → flag → edit → delete | `e2e/journeys/j08-comments.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-10 | WU-M5-8 |
| J9 — admin panel: topics, tags, permissions, CSV | `e2e/journeys/j09-admin.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-15 | WU-M5-10 |
| J10 — settings, password, notifications, EN↔RO | `e2e/journeys/j10-settings.spec.ts` | pending | M4 (API-level; UI at M5) | WU-M4-16 | WU-M5-11 |

Notes:

- Spec files do not exist yet — J1–J10 are separate WUs (WU-M1-2 … WU-M1-11)
  dispatched after the harness. The plan fixes only the naming endpoints
  (`j01-signup.spec.ts` … `j10-settings.spec.ts`); the intermediate filenames
  above are inferred from the journey titles, and the journey WU that creates
  each file must update this row if it names the file differently.
- `e2e/harness.spec.ts` is the harness's own quarantine self-check, not a
  journey; it is deleted or activated at the maintainer's discretion once the
  first real journey activates, and it never appears in this table.
