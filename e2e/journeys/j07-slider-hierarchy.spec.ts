// J7 — vote with methods `slider` (intensity) and `hierarchy` (ranking)
// (plan §4.2, WU-M1-8). These two methods are the product's headline
// differentiators (neither Consul nor Decidim has them), so the plan demands
// the highest characterization fidelity here. Semantic spec: behaviour derived
// by READING legacy/lib/ (never a running system), targeting the NEW app built
// in M4 (API) / M5 (UI). Every assertion cites the legacy source it was
// derived from; a fresh reviewer re-derives each one from the citation.
//
// Pending-by-design: quarantined via test.fixme until the activation row in
// e2e/SPEC-LEDGER.md (M4, WU-M4-9; UI re-point WU-M5-7). The ledger already
// names this exact file (row J7), so no ledger-drift note is needed.
//
// Vocabulary note (shared with J5): Vote.value is an untyped, free String —
// no enum, no validation beyond "is a string". Method 'slider' stores a
// stringified number ('-100'…'100'), method 'hierarchy' stores a CSV of
// option names. The new Postgres schema replaces this polymorphic free
// string with real typed columns/enums per method.
// src: legacy/lib/models/vote.js:5-10 (value: String, required — no enum)
// src: legacy/lib/api-v2/topics/index.js:230-242 (route validates only
//      "value is a required string" — nothing method-specific)
//
// i18n note (RO catalogue gap, found while deriving): the legacy Romanian
// catalogue has NO translations for any slider/hierarchy string — every
// `proposal-result.*`, `proposal-behavior.hierarchy*` and `topics.actions.*`
// key is absent from ro.json (verified by exhaustive search; ro.json's
// proposal-options block at lines 208-220 is the closest neighbourhood and
// contains none of them), while en.json defines them all (317-320, 332,
// 335-336, 344-352, 454-459). The headline differentiators were therefore
// never localized. The regexes below pin the EN catalogue values (the only
// citable copy) plus conservative Romanian stems for forward-compatibility;
// the final RO copy is new design and must be recorded in
// docs/CHARACTERIZATION.md at activation (same rule J5 applied to G-10 copy).
// legacy-bug: shipping the differentiator methods without RO strings on a
// Romanian-primary deployment is itself a defect; intended behaviour is a
// complete RO-primary catalogue with EN fallback.

import { expect, test } from '../fixtures/app';
import type { Page } from '@playwright/test';
import type { FixtureUser } from '../fixtures/users';

// ---------------------------------------------------------------------------
// TODO-AMBIGUOUS (fixture gap — closed topics for the results views): the
// fixture corpus (docs/develop/fixtures.md "Topics") defines open t-slider /
// t-hierarchy and a single closed topic with method 'vote'. Legacy renders
// slider/hierarchy RESULTS only when the topic is closed
// (src: legacy/lib/site/topic-layout/topic-article/slider/component.js:87
//  showResults = topic.closed;
//  src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:73),
// so the results tests below need closed fixtures with recorded votes —
// including a ranking by elena-voter for the hierarchy own-answer toggle.
// The slugs below are placeholders: before activation they must land in
// docs/develop/fixtures.md and e2e/fixtures/app.ts (the contract file first,
// per the drift rule in e2e/fixtures/users.ts). This WU writes exactly one
// file and therefore cannot extend the contract itself.
// ---------------------------------------------------------------------------
const CLOSED_SLIDER_SLUG = 't-slider-closed';
const CLOSED_HIERARCHY_SLUG = 't-hierarchy-closed';

// ---------------------------------------------------------------------------
// Accessible names.
// ---------------------------------------------------------------------------

// The nine slider buckets. Range and granularity are defined twice in legacy
// and agree: the UI control is min -100, max +100, step 25 (nine positions),
// and the server seeds exactly nine result buckets '-100'…'100'.
// src: legacy/lib/site/topic-layout/topic-article/slider/component.js:101-107
//      (InputRange maxValue={100} minValue={-100} step={25})
// src: legacy/lib/api-v2/db-api/topics/index.js:141-153 (nine seeded buckets)
// src: legacy/lib/api-v2/middlewares/topics.js:130-141 (same nine on edit)
// Labels per bucket (EN catalogue; the strings embed literal "\n", hence \s+):
// src: legacy/lib/site/topic-layout/topic-article/slider/component.js:151-165
//      (fillFormatLabel: the value→label map)
// src: legacy/lib/translations/lib/en.json:344-352
const SLIDER_LABELS = {
  '-100': 'very\\s+against',
  '-75': 'strongly\\s+against',
  '-50': 'against',
  '-25': 'somewhat\\s+against',
  '0': 'neutral',
  '25': 'somewhat\\s+support',
  '50': 'support',
  '75': 'strongly\\s+support',
  '100': 'very\\s+support',
} as const;
type SliderValue = keyof typeof SLIDER_LABELS;

/** An element whose whole text is exactly this bucket's label. */
const exactLabel = (value: SliderValue) => new RegExp(`^${SLIDER_LABELS[value]}$`, 'i');

// The voted confirmation interpolates the bucket label into "Your answer
// was: {vote}". Adjacency in the regex guarantees e.g. bucket '-50'
// ("Against") does not false-match a "Very against" confirmation.
// src: legacy/lib/site/topic-layout/topic-article/slider/component.js:195-209
//      (VotedBox: thanks + feedback + the interpolated answer)
// src: legacy/lib/translations/lib/en.json:335-336 ("Your answer was: {vote}")
// TODO-AMBIGUOUS: RO copy absent (header note); 'răspunsul' is a stem, not copy.
const confirmedIntensity = (value: SliderValue) =>
  new RegExp(`(your answer was|răspunsul)\\W*${SLIDER_LABELS[value]}`, 'i');

// Both methods submit through the same explicit button, separate from the
// input control — choosing a value/order does NOT cast the vote by itself.
// src: legacy/lib/site/topic-layout/topic-article/slider/component.js:167-181
// src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:173-187
//      (VoteBox: a single button labelled t('topics.actions.poll.do'))
// src: legacy/lib/translations/lib/en.json:459 ("Vote"); anchored so it never
//      matches "Change vote". RO analogue stem from ro.json:214 ("Votează").
const SUBMIT_VOTE = /^(votează|vote)$/i;

// Post-vote acknowledgement, shared by both methods.
// src: legacy/lib/site/topic-layout/topic-article/slider/component.js:202-206
// src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:154-158
// src: legacy/lib/translations/lib/en.json:457-458 ("Thanks!" / "Your answer
//      has been saved")
const THANKS = /mulțum|thanks/i;

// Same change-vote control as J5 (shared component).
// src: legacy/lib/site/topic-layout/topic-article/change-vote-button/component.js:4-12
// src: legacy/lib/translations/lib/ro.json:209 ("Vreau să îmi schimb votul.")
const CHANGE_VOTE = /vreau să îmi schimb votul|change vote/i;

// Hierarchy headings and toggles.
// src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:81-89
// src: legacy/lib/translations/lib/en.json:320 ("Choose your hierarchy
//      according to your priority."), 317 ("Results")
const HIERARCHY_HEADING = /ierarh|choose your hierarchy/i;
// src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:214-237
// src: legacy/lib/translations/lib/en.json:318-319 ("Show my answer" /
//      "Show results")
const SHOW_MY_ANSWER = /răspunsul meu|show my answer/i;
const SHOW_RESULTS = /arată rezultatele|show results/i;
// src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:159
// src: legacy/lib/translations/lib/en.json:454 ("Your answer was:")
const YOUR_ANSWER = /răspunsul|your answer/i;

// The accessible name the NEW UI must give the ranking list. The legacy list
// is an anonymous <ol> of drag-only items — no accessible name, no keyboard
// path (legacy-bug, see test below); naming it here is the WCAG-seeding
// contract (plan §4.2: role/name selectors define the names the new UI must
// have).
// src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:135-149
const RANKING_LIST = /ierarh|priorit|ranking|hierarchy/i;

// Results region + G-7/G-10 vocabulary, identical to J5 (do not diverge).
// src: e2e/journeys/j05-vote-method.spec.ts (same regexes, same decisions)
const RESULTS_REGION = /rezultate|results/i;
const VERIFICATION_NOTICE = /verificare|verifică|verification|verify/i;
const CONSULTATIVE = /consultativ|consultative/i;

// ---------------------------------------------------------------------------
// Sign-in steps — same convention as J5 (J1 owns the full auth journey).
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
// SLIDER
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. Presentation: an accessible slider over −100…+100 in 25-point steps.
// ---------------------------------------------------------------------------
test.fixme('J7: an open slider topic presents an accessible intensity slider over -100…+100', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.slider.slug));

  // The slider component mounts exactly when action.method === 'slider'.
  // src: legacy/lib/site/topic-layout/topic-article/component.js:127-131
  // The range control is shown to a signed-in voter who has not voted yet.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:88
  //      (showRange = signed-in && !(closed || voted))
  // The NEW UI must expose it with the ARIA slider role — this is where the
  // accessible interaction contract is defined (plan §4.2, WCAG seed).
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:101-107
  //      (min -100, max +100, step 25)
  const slider = page.getByRole('slider');
  await expect(slider).toBeVisible();

  // Initial position is the neutral midpoint, value 0, and its label is
  // rendered for the current position.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:30
  //      (initial state value = 0 when not voted)
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:106,151-165
  //      (formatLabel maps 0 → t('proposal-result.neutral'))
  // src: legacy/lib/translations/lib/en.json:344 ("Neutral")
  await expect(page.getByText(exactLabel('0')).first()).toBeVisible();

  // The two half-axis anchors are always presented above the control…
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:96-100
  //      (input-great-labels: middle-against / middle-support)
  // src: legacy/lib/translations/lib/en.json:347-348 ("Against" / "Support")
  await expect(page.getByText(exactLabel('-50')).first()).toBeVisible();
  await expect(page.getByText(exactLabel('50')).first()).toBeVisible();

  // …and every non-neutral bucket label is presented along the scale, so a
  // voter can see all nine positions' meanings before choosing.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:11-24
  //      (the eight small labels, four per half)
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:108-118
  //      (rendered under the range control)
  // src: legacy/lib/translations/lib/en.json:345-346,349-352
  for (const value of ['-100', '-75', '-25', '25', '75', '100'] as const) {
    await expect(page.getByText(exactLabel(value)).first()).toBeVisible();
  }

  // Choosing an intensity does not cast anything: submission is an explicit,
  // separate button.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:119,167-181
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).toBeVisible();

  // NOTE (deliberate non-assertion): unlike method 'vote' (J5), the legacy
  // slider never renders a votes-cast counter while open — action.count is
  // used only inside the closed-topic ResultBox.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:85,132-135
});

// ---------------------------------------------------------------------------
// 2. Keyboard granularity: one arrow press = exactly one 25-point bucket.
// ---------------------------------------------------------------------------
test.fixme('J7: the slider is keyboard-operable and one arrow step moves exactly one 25-point bucket', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.slider.slug));

  // Keyboard path: focus the slider, one ArrowRight from the initial 0, then
  // submit. If (and only if) the control implements the legacy granularity —
  // step 25 over -100…+100 — a single keypress lands on bucket 25 and the
  // confirmation names that bucket's label.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:104 (step={25})
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:30 (starts at 0)
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:55-73
  //      (handleVote posts value.toString() — here '25')
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:151-165
  //      + legacy/lib/translations/lib/en.json:351 (25 → "Somewhat support")
  // legacy-bug (a11y): legacy renders react-input-range with no guaranteed
  // keyboard contract of its own choosing and pairs it with a purely visual
  // label track; the NEW control must implement the WAI-ARIA slider keyboard
  // pattern (arrows step, Home/End to extremes) — that contract is what this
  // test and the next one pin (plan §4.2 WCAG seeding; no legacy line can be
  // cited for keyboard behaviour, which is precisely the gap).
  const slider = page.getByRole('slider');
  await slider.press('ArrowRight');
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:195-209
  //      + legacy/lib/translations/lib/en.json:457-458,336
  await expect(page.getByText(THANKS)).toBeVisible();
  await expect(page.getByText(confirmedIntensity('25'))).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Casting an extreme via Home/End proves the -100…+100 bounds.
// ---------------------------------------------------------------------------
test.fixme('J7: End jumps the slider to +100 and casting confirms the extreme intensity', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.slider.slug));

  // End must land on the maximum, +100 — the top seeded bucket. (WAI-ARIA
  // slider keyboard pattern; bounds from the legacy control and seed.)
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:102-103
  //      (maxValue 100 / minValue -100)
  // src: legacy/lib/api-v2/db-api/topics/index.js:141-153 ('100' is a seeded bucket)
  const slider = page.getByRole('slider');
  await slider.press('End');
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:195-209
  //      + legacy/lib/translations/lib/en.json:345 (100 → "Very support")
  await expect(page.getByText(confirmedIntensity('100'))).toBeVisible();

  // The voted state replaces the range control and offers change-vote.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:88-89
  //      (showRange false once voted; showChangeVote true)
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:123-127
  await expect(page.getByRole('slider')).not.toBeVisible();
  await expect(page.getByRole('button', { name: CHANGE_VOTE })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 4. Re-voting replaces the previous intensity (consistent with J5's finding).
// ---------------------------------------------------------------------------
test.fixme('J7: re-voting on a slider replaces the previous intensity instead of duplicating it', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.slider.slug));

  // First vote: one step right = 25.
  await page.getByRole('slider').press('ArrowRight');
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();
  await expect(page.getByText(confirmedIntensity('25'))).toBeVisible();

  // Change vote re-opens the range control.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:75-79,88
  //      (changingVote forces showRange true again)
  await page.getByRole('button', { name: CHANGE_VOTE }).click();
  await page.getByRole('slider').press('End');
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // Replace semantics — the SAME doVote path J5 characterized: votedBy →
  // removeOwnVote deletes the prior Vote document before the new one saves;
  // one (topic, author) vote at all times via the unique compound index. The
  // remove-without-replace branch applies to method 'cause' only — never
  // slider or hierarchy.
  // src: legacy/lib/api-v2/db-api/topics/index.js:313-332
  // src: legacy/lib/api-v2/db-api/topics/utils.js:12-15 (removeOwnVote)
  // src: legacy/lib/models/vote.js:16-17 (unique index { topic, author })
  await expect(page.getByText(confirmedIntensity('100'))).toBeVisible();
  await expect(page.getByText(confirmedIntensity('25'))).not.toBeVisible();
  // legacy-bug (same race as J5, inherited here verbatim): votedBy
  // short-circuits to false while the denormalized action.count is still 0
  // (utils.js:26), so two racing first votes collide on the unique index and
  // surface as 400 ALREADY_VOTED (api-v2/topics/index.js:256-262). Intended:
  // atomic upsert keyed on (topic, author). J5 owns the canonical write-up.
});

// ---------------------------------------------------------------------------
// 5. Closed slider: the aggregate is a nine-bucket DISTRIBUTION, not a mean.
// ---------------------------------------------------------------------------
test.fixme('J7: a closed slider topic shows the per-bucket distribution, including neutral', async ({
  page,
  forum,
}) => {
  // TODO-AMBIGUOUS: placeholder fixture (see header) — a closed slider topic
  // seeded with at least one vote so the distribution renders rather than the
  // empty state ("Niciun vot exprimat" / "No votes cast",
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:213-222,
  // src: legacy/lib/translations/lib/ro.json:213 + en.json:332).
  await page.goto(topicPath(forum.slug, CLOSED_SLIDER_SLUG));

  // Closed → the results view replaces the range control entirely.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:87-88,131-135
  // src: legacy/lib/models/topic.js:184-190,210-212 (closed = closingAt past)
  await expect(page.getByRole('slider')).not.toBeVisible();
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();

  // The aggregate the server computes is a per-bucket DISTRIBUTION — for each
  // of the nine seeded buckets: raw vote count plus percentage of all votes,
  // rounded to 2 decimals. There is NO mean/average anywhere in the tally
  // code; the new app must render the distribution, not collapse it.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:70-90 (calcResult generic
  //      branch: per-option votes + 100/total*count at 2 dp; count = total)
  // src: legacy/lib/api-v2/db-api/topics/index.js:333-338 (denormalized onto
  //      topic.action.results / action.count after every vote)
  await expect(page.getByRole('region', { name: RESULTS_REGION })).toBeVisible();
  const results = page.getByRole('region', { name: RESULTS_REGION });
  for (const value of ['-100', '-75', '-50', '-25', '0', '25', '50', '75', '100'] as const) {
    await expect(results.getByText(exactLabel(value)).first()).toBeVisible();
  }
  // legacy-bug (dropped neutral): the legacy ResultBox splits results into
  // strictly negative and strictly positive chart halves, so bucket '0'
  // (Neutral) appears in NEITHER chart — neutral votes are silently invisible
  // in the closed view even though the server counted them.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:224-225
  //      (filter row.value > 0 / row.value < 0 — no branch keeps 0)
  // Intended behaviour (encoded above): all nine buckets, neutral included.
  //
  // legacy-bug (inaccessible tally): the distribution is rendered only as
  // SVG bar charts with hover tooltips for the raw counts — no text
  // alternative at all.
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:227-283
  // Intended behaviour: the counts/percentages are exposed as accessible
  // text, asserted structurally here (a percentage is readable as text).
  await expect(results.getByText(/%/).first()).toBeVisible();
  //
  // legacy-bug (unvalidated intensity): the API accepts ANY string as a
  // slider value — nothing checks membership in the nine buckets. An
  // off-bucket value (e.g. '42') is stored, inflates action.count, deflates
  // every bucket's percentage (they no longer sum to 100), and renders
  // nowhere.
  // src: legacy/lib/api-v2/topics/index.js:232-239 (type-only validation)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:71-80 (unknown values are
  //      counted in votes.length but exposed under no seeded option)
  // Intended behaviour: the new schema constrains slider values to the nine
  // buckets (real enum / CHECK constraint) and rejects anything else.
});

// ===========================================================================
// HIERARCHY
// ===========================================================================

// ---------------------------------------------------------------------------
// 6. Presentation: the option set as a reorderable ranked list.
// ---------------------------------------------------------------------------
test.fixme('J7: an open hierarchy topic lists its options as a reorderable ranking with an explicit submit', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.hierarchy.slug));

  // The hierarchy component mounts exactly when action.method === 'hierarchy'.
  // src: legacy/lib/site/topic-layout/topic-article/component.js:134-138
  // The instruction heading is shown while voting is possible.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:81-84
  // src: legacy/lib/translations/lib/en.json:320
  await expect(page.getByRole('heading', { name: HIERARCHY_HEADING })).toBeVisible();

  // The option set is fixed at topic creation: creating a hierarchy topic
  // REQUIRES action.options, and the seeded results carry one row per option
  // — the UI derives its list items from exactly those rows. Options are
  // immutable once any vote exists.
  // src: legacy/lib/api-v2/db-api/topics/index.js:130-137 (options required,
  //      one result row per option)
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:23
  //      (items = action.results.map(item => item.value))
  // src: legacy/lib/api-v2/middlewares/topics.js:100-108 (method/options
  //      frozen after the first vote)
  // TODO-AMBIGUOUS: the fixture contract (docs/develop/fixtures.md "Topics")
  // does not define t-hierarchy's option set, so no option NAMES can be
  // asserted; the assertions here are structural (a list of 2+ options) and
  // the contract must pin the option set before activation.
  const ranking = page.getByRole('list', { name: RANKING_LIST });
  await expect(ranking).toBeVisible();
  expect(await ranking.getByRole('listitem').count()).toBeGreaterThan(1);

  // NOTE (behaviour to preserve, not directly assertable in one run): until
  // the user has voted, the presented order is RANDOMIZED per render — an
  // anti-anchoring measure so the seeded order does not bias the ranking.
  // After voting, the user's own order is shown instead.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:28
  //      (items: voted ? items : shuffle(items))
  // Activation may strengthen this by seeding many options and comparing two
  // fresh sessions; recorded here so the shuffle is not "simplified away".

  // Reordering never submits by itself — casting is an explicit button.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:100,173-187
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 7. Keyboard reordering — the affordance the legacy UI never had.
// ---------------------------------------------------------------------------
test.fixme('J7: ranking options are reorderable by keyboard-operable controls, not drag-only', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.hierarchy.slug));

  const ranking = page.getByRole('list', { name: RANKING_LIST });
  const items = ranking.getByRole('listitem');

  // legacy-bug (a11y, the drag-only ranking): legacy reordering is
  // react-sortable-hoc drag-and-drop ONLY — plain <li> items, no buttons, no
  // keyboard path, no accessible name on the list. A keyboard or
  // screen-reader user cannot rank at all, on the product's headline method.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:57-65
  //      (onSortEnd/arrayMove — the only reorder path)
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:135-149
  //      (SortableList/SortableItem: bare list items, no controls)
  // Intended behaviour (the contract this spec DEFINES, plan §4.2 WCAG seed):
  // every option row exposes accessible move-up / move-down controls (drag
  // may exist in addition). Wording is new design — the regexes pin the
  // concept; final RO/EN copy goes to docs/CHARACTERIZATION.md at activation.
  const first = items.nth(0);
  await expect(first.getByRole('button', { name: /jos|down/i })).toBeVisible();
  await expect(items.nth(1).getByRole('button', { name: /sus|up/i })).toBeVisible();

  // Moving the first option down swaps exactly the first two rows — the
  // keyboard-operable equivalent of legacy's arrayMove(items, 0, 1).
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:57-65
  const before = await items.allTextContents();
  await first.getByRole('button', { name: /jos|down/i }).click();
  const after = await items.allTextContents();
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);
  expect(after.slice(2)).toEqual(before.slice(2));
});

// ---------------------------------------------------------------------------
// 8. Submitting casts the FULL ordering and confirms it back.
// ---------------------------------------------------------------------------
test.fixme('J7: submitting the ranking casts the complete ordering and confirms it back as a list', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.hierarchy.slug));

  const ranking = page.getByRole('list', { name: RANKING_LIST });
  const optionCount = await ranking.getByRole('listitem').count();

  // What a VALID ballot is, read from the client: the submitted value is the
  // CSV of the on-screen items — ALWAYS every option, each exactly once, in
  // the chosen order. Partial rankings and ties are impossible to express:
  // the UI has no omit/tie affordance, only reordering of the full set.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:32-49
  //      (handleVote posts items.toString() — the full array, comma-joined)
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:23,28
  //      (items is exactly the option set)
  // legacy-bug (unvalidated ranking): that completeness is CLIENT-side only —
  // the API accepts any string (a partial list, duplicates, unknown options)
  // and the tally will ingest it, skewing countByPosition. Intended
  // behaviour: the server validates the ballot as a permutation of the
  // option set (the new schema's typed vote replaces the free string).
  // src: legacy/lib/api-v2/topics/index.js:232-239 (type-only validation)
  // src: legacy/lib/models/vote.js:5-10 (free-string value)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:48-50 (blind CSV split)
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // Voted state: acknowledgement plus the user's own ordering echoed back as
  // an ordered list (one entry per option), with change-vote offered.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:104-113
  //      (VotedBox + ChangeVote once voted)
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:151-171
  //      (thanks + "Your answer was:" + <ol> of votes.split(','))
  // src: legacy/lib/translations/lib/en.json:454,457-458
  await expect(page.getByText(THANKS)).toBeVisible();
  await expect(page.getByText(YOUR_ANSWER).first()).toBeVisible();
  const echoed = page.getByRole('list', { name: YOUR_ANSWER });
  await expect(echoed).toBeVisible();
  expect(await echoed.getByRole('listitem').count()).toBe(optionCount);
  await expect(page.getByRole('button', { name: CHANGE_VOTE })).toBeVisible();

  // The user's own vote comes back from the API as `voted` — own vote only,
  // never anyone else's (same scope J5 characterized).
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83
});

// ---------------------------------------------------------------------------
// 9. Re-ranking replaces the previous ranking.
// ---------------------------------------------------------------------------
test.fixme('J7: re-ranking replaces the previous ranking instead of duplicating it', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.hierarchy.slug));

  const ranking = page.getByRole('list', { name: RANKING_LIST });
  const items = ranking.getByRole('listitem');

  // First ballot: the presented order, unchanged.
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();
  await expect(page.getByText(THANKS)).toBeVisible();

  // Change vote re-opens the ranking (now in the user's own voted order, not
  // reshuffled).
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:51-55,74
  //      (changingVote forces the vote box open again)
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:28
  //      (voted → items keep the stored order)
  await page.getByRole('button', { name: CHANGE_VOTE }).click();
  const before = await items.allTextContents();
  await items
    .nth(0)
    .getByRole('button', { name: /jos|down/i })
    .click();
  await page.getByRole('button', { name: SUBMIT_VOTE }).click();

  // Replace, not duplicate — same doVote path as the slider test above and
  // as J5: the prior Vote document is removed before the new CSV saves; one
  // (topic, author) ballot at all times.
  // src: legacy/lib/api-v2/db-api/topics/index.js:313-332
  // src: legacy/lib/models/vote.js:16-17 (unique index { topic, author })
  const echoed = page.getByRole('list', { name: YOUR_ANSWER });
  await expect(echoed).toBeVisible();
  const echoedItems = await echoed.getByRole('listitem').allTextContents();
  // The echoed first choice is the option that was moved into first place
  // (text comparison is prefix-based because the ranking rows also contain
  // the move-control labels while the echoed rows do not).
  expect(echoedItems[0]).toBe(before[1].replace(/\s*(mută.*|move.*)$/i, '').trim());
});

// ---------------------------------------------------------------------------
// 10. Closed hierarchy: the aggregate is a consensus RANKING (per-position
//     winners), and a voter can toggle to their own answer.
// ---------------------------------------------------------------------------
test.fixme('J7: a closed hierarchy topic shows the aggregated consensus ranking and a voter can toggle their own answer', async ({
  page,
  forum,
  users,
}) => {
  // TODO-AMBIGUOUS: placeholder fixture (see header) — a closed hierarchy
  // topic seeded with recorded ballots INCLUDING one by elena-voter, so both
  // the aggregate list and the own-answer toggle render.
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, CLOSED_HIERARCHY_SLUG));

  // Closed → results heading replaces the instruction heading; no reordering
  // controls, no submit.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:73-75,86-89
  // src: legacy/lib/translations/lib/en.json:317 ("Results")
  // src: legacy/lib/models/topic.js:184-190,210-212
  await expect(page.getByRole('heading', { name: RESULTS_REGION })).toBeVisible();
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();

  // HOW THE TALLY AGGREGATES, read from the code (cite-or-die, this is the
  // headline algorithm): the server splits every ballot CSV by position and
  // counts, per position, how many voters placed each option there
  // (countByPosition). It then accumulates counts down the positions —
  // an option's score at position P is its total appearances at positions
  // 1..P (getOptionsWithVotes). The published result is an ordered list:
  // position 1 goes to the option with the highest cumulative score at level
  // 1; a tie is broken by looking one level deeper; each winner is excluded
  // from later positions. Rows are {value, position} — there is no
  // percentage in a hierarchy result.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:44-69 (hierarchy branch)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:102-128 (countByPosition)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:139-150 (cumulative sums)
  // src: legacy/lib/api-v2/db-api/topics/utils.js:163-193 (winner per level,
  //      tie recursion, winner exclusion)
  // Rendered as an ordered list of option names in consensus order.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:238-247
  const aggregate = page.getByRole('list', { name: RESULTS_REGION });
  await expect(aggregate).toBeVisible();
  expect(await aggregate.getByRole('listitem').count()).toBeGreaterThan(1);

  // A voter may toggle between the aggregate and their own recorded answer.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:214-237
  //      (showAnswer toggle: "Show my answer" ↔ "Show results")
  // src: legacy/lib/translations/lib/en.json:318-319
  await page.getByRole('button', { name: SHOW_MY_ANSWER }).click();
  await expect(page.getByText(YOUR_ANSWER).first()).toBeVisible();
  await expect(page.getByRole('button', { name: SHOW_RESULTS })).toBeVisible();

  // legacy-bug (phantom percentage): the results view prints
  // `vote.porcentage` — a misspelled field that NO code path ever sets (the
  // hierarchy tally emits {value, position} only), so the span is always
  // empty. Intended behaviour: no per-row percentage in a ranking result —
  // the field and the span are dead and must not be "ported".
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:243
  // src: legacy/lib/api-v2/db-api/topics/utils.js:62-66
  //
  // legacy-bug (broken tie-break): getMaxValues receives the tied options as
  // `fieldsTofind`, but tests `!fieldsTofind.lenght` — a typo ('lenght'), so
  // the guard is always true and the deeper level re-considers ALL remaining
  // options instead of only the tied ones. A tie can thus be "broken" by an
  // option that was not tied. Intended behaviour: the deeper-level
  // comparison is restricted to the tied options.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:163-165
  //
  // legacy-bug (crash on a full tie): a tie at the LAST level recurses with
  // level = optionsWithMaxVotes[index + 1] = undefined, and Object.keys of
  // undefined throws — so a perfectly tied electorate makes calcResult
  // reject and the vote POST fail server-side. Intended behaviour: a
  // deterministic, documented final tie-break (never an error).
  // src: legacy/lib/api-v2/db-api/topics/utils.js:186-188 (recursion into
  //      the out-of-bounds level), 165 (Object.keys on the undefined level)
  //
  // legacy-bug (shape mutation): the first hierarchy vote OVERWRITES the
  // seeded {value, percentage, votes} rows with {value, position} ranking
  // rows (plus a misspelled `matriz` matrix that is discarded on save) —
  // action.results is a polymorphic bag whose shape depends on vote history.
  // Intended behaviour: the new schema separates the immutable option set
  // from the computed tally.
  // src: legacy/lib/api-v2/db-api/topics/utils.js:62-69
  // src: legacy/lib/api-v2/db-api/topics/index.js:333-338
});

// ===========================================================================
// BOTH METHODS — the two decision-log behaviours, exactly as J5 pinned them.
// ===========================================================================

// ---------------------------------------------------------------------------
// 11. NEW (decision G-10): a stage-1 participant may not vote — either method.
// ---------------------------------------------------------------------------
test.fixme('J7: a stage-1 participant cannot cast a slider or hierarchy vote', async ({
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
  // BOTH method components render the same locked-out overlay in place of
  // their controls.
  // src: legacy/lib/api-v2/middlewares/topics.js:7-20 (403 LACK_PRIVILEGES)
  // src: legacy/lib/privileges/topic.js:40-44 (canVote)
  // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:90,141-145
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:76,126-129
  // src: legacy/lib/site/topic-layout/topic-article/cant-comment/component.js:4-13
  //
  // Fixture taxonomy: `participant` (ana, stage1-email) is the negative case;
  // `voter` (elena, stage2-phone) is the eligible account used above.
  // src: e2e/fixtures/users.ts (FixtureVerificationStage; the two accounts)
  // TODO-AMBIGUOUS (same as J5): the refusal copy is new design; assertions
  // pin semantics only — no castable control, a notice naming verification.
  await signIn(page, users.participant);

  await page.goto(topicPath(forum.slug, topics.slider.slug));
  await expect(page.getByRole('slider')).not.toBeVisible();
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();
  await expect(page.getByText(VERIFICATION_NOTICE)).toBeVisible();

  await page.goto(topicPath(forum.slug, topics.hierarchy.slug));
  // No reordering affordance and no submit — a read-only option list may
  // remain visible, but nothing castable.
  await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();
  await expect(page.getByText(VERIFICATION_NOTICE)).toBeVisible();
  // src: legacy/lib/api-v2/middlewares/topics.js:7-20 (the refusal happens
  //      before api.topics.vote runs — no tally side-effect, as in J5)
});

// ---------------------------------------------------------------------------
// 12. NEW (decision G-7): aggregate-only public results + consultative label.
// ---------------------------------------------------------------------------
test.fixme('J7: slider and hierarchy results are aggregate-only and carry the consultative label', async ({
  page,
  forum,
  users,
}) => {
  // Signed-out visitor on both closed placeholder topics (see header
  // TODO-AMBIGUOUS on the fixtures).
  //
  // Aggregates are public; the only per-user datum the API ever exposes is
  // the requester's OWN `voted`. Individual ballots are never listed —
  // especially material for hierarchy, where a full ranking is close to a
  // fingerprint of the voter (G-7: pseudonymize the vote payload from
  // identity where the method allows).
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:8-47 (public scope:
  //      action.results / action.count only)
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83 (voted = own only)
  // src: decision G-7 (grill ledger) — docs/plans/2026-08-18-democracyos-grill-decisions.md:313
  // TODO-AMBIGUOUS (same as J5): the RO phrasing of the consultative label is
  // not yet decided; the regex pins the required concept, not final copy.
  for (const slug of [CLOSED_SLIDER_SLUG, CLOSED_HIERARCHY_SLUG]) {
    await page.goto(topicPath(forum.slug, slug));

    await expect(page.getByText(CONSULTATIVE)).toBeVisible();

    // No voter identity in or around the results — the fixture voter's
    // handle must appear nowhere on the public result page.
    await expect(page.getByText(users.voter.handle)).not.toBeVisible();

    // A signed-out visitor gets results, never a castable control.
    // src: legacy/lib/site/topic-layout/topic-article/slider/component.js:87-88
    // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:73-74
    //      (both require a session for the vote box; closed shows results)
    await expect(page.getByRole('button', { name: SUBMIT_VOTE })).not.toBeVisible();
  }

  // The hierarchy own-answer toggle is a SESSION datum, not public: it
  // renders only when `voted` (the requester's own ballot) is present, so a
  // signed-out visitor must not see it.
  // src: legacy/lib/site/topic-layout/topic-article/hierarchy/component.js:230-237
  //      (the toggle renders only when `voted` is truthy)
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:75-83
  await expect(page.getByRole('button', { name: SHOW_MY_ANSWER })).not.toBeVisible();
});
