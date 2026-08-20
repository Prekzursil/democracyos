# Fixture inventory — the shared contract (plan WU-M0-6)

This is the **contract, not code**: the single fixture corpus that the semantic e2e
suite (M1) asserts against and that the executable seed script implements at
WU-M3a-10 (`packages/server/prisma/seed.ts`, `npm run db:seed`), once a schema
exists to seed. e2e specs and the seed must never drift — both cite this file.

## Forum

| id (slug) | name | visibility | notes |
|---|---|---|---|
| `agora-fixture` | Forumul de test | public | The single multi-forum-hub tenant used by every journey. |

## Users — two orthogonal axes

**Corrected 20.08.2026** (M1 harness review, finding N1). The first version of this table
listed a `registered` *role* and cited `legacy/lib/models/forum/roles.js` for it. That role
does not exist in the legacy source, and the citation was false. The mistake was conflating
two independent things, which are now modelled separately:

**Axis 1 — forum role** (authorization inside a forum). Verbatim from
`legacy/lib/models/forum/roles.js:7-13` = `admin`, `collaborator`, `author`, `participant`.
`owner` is absent from that array because it lives on `forum.owner` (see the comment on
line 8). `moderator` is appended only when `config.moderatorEnabled` (line 15) and is
therefore **omitted** from fixtures until the new app decides whether that flag survives.

**Axis 2 — verification stage** (how strongly the person is identified). **NEW** — decision
G-10, no legacy counterpart; legacy gated voting on forum privileges alone. Stage 1
(e-mail + Turnstile) may read and comment; **Stage 2 (phone) is required to vote**; Stage 3
(Romanian eID) is reserved for high-stakes consultations.

`visitor` is the unauthenticated state: no account, no role, no stage.

| handle | role | verification | e-mail (fixture) | notes |
|---|---|---|---|---|
| — | *(none)* | *(none)* | — | No account; asserts the view-only experience. |
| `ana-participant` | participant | stage1-email | `ana@example.test` | May comment, **may not vote** — the negative case every voting journey needs. |
| `elena-voter` | participant | stage2-phone | `elena@example.test` | The canonical eligible **voter**; J5–J7 happy paths use this account. |
| `flavia-author` | author | stage2-phone | `flavia@example.test` | Legacy `author` role; owns content for the comment journey (J8). |
| `bogdan-collaborator` | collaborator | stage2-phone | `bogdan@example.test` | Elevated but not admin — the boundary case that catches over-broad permission checks. |
| `carmen-admin` | admin | stage2-phone | `carmen@example.test` | Forum admin (moderation surfaces, CSV export). |
| `dan-owner` | owner | stage3-eid | `dan@example.test` | `forum.owner`; the only role that may transfer or delete the forum. Also exercises the top verification stage. |

Every forum role is represented by exactly one canonical account, so the permissions
journey (J3) can iterate roles without hand-picking users — see `fixtureUserByRole` in
`e2e/fixtures/users.ts`.

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
