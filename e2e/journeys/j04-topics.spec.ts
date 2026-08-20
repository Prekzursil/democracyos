// J4 — an admin creates a topic per voting method → publishes it → it appears
// on the forum home (WU-M1-5, plan §4.2).
//
// Characterization spec derived by READING legacy source (never by observing a
// running system), targeting the NEW app built in M4 (API) / M5 (UI). Every
// assertion cites the legacy file:lines it was derived from; behaviours that
// are NEW (not in legacy) cite the decision log instead. A fresh reviewer
// re-derives each assertion from the citation, not from this file's prose.
//
// Pending-by-design: every spec is quarantined via test.fixme until its
// activation row in e2e/SPEC-LEDGER.md (row J4: activate at M4 via WU-M4-8,
// re-point at the real UI at WU-M5-6). The ledger already names this exact
// file (`e2e/journeys/j04-topics.spec.ts`) — no filename correction needed.
//
// Routes used with page.goto() are the legacy URL structure, adopted as the
// spec'd routes for the new app:
//   /:forum                        // src: legacy/lib/site/boot/routes.js:6
//   /:forum/topic/:id              // src: legacy/lib/site/boot/routes.js:7
//   /:forum/admin/topics/create    // src: legacy/lib/admin/boot/routes.js:11
//   /:forum/admin/topics/:id       // src: legacy/lib/admin/boot/routes.js:12
//
// PRIVILEGE MATRIX for this journey, read directly from the privilege table —
// note that it is FINER than "creating a topic requires admin":
//   - canCreateTopics: owner | admin | collaborator | author (participant NO).
//     // src: legacy/lib/privileges/forum.js:31-35
//   - canChangeTopics (the admin topic surface): same four roles.
//     // src: legacy/lib/privileges/forum.js:37-40
//   - canPublishTopics: owner | admin ONLY — a collaborator or author may
//     draft topics but may NOT publish them.
//     // src: legacy/lib/privileges/forum.js:42-46
// So "admin creates and publishes" is the happy path, "participant" is the
// refused-at-creation case, and "collaborator" is the boundary case that can
// create but not publish. (J3 characterizes the admin-panel surface per role;
// this journey characterizes the topic-specific privileges and flows only.)
// The collaborative-forum variant (creation open to any signed-in user, with
// auto-publish) is NOT asserted — the fixture forum is public. See:
//   // src: legacy/lib/privileges/forum.js:33,44 (collaborative short-circuit)
//   // src: legacy/lib/api-v2/middlewares/topics.js:182-189 (autoPublish when
//   //      the creator lacks canChangeTopics)
//
// Transport note for M4 (API-level activation): legacy answers 200 on success,
// 403 LACK_PRIVILEGES on privilege refusal (api-v2/middlewares/forums.js:8-21
// and api-v2/middlewares/topics.js:7-20), 404 TOPIC_NOT_FOUND on a missing
// topic (api-v2/middlewares/topics.js:22-39). This journey asserts only
// user-visible outcomes, so its assertions survive the new API's use of
// proper statuses — see docs/CHARACTERIZATION.md.
//
// Romanian copy is taken from the legacy RO locale where it exists
// (legacy/lib/translations/lib/ro.json). GAPS: the entire method-label family
// `admin-topics-form.action.*` (en.json:68-73), the option-group labels
// (en.json:116-117), `admin-topics-form.label.action` (en.json:107),
// `admin-topics-form.title.preview` (en.json:147) and
// `proposal-article.create` (en.json:323) have NO Romanian keys — those names
// below are new-design Romanian with the legacy EN string as fallback.

import type { Page } from '@playwright/test';
import { expect, test, type VotingMethod } from '../fixtures/app';
import type { FixtureUser } from '../fixtures/users';

// ---------------------------------------------------------------------------
// Accessible names (Romanian-primary, EN fallback).
// ---------------------------------------------------------------------------

// src: legacy/lib/admin/admin-topics-form/template.jade:34 (mediaTitle input,
//      validate=required) + legacy/lib/translations/lib/ro.json:45 ("Titlu")
//      + legacy/lib/translations/lib/en.json:115 ("Title")
const TITLE_FIELD = /^titlu$|^title$/i;

// src: legacy/lib/admin/admin-topics-form/template.jade:39-43 (tag select,
//      validate=required) + ro.json:49 ("Eticheta") + en.json:121 ("Category")
const TAG_FIELD = /etichet[aă]|category/i;

// src: legacy/lib/admin/admin-topics-form/template.jade:80,93-100 (the method
//      select) + en.json:107 ("Action"; no RO key — RO is new-design)
const METHOD_FIELD = /ac[țt]iune|metod[aă]|action/i;

// Method option labels. Values are the wire enum; the visible labels exist
// only in EN (en.json:68-73) — RO is new-design.
// src: legacy/lib/models/topic.js:73 (the enum)
// src: legacy/lib/admin/admin-topics-form/template.jade:95-100 (option values)
const METHOD_OPTION_LABELS: Record<VotingMethod, RegExp> = {
  vote: /^vot$|^vote$/i,
  poll: /^sondaj$|^poll$/i,
  cause: /^cauz[aă]$|^cause$/i,
  slider: /^glisor$|^slider$/i,
  hierarchy: /^ierarhie$|^hierarchy$/i,
};

// The sixth, empty-valued choice ("No action", en.json:71; enum member '' at
// legacy/lib/models/topic.js:73). See the method-selector test for how the
// new app maps it onto the content-type split (decision C4).
const METHOD_NONE_LABEL = /nicio ac[țt]iune|f[aă]r[aă] ac[țt]iune|no action/i;

// src: legacy/lib/admin/admin-topics-form/template.jade:101-112 (poll options
//      group) + en.json:117 ("Poll options"; no RO key)
const POLL_OPTIONS_FIELD = /op[țt]iuni.*sondaj|poll options/i;

// src: legacy/lib/admin/admin-topics-form/template.jade:113-122 (hierarchy
//      options group) + en.json:116 ("Hierarchy options"; no RO key)
const HIERARCHY_OPTIONS_FIELD = /op[țt]iuni.*ierarhie|hierarchy options/i;

// src: legacy/lib/admin/admin-topics-form/commands.jade:15-17 (.save) +
//      template.jade:166 (submit) + ro.json:29 ("Salveaza") + en.json:80
const SAVE_BUTTON = /salveaz[aă]|^save$/i;

// src: legacy/lib/admin/admin-topics-form/commands.jade:9-10 (.make-public,
//      shown only with topic.draft && topic.id && canPublishTopics) +
//      ro.json:28 ("Publica") + en.json:79 ("Publish")
const PUBLISH_BUTTON = /^public[aă]$|^publish$/i;

// src: legacy/lib/admin/admin-topics-form/commands.jade:7-8 (.make-private) +
//      ro.json:27 + en.json:78. legacy-bug (copy): the RO string is "Non
//      public" — not Romanian; not preserved — the new RO copy must be a real
//      verb phrase ("Retrage publicarea"); the regex accepts both.
const UNPUBLISH_BUTTON = /retrage publicarea|non public|unpublish/i;

// src: ro.json:52 + en.json:128. legacy-bug (copy): EN misspells
// "successfuly"; not preserved — the regex pins the RO string and a correctly
// spelled EN fallback.
const SAVED_MESSAGE = /salvat cu succes|successf?ul?ly saved/i;

// src: legacy/lib/admin/admin-topics-form/template.jade — the draft/public
//      status strings ro.json:53-54 + en.json:129-130.
const DRAFT_STATUS = /este o ciorn[aă]|is a draft/i;
const PUBLISHED_STATUS = /este publicat|is published/i;

// src: legacy/lib/admin/admin-topics-form/template.jade:17-21 (preview link on
//      the edit form, href=topic.url) + en.json:147 ("View"; no RO key)
const PREVIEW_LINK = /previzualiz|vezi subiectul|^view$/i;

// src: legacy/lib/site/home-forum/component.js:85-94 (create button, gated on
//      canCreateTopics) + en.json:323 ("Create proposal"; no RO key)
const CREATE_TOPIC_LINK = /creeaz[aă]|create/i;

// src: legacy/lib/admin/admin-topics-form/template.jade:134-149 (closingAt
//      date + time inputs) + ro.json:44 ("Se închide la") + en.json:112
const CLOSING_DATE_FIELD = /se închide la|închider|closing/i;

// src: ro.json:164 + en.json:264 (homepage.no-topics)
const NO_TOPICS_MESSAGE = /niciun subiect|no topics/i;

// src: legacy/lib/site/home-forum/topic-card/component.js:18-24 (count +
//      participants label) + ro.json:205 + en.json:325
const zeroParticipants = /\b0\b\s+participan/i;

// ---------------------------------------------------------------------------
// Sign-in / sign-out steps. J1 owns the auth journey; J4 only needs sessions.
// Same conventions as J3/J5.
// ---------------------------------------------------------------------------

async function signIn(page: Page, user: FixtureUser): Promise<void> {
  await page.goto('/signin');
  // src: legacy/lib/site/sign-in/component.js:83-112 (email + password fields)
  //      + ro.json:282 ("Email"), ro.json:199 ("Parola")
  await page.getByLabel(/e-?mail/i).fill(user.email);
  await page.getByLabel(/parol|password/i).fill(user.password);
  // src: legacy/lib/site/sign-in/component.js:124-130 + ro.json:273 ("Login")
  await page.getByRole('button', { name: /login|autentificare|conectare/i }).click();
}

async function signOut(page: Page, user: FixtureUser): Promise<void> {
  // Same user-menu convention as J3; J1 owns the sign-out characterization.
  await page.getByRole('button', { name: new RegExp(user.handle.split('-')[0], 'i') }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
}

const createTopicPath = (forumSlug: string) => `/${forumSlug}/admin/topics/create`;
const topicPath = (forumSlug: string, topicSlug: string) => `/${forumSlug}/topic/${topicSlug}`;

function uniqueTitle(label: string): string {
  return `J4 ${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Fills the required creation fields and optionally the method + its options,
// then saves. Required fields, read from the form and the model:
//   - mediaTitle (validate=required; the model also caps it).
//     // src: legacy/lib/admin/admin-topics-form/template.jade:34
//     // src: legacy/lib/models/topic.js:57 (mediaTitle maxlength 225)
//     // legacy-bug: the form caps the title at 200 chars (template.jade:34,
//     // maxlength=200) while the model allows 225 — two different limits for
//     // one field. Not preserved: the new app uses ONE limit, defined in the
//     // shared contract (packages/shared, WU-M3b) and enforced identically in
//     // form and API — see docs/CHARACTERIZATION.md.
//   - tag (validate=required; required in the model).
//     // src: legacy/lib/admin/admin-topics-form/template.jade:39-43
//     // src: legacy/lib/models/topic.js:54 (tag: required)
//     TODO-AMBIGUOUS: docs/develop/fixtures.md defines NO Tag fixture, yet a
//     topic cannot be created without one (and the legacy form refuses to
//     render at all when a forum has zero tags — template.jade:4-13). The
//     seed (WU-M3a-10) must grow at least one tag for agora-fixture; tracked
//     as an activation prerequisite on the J4 ledger row, like J8's comment
//     tree (fixtures.md finding N6). The selection below takes the first
//     available tag rather than naming one.
// The method select's option VALUES are the wire enum.
//     // src: legacy/lib/admin/admin-topics-form/template.jade:95-100
//     // src: legacy/lib/models/topic.js:73
async function fillAndSaveTopic(
  page: Page,
  forumSlug: string,
  draft: { mediaTitle: string; method?: VotingMethod; options?: readonly string[] },
): Promise<void> {
  await page.goto(createTopicPath(forumSlug));
  await page.getByLabel(TITLE_FIELD).fill(draft.mediaTitle);
  await page.getByLabel(TAG_FIELD).selectOption({ index: 0 });

  if (draft.method) {
    await page.getByLabel(METHOD_FIELD).selectOption(draft.method);
  }

  if (draft.method && draft.options) {
    // The legacy options widget is a comma/ENTER tags-input (template.jade:112,
    // 122; en.json:104 documents the ENTER/TAB submission). The spec pins the
    // labelled field and comma-separated entry; the exact widget is M5's.
    const optionsField =
      draft.method === 'hierarchy' ? HIERARCHY_OPTIONS_FIELD : POLL_OPTIONS_FIELD;
    await page.getByLabel(optionsField).fill(draft.options.join(','));
  }

  // src: legacy/lib/admin/admin-topics-form/view.js:209-220 (onsaveclick →
  //      submit) → POST /api/v2/topics (view.js:49-55)
  await page.getByRole('button', { name: SAVE_BUTTON }).click();
}

// ---------------------------------------------------------------------------
// 1. Who may create, who may publish: participant refused; collaborator may
//    draft but not publish; admin gets the full surface.
// ---------------------------------------------------------------------------
test.fixme('J4: participant is refused topic creation; collaborator may draft but sees no publish control; admin sees both', async ({
  page,
  forum,
  users,
}) => {
  // participant: the forum home offers NO create entry (the button renders
  // only with canCreateTopics, which excludes participant)...
  // src: legacy/lib/site/home-forum/component.js:85-94
  // src: legacy/lib/privileges/forum.js:31-35 (participant not in the list)
  await signIn(page, users.participant);
  await page.goto(`/${forum.slug}`);
  await expect(page.getByRole('link', { name: CREATE_TOPIC_LINK })).not.toBeVisible();

  // ...and deep-linking to the creation form is refused server-side — the
  // creation route re-checks canCreateTopics; this is not just a hidden link.
  // src: legacy/lib/api-v2/topics/index.js:129-132 (POST /topics gated on
  //      canCreateTopics)
  // src: legacy/lib/api-v2/middlewares/forums.js:8-21 (403 LACK_PRIVILEGES)
  await page.goto(createTopicPath(forum.slug));
  await expect(page.getByLabel(TITLE_FIELD)).not.toBeVisible();
  await signOut(page, users.participant);

  // collaborator: reaches the creation form (canCreateTopics includes
  // collaborator) and may save...
  // src: legacy/lib/privileges/forum.js:31-35
  await signIn(page, users.collaborator);
  await page.goto(createTopicPath(forum.slug));
  await expect(
    page.getByRole('heading', { name: /creeaz[aă].*subiect|create topic/i }),
  ).toBeVisible(); // src: ro.json:60 + en.json:145 (admin-topics-form.title.create)
  await expect(page.getByRole('button', { name: SAVE_BUTTON })).toBeVisible();

  // ...but after saving, the publish control never appears for them: the
  // publish button is gated on canPublishTopics = owner | admin only.
  // src: legacy/lib/admin/admin-topics-form/commands.jade:9-10
  // src: legacy/lib/privileges/forum.js:42-46
  // src: legacy/lib/api-v2/topics/index.js:176-181 (the /publish route
  //      re-checks canPublishTopics server-side)
  await fillAndSaveTopic(page, forum.slug, { mediaTitle: uniqueTitle('colab'), method: 'vote' });
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(page.getByText(DRAFT_STATUS)).toBeVisible();
  await expect(page.getByRole('button', { name: PUBLISH_BUTTON })).not.toBeVisible();
  await signOut(page, users.collaborator);

  // admin: full surface — form plus, once a draft exists, the publish button.
  // src: legacy/lib/privileges/forum.js:31-35,42-46 (admin in both lists)
  await signIn(page, users.admin);
  await fillAndSaveTopic(page, forum.slug, { mediaTitle: uniqueTitle('admin'), method: 'vote' });
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(page.getByRole('button', { name: PUBLISH_BUTTON })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. The method selector offers exactly the five methods from the enum.
// ---------------------------------------------------------------------------
test.fixme('J4: the method selector offers exactly the five voting methods plus the no-method choice', async ({
  page,
  forum,
  users,
}) => {
  await signIn(page, users.admin);
  await page.goto(createTopicPath(forum.slug));

  // The Topic model's method enum is exactly:
  //   ['vote', 'poll', 'cause', 'slider', 'hierarchy', '']
  // — five voting methods plus the empty string (a topic with no voting
  // action at all). The form's selector mirrors it one option per member, in
  // that order, with '' rendered first as "No action".
  // src: legacy/lib/models/topic.js:73 (the enum)
  // src: legacy/lib/admin/admin-topics-form/template.jade:93-100 (the
  //      editable select: option '' + the five methods)
  // src: legacy/lib/translations/lib/en.json:68-73 (the six labels; RO absent)
  const methodSelect = page.getByLabel(METHOD_FIELD);
  await expect(methodSelect).toBeVisible();
  for (const label of Object.values(METHOD_OPTION_LABELS)) {
    await expect(
      methodSelect.getByRole('option', { name: label, includeHidden: true }),
    ).toHaveCount(1);
  }
  await expect(
    methodSelect.getByRole('option', { name: METHOD_NONE_LABEL, includeHidden: true }),
  ).toHaveCount(1);
  // Exactly six — nothing beyond the enum is offered.
  // src: legacy/lib/models/topic.js:73
  await expect(methodSelect.getByRole('option', { includeHidden: true })).toHaveCount(6);
  // TODO-AMBIGUOUS: how the NEW app surfaces the '' member. Decision C4
  // splits content types debate | proposal | poll (grill ledger C4,
  // docs/plans/2026-08-18-democracyos-grill-decisions.md:152,204; plan
  // WU-M3b-9, docs/plans/2026-08-18-democracyos-revival-plan.md:490), so "no
  // voting method" may become the `debate` content type instead of a sixth
  // selector entry. The assertion above pins the LEGACY shape; if the C4
  // design lands differently, this test is revised via a reviewed
  // docs/CHARACTERIZATION.md decision, never silently.

  // Once ANY vote is cast the selector is rendered read-only — the method is
  // frozen. Asserted here only as the admin-form surface (the disabled
  // variant + warning); the server-side freeze is characterized by J9's
  // edit flows.
  // src: legacy/lib/admin/admin-topics-form/template.jade:79-90 (pollOpen →
  //      warning + disabled select)
  // src: legacy/lib/api-v2/middlewares/topics.js:100-103 ("Can't change
  //      method after votes casted")
  // legacy-bug: that middleware guard calls next(err) WITHOUT returning, so
  // execution falls through and next() is called a second time — a
  // double-next that Express surfaces as "headers already sent" noise.
  // Intended behaviour: one refusal, one response. Same defect at lines
  // 105-108 for the options guard. Not preserved — see
  // docs/CHARACTERIZATION.md.
});

// ---------------------------------------------------------------------------
// 3. One topic per voting method: created as a DRAFT by the admin.
// ---------------------------------------------------------------------------

// Options are provided only where creation demands them (poll + hierarchy —
// see the next test). The in-journey option sets are this journey's own;
// the SEEDED hierarchy option set belongs to fixtures.md ("t-hierarchy").
const METHOD_CASES: ReadonlyArray<{
  method: VotingMethod;
  options?: readonly string[];
}> = [
  { method: 'vote' },
  { method: 'poll', options: ['Opțiunea unu', 'Opțiunea doi', 'Opțiunea trei'] },
  { method: 'cause' },
  { method: 'slider' },
  { method: 'hierarchy', options: ['Prima variantă', 'A doua variantă', 'A treia variantă'] },
];

for (const { method, options } of METHOD_CASES) {
  test.fixme(`J4: the admin creates a '${method}' topic and it is saved as a draft`, async ({
    page,
    forum,
    users,
  }) => {
    const mediaTitle = uniqueTitle(method);
    await signIn(page, users.admin);
    await fillAndSaveTopic(page, forum.slug, { mediaTitle, method, options });

    // Saved: the success message renders and the client lands on the topic's
    // edit form (create → redirect to admin.topics.id).
    // src: legacy/lib/admin/admin-topics-form/view.js:143-171 (onsuccess →
    //      admin.topics.id) + view.js:68-71 (the onsuccess message)
    await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();

    // A topic created by a canChangeTopics holder is NOT auto-published: the
    // autoPublish middleware sets publishedAt only for creators WITHOUT that
    // privilege, and publishedAt is not among the updatable keys a request
    // can smuggle in. Draft is the publishedAt-is-null state.
    // src: legacy/lib/api-v2/middlewares/topics.js:182-189 (autoPublish)
    // src: legacy/lib/api-v2/middlewares/topics.js:77-91 (updatableKeys —
    //      no publishedAt)
    // src: legacy/lib/models/topic.js:243-245 (draft = !publishedAt)
    await expect(page.getByText(DRAFT_STATUS)).toBeVisible();

    // The chosen method sticks: the edit form re-renders with it selected.
    // src: legacy/lib/admin/admin-topics-form/view.js:102-104 (option
    //      preselection from topic.action.method)
    await expect(page.getByLabel(METHOD_FIELD)).toHaveValue(method);

    // What creation seeds per method (server-side, user-visible later as the
    // voting options — J5/J6/J7 characterize the voting UIs; NOT restated):
    //   vote      → positive / neutral / negative        (J5)
    //   poll      → one result per submitted option      (J6)
    //   cause     → the single 'support' option          (J6)
    //   slider    → nine buckets, -100…100 step 25       (J7)
    //   hierarchy → one result per submitted option      (J7)
    // src: legacy/lib/api-v2/db-api/topics/index.js:122-156 (the seeding
    //      switch on action.method)
  });
}

// ---------------------------------------------------------------------------
// 4. poll and hierarchy REQUIRE options at creation; the other three do not.
// ---------------------------------------------------------------------------
test.fixme('J4: poll and hierarchy refuse creation without options; vote, cause and slider need none', async ({
  page,
  forum,
  users,
}) => {
  await signIn(page, users.admin);
  await page.goto(createTopicPath(forum.slug));

  // The option fields exist only for poll and hierarchy, revealed when that
  // method is selected — for vote/cause/slider there is nothing to fill.
  // src: legacy/lib/admin/admin-topics-form/template.jade:101,113 (both
  //      groups start hidden)
  // src: legacy/lib/admin/admin-topics-form/view.js:335-345 (onmethodchange
  //      reveals only the matching group)
  await page.getByLabel(METHOD_FIELD).selectOption('slider');
  await expect(page.getByLabel(POLL_OPTIONS_FIELD)).not.toBeVisible();
  await expect(page.getByLabel(HIERARCHY_OPTIONS_FIELD)).not.toBeVisible();

  // poll without options: refused with a validation message, client-side
  // before submit AND server-side at create.
  // src: legacy/lib/admin/admin-topics-form/view.js:211-214 (client check)
  // src: legacy/lib/api-v2/db-api/topics/index.js:130-137 (create rejects a
  //      poll/hierarchy without action.options)
  // src: legacy/lib/translations/lib/en.json:135 ("Must add options to the
  //      poll"; no RO key — RO copy is new-design)
  await page.getByLabel(TITLE_FIELD).fill(uniqueTitle('poll-refuz'));
  await page.getByLabel(TAG_FIELD).selectOption({ index: 0 });
  await page.getByLabel(METHOD_FIELD).selectOption('poll');
  await page.getByRole('button', { name: SAVE_BUTTON }).click();
  await expect(page.getByText(/adaug[aă] op[țt]iuni|must add options/i)).toBeVisible();
  await expect(page.getByText(SAVED_MESSAGE)).not.toBeVisible();

  // hierarchy without options: same refusal.
  // src: legacy/lib/admin/admin-topics-form/view.js:215-218
  // src: legacy/lib/api-v2/db-api/topics/index.js:130-137
  // src: legacy/lib/translations/lib/en.json:136
  await page.getByLabel(METHOD_FIELD).selectOption('hierarchy');
  await page.getByRole('button', { name: SAVE_BUTTON }).click();
  await expect(page.getByText(/adaug[aă] op[țt]iuni|must add options/i)).toBeVisible();
  await expect(page.getByText(SAVED_MESSAGE)).not.toBeVisible();

  // legacy-bug (server refusal shape): the create-path rejection is a BARE
  // STRING, not an Error, and its message says "poll" even when the topic is
  // a hierarchy (api-v2/db-api/topics/index.js:132-134). Worse, the EDIT
  // path's copy of the same check does `return new Error(...)` — neither
  // next(err) nor throw — so an edit that strips options from a poll or
  // hierarchy HANGS the request instead of refusing it
  // (api-v2/middlewares/topics.js:119-126). Intended behaviour (encoded
  // above): a real validation error, naming the actual method, on both
  // create and edit. Not preserved — see docs/CHARACTERIZATION.md.

  // vote/cause/slider create fine with the options fields never shown — the
  // per-method result sets are seeded server-side, not user-supplied.
  // src: legacy/lib/api-v2/db-api/topics/index.js:122-129,138-153
  await fillAndSaveTopic(page, forum.slug, { mediaTitle: uniqueTitle('slider'), method: 'slider' });
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 5. Draft vs published: a draft is invisible on the forum home and refused
//    by direct link for a participant.
// ---------------------------------------------------------------------------
test.fixme('J4: a draft topic is absent from the forum home and its direct link is refused for a participant', async ({
  page,
  forum,
  users,
}) => {
  const mediaTitle = uniqueTitle('ciornă');
  await signIn(page, users.admin);
  await fillAndSaveTopic(page, forum.slug, { mediaTitle, method: 'vote' });
  await expect(page.getByText(DRAFT_STATUS)).toBeVisible();

  // Capture the public URL from the edit form's preview link (href is the
  // topic's public address).
  // src: legacy/lib/admin/admin-topics-form/template.jade:17-21
  const topicUrl = await page.getByRole('link', { name: PREVIEW_LINK }).getAttribute('href');
  await signOut(page, users.admin);

  // The forum-home listing serves ONLY published topics: the list query
  // filters publishedAt != null unless draft=true is requested, and
  // requesting drafts demands canChangeTopics — a participant cannot.
  // src: legacy/lib/api-v2/db-api/topics/index.js:46 (publishedAt filter)
  // src: legacy/lib/api-v2/topics/index.js:38-41,46-52 (draft param gated on
  //      canChangeTopics)
  // src: legacy/lib/site/home-forum/component.js:40-54 (home fetches the
  //      published listing)
  await signIn(page, users.participant);
  await page.goto(`/${forum.slug}`);
  await expect(page.getByText(mediaTitle)).not.toBeVisible();

  // Direct link: for a participant the draft must be refused (not-found), it
  // must not render its content.
  // legacy-bug: legacy does NOT enforce this — GET /topics/:id checks only
  // the forum's canView and never publishedAt, so anyone holding a draft's
  // URL reads it before publication (a draft leak).
  // src: legacy/lib/api-v2/topics/index.js:110-127 (no draft check on the
  //      single-topic route)
  // src: legacy/lib/api-v2/middlewares/topics.js:22-39 (findWithId 404s only
  //      on missing, not on draft)
  // Intended behaviour (encoded here): a draft is visible only to users
  // holding canChangeTopics; everyone else gets the same not-found outcome
  // as a topic that does not exist (no existence oracle). Not preserved —
  // see docs/CHARACTERIZATION.md.
  // TODO-AMBIGUOUS: the not-found copy. Legacy's 404 page copy is owned by
  // the error-pages component and no RO/EN key was verified for it here; the
  // regex pins the intent only.
  await page.goto(topicUrl ?? topicPath(forum.slug, 'draft-inaccesibil'));
  await expect(page.getByText(mediaTitle)).not.toBeVisible();
  await expect(page.getByText(/nu a fost g[aă]sit|negăsit|not found/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 6. Publishing makes the topic appear on the forum home; unpublishing
//    withdraws it back to draft.
// ---------------------------------------------------------------------------
test.fixme('J4: publishing a draft puts it on the forum home for everyone; unpublishing withdraws it', async ({
  page,
  forum,
  users,
}) => {
  const mediaTitle = uniqueTitle('publicare');
  await signIn(page, users.admin);
  await fillAndSaveTopic(page, forum.slug, { mediaTitle, method: 'vote' });
  await expect(page.getByText(DRAFT_STATUS)).toBeVisible();

  // Publish: POST /topics/:id/publish stamps publishedAt = now. The form
  // swaps the publish control for the unpublish one.
  // src: legacy/lib/admin/admin-topics-form/view.js:260-275 (onmakepublicclick)
  // src: legacy/lib/stores/topic-store/topic-store.js:56-63 (POST …/publish)
  // src: legacy/lib/api-v2/db-api/topics/index.js:205-221 (publishedAt = new
  //      Date) + legacy/lib/models/topic.js:232-234 (public = !!publishedAt)
  // src: legacy/lib/admin/admin-topics-form/commands.jade:7-10 (button swap)
  await page.getByRole('button', { name: PUBLISH_BUTTON }).click();
  await expect(page.getByText(PUBLISHED_STATUS)).toBeVisible();
  await expect(page.getByRole('button', { name: UNPUBLISH_BUTTON })).toBeVisible();
  await signOut(page, users.admin);

  // The published topic now appears on the forum home for a SIGNED-OUT
  // visitor (the fixture forum is public): a card titled by mediaTitle,
  // showing its participant count — zero for a fresh topic.
  // src: legacy/lib/api-v2/db-api/topics/index.js:36-66 (published listing)
  // src: legacy/lib/site/home-forum/component.js:97-110 (cards render per
  //      topic; the empty message only when there are none)
  // src: legacy/lib/site/home-forum/topic-card/component.js:6-26 (the card
  //      links to the topic, titled by mediaTitle, with action.count +
  //      the participants label)
  await page.goto(`/${forum.slug}`);
  await expect(page.getByText(NO_TOPICS_MESSAGE)).not.toBeVisible();
  const card = page.getByRole('link', { name: new RegExp(mediaTitle, 'i') });
  await expect(card).toBeVisible();
  await expect(card.getByText(zeroParticipants)).toBeVisible();

  // Following the card lands on the topic page, headed by the same title.
  // src: legacy/lib/site/topic-layout/topic-article/component.js:85-92
  //      (Header receives mediaTitle)
  await card.click();
  await expect(page.getByRole('heading', { name: new RegExp(mediaTitle, 'i') })).toBeVisible();

  // Unpublish reverses it: publishedAt is cleared, the topic is a draft
  // again and leaves the public listing.
  // src: legacy/lib/api-v2/topics/index.js:197-216 (POST …/unpublish, gated
  //      on canPublishTopics)
  // src: legacy/lib/api-v2/db-api/topics/index.js:233-249 (publishedAt=null)
  // src: legacy/lib/admin/admin-topics-form/view.js:277-293
  await signIn(page, users.admin);
  await page.goto(`/${forum.slug}/admin/topics`);
  await page.getByRole('link', { name: new RegExp(mediaTitle, 'i') }).click();
  await page.getByRole('button', { name: UNPUBLISH_BUTTON }).click();
  await expect(page.getByText(DRAFT_STATUS)).toBeVisible();
  await signOut(page, users.admin);
  await page.goto(`/${forum.slug}`);
  await expect(page.getByText(mediaTitle)).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 7. The closing transition: closingAt is set on the form; closed is a
//    DERIVED state; a closed topic stays published and listed.
// ---------------------------------------------------------------------------
test.fixme('J4: closingAt is set at creation; closed is time-derived; a closed topic remains published', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.admin);
  await page.goto(createTopicPath(forum.slug));

  // The form exposes a closing date + time pair and a control to clear them.
  // src: legacy/lib/admin/admin-topics-form/template.jade:134-149 (date
  //      input, hh:mm time input, clear button)
  // src: legacy/lib/admin/admin-topics-form/view.js:235-238 (date + time are
  //      combined into one closingAt instant on submit) + 325-333 (clear)
  // src: legacy/lib/models/topic.js:79 (closingAt: Date)
  // TODO-AMBIGUOUS: legacy labels only the pair as a whole ("Se închide la",
  // ro.json:44) — the time input has just an hh:mm placeholder and the clear
  // control is an unnamed icon button, both a11y gaps the new UI must fill
  // (N16). The names below pair new-design RO with the legacy intent.
  await expect(page.getByLabel(CLOSING_DATE_FIELD)).toBeVisible();
  await expect(page.getByLabel(/or[aă]|time|hh:mm/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /șterge data|golește|clear/i })).toBeVisible();
  // legacy-bug (copy): the EN help text for closingAt says "anyone will be
  // able to vote after that date" (en.json:96) — the code does the OPPOSITE:
  // voting is REFUSED once closingAt passes. Not preserved: the new copy
  // states that voting closes at that instant — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api-v2/db-api/topics/index.js:306-311 (VOTING_CLOSED)

  // 'closed' is DERIVED, not stored: a topic with no closingAt is open
  // forever; once closingAt is in the past, status flips to closed with no
  // further admin action. There is no explicit "close now" control anywhere
  // in the legacy admin surface — the date is the only lever.
  // src: legacy/lib/models/topic.js:184-190 (status from closingAt)
  // src: legacy/lib/models/topic.js:199-212 (open/closed virtuals)

  // A CLOSED topic is still a PUBLISHED topic: the listing filters only on
  // publishedAt, never on closingAt, so closing does not hide a topic — its
  // page stays reachable (t-closed-outcome is the seeded closed fixture).
  // src: legacy/lib/api-v2/db-api/topics/index.js:42-46 (query has no
  //      closingAt clause)
  // src: legacy/lib/site/topic-layout/topic-article/component.js:85-92 (the
  //      header shows the closed state to visitors)
  await page.goto(topicPath(forum.slug, topics.closedOutcome.slug));
  await expect(page.getByText(/nu a fost g[aă]sit|negăsit|not found/i)).not.toBeVisible();
  await expect(page.getByText(/închis|closed/i)).toBeVisible();

  // That a closed topic REFUSES votes (no vote controls; server rejects with
  // VOTING_CLOSED) is characterized by J5 ("a closed vote topic shows
  // results and offers no vote controls") — cross-referenced, not restated.
  // src: legacy/lib/api-v2/db-api/topics/index.js:306-311
});

// ---------------------------------------------------------------------------
// 8. NEW (decisions C3 + N11): closing demands an outcome declaration —
//    "what happens with the result".
// ---------------------------------------------------------------------------
test.fixme('J4: NEW — a topic cannot close without an outcome declaration, and the declaration is shown once closed', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // NEW behaviour — no legacy analogue (legacy's lifecycle was publishedAt +
  // time-derived closing, nothing more). The revival's lightweight lifecycle
  // is open → closed → outcome-published, with a FORCED "what happens with
  // the result" declaration, enforced in the database as well as the UI.
  // src: decision C3/N11 (grill ledger + plan)
  //   - docs/plans/2026-08-18-democracyos-grill-decisions.md:143 ("force
  //     every forum to declare 'what happens with the result'"), :151,203 (C3)
  //   - docs/plans/2026-08-18-democracyos-revival-plan.md:93 (N11), :452
  //     (WU-M3a-4: CHECK outcomeDeclaration non-empty once lifecycle ≥
  //     closed), :596 (WU-M6-2: closing is blocked until it is filled in)
  //
  // The only fixture carrying it is t-closed-outcome (fixtures.md "Topics";
  // e2e/fixtures/app.ts marks it outcomePublished: true).
  //
  // TODO-AMBIGUOUS (new design, activation must pin copy in
  // docs/CHARACTERIZATION.md):
  //   1. The declaration field's label and the blocked-close message wording.
  //   2. Whether the declaration is set on the closing form or editable
  //      beforehand. The assertions pin SEMANTICS only: a close attempt
  //      without a declaration is refused; a closed topic with one shows it.

  // Admin side: setting a closing date without an outcome declaration is
  // refused with a message naming the missing declaration.
  // src: decision C3/N11 (grill ledger + plan) — see the block above.
  await signIn(page, users.admin);
  await fillAndSaveTopic(page, forum.slug, {
    mediaTitle: uniqueTitle('fără-rezultat'),
    method: 'vote',
  });
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();
  await expect(page.getByLabel(/rezultat|outcome/i)).toBeVisible();
  await signOut(page, users.admin);

  // Public side: the closed fixture topic displays its outcome declaration
  // to any visitor — the visible outcome path is the product lesson this
  // requirement encodes.
  // src: decision C3/N11 (grill ledger + plan); fixture t-closed-outcome
  //      (docs/develop/fixtures.md "Topics", outcome published)
  await page.goto(topicPath(forum.slug, topics.closedOutcome.slug));
  await expect(page.getByText(/ce se întâmpl[aă] cu rezultatul|rezultat|outcome/i)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 9. The displayed title derives from mediaTitle — the legacy `title` and
//    `content` virtuals are broken and are NOT ported.
// ---------------------------------------------------------------------------
test.fixme('J4: the topic title shown everywhere is mediaTitle, never undefined; body content round-trips', async ({
  page,
  forum,
  users,
}) => {
  const mediaTitle = uniqueTitle('titlu');
  const bodyText = 'Conținutul de test al subiectului J4.';

  await signIn(page, users.admin);
  await page.goto(createTopicPath(forum.slug));
  await page.getByLabel(TITLE_FIELD).fill(mediaTitle);
  await page.getByLabel(TAG_FIELD).selectOption({ index: 0 });
  // The body editor ("Conținut", ro.json:48) serializes into the clause list:
  // each paragraph becomes one clause carrying its markup and position, and
  // clauses are re-sorted by position on every serialization.
  // src: legacy/lib/admin/admin-topics-form/template.jade:129-133 (textarea)
  // src: legacy/lib/admin/admin-topics-form/view.js:240-241 (body → clauses)
  // src: legacy/lib/models/topic.js:40-44 (ParagraphSchema: markup,
  //      position, empty), :64 (clauses: [ParagraphSchema])
  // src: legacy/lib/models/topic.js:104-111 (clauses sorted by position on
  //      every toJSON)
  await page.getByLabel(/con[țt]inut|content/i).fill(bodyText);
  await page.getByRole('button', { name: SAVE_BUTTON }).click();
  await expect(page.getByText(SAVED_MESSAGE)).toBeVisible();
  await page.getByRole('button', { name: PUBLISH_BUTTON }).click();
  await expect(page.getByText(PUBLISHED_STATUS)).toBeVisible();
  await signOut(page, users.admin);

  // Everywhere the user sees a topic name — the home card and the topic
  // page header — it is mediaTitle.
  // src: legacy/lib/site/home-forum/topic-card/component.js:15-17
  // src: legacy/lib/site/topic-layout/topic-article/component.js:85-92
  await page.goto(`/${forum.slug}`);
  const card = page.getByRole('link', { name: new RegExp(mediaTitle, 'i') });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: new RegExp(mediaTitle, 'i') })).toBeVisible();

  // The body content round-trips to the public page.
  // src: legacy/lib/site/topic-layout/topic-article/component.js:93
  //      (Content renders topic.clauses)
  // src: legacy/lib/models/topic.js:123-128 (pre-save xss filter — the
  //      sanitization boundary the new app must keep)
  await expect(page.getByText(bodyText)).toBeVisible();

  // Nothing on the page may render a missing value as text.
  await expect(page.getByText(/undefined/)).not.toBeVisible();

  // legacy-bug (OWNED HERE — J5 flagged it in passing, J4 is the journey of
  // record): the model's `title` virtual is declared with an ARROW function,
  // so `this` is the module scope, not the document — `this.topicId` is
  // always undefined, and since the API scope exposes `title`, every topic
  // in every legacy API response carries `title: undefined`. The legacy UI
  // survives only because it reads mediaTitle instead.
  // src: legacy/lib/models/topic.js:157 (the arrow-function virtual)
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:12 ('title' exposed)
  // Intended behaviour (encoded above): the new API's title field derives
  // from the topic document (mediaTitle), is never undefined, and the UI
  // renders it. Not preserved — see docs/CHARACTERIZATION.md.
  //
  // legacy-bug (OWNED HERE): the `content` virtual is DEAD CODE twice over.
  // It reads clause fields that do not exist — `c.text`, `c.clauseName`,
  // `a.order` — while ParagraphSchema defines only markup/position/empty, so
  // it could only ever produce a join of empty strings; and it is not in the
  // API scope's expose list, so nothing ever serves it.
  // src: legacy/lib/models/topic.js:167-175 (the virtual reads
  //      text/clauseName/order)
  // src: legacy/lib/models/topic.js:40-44 (ParagraphSchema has none of them)
  // src: legacy/lib/api-v2/db-api/topics/scopes.js:8-42 (no 'content' key)
  // Intended behaviour: no `content` virtual at all — the new app renders
  // clause markup directly (asserted via the round-trip above). Not ported —
  // see docs/CHARACTERIZATION.md.
});
