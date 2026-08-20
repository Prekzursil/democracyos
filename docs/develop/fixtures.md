# Fixture inventory — the shared contract (plan WU-M0-6)

This is the **contract, not code**: the single fixture corpus that the semantic e2e
suite (M1) asserts against and that the executable seed script implements at
WU-M3a-10 (`packages/server/prisma/seed.ts`, `npm run db:seed`), once a schema
exists to seed. e2e specs and the seed must never drift — both cite this file.

## Forum

| id (slug) | name | visibility | notes |
|---|---|---|---|
| `agora-fixture` | Forumul de test | public | The single multi-forum-hub tenant used by every journey. |

## Users — one per role

Roles follow `legacy/lib/models/forum/roles.js` (visitor is the unauthenticated state).

| handle | role | e-mail (fixture) | notes |
|---|---|---|---|
| — | visitor | — | No account; asserts the view-only experience. |
| `ana-registered` | registered | `ana@example.test` | Baseline participant (comment tier). |
| `bogdan-collaborator` | collaborator | `bogdan@example.test` | Can manage topics in the fixture forum. |
| `carmen-admin` | admin | `carmen@example.test` | Forum admin (moderation surfaces). |
| `dan-owner` | owner | `dan@example.test` | Forum owner (permissions journey J3). |

All fixture accounts are e-mail-validated except where a journey (J1) needs the
pre-validation state, which it creates itself. Passwords are per-seed random and
never reused outside fixtures.

## Topics — one per voting method

Voting methods per `legacy/lib/models/topic.js:73`.

| slug | method | state | notes |
|---|---|---|---|
| `t-vote` | `vote` | open | yes/no/abstain (J5). |
| `t-poll` | `poll` | open | multiple options (J6). |
| `t-cause` | `cause` | open | support-style (J6). |
| `t-slider` | `slider` | open | headline differentiator (J7). |
| `t-hierarchy` | `hierarchy` | open | headline differentiator (J7). |
| `t-closed-outcome` | `vote` | closed, outcome published | carries the mandatory outcome declaration (N11); asserted by J13 and the results journeys. |

## Comment tree

On `t-vote`: one root comment by `ana-registered` → reply by `bogdan-collaborator`
→ nested reply by `ana-registered`; one upvote and one downvote on the root; one
spam flag by `carmen-admin` on a second, separate root comment (J8's edit/delete
targets are created inside the journey itself so fixtures stay immutable).

## Invariants

- Fixture data is synthetic only — never personal data, on any path (§4.1).
- The corpus is idempotent: re-seeding resets to exactly this state.
- Every addition here must name the journey that consumes it.
