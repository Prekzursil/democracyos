// J5 — vote with method `vote` (yes/no/abstain) and see the tally update
// (plan §4.2, WU-M1-6). Semantic characterization spec: behaviour derived by
// READING legacy/lib/ (never a running system), targeting the NEW app built in
// M4 (API) / M5 (UI). Every assertion cites the legacy source it was derived
// from; a fresh reviewer re-derives each one from the citation, not from this
// file's prose.
//
// Pending-by-design: every spec is quarantined via test.fixme until its
// activation row in e2e/SPEC-LEDGER.md (M4, WU-M4-9; UI re-point WU-M5-7).
// NOTE for the ledger keeper: SPEC-LEDGER.md row J5 lists the inferred name
// `j05-vote.spec.ts`; this WU created the file as `j05-vote-method.spec.ts`
// per its dispatch. The ledger row must be updated by the orchestrator (this
// WU writes exactly one file, so it cannot flip the row itself).
//
// Vocabulary note (the polymorphic vote value): the legacy wire values are
// 'positive' | 'neutral' | 'negative' — Vote.value is an untyped String reused
// by every voting method (poll options, slider numbers, hierarchy CSV), and
// method 'vote' occupies the yes/abstain/no corner of that space.
// src: legacy/lib/models/vote.js:5-10 (value: String, required — no enum)
// src: legacy/lib/api-v2/db-api/topics/index.js:122-129 (method 'vote' seeds
//      exactly [positive, neutral, negative])

import { expect, test } from '../fixtures/app.js';
import type { Page } from '@playwright/test';
import type { FixtureUser } from '../fixtures/users.js';

// ---------------------------------------------------------------------------
// Accessible names (Romanian-primary, EN fallback). The new UI must expose
// these names; the regexes are derived from the legacy translation catalogue.
// ---------------------------------------------------------------------------

// src: legacy/lib/translations/lib/ro.json:214 ("proposal-options.vote": "Votează")
// src: legacy/lib/translations/lib/en.json:333 ("proposal-options.vote": "Vote")
const VOTE_HEADING = /votează|^vote$/i;

// src: legacy/lib/site/topic-layout/topic-article/vote/vote-options.js:1-35
//      (the three options: positive/neutral/negative with their label keys)
// src: legacy/lib/translations/lib/ro.json:208,212,220 (Abține-te / Nu / DA)
// src: legacy/lib/translations/lib/en.json:328,331,343 (Abstain / Nay / Yea)
const OPTION_LABELS = {
  positive: /^da$|^yea$|^yes$/i,
  neutral: /abține-te|abstain/i,
  negative: /^nu$|^nay$|^no$/i,
} as const;

// src: legacy/lib/site/topic-layout/topic-article/vote/component.js:204-208
//      (the votes-cast counter always renders under the vote box)
// src: legacy/lib/translations/lib/ro.json:219 ("{num} voturi exprimate")
// src: legacy/lib/translations/lib/en.json:342 ("{num} votes cast")
// TODO-AMBIGUOUS: legacy interpolates the raw number with no RO pluralization
// ("1 voturi exprimate"); the new app may correctly pluralize ("1 vot
// exprimat"). The regexes accept both; docs/CHARACTERIZATION.md should record
// the deliberate choice.
const votesCast = (num: number) =>
  new RegExp(`\\b${num}\\b\\s+(vot(uri)?\\s+exprimat(e|ă)?|votes?\\s+cast)`, 'i');

// src: legacy/lib/site/topic-layout/topic-article/vote/component.js:308-325
//      (VotedBox renders the per-option voted confirmation)
// src: legacy/lib/translations/lib/ro.json:216-218 (voted-abstained/-nay/-yea)
// src: legacy/lib/translations/lib/en.json:339-341
const VOTED_CONFIRMATION = {
  positive: /ai votat da|you voted yea/i,
  neutral: /te-ai abținut de la vot|you abstained from voting/i,
  negative: /ai votat nu|you voted nay/i,
} as const;

// src: legacy/lib/site/topic-layout/topic-article/change-vote-button/component.js:4-12
// src: legacy/lib/translations/lib/ro.json:209 ("Vreau să îmi schimb votul.")
// src: legacy/lib/translations/lib/en.json:337 ("Change vote")
const CHANGE_VOTE = /vreau să îmi schimb votul|change vote/i;

// ---------------------------------------------------------------------------
// Sign-in steps. J1 owns the full auth journey; J5 only needs a session.
// Field and button names derived from the legacy sign-in form.
// ---------------------------------------------------------------------------
async function signIn(page: Page, user: FixtureUser): Promise<void> {
  await page.goto('/signin');
  // src: legacy/lib/site/sign-in/component.js:83-94 (email field, label
  //      t('signup.email')) + legacy/lib/translations/lib/ro.json:282 ("Email")
  await page.getByLabel(/e-?mail/i).fill(user.email);
  // src: legacy/lib/site/sign-in/component.js:95-112 (password field, label
  //      t('password')) + legacy/lib/translations/lib/ro.json:199 ("Parola")
  await page.getByLabel(/parol|password/i).fill(user.password);
  // src: legacy/lib/site/sign-in/component.js:124-130 (submit, t('signin.login'))
  //      + legacy/lib/translations/lib/ro.json:273 ("Login" in RO too)
  await page.getByRole('button', { name: /login|autentificare|conectare/i }).click();
}

const topicPath = (forumSlug: string, topicSlug: string) => `/${forumSlug}/topic/${topicSlug}`;

// ---------------------------------------------------------------------------
// 1. The three options are presented to a signed-in, verified voter.
// ---------------------------------------------------------------------------
test.fixme('J5: an open vote topic offers exactly yes / no / abstain with a zero tally', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  // The vote box is shown to a signed-in user who has not voted yet.
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:155
  //      (showVoteBox = signed-in && !closed && !voted)
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:281-306
  //      (VoteBox: heading t('proposal-options.vote') + one control per option)
  await expect(page.getByRole('heading', { name: VOTE_HEADING })).toBeVisible();

  // Method 'vote' has exactly these three options, seeded at topic creation.
  // src: legacy/lib/api-v2/db-api/topics/index.js:122-129
  // src: legacy/lib/site/topic-layout/topic-article/vote/vote-options.js:1-35
  await expect(page.getByRole('button', { name: OPTION_LABELS.positive })).toBeVisible();
  await expect(page.getByRole('button', { name: OPTION_LABELS.neutral })).toBeVisible();
  await expect(page.getByRole('button', { name: OPTION_LABELS.negative })).toBeVisible();
  // legacy-bug: the legacy options are <a> tags with onClick and no href
  // (component.js:291-299) — keyboard-unreachable. Intended behaviour
  // (encoded above): real buttons, per spec-first WCAG 2.1 AA (plan §4.2).

  // Fresh fixture topic → zero votes cast.
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:204-208
  // src: legacy/lib/translations/lib/ro.json:219 + en.json:342
  await expect(page.getByText(votesCast(0))).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2-4. Casting each of yes / no / abstain updates the tally.
// ---------------------------------------------------------------------------
for (const value of ['positive', 'neutral', 'negative'] as const) {
  test.fixme(`J5: casting a ${value} vote confirms the choice and increments the tally`, async ({
    page,
    forum,
    topics,
    users,
  }) => {
    await signIn(page, users.voter);
    await page.goto(topicPath(forum.slug, topics.vote.slug));

    // Baseline before voting.
    // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:204-208
    await expect(page.getByText(votesCast(0))).toBeVisible();

    // Cast the vote. POST /topics/:id/vote accepts a single string `value`.
    // src: legacy/lib/api-v2/topics/index.js:230-263 (route: restrict +
    //      canVote privilege + api.topics.vote({ value }))
    // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:81-105
    //      (handleVote posts the option's value, then shows the voted state)
    await page.getByRole('button', { name: OPTION_LABELS[value] }).click();

    // The voted state replaces the vote box: a confirmation naming the
    // choice, and a change-vote control.
    // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:155
    //      (showVoteBox goes false once voted)
    // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:308-325
    //      (VotedBox names the chosen answer)
    // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83 (the API exposes
    //      the requesting user's own vote as `voted` — own vote only)
    await expect(page.getByText(VOTED_CONFIRMATION[value])).toBeVisible();
    // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:179
    //      + change-vote-button/component.js:4-12
    await expect(page.getByRole('button', { name: CHANGE_VOTE })).toBeVisible();

    // The tally updates: one vote cast. The server recomputes the aggregate
    // from the Vote collection and denormalizes it onto the topic.
    // src: legacy/lib/api-v2/db-api/topics/index.js:333-338 (doVote →
    //      calcResult → topic.action.results/count saved)
    // src: legacy/lib/api-v2/db-api/topics/utils.js:39-92 (calcResult:
    //      count = votes.length; per-option votes + 2-dp percentage)
    await expect(page.getByText(votesCast(1))).toBeVisible();
    // legacy-bug: the legacy client re-derives per-option counts as
    // parseInt(percentage * count) — a 100× inflation, since percentage is
    // already 0-100 (component.js:44-46; `new Array(n) || []` is a dead
    // fallback, and the guard `if (!votes[votedValue] === 0) return` at
    // component.js:58 is always false). Intended behaviour (encoded here):
    // display the server-computed action.results[].votes / action.count
    // verbatim, never recompute them client-side.
  });
}

// ---------------------------------------------------------------------------
// 5. Changing one's vote REPLACES it — the tally never double-counts.
// ---------------------------------------------------------------------------
test.fixme('J5: re-voting replaces the previous vote instead of duplicating it', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  // First vote: yes.
  // src: legacy/lib/api-v2/topics/index.js:230-263
  await page.getByRole('button', { name: OPTION_LABELS.positive }).click();
  await expect(page.getByText(VOTED_CONFIRMATION.positive)).toBeVisible();
  await expect(page.getByText(votesCast(1))).toBeVisible();

  // The change-vote control re-opens the option list.
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:107-111
  //      (changeVote → changingVote → showVoteBox true again, line 155)
  await page.getByRole('button', { name: CHANGE_VOTE }).click();
  await page.getByRole('button', { name: OPTION_LABELS.negative }).click();

  // Replace semantics, READ from the model code: doVote first checks
  // votedBy, and when a prior vote exists it REMOVES that Vote document
  // before saving the new one — one (topic, author) vote at all times,
  // enforced by the unique compound index.
  // src: legacy/lib/api-v2/db-api/topics/index.js:313-332 (votedBy →
  //      removeOwnVote → new Vote().save; the remove-without-replace branch
  //      at 321-323 applies to method 'cause' only, never 'vote')
  // src: legacy/lib/api-v2/db-api/topics/utils.js:12-15 (removeOwnVote)
  // src: legacy/lib/models/vote.js:16-17 (unique index { topic, author })
  await expect(page.getByText(VOTED_CONFIRMATION.negative)).toBeVisible();

  // Total stays 1 — replaced, not duplicated.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:39-92 (calcResult counts
  //      Vote documents; after replace there is exactly one)
  await expect(page.getByText(votesCast(1))).toBeVisible();
  await expect(page.getByText(votesCast(2))).not.toBeVisible();
  // legacy-bug (tally race): votedBy short-circuits to `false` whenever the
  // DENORMALIZED topic.action.count is 0 (utils.js:26) even if a Vote row
  // exists, and count only updates at the end of doVote (index.js:333-338),
  // which is itself a non-transactional read-recount-write. Two racing
  // votes by the same user skip removeOwnVote and collide on the unique
  // index → Mongo error 11000, surfaced as 400 ALREADY_VOTED
  // (api-v2/topics/index.js:256-262) for what the user meant as a legal
  // re-vote. Intended behaviour: a re-vote is an atomic upsert keyed on
  // (topic, author) and never fails with ALREADY_VOTED.
});

// ---------------------------------------------------------------------------
// 6. A closed topic refuses new votes and shows results instead.
// ---------------------------------------------------------------------------
test.fixme('J5: a closed vote topic shows results and offers no vote controls', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.closedOutcome.slug));

  // Closed → the results view replaces the vote box entirely.
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:152-155
  //      (showResult = closed; showVoteBox requires !showResult)
  // src: legacy/lib/models/topic.js:184-190 (status 'closed' when
  //      closingAt is in the past)
  await expect(page.getByRole('button', { name: OPTION_LABELS.positive })).not.toBeVisible();
  await expect(page.getByRole('button', { name: OPTION_LABELS.neutral })).not.toBeVisible();
  await expect(page.getByRole('button', { name: OPTION_LABELS.negative })).not.toBeVisible();

  // The server refuses a vote on a closed topic regardless of the UI.
  // src: legacy/lib/api-v2/db-api/topics/index.js:307-311 (doVote rejects
  //      with code VOTING_CLOSED; the message typo "os closed" is legacy)
  // Result aggregates are shown to the viewer.
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:184-197
  //      (ResultBox with per-option percentages) + 226-279
  await expect(page.getByRole('region', { name: /rezultate|results/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 7. NEW (decision G-10): a registered-but-unverified user is refused.
// ---------------------------------------------------------------------------
test.fixme('J5: a registered user below the required verification stage cannot vote', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // NEW behaviour — no direct legacy analogue. The verification-escalation
  // ladder (Stage 1 email → Stage 2 phone/SMS → Stage 3 eID, configurable
  // per consultation) gates voting above the comment tier.
  // src: decision G-10 (grill ledger) — docs/plans/2026-08-18-democracyos-grill-decisions.md:307
  //
  // Legacy ANALOGUE of "may participate ≠ may vote": the privilege
  // middleware refuses with 403 LACK_PRIVILEGES when canVote is false, and
  // the client renders a locked-out notice instead of the options.
  // src: legacy/lib/api-v2/middlewares/topics.js:7-20 (privilege → 403
  //      LACK_PRIVILEGES)
  // src: legacy/lib/privileges/topic.js:40-44 (canVote by forum
  //      visibility/role)
  // src: legacy/lib/site/topic-layout/topic-article/vote/component.js:157,214-218
  //      (cantComment overlay when privileges.canVote is false)
  // src: legacy/lib/site/topic-layout/topic-article/cant-comment/component.js:4-13
  //
  // RESOLVED (was TODO-AMBIGUOUS in this WU's report): the fixture contract
  // now models the two axes separately — `participant` is the Stage-1
  // (e-mail + Turnstile) account that may comment but not vote, and `voter`
  // is the Stage-2 (phone) account used by the happy paths above. So this
  // refusal uses a genuinely under-verified account rather than a role.
  // src: e2e/fixtures/users.ts (FixtureVerificationStage); decision G-10.
  // STILL AMBIGUOUS: the refusal copy (RO/EN) and per-topic stage
  // requirements are new design; the assertions below pin SEMANTICS only
  // (no castable options, a notice naming verification, tally untouched) and
  // the wording must be recorded in docs/CHARACTERIZATION.md at activation.
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  // src: decision G-10 (grill ledger) — voting gated above Stage 1.
  await expect(page.getByRole('button', { name: OPTION_LABELS.positive })).not.toBeVisible();
  await expect(page.getByText(/verificare|verifică|verification|verify/i)).toBeVisible();

  // The tally is untouched by the refused attempt.
  // src: legacy/lib/api-v2/middlewares/topics.js:7-20 (refusal happens
  //      before api.topics.vote runs — analogue for "no tally side-effect")
  await expect(page.getByText(votesCast(0))).toBeVisible();
});

// ---------------------------------------------------------------------------
// 8. NEW (decision G-7): aggregate-only public results + consultative label.
// ---------------------------------------------------------------------------
test.fixme('J5: results are aggregate-only and carry the consultative label', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // Signed-out visitor on the closed topic's public result page.
  await page.goto(topicPath(forum.slug, topics.closedOutcome.slug));

  // Aggregates are public.
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:8-47 (the ordinary scope
  //      exposes action.results and action.count — aggregates only; the
  //      single per-user datum is the requester's OWN `voted`, scopes.js:75-83)
  await expect(page.getByRole('region', { name: /rezultate|results/i })).toBeVisible();

  // NEW: every result page carries the "consultative, not a binding secret
  // ballot" label. No legacy analogue — G-7 requirement.
  // src: decision G-7 (grill ledger) — docs/plans/2026-08-18-democracyos-grill-decisions.md:313
  // TODO-AMBIGUOUS: the Romanian phrasing of the label is not yet decided;
  // the regex pins the required concept ("consultative"), not final copy.
  await expect(page.getByText(/consultativ|consultative/i)).toBeVisible();

  // NEW: individual votes must NOT be publicly attributable — no voter
  // identity may appear in or around the results.
  // src: decision G-7 (grill ledger) — aggregate-only public by default;
  //      pseudonymized vote payload. Legacy analogue (weaker): the topics
  //      API never lists voters (scopes.js:8-47 exposes no such field).
  await expect(page.getByText(users.voter.handle)).not.toBeVisible();

  // legacy-bug (schema-adjacent, found while deriving): the `title` virtual
  // is defined with an arrow function, so `this` is the module scope and
  // the exposed `title` (scopes.js:12) is always undefined —
  // legacy/lib/models/topic.js:157. Owned by J4 (topic display); recorded
  // here because J5's result page also renders the topic title. Intended
  // behaviour: title derives from the topic document, never undefined.
});
