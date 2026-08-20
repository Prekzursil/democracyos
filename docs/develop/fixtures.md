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
| `dan-owner` | owner | stage3-eid | `dan@example.test` | `forum.owner`; the only role that may **delete** the forum. Ownership **transfer does not exist** in legacy for any role — corrected 20.08.2026, WU-M1-14, per J3. Also exercises the top verification stage. |

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
| `t-poll` | `poll` | open | multiple options (J6). **Options are mandatory at creation** — see below. |
| `t-cause` | `cause` | open | support-style endorsement (J6). Single implicit `support` value, no option set. |
| `t-poll-closed` | `poll` | closed | **Added 20.08.2026 (J6 derivation).** Poll results render only when closed. Must be seeded **non-tied**: legacy marks every option whose percentage equals the maximum as the winner, so an all-zero or tied poll highlights all of them (`legacy/lib/site/.../poll/component.js:11-20`). The new implementation must define tie presentation deliberately, and this fixture must not accidentally assert the buggy behaviour. |
| `t-cause-closed` | `cause` | closed | **Added 20.08.2026 (J6 derivation).** Carries at least one supporter who is **not** `elena-voter`, so the endorse/withdraw journey can act on a fresh state while the aggregate is non-zero. |
| `t-slider` | `slider` | open | headline differentiator (J7). Range −100…+100, step 25 (nine buckets incl. neutral). |
| `t-hierarchy` | `hierarchy` | open | headline differentiator (J7). **Options are mandatory at creation** — see below. |
| `t-slider-closed` | `slider` | closed | **Added 20.08.2026 (J7 derivation).** Legacy renders the slider distribution only when the topic is closed, so an open topic alone cannot exercise the tally. Carries recorded votes across at least three distinct buckets, one of them neutral (`0`), because legacy's chart drops the neutral bucket and the new UI must not. |
| `t-hierarchy-closed` | `hierarchy` | closed | **Added 20.08.2026 (J7 derivation).** Same reason: the consensus ranking is only rendered when closed. Carries a recorded ballot by `elena-voter` plus at least two more differing ballots, so the positional consensus has something to resolve. Ballots must **not** be a full tie — legacy crashes on one (see below); the new implementation must define and test tie behaviour deliberately. |
| `t-closed-outcome` | `vote` | closed, outcome published | carries the mandatory outcome declaration (N11); asserted by J13 and the results journeys. |

### Closed-topic outcome declarations — mandatory

**Added 20.08.2026 (WU-M3a-1 found the previous spec unseedable).** The schema enforces
decision C3/N11 with a CHECK: a topic in the `closed` lifecycle **must** carry an outcome
declaration. The four closed method fixtures were specified without one, so they could not
have been seeded at all. Each now carries the declaration below — deliberately short, because
the point is that the field is non-empty and rendered, not that the prose is realistic.

| slug | outcome declaration (ro) |
|---|---|
| `t-poll-closed` | `Rezultatul consultării a fost transmis comisiei de urbanism.` |
| `t-cause-closed` | `Inițiativa a fost inclusă pe ordinea de zi a ședinței următoare.` |
| `t-slider-closed` | `Rezultatul a fost publicat ca aviz consultativ; nu produce efecte juridice.` |
| `t-hierarchy-closed` | `Ordinea de priorități rezultată a fost trimisă spre analiză bugetară.` |
| `t-closed-outcome` | `Propunerea a fost adoptată cu majoritate de voturi; hotărârea de punere în aplicare se publică pe site-ul primăriei.` |

> **Corrected 20.08.2026 (M3a-1 review, N9a):** the `t-closed-outcome` row previously said
> "already specified above", but no declaration text appeared anywhere above — the canonical
> outcome-declaration fixture was the only one *without* a pinned declaration. The Romanian text
> above is now the pinned value; J13 and the results journeys assert against it.

### Per-topic voting-stage requirement

Also added by WU-M3a-1: the schema gives every topic a `requiredStageToVote`, because decision
G-10 makes the verification stage a **per-consultation** setting rather than a global one. The
contract must therefore assign it, or the seed has to invent it:

| topic | requiredStageToVote | why |
|---|---|---|
| `t-vote`, `t-poll`, `t-cause`, `t-slider`, `t-hierarchy` | `stage2-phone` | The default for a real consultation, and what makes `ana-participant` (stage 1) the negative case every voting journey needs. |
| all four `*-closed` fixtures | `stage2-phone` | Closed topics refuse votes regardless, but the field is NOT NULL, so it must be set; keeping it identical avoids implying the stage is what closed them. |

A high-stakes `stage3-eid` fixture is deliberately **not** seeded: ROeID relying-party access is
unresolved (OD-7), so a fixture requiring it would assert an integration that may never exist.

### `t-poll` option set

Poll creation refuses a topic without options, exactly like hierarchy
(`legacy/lib/api-v2/db-api/topics/index.js:130-137`), so the seed cannot exist until they are
named. Fixed at three distinct options:

1. `Dimineața (08:00–12:00)`
2. `După-amiaza (12:00–17:00)`
3. `Seara (17:00–21:00)`

A poll ballot is exactly **one** of these. Legacy accepts any string as a vote value
(`legacy/lib/api-v2/topics/index.js:232-239`), which inflates the participant count while
deflating every real option's percentage; the new schema constrains the value to the
topic's own option set.

### `t-hierarchy` option set

Topic creation refuses a hierarchy topic without options (`legacy/lib/api-v2/db-api/topics/index.js:130-137`),
so the seed cannot exist until they are named. Fixed at three, in this order at creation
(the UI randomizes presentation order per visitor to avoid anchoring):

1. `Reabilitarea parcului central`
2. `Piste de biciclete pe strada principală`
3. `Extinderea programului transportului public`

A valid ballot is a **full permutation** of all three — legacy's UI cannot express partial
rankings or ties, and the new implementation must reject them explicitly rather than by
omission, because legacy's tie handling is broken: the deeper-level tie-break never narrows
(a `.lenght` typo at `legacy/lib/db-api/topics/utils.js:163-165`) and a complete tie recurses
past the last level and throws on `Object.keys(undefined)` (`utils.js:186-188`), failing the
vote request.

## Tags

**Added 20.08.2026 (J4 derivation, WU-M1-5).** A tag is **mandatory** to create a topic
(`legacy/lib/models/topic.js:54`), and the legacy admin form refuses to render at all when the
forum has zero tags (`legacy/lib/admin/admin-topics-form/template.jade:4-13`). The contract
previously defined no tag, so the topic fixtures could not have been seeded.

| slug | name | purpose |
|---|---|---|
| `urbanism` | Urbanism | The default tag carried by every seeded topic. |
| `transport` | Transport | A second tag, so tag CRUD and tag filtering (J9) have something to distinguish. |

`transport` exists so that tag listing and tag filtering have something to distinguish, and
because no fixture topic references it, it is the only tag that *could* safely be deleted.

> **Corrected 20.08.2026** (WU-M1-14 found this contradicted the spec): an earlier version
> called `transport` "the safe target for J9's tag-delete assertion". J9 asserts the
> opposite — legacy exposes **no tag-delete control to any role**, and whether the new app
> gains one is an open product decision. The contract must not presume an assertion the
> spec deliberately refuses to make.

## Consent records

**Added 20.08.2026 (M3a-1 review, N9b).** Decision E2 makes explicit Art. 9 consent
(`purpose = voting_opinions`) a precondition of the vote path, and the schema records it in
`ConsentRecord` (data-model §2 M28). No fixture previously specified any consent row, so the
moment the vote path enforces E2, every live-vote journey (J5–J7) and every seeded closed-topic
vote would have been unseedable or refused. The seed therefore creates one **active** consent row
per stage-2-or-higher account:

| handle | purpose | policyVersion | withdrawnAt |
|---|---|---|---|
| `elena-voter` | `voting_opinions` | `fixture-v1` | — (active) |
| `flavia-author` | `voting_opinions` | `fixture-v1` | — (active) |
| `bogdan-collaborator` | `voting_opinions` | `fixture-v1` | — (active) |
| `carmen-admin` | `voting_opinions` | `fixture-v1` | — (active) |
| `dan-owner` | `voting_opinions` | `fixture-v1` | — (active) |

`grantedAt` is the seed timestamp (it must not post-date any seeded `Vote.createdAt` for the same
account). `ana-participant` gets **no** consent row: her negative case is the verification stage
(stage 1 may not vote), and the stage refusal must fire before any consent check, so seeding her a
consent would not change her journey — but a *separate* consent-refusal case (stage-2 account
without consent) is created **in-journey** by the consent-flow spec, not seeded, so fixtures stay
immutable. **Dependency, recorded:** J5–J7's happy paths assume these rows exist; if the seed
lands before the vote path enforces E2, the rows are inert; once enforcement lands, they are
load-bearing.

## Comment tree

**Corrected 20.08.2026** (J8 derivation, WU-M1-9). The previous version described a
"nested reply" three levels deep and used the pre-correction handle `ana-registered`.
Both were wrong: legacy threading is **exactly one level** — `CommentReplySchema`
(`legacy/lib/models/comment.js:35-40`) holds only `author/text/createdAt/editedAt` with
no child collection, and the reply row exposes no reply control
(`legacy/lib/site/.../replies/list/component.js:71-110`). A depth-3 fixture could not be
seeded and a spec asserting it would have been fiction.

On `t-vote`:

| Item | Author | Purpose |
|---|---|---|
| Root comment A | `ana-participant` | The reply and vote target. Stage-1 accounts may comment (G-10), which this proves. |
| One reply to A | `bogdan-collaborator` | The single permitted threading level. |
| One upvote on A | `elena-voter` | Score arithmetic (score = upvotes − downvotes). |
| One downvote on A | `flavia-author` | Ditto, and proves votes come from different accounts than the author (self-voting is refused: `NO_AUTOVOTE`). |
| Root comment B | `flavia-author` | A separate root carrying one spam flag by `carmen-admin`, for the flag/veil path. |

J8's edit and delete targets are created **inside** the journey so fixtures stay
immutable. Note that legacy blocks deleting a comment that has replies (`HAS_REPLIES`)
unless the actor holds `canDeleteComments`, so the delete target must be reply-free.

> **Not yet implemented (M1 review finding N6):** `e2e/fixtures/app.ts` models the forum
> and topics but not this comment tree. J8 therefore creates its comments in-journey and
> cannot activate until the fixture exists — the seed script (WU-M3a-10) and `app.ts` must
> both grow it. Tracked as an activation prerequisite on the J8 ledger row.

## Invariants

- Fixture data is synthetic only — never personal data, on any path (§4.1).
- The corpus is idempotent: re-seeding resets to exactly this state.
- Every addition here must name the journey that consumes it.
