// J6 — vote with methods `poll` (single choice from a configured option set)
// and `cause` (endorse/support) (plan §4.2, WU-M1-7). Semantic characterization
// spec: behaviour derived by READING legacy/lib/ (never a running system),
// targeting the NEW app built in M4 (API) / M5 (UI). Every assertion cites the
// legacy source it was derived from; a fresh reviewer re-derives each one from
// the citation, not from this file's prose.
//
// Pending-by-design: quarantined via test.fixme until the activation row in
// e2e/SPEC-LEDGER.md (M4, WU-M4-9; UI re-point WU-M5-7). The ledger already
// names this exact file (row J6), so no ledger-drift note is needed.
//
// Vocabulary note (shared with J5/J7): Vote.value is an untyped, free String —
// no enum, no validation beyond "is a string". Method 'poll' stores one of the
// topic's configured option names; method 'cause' stores the constant
// 'support' (the client hardcodes it). The new Postgres schema replaces this
// polymorphic free string with typed columns per method. J5 owns the canonical
// write-up; the poll- and cause-specific consequences are characterized below.
// src: legacy/lib/models/vote.js:5-10 (value: String, required — no enum)
// src: legacy/lib/api-v2/topics/index.js:230-242 (route validates only
//      "value is a required string" — nothing method-specific)
//
// THE ONE SEMANTIC THIS JOURNEY OWNS — cause withdrawal vs. everyone else's
// replace: doVote first resolves the user's prior vote (votedBy) and, when one
// exists, DELETES that Vote document (removeOwnVote). For every other method
// (vote/poll/slider/hierarchy) a NEW Vote is then saved — a re-vote REPLACES.
// For method 'cause' ONLY, the branch at index.js:320-323 returns early after
// the delete and NEVER re-inserts: a second vote by the same user is a
// WITHDRAWAL — the vote ceases to exist and the recount decrements. Cause is a
// toggle; everything else is a replace.
// src: legacy/lib/api-v2/db-api/topics/index.js:313-323 (votedBy →
//      removeOwnVote → `if (results[1] && ['cause'].indexOf(...) !== -1)
//      return Promise.resolve()` — the cause-only early return)
// src: legacy/lib/api-v2/db-api/topics/index.js:325-331 (the reinsert every
//      OTHER method reaches)
// src: legacy/lib/api-v2/db-api/topics/index.js:333-338 (recount after either
//      path — after a withdrawal, count goes DOWN)
// Note the server decides "withdrawal" purely from the existence of a prior
// vote — the posted value plays no part in the decision (the cause client
// happens to always post 'support': cause/component.js:31-36). The new API
// should make endorse/withdraw explicit rather than value-ignoring; recorded
// for docs/CHARACTERIZATION.md.
//
// i18n note (RO catalogue gap, same class as J7's): the legacy Romanian
// catalogue defines NONE of the poll/cause action strings — every
// `topics.actions.*` key (poll.do, cause.do, cause.done, thanks, feedback) is
// absent from ro.json (verified by exhaustive search: only fr/es/en define
// them; ro.json's nearest neighbourhood is proposal-options at 208-220), while
// en.json defines them all (454-459). The regexes below pin the EN catalogue
// values (the only citable copy) plus conservative Romanian stems; final RO
// copy is new design and must be recorded in docs/CHARACTERIZATION.md at
// activation (the rule J5 applied to G-10 copy and J7 to slider/hierarchy).
// legacy-bug: shipping two voting methods without RO strings on a
// Romanian-primary deployment is itself a defect; intended behaviour is a
// complete RO-primary catalogue with EN fallback.

import { expect, test } from '../fixtures/app.js';
import type { Page } from '@playwright/test';
import type { FixtureUser } from '../fixtures/users.js';

// ---------------------------------------------------------------------------
// TODO-AMBIGUOUS (fixture gaps this WU cannot close — one file only):
//
// 1. t-poll's OPTION SET is not named in the fixture contract
//    (docs/develop/fixtures.md "Topics" pins t-hierarchy's three options but
//    none for t-poll), yet creating a poll topic REQUIRES options — the seed
//    cannot exist until they are named, exactly the gap J7 flagged for
//    t-hierarchy before the contract grew its option set.
//    src: legacy/lib/api-v2/db-api/topics/index.js:130-134 ("Can't create a
//         poll without options")
//    Until the contract pins them, the poll assertions below are STRUCTURAL
//    (a radio group of 2+ options) and never name an option.
//
// 2. Closed-topic fixtures for the results views: the corpus has open t-poll /
//    t-cause and a single closed topic of method 'vote'. The closed-poll and
//    closed-cause tests below need closed fixtures with recorded votes (the
//    closed-poll one with a NON-TIED distribution, so exactly one winner
//    exists — see the all-winners legacy-bug in test 4). The slugs below are
//    placeholders following J7's convention; before activation they must land
//    in docs/develop/fixtures.md and e2e/fixtures/app.ts (contract file
//    first, per the drift rule in e2e/fixtures/users.ts).
// ---------------------------------------------------------------------------
const CLOSED_POLL_SLUG = 't-poll-closed';
const CLOSED_CAUSE_SLUG = 't-cause-closed';

// ---------------------------------------------------------------------------
// Accessible names (Romanian-primary, EN fallback).
// ---------------------------------------------------------------------------

// Poll submits through an explicit button, separate from choosing an option —
// selecting alone casts nothing (same pattern as J7's slider/hierarchy, and
// literally the same translation key).
// src: legacy/lib/site/topic-layout/topic-article/poll/component.js:116-123
//      (button t('topics.actions.poll.do'), disabled until a selection)
// src: legacy/lib/translations/lib/en.json:459 ("Vote"); anchored so it never
//      matches "Change vote". RO stem from ro.json:214 ("Votează").
const SUBMIT_VOTE = /^(votează|vote)$/i;

// The accessible name the NEW UI must give the poll's option group. Legacy
// renders a bare div of buttons with no group semantics and no name — naming
// it here is the WCAG-seeding contract (plan §4.2), as J7 did for its ranking
// list. Wording is new design; the regex pins the concept.
// src: legacy/lib/site/topic-layout/topic-article/poll/component.js:94-95,106-114
const POLL_GROUP = /sondaj|opțiuni|poll|options/i;

// The cause endorse action. EN catalogue "Add my Support"; RO absent (header
// note) — 'susțin'/'sprijin' are stems, not copy.
// src: legacy/lib/site/topic-layout/topic-article/cause/component.js:68-76
//      (button t('topics.actions.cause.do'))
// src: legacy/lib/translations/lib/en.json:455 ("Add my Support")
const ENDORSE = /susțin|sprijin|add my support/i;

// The cause withdraw action — the SAME handler as endorse, offered once
// supported. EN catalogue "You don't want to support this" (confirmation-
// shaped); the Spanish catalogue says "Dejar de apoyar" (stop supporting),
// which is the action the button actually performs.
// src: legacy/lib/site/topic-layout/topic-article/cause/component.js:59-65
//      (button t('topics.actions.cause.done') → handleSupport)
// src: legacy/lib/translations/lib/en.json:456; es.json:461
// TODO-AMBIGUOUS: the EN copy describes a state, not an action, and RO is
// absent — final copy is new design (docs/CHARACTERIZATION.md at activation);
// the regex pins the withdraw concept.
const WITHDRAW = /retrag|nu mai susțin|stop supporting|don't want to support/i;

// Post-vote acknowledgement, shared with J7 (same keys).
// src: legacy/lib/site/topic-layout/topic-article/cause/component.js:56-57
// src: legacy/lib/translations/lib/en.json:457-458 ("Thanks!" / "Your answer
//      has been saved")
const THANKS = /mulțum|thanks/i;

// Same change-vote control as J5/J7 (shared component) — poll offers it once
// voted; cause does NOT (its voted state offers withdraw instead).
// src: legacy/lib/site/topic-layout/topic-article/poll/component.js:88,115
// src: legacy/lib/site/topic-layout/topic-article/change-vote-button/component.js:4-12
// src: legacy/lib/translations/lib/ro.json:209 ("Vreau să îmi schimb votul.")
const CHANGE_VOTE = /vreau să îmi schimb votul|change vote/i;

// THE TALLY SURFACE for poll and cause: neither component renders a votes-cast
// counter of its own (unlike J5's method 'vote'); the aggregate the user sees
// is the participants box, rendered for EVERY method from the denormalized
// action.count. This is where the tally-update assertions below read.
// src: legacy/lib/site/topic-layout/topic-article/component.js:140 (Social is
//      always rendered under the action component)
// src: legacy/lib/site/topic-layout/topic-article/social/component.js:13-17
//      (`${action.count} ${t('proposal-article.participant.…')}`)
// src: legacy/lib/translations/lib/ro.json:205-206 (Participanți/Participant)
// src: legacy/lib/translations/lib/en.json:325-326 (Participants/Participant)
const participants = (num: number) => new RegExp(`\\b${num}\\b\\s+participan(ți|ts|t)`, 'i');

// Results region + G-7/G-10 vocabulary, identical to J5/J7 (do not diverge).
// src: e2e/journeys/j05-vote-method.spec.ts (same regexes, same decisions)
const RESULTS_REGION = /rezultate|results/i;
const VERIFICATION_NOTICE = /verificare|verifică|verification|verify/i;
const CONSULTATIVE = /consultativ|consultative/i;

// ---------------------------------------------------------------------------
// Sign-in steps — same convention as J5/J7 (J1 owns the full auth journey).
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

// ===========================================================================
// POLL
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Presentation: the configured option set as a single-choice group with an
//    explicit submit that stays disabled until something is chosen.
// ---------------------------------------------------------------------------
test.fixme('J6: an open poll presents its configured options as a single-choice group with an explicit submit', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.poll.slug));

  // The poll component mounts exactly when action.method === 'poll'.
  // src: legacy/lib/site/topic-layout/topic-article/component.js:112-118
  // src: legacy/lib/models/topic.js:73 (method enum names 'poll')
  //
  // WHERE THE OPTIONS COME FROM (the poll-defining fact): a poll REQUIRES an
  // option set at creation — the route forwards action.options only for
  // poll/hierarchy, creation rejects a poll without them, and one result row
  // is seeded per option. The UI then renders exactly one control per seeded
  // result row, labelled with the option's configured value. Options are
  // frozen once any vote exists.
  // src: legacy/lib/api-v2/topics/index.js:136-138 (route forwards options)
  // src: legacy/lib/api-v2/db-api/topics/index.js:130-137 ("Can't create a
  //      poll without options"; one result row per option)
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:106-114
  //      (one Option per action.results row) + 142-150 (value as the label)
  // src: legacy/lib/api-v2/middlewares/topics.js:100-108 (method/options
  //      frozen after the first vote)
  //
  // EXACTLY ONE choice is castable: the client keeps a single `selected`
  // value (picking another option overwrites it), and the cast posts that one
  // value. The NEW UI must express this as a real radio group — legacy's
  // plain buttons convey the single-choice rule only visually.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:25-29,49-53
  //      (single state.selected) + 38-40 (one value posted)
  // TODO-AMBIGUOUS (header, gap 1): the contract names no options for t-poll,
  // so assertions are structural — a group of 2+ radios, none named here.
  const group = page.getByRole('radiogroup', { name: POLL_GROUP });
  await expect(group).toBeVisible();
  expect(await group.getByRole('radio').count()).toBeGreaterThan(1);
  // legacy-bug (a11y): a legacy option is a <button> whose selected state is
  // conveyed ONLY by swapping a purely visual circle/check span — no checked
  // semantics of any kind, so the current choice is invisible to assistive
  // tech. Intended behaviour (encoded above and in test 2): real radios whose
  // checked state is programmatic.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:142-150

  // Choosing an option casts nothing by itself — submission is an explicit,
  // separate button, disabled until a selection exists.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:116-123
  //      (disabled={!this.state.selected}) + 38 (handlePoll refuses without
  //      a selection)
  const submit = page.getByRole('button', { name: SUBMIT_VOTE });
  await expect(submit).toBeVisible();
  await expect(submit).toBeDisabled();

  // Fresh fixture topic → zero participants (action.count defaults to 0).
  // src: legacy/lib/models/topic.js:74-75 (count default 0)
  // src: legacy/lib/site/topic-layout/topic-article/social/component.js:13-17
  await expect(page.getByText(participants(0))).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. Casting: one chosen option, the tally updates, the choice stays marked.
// ---------------------------------------------------------------------------
test.fixme('J6: casting a poll vote updates the participant tally and keeps the choice marked', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.poll.slug));

  // Baseline before voting.
  // src: legacy/lib/site/topic-layout/topic-article/social/component.js:13-17
  await expect(page.getByText(participants(0))).toBeVisible();

  // Choose one option, then submit. The client posts the selected option's
  // value as the vote — POST /topics/:id/vote with a single string `value`.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:49-53
  //      (select stores the option value) + 32-47 (handlePoll posts it)
  // src: legacy/lib/api-v2/topics/index.js:230-263 (the vote route)
  const group = page.getByRole('radiogroup', { name: POLL_GROUP });
  const chosen = group.getByRole('radio').first();
  await chosen.check();
  await expect(chosen).toBeChecked();
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // The tally updates: the server recounts the Vote collection and
  // denormalizes results/count onto the topic; the participants box shows 1.
  // src: legacy/lib/api-v2/db-api/topics/index.js:333-338 (doVote →
  //      calcResult → topic.action.results/count saved)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:70-90 (generic branch:
  //      count = votes.length; per-option votes + 2-dp percentage)
  // src: legacy/lib/site/topic-layout/topic-article/social/component.js:13-17
  await expect(page.getByText(participants(1))).toBeVisible();

  // Voted state on an OPEN poll: the option list stays visible with the
  // user's own choice marked (the API echoes the requester's own vote as
  // `voted`, and the client selects that option); picking another option is
  // inert until change-vote; the submit button is replaced by change-vote.
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83 (voted = own vote)
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:63-70
  //      (selected = topic.voted) + 49-53 (re-selection inert unless
  //      changing) + 88-89,115 (change-vote replaces the submit button)
  await expect(chosen).toBeChecked();
  await expect(page.getByRole('button', { name: CHANGE_VOTE })).toBeVisible();
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Re-voting REPLACES the previous choice — the tally never double-counts.
// ---------------------------------------------------------------------------
test.fixme('J6: re-voting on a poll replaces the previous choice instead of duplicating it', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.poll.slug));

  const group = page.getByRole('radiogroup', { name: POLL_GROUP });
  const first = group.getByRole('radio').first();
  const second = group.getByRole('radio').nth(1);

  // First vote: the first option.
  await first.check();
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();
  await expect(page.getByText(participants(1))).toBeVisible();

  // Change vote re-enables selection and the submit button.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:72-76
  //      (changeVote → changingVote) + 49-53 (selection allowed again) +
  //      87-89 (submit button returns while changing)
  await page.getByRole('button', { name: CHANGE_VOTE }).click();
  await second.check();
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // Replace semantics — poll takes the SAME doVote path J5 characterized:
  // votedBy finds the prior vote, removeOwnVote deletes it, and a NEW Vote is
  // saved (the cause-only early return at index.js:320-323 never applies to
  // 'poll'); one (topic, author) vote at all times via the unique compound
  // index.
  // src: legacy/lib/api-v2/db-api/topics/index.js:313-332
  // src: legacy/lib/api-v2/db-api/topics/utils.js:12-15 (removeOwnVote)
  // src: legacy/lib/models/vote.js:16-17 (unique index { topic, author })
  await expect(second).toBeChecked();
  await expect(page.getByText(participants(1))).toBeVisible();
  await expect(page.getByText(participants(2))).not.toBeVisible();
  // legacy-bug (same tally race as J5, inherited verbatim): votedBy
  // short-circuits to false while the denormalized action.count is still 0
  // (utils.js:26), so two racing first votes collide on the unique index and
  // surface as 400 ALREADY_VOTED (api-v2/topics/index.js:256-262). Intended:
  // atomic upsert keyed on (topic, author). J5 owns the canonical write-up.
});

// ---------------------------------------------------------------------------
// 4. A closed poll shows per-option results and refuses new votes.
// ---------------------------------------------------------------------------
test.fixme('J6: a closed poll shows per-option results and offers no castable controls', async ({
  page,
  forum,
  users,
}) => {
  // TODO-AMBIGUOUS (header, gap 2): placeholder fixture — a closed poll topic
  // seeded with a NON-TIED vote distribution.
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, CLOSED_POLL_SLUG));

  // Closed → the results view replaces the option controls entirely: the
  // options branch requires !showResults and the submit button requires
  // !showResults too.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:86
  //      (showResults = topic.closed) + 106-107,116-117 (both gated off)
  // src: legacy/lib/models/topic.js:184-190,210-212 (closed = closingAt past)
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();

  // The server refuses a vote on a closed topic regardless of the UI.
  // src: legacy/lib/api-v2/db-api/topics/index.js:307-311 (doVote rejects
  //      with code VOTING_CLOSED; the message typo "os closed" is legacy)

  // Results: one row per configured option, each carrying the
  // server-computed percentage (2-dp, denormalized after every vote), with
  // the leading option distinguished.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:96-105
  //      (one ResultBox per result row) + 152-164 (percentage + option label)
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:11-20
  //      (winner = the option(s) at the max percentage)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:70-90 (per-option votes +
  //      100/total*count at 2 dp) + index.js:333-338 (denormalized)
  const results = page.getByRole('region', { name: RESULTS_REGION });
  await expect(results).toBeVisible();
  await expect(results.getByText(/%/).first()).toBeVisible();
  // legacy-bug (everyone wins a tied or empty poll): the "winner" flag is
  // `percentage === Math.max(...)`, so on a tie — including the all-zero
  // fresh topic — EVERY option is highlighted as the winner. Intended
  // behaviour: the new UI defines tie presentation deliberately (e.g. a
  // stated tie, never a false unanimous highlight); the fixture is seeded
  // non-tied so this spec asserts the unambiguous case.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:11-20
  //
  // legacy-bug (free-string poll ballot — the poll variant of J7's
  // off-bucket slider value): the API accepts ANY string as a poll vote, with
  // no membership check against the configured option set. An off-option
  // value is stored, inflates action.count, deflates every real option's
  // percentage (they no longer sum to 100), and renders nowhere. Intended
  // behaviour: the server rejects a poll ballot whose value is not one of
  // the topic's options (typed schema per method). J7 owns the slider
  // variant; J5 owns the free-string vocabulary note.
  // src: legacy/lib/api-v2/topics/index.js:232-239 (type-only validation)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:70-90 (unknown values are
  //      counted in votes.length but exposed under no seeded option)
  //
  // legacy-bug (inaccessible result rows): a legacy result row is a focusable
  // <button> that does nothing, whose bar is a width-styled div. Intended
  // behaviour: results are non-interactive text (percentage readable as
  // text, asserted above), not phantom buttons.
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:152-164
});

// ===========================================================================
// CAUSE
// ===========================================================================

// ---------------------------------------------------------------------------
// 5. The endorse action: single-value support with no alternatives.
// ---------------------------------------------------------------------------
test.fixme('J6: an open cause offers a single endorse action and endorsing increments the supporter tally', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.cause.slug));

  // The cause component mounts exactly when action.method === 'cause'.
  // src: legacy/lib/site/topic-layout/topic-article/component.js:119-125
  //
  // WHAT A CAUSE IS: a single-value endorsement with NO alternatives. The
  // seeded result set is exactly one row, {value: 'support'}, and the client
  // posts the hardcoded constant 'support' — there is no option to choose,
  // no negative, no scale. The only decisions a user can make are endorse
  // and (later) withdraw.
  // src: legacy/lib/api-v2/db-api/topics/index.js:138-140 (seeded results =
  //      [{ value: 'support', percentage: 0, votes: 0 }])
  // src: legacy/lib/api-v2/middlewares/topics.js:127-129 (same on edit)
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:31-36
  //      (handleSupport posts the constant 'support')
  const endorse = page.getByRole('button', { name: ENDORSE });
  await expect(endorse).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByText(participants(0))).toBeVisible();

  // Endorse. Unlike poll, there is no separate submit — the endorse button
  // IS the cast.
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:68-76
  await endorse.click();

  // The supporter tally is the participants count: every cause vote is
  // 'support', so action.count IS the supporter count (the seeded row's
  // votes/percentage move with it: 1 vote → support 100%).
  // src: legacy/lib/api-v2/db-api/topics/utils.js:70-90 + index.js:333-338
  // src: legacy/lib/site/topic-layout/topic-article/social/component.js:13-17
  await expect(page.getByText(participants(1))).toBeVisible();

  // Endorsed state: an acknowledgement plus the WITHDRAW control in place of
  // the endorse button (`supported` derives from the API's own-vote echo).
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:22-29
  //      (supported = !!topic.voted) + 47-48 (endorse and withdraw are
  //      mutually exclusive) + 52-66 (thanks + the cause.done button)
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83 (voted = own only)
  // src: legacy/lib/translations/lib/en.json:456-458
  await expect(page.getByText(THANKS)).toBeVisible();
  await expect(page.getByRole('button', { name: WITHDRAW })).toBeVisible();
  await expect(page.getByRole('button', { name: ENDORSE })).not.toBeVisible();
  // NOTE (deliberate non-assertion): cause never offers the shared
  // change-vote control — there is nothing to change TO; its voted state
  // offers withdrawal instead. Cross-reference J5 (vote) and J7
  // (slider/hierarchy), whose voted states all offer CHANGE_VOTE.
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:50-88
  //      (no ChangeVote import or render anywhere in the component)
});

// ---------------------------------------------------------------------------
// 6. Withdrawal — THE cause-only branch: the vote is REMOVED, not replaced.
// ---------------------------------------------------------------------------
test.fixme('J6: withdrawing a cause endorsement removes the vote entirely and decrements the tally', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.cause.slug));

  // Endorse first.
  await page.getByRole('button', { name: ENDORSE }).click();
  await expect(page.getByText(participants(1))).toBeVisible();

  // Withdraw. The withdraw button fires the SAME handler and posts the SAME
  // 'support' value — the server, not the payload, decides this is a
  // withdrawal: votedBy finds the prior vote, removeOwnVote DELETES the Vote
  // document, and the cause-only branch returns early WITHOUT saving a new
  // one. The recount then sees one vote fewer. This is the exact opposite of
  // every other method, where the delete is immediately followed by a
  // reinsert (replace — J5/J7 characterize that side).
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:59-65
  //      (cause.done button → handleSupport) + 31-36 (posts 'support')
  // src: legacy/lib/api-v2/db-api/topics/index.js:313-319 (votedBy →
  //      removeOwnVote when a prior vote exists)
  // src: legacy/lib/api-v2/db-api/topics/index.js:320-323 (`if (results[1]
  //      && ['cause'].indexOf(topic.action.method) !== -1) return
  //      Promise.resolve()` — no new Vote is ever created)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:12-15 (removeOwnVote:
  //      Vote.remove — a hard delete)
  // src: legacy/lib/api-v2/db-api/topics/index.js:333-338 (recount → the
  //      denormalized count DECREMENTS)
  await page.getByRole('button', { name: WITHDRAW }).click();

  // Withdrawn state: the tally is back to zero and the endorse action is
  // offered again — the user is indistinguishable from someone who never
  // voted (their Vote document no longer exists, so the own-vote echo is
  // empty).
  // src: legacy/lib/api-v2/db-api/topics/utils.js:25-30 (votedBy finds no
  //      vote → false) + scopes.js:75-83 (voted false → supported false)
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:22-29,47-48
  await expect(page.getByText(participants(0))).toBeVisible();
  await expect(page.getByRole('button', { name: ENDORSE })).toBeVisible();
  await expect(page.getByRole('button', { name: WITHDRAW })).not.toBeVisible();

  // The toggle cycles: endorsing again is a fresh first vote.
  // src: legacy/lib/api-v2/db-api/topics/index.js:313-331 (no prior vote →
  //      straight to the insert path)
  await page.getByRole('button', { name: ENDORSE }).click();
  await expect(page.getByText(participants(1))).toBeVisible();
  // legacy-bug (withdrawal blocked by the stale-count race — the
  // cause-specific consequence of J5's canonical race): votedBy trusts the
  // DENORMALIZED topic.action.count and short-circuits to false whenever it
  // reads 0 (utils.js:26), even if the user's Vote row exists (e.g. the vote
  // saved but the follow-up topic.save failed, or two racing first
  // endorsements). For cause this is worse than a wrong error: the toggle
  // can NEVER reach the withdrawal branch while count reads 0 — the attempt
  // takes the insert path and dies on the unique index as 400 ALREADY_VOTED
  // (api-v2/topics/index.js:256-262), leaving the user permanently unable to
  // un-endorse. Intended behaviour: withdrawal is decided by the existence
  // of the Vote row itself (atomic delete-if-exists), never by a
  // denormalized counter. J5 owns the canonical race write-up.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:25-30
  // src: legacy/lib/models/vote.js:16-17
  //
  // legacy-bug (fragile "was anything removed" check): removeOwnVote reports
  // deletion as `writeOpResult.nMatched !== 0`, a field name that appears
  // nowhere else in the codebase and is not the Mongoose remove() result
  // shape (`result.n`); if absent it is `undefined !== 0` — always true. The
  // cause branch therefore effectively keys on votedBy alone. Harmless while
  // votedBy is truthy only when a vote exists, but the new implementation
  // must key withdrawal on the delete's actual result, verified at
  // activation.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:12-15
  // src: legacy/lib/api-v2/db-api/topics/index.js:320-321
});

// ---------------------------------------------------------------------------
// 7. A closed cause refuses endorsement and shows the supporter aggregate.
// ---------------------------------------------------------------------------
test.fixme('J6: a closed cause offers no endorse or withdraw action and shows the supporter count', async ({
  page,
  forum,
  users,
}) => {
  // TODO-AMBIGUOUS (header, gap 2): placeholder fixture — a closed cause
  // topic seeded with at least one recorded supporter (NOT elena-voter, so
  // this signed-in view is also endorse-free by state, not by accident).
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, CLOSED_CAUSE_SLUG));

  // Closed → both actions are gated off client-side, and the server refuses
  // regardless.
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:44,47-48
  //      (showVoteButton and showChangeVote both require !showResults)
  //      + 31-32 (handleSupport no-ops when closed)
  // src: legacy/lib/api-v2/db-api/topics/index.js:307-311 (VOTING_CLOSED)
  // src: legacy/lib/models/topic.js:184-190,210-212
  await expect(page.getByRole('button', { name: ENDORSE })).not.toBeVisible();
  await expect(page.getByRole('button', { name: WITHDRAW })).not.toBeVisible();

  // The aggregate that exists server-side — the supporter count — remains
  // visible (the participants box renders for every method from
  // action.count, and for cause every counted vote is a supporter).
  // src: legacy/lib/site/topic-layout/topic-article/component.js:140
  // src: legacy/lib/site/topic-layout/topic-article/social/component.js:13-17
  // src: legacy/lib/api-v2/db-api/topics/index.js:138-140 (the single
  //      'support' row is the whole result set)
  await expect(page.getByText(/participan(ți|ts|t)/i)).toBeVisible();
  // legacy-bug (the missing cause results view): the cause component computes
  // showResults but its render has NO results branch at all — a closed cause
  // shows neither a result box nor any closure notice; only the generic
  // participants box betrays that anything happened. Intended behaviour
  // (encoded above + in test 9): a closed cause presents its supporter count
  // as the result, under the same results/consultative framing as every
  // other method (G-7 requires a labelled result page).
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:44,50-88
  //      (showResults computed at 44, never used to render results)
});

// ===========================================================================
// BOTH METHODS — the two decision-log behaviours, exactly as J5/J7 pinned them.
// ===========================================================================

// ---------------------------------------------------------------------------
// 8. NEW (decision G-10): a stage-1 participant may not vote — either method.
// ---------------------------------------------------------------------------
test.fixme('J6: a stage-1 participant cannot cast a poll vote or endorse a cause', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // NEW behaviour — the verification-escalation ladder (Stage 1 email may
  // read/comment; Stage 2 phone required to VOTE) has no legacy counterpart;
  // legacy gated voting on forum privileges alone.
  // src: decision G-10 (grill ledger) — docs/plans/2026-08-18-democracyos-grill-decisions.md:307
  //
  // Legacy ANALOGUE of "may participate ≠ may vote": the privilege
  // middleware refuses with 403 LACK_PRIVILEGES when canVote is false, and
  // BOTH method components render the same locked-out overlay alongside
  // their controls.
  // src: legacy/lib/api-v2/middlewares/topics.js:7-20 (403 LACK_PRIVILEGES)
  // src: legacy/lib/privileges/topic.js:40-44 (canVote)
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:90,130-134
  // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:45,82-86
  // src: legacy/lib/site/topic-layout/topic-article/cant-comment/component.js:4-13
  //
  // Fixture taxonomy: `participant` (ana, stage1-email) is the negative case;
  // `voter` (elena, stage2-phone) is the eligible account used above.
  // src: e2e/fixtures/users.ts (FixtureVerificationStage; the two accounts)
  // TODO-AMBIGUOUS (same as J5/J7): the refusal copy is new design;
  // assertions pin semantics only — nothing castable, a notice naming
  // verification, tally untouched.
  await signIn(page, users.participant);

  await page.goto(topicPath(forum.slug, topics.poll.slug));
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();
  await expect(page.getByText(VERIFICATION_NOTICE)).toBeVisible();

  await page.goto(topicPath(forum.slug, topics.cause.slug));
  await expect(page.getByRole('button', { name: ENDORSE })).not.toBeVisible();
  await expect(page.getByText(VERIFICATION_NOTICE)).toBeVisible();

  // The tally is untouched by the refused attempt.
  // src: legacy/lib/api-v2/middlewares/topics.js:7-20 (the refusal happens
  //      before api.topics.vote runs — no tally side-effect, as in J5)
  await expect(page.getByText(participants(0))).toBeVisible();
});

// ---------------------------------------------------------------------------
// 9. NEW (decision G-7): aggregate-only public results + consultative label.
// ---------------------------------------------------------------------------
test.fixme('J6: poll and cause results are aggregate-only and carry the consultative label', async ({
  page,
  forum,
  users,
}) => {
  // Signed-out visitor on both closed placeholder topics (see header
  // TODO-AMBIGUOUS on the fixtures).
  //
  // Aggregates are public; the only per-user datum the API ever exposes is
  // the requester's OWN `voted`. Individual votes are never listed — for
  // cause especially, "who endorsed" is exactly the attributable datum G-7
  // forbids publishing (aggregate-only public by default; pseudonymized
  // vote payload).
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:8-47 (public scope:
  //      action.results / action.count only — no voter list field exists)
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83 (voted = own only)
  // src: decision G-7 (grill ledger) — docs/plans/2026-08-18-democracyos-grill-decisions.md:313
  // TODO-AMBIGUOUS (same as J5/J7): the RO phrasing of the consultative
  // label is not yet decided; the regex pins the required concept, not
  // final copy.
  for (const slug of [CLOSED_POLL_SLUG, CLOSED_CAUSE_SLUG]) {
    await page.goto(topicPath(forum.slug, slug));

    await expect(page.getByText(CONSULTATIVE)).toBeVisible();

    // No voter identity in or around the results — the fixture voter's
    // handle must appear nowhere on the public result page.
    await expect(page.getByText(users.voter.handle)).not.toBeVisible();

    // A signed-out visitor gets aggregates, never a castable control.
    // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:87-89
    // src: legacy/lib/site/topic-layout/topic-article/cause/component.js:47-48
    //      (both require a fulfilled session for any action control)
    await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();
    await expect(page.getByRole('button', { name: ENDORSE })).not.toBeVisible();
  }

  // The poll's own-choice marking is a SESSION datum, not public: the marked
  // option derives from the requester's own `voted`, so a signed-out visitor
  // must not see any option presented as "the chosen one".
  // src: legacy/lib/site/topic-layout/topic-article/poll/component.js:11-20
  //      (voted flag per result row comes from userVote) + 63-70
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
});
