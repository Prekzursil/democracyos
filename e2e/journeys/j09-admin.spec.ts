// J9 — admin panel: topic list, tag CRUD, permissions, CSV export of topics
// and comments (WU-M1-10, plan §4.2). Semantic characterization spec: behaviour
// derived by READING legacy/lib/ (never a running system), targeting the NEW
// app built in M4 (API) / M5 (UI). Every assertion cites the legacy source (or
// the decision log, for NEW behaviour) so a fresh reviewer re-derives each one
// from the citation, not from this file's prose.
//
// Pending-by-design: every spec is quarantined via test.fixme until its
// activation row in e2e/SPEC-LEDGER.md (row J9: activate at M4 via WU-M4-15,
// re-point at the real UI at WU-M5-10). The filename matches the ledger row.
//
// Route names used with page.goto() are the legacy URL structure, adopted as
// the spec'd routes for the new app:
//   /:forum/admin                  → redirects to the Topics section
//   /:forum/admin/topics           /:forum/admin/topics/create
//   /:forum/admin/tags             /:forum/admin/tags/create
//   /:forum/admin/tags/:id         /:forum/admin/permissions
//   /:forum/admin/comments
//   /api/v2/topics.csv?forum=…     /api/v2/comments.csv?forum=…
//   // src: legacy/lib/admin/boot/routes.js:3-25 (CSV routes at :21-22)
//
// GATES, read from the source (the panel is privilege-gated, not role-named):
//  - panel entry: canChangeTopics || canCreateTopics
//    // src: legacy/lib/admin/admin/admin.js:30-57,157-160
//  - topics section: canChangeTopics; topic create/edit: canCreateTopics
//    // src: legacy/lib/admin/admin/admin.js:63,78,88
//  - tags section (list/create/edit): canEdit
//    // src: legacy/lib/admin/admin/admin.js:100,110,116
//  - permissions section: canEdit
//    // src: legacy/lib/admin/admin/admin.js:126-135
//  - both CSV exports: session + canChangeTopics
//    // src: legacy/lib/api-v2/topics/csv.js:23-27
//    // src: legacy/lib/api-v2/comments/csv.js:49-53
// The role→privilege mapping (owner/admin/collaborator/author hold
// canChangeTopics + canCreateTopics; canEdit is owner/admin only; participant
// holds none) is J3's territory — J3's per-role loop already characterizes
// the /admin and /admin/permissions gates for every fixture role. J9 does NOT
// restate that matrix; it asserts the gates of ITS OWN surfaces (topics list,
// tags, CSV) and cross-references J3 for the rest.
//   // src: legacy/lib/privileges/forum.js:21-24,31-35,37-40
//   // cross-ref: e2e/journeys/j03-forum-roles.spec.ts (adminSurfaceByRole)
//
// TAGS ARE PLATFORM-GLOBAL in legacy: the Tag model has no forum reference,
// /api/tag/all returns every tag in the database, and the admin tag list
// renders that unfiltered set. The new app must decide whether tags stay
// global or become per-forum — TODO-AMBIGUOUS (product decision, record in
// docs/CHARACTERIZATION.md at activation); the specs below assert only
// forum-agnostic tag behaviour, which holds under either reading.
//   // src: legacy/lib/models/tag.js:12-18 (no forum field)
//   // src: legacy/lib/api/tag/index.js:21-29 (all, unfiltered)
//   // src: legacy/lib/admin/admin/admin.js:100-108 (findAllTags → list)
//
// Romanian copy comes from the legacy RO catalogue where it exists (the
// admin-sidebar.topics/tags, admin-tags*, admin-topics* namespaces have RO
// keys). The admin-sidebar entries for comments/permissions/edit-forum, the
// whole admin-comments.* namespace and the CSV button copy exist ONLY in EN
// (legacy/lib/translations/lib/en.json:6,40-43,155-156; no RO counterparts in
// ro.json) — those names below are new-design Romanian with the legacy EN
// string as fallback.

import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/app.js';
import type { FixtureUser } from '../fixtures/users.js';

// ---------------------------------------------------------------------------
// Accessible names (Romanian-primary, EN fallback). Legacy renders several of
// these controls as icon-only or placeholder-only elements (search inputs,
// sort buttons, the trash delete button) — the names pinned here are how M1
// seeds WCAG 2.1 AA (N16, plan §4.2).
// ---------------------------------------------------------------------------

// Sidebar entries. The sidebar renders one link per section, each gated by a
// privilege (see GATES above).
// src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:1-14
// src: legacy/lib/translations/lib/ro.json:10 ("Subiecte")
// src: legacy/lib/translations/lib/en.json:49 ("Topics")
const TOPICS_ENTRY = /subiecte|topics/i;
// src: legacy/lib/translations/lib/ro.json:7 ("Cuvinte cheie")
// src: legacy/lib/translations/lib/en.json:46 ("Categories")
const TAGS_ENTRY = /cuvinte cheie|categorii|categories|tags/i;
// No RO key exists for the permissions sidebar entry; EN says "Privileges"
// while the page heading says "Permissions" — same regex J3 uses.
// src: legacy/lib/translations/lib/en.json:43,26
const PERMISSIONS_ENTRY = /permisiuni|privilegii|privileges|permissions/i;
// EN-only in legacy ("Comments", en.json:41); RO is new-design. "Argumente"
// is accepted because the public comments surface is named that way (J8).
const COMMENTS_ENTRY = /comentarii|argumente|comments/i;
// EN-only in legacy ("Edit forum", en.json:40); RO is new-design.
const EDIT_FORUM_ENTRY = /modific[aă] forumul|editeaz[aă] forumul|edit forum/i;
// src: legacy/lib/translations/lib/ro.json:11 ("Utilizatori activi")
// src: legacy/lib/translations/lib/en.json:50 ("Enabled users")
const WHITELIST_ENTRY = /utilizatori activi|enabled users/i;

// Topic list controls. The legacy search input is placeholder-only and the
// sort buttons are icon-only (glyphicons, no text) — all three need real
// accessible names in the new UI.
// src: legacy/lib/admin/admin-topics/template.jade:12 (search, placeholder only)
// src: legacy/lib/admin/admin-topics/template.jade:15-19 (icon-only sort)
// src: legacy/lib/translations/lib/ro.json:66-67 ("Caută un subiect de
//      discuții..." / "Sortează")
// src: legacy/lib/translations/lib/en.json:152-153
const TOPIC_SEARCH = /caut[aă] un subiect|search a topic/i;
// The per-row delete control is an icon-only trash button; its name comes
// from the delete-confirmation catalogue keys.
// src: legacy/lib/admin/admin-topics/template.jade:24-25 (icon-only button)
// src: legacy/lib/translations/lib/ro.json:38 ("Șterge")
// src: legacy/lib/translations/lib/en.json:89 ("Delete")
const DELETE_TOPIC = /șterge|delete/i;
// Delete confirmation modal (title + cancel), shown before any destroy.
// src: legacy/lib/admin/admin-topics/view.js:69-93 (confirm modal flow)
// src: legacy/lib/translations/lib/ro.json:39-41 ("Anulează" / "Șterge" /
//      "Șterge subiect")
// src: legacy/lib/translations/lib/en.json:90-92
const DELETE_TOPIC_CONFIRM_TITLE = /șterge subiect|delete topic/i;
const CANCEL = /anuleaz[aă]|cancel/i;
// Topic state labels rendered next to closingAt: past → close.past.
// src: legacy/lib/admin/admin-topics/template.jade:31-36
// src: legacy/lib/translations/lib/ro.json:64-65 ("Se închide" / "Închis")
// src: legacy/lib/translations/lib/en.json:150-151 ("Closing" / "Closed")
const TOPIC_CLOSED = /închis|closed/i;

// Tag list + form. The "Nou"/"New" add buttons are bare; the new UI must
// carry an unambiguous accessible name (both regexes accept the legacy copy).
// src: legacy/lib/admin/admin-tags/template.jade:4-6 (add-tag button)
// src: legacy/lib/translations/lib/ro.json:20 ("Nou")
// src: legacy/lib/translations/lib/en.json:59 ("New")
const ADD_TAG = /cuv[aâ]nt cheie nou|adaug[aă] cuv[aâ]nt cheie|^nou$|^new$/i;
// src: legacy/lib/admin/admin-tags-form/template.jade:6 (form heading)
// src: legacy/lib/translations/lib/ro.json:18-19 ("Creează cuvânt cheie" /
//      "Modifică cuvânt cheie")
// src: legacy/lib/translations/lib/en.json:57-58
const CREATE_TAG_HEADING = /creeaz[aă] cuv[aâ]nt cheie|create category/i;
const EDIT_TAG_HEADING = /modific[aă] cuv[aâ]nt cheie|edit category/i;
// src: legacy/lib/admin/admin-tags-form/template.jade:9-11 (name field)
// src: legacy/lib/translations/lib/ro.json:14 ("Nume")
// src: legacy/lib/translations/lib/en.json:53 ("Name")
const TAG_NAME = /^nume$|^name$/i;
// src: legacy/lib/admin/admin-tags-form/template.jade:20-22 (submit)
// src: legacy/lib/translations/lib/ro.json:12 ("Salvează")
// src: legacy/lib/translations/lib/en.json:51 ("Save")
const SAVE = /salveaz[aă]|save/i;
// src: legacy/lib/admin/admin-tags-form/view.js:43-49 (success message)
// src: legacy/lib/translations/lib/ro.json:15 ("Cuvânt cheie salvat cu succes")
// src: legacy/lib/translations/lib/en.json:54 ("Category successfully saved")
const TAG_SAVED = /cuv[aâ]nt cheie salvat cu succes|category successfully saved/i;

// CSV controls. Both live only in EN in legacy — the download key is even
// misspelled ("dowload-as-csv") — RO copy is new-design.
// src: legacy/lib/admin/admin-topics/export-update/component.js:75-83
// src: legacy/lib/admin/admin-comments/component.js:12-15
// src: legacy/lib/translations/lib/en.json:6 ("Download all as .csv")
// src: legacy/lib/translations/lib/en.json:155 ("Update topics from .csv")
const DOWNLOAD_CSV = /descarc[aă] (tot|toate) ca \.csv|download all as \.csv/i;
const UPDATE_FROM_CSV = /actualizeaz[aă] subiectele din \.csv|update topics from \.csv/i;

// ---------------------------------------------------------------------------
// Helpers. J1 owns the full auth journey; J9 only needs sessions (same
// conventions as J3/J8).
// ---------------------------------------------------------------------------
async function signIn(page: Page, user: FixtureUser): Promise<void> {
  await page.goto('/signin');
  // src: legacy/lib/site/sign-in/component.js:83-112 (email + password fields)
  await page.getByLabel(/e-?mail/i).fill(user.email);
  await page.getByLabel(/parol|password/i).fill(user.password);
  // src: legacy/lib/site/sign-in/component.js:124-130 (submit)
  await page.getByRole('button', { name: /login|autentificare|conectare/i }).click();
}

const adminPath = (forumSlug: string, section = 'topics') => `/${forumSlug}/admin/${section}`;

/** Unique tag name so list-level text queries stay unambiguous. */
function uniqueTagName(label: string): string {
  return `j9-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Creates a tag through the admin form as the CURRENT session (must hold
// canEdit — see the gate notes on the tag tests).
// src: legacy/lib/admin/admin/admin.js:110-114 (create route + form)
// src: legacy/lib/admin/admin-tags-form/view.js:6-26 (POST /api/tag/create)
async function createTag(page: Page, forumSlug: string, name: string): Promise<void> {
  await page.goto(adminPath(forumSlug, 'tags/create'));
  await page.getByLabel(TAG_NAME).fill(name);
  // An image must be picked (validate='any:image'); each radio's accessible
  // name is its image key — 'agora' exists in the fixed image dictionary.
  // src: legacy/lib/admin/admin-tags-form/template.jade:12-19
  // src: legacy/lib/tags-images/index.js:34-37 ('agora')
  await page.getByRole('radio', { name: /agora/i }).check();
  await page.getByRole('button', { name: SAVE }).click();
  await expect(page.getByText(TAG_SAVED)).toBeVisible();
}

// ---------------------------------------------------------------------------
// 1. The topics section is reachable with canChangeTopics and refused
//    otherwise. (Panel-level entry per role = J3's adminSurfaceByRole loop —
//    cross-referenced, not restated.)
// ---------------------------------------------------------------------------
test.fixme('J9: the admin topics list opens for an admin; a participant and a visitor are refused', async ({
  page,
  forum,
  users,
}) => {
  // Signed out: the whole panel sits behind user.required — the visitor is
  // sent to sign in before any admin markup renders.
  // src: legacy/lib/admin/admin/admin.js:30-57 (user.required in the chain)
  await page.goto(adminPath(forum.slug));
  await expect(page.getByRole('button', { name: /autentificare|sign ?in|login/i })).toBeVisible();
  await expect(page.getByRole('link', { name: TOPICS_ENTRY })).not.toBeVisible();

  // A participant holds neither canChangeTopics nor canCreateTopics, so the
  // panel bounces them to the forum home; deep-linking the topics section is
  // additionally gated by canChangeTopics on the section route itself.
  // src: legacy/lib/admin/admin/admin.js:157-160 (hasAccessToForumAdmin)
  // src: legacy/lib/admin/admin/admin.js:63 (privileges('canChangeTopics'))
  // src: legacy/lib/privileges/forum.js:31-40 (participant in neither list)
  await signIn(page, users.participant);
  await page.goto(adminPath(forum.slug));
  await expect(page.getByRole('searchbox', { name: TOPIC_SEARCH })).not.toBeVisible();

  // An admin lands on the topics list; /:forum/admin redirects there.
  // src: legacy/lib/admin/admin/admin.js:59-61 (redirect to admin.topics)
  await signIn(page, users.admin);
  await page.goto(`/${forum.slug}/admin`);
  await expect(page.getByRole('searchbox', { name: TOPIC_SEARCH })).toBeVisible();

  // Server-side the drafts-included listing the panel uses is equally gated:
  // GET /topics?draft=true runs canChangeTopics before answering, so the gate
  // is not just a hidden link.
  // src: legacy/lib/api-v2/topics/index.js:38-52 (draft → canChangeTopics)
  // src: legacy/lib/middlewares/topic-middlewares/topic-middlewares.js:20-42
  //      (the admin list queries draft: true, limit 100)
});

// ---------------------------------------------------------------------------
// 2. Sidebar composition per privilege — the panel shows each section only to
//    the privilege that may use it.
// ---------------------------------------------------------------------------
test.fixme('J9: the admin sidebar shows topics/tags/permissions/edit-forum/comments to an admin, but hides the canEdit sections from a collaborator', async ({
  page,
  forum,
  users,
}) => {
  // Admin (canEdit + canChangeTopics + canCreateTopics): every section.
  // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:1-12
  //      (topics ← canCreateTopics; permissions + edit-forum ← canEdit;
  //       comments ← canChangeTopics)
  // src: legacy/lib/privileges/forum.js:21-24,31-40 (admin holds all three)
  // legacy-bug: the TAGS sidebar entry is gated on user.staff (a single-forum
  // relic configured via the STAFF env list) while the tag PAGES are gated on
  // canEdit — a forum admin can deep-link /admin/tags but never sees the
  // entry. Not preserved: the new app gates entry and pages identically on
  // the panel's own privilege (canEdit); D6 (grill ledger) replaces the STAFF
  // list with DB-backed RBAC — see docs/CHARACTERIZATION.md.
  //   // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:7-8 (staff)
  //   // src: legacy/lib/admin/admin/admin.js:100-124 (pages: canEdit)
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug));
  for (const entry of [TOPICS_ENTRY, TAGS_ENTRY, PERMISSIONS_ENTRY, EDIT_FORUM_ENTRY]) {
    await expect(page.getByRole('link', { name: entry })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: COMMENTS_ENTRY })).toBeVisible();

  // The users-whitelist section is CONFIG-GATED (config.usersWhitelist,
  // default false) and its API is staff-only; under the spec'd default
  // configuration the entry must NOT exist. If the new app revives the flag,
  // a new reviewed spec must cover it (same treatment J3 gives 'moderator').
  // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:13-14
  // src: legacy/config/defaults.json:128 (usersWhitelist: false)
  // src: legacy/lib/admin/admin/admin.js:137-140 (routes only when enabled)
  // src: legacy/lib/api/whitelist/index.js:25,32-91 (config gate + staff)
  await expect(page.getByRole('link', { name: WHITELIST_ENTRY })).not.toBeVisible();

  // Collaborator: topics + comments (canChangeTopics/canCreateTopics), but no
  // permissions and no edit-forum (canEdit is owner/admin only). J3 already
  // asserts the deep-link refusal of /admin/permissions for this role.
  // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:2-6,9-10
  // src: legacy/lib/privileges/forum.js:21-24 (collaborator lacks canEdit)
  // cross-ref: e2e/journeys/j03-forum-roles.spec.ts (adminSurfaceByRole)
  await signIn(page, users.collaborator);
  await page.goto(adminPath(forum.slug));
  await expect(page.getByRole('link', { name: TOPICS_ENTRY })).toBeVisible();
  await expect(page.getByRole('link', { name: COMMENTS_ENTRY })).toBeVisible();
  await expect(page.getByRole('link', { name: PERMISSIONS_ENTRY })).not.toBeVisible();
  await expect(page.getByRole('link', { name: EDIT_FORUM_ENTRY })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. The topic list shows the fixture topics — drafts included — with state.
// ---------------------------------------------------------------------------
test.fixme('J9: the topic list shows every fixture topic with its state, searchable and sortable', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug));

  // The list is fetched with draft: true — unlike the public forum home it
  // contains unpublished topics too — and the client keeps only topics the
  // session may edit or delete.
  // src: legacy/lib/middlewares/topic-middlewares/topic-middlewares.js:20-42
  // src: legacy/lib/admin/admin-topics/view.js:26-32 (canEdit||canDelete filter)
  //
  // Every fixture topic is a row; each row links to the edit form and shows
  // the topic's title and its tag.
  // src: legacy/lib/admin/admin-topics/template.jade:22-39 (row = link with
  //      title, author, closing state, tag name)
  // TODO-AMBIGUOUS: docs/develop/fixtures.md fixes topic SLUGS but not their
  // display titles (mediaTitle). Until the contract names titles, this
  // asserts row identity by slug — the seed (WU-M3a-10) must render titles
  // that contain their slug, or the contract must grow a title column.
  for (const topic of Object.values(topics)) {
    await expect(page.getByRole('link', { name: new RegExp(topic.slug, 'i') })).toBeVisible();
  }

  // State: a topic whose closingAt is past is labelled closed; the closed
  // fixture topic must carry the label, the open ones must not.
  // src: legacy/lib/admin/admin-topics/template.jade:31-36 (close.past/future)
  // src: legacy/lib/translations/lib/ro.json:64-65
  // TODO-AMBIGUOUS: legacy renders NO state label for a topic without
  // closingAt, and no draft/published badge at all in the list (draft state
  // is only visible inside the edit form: ro.json:53-54). Whether the new
  // list adds an explicit state column is new-design — only the closed label
  // is pinned here.
  const closedRow = page.getByRole('link', { name: new RegExp(topics.closedOutcome.slug, 'i') });
  await expect(closedRow.getByText(TOPIC_CLOSED)).toBeVisible();
  const openRow = page.getByRole('link', { name: new RegExp(topics.vote.slug, 'i') });
  await expect(openRow.getByText(TOPIC_CLOSED)).not.toBeVisible();

  // Search filters the list by title (client-side in legacy; the behaviour —
  // typing narrows the rows — is what the new app must keep).
  // src: legacy/lib/admin/admin-topics/template.jade:8-12 (search input)
  // src: legacy/lib/admin/admin-topics/view.js:40 (List over topic-title/
  //      topic-id/topic-date)
  await page.getByRole('searchbox', { name: TOPIC_SEARCH }).fill(topics.closedOutcome.slug);
  await expect(closedRow).toBeVisible();
  await expect(openRow).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 4. Deleting from the topic list asks for confirmation (cancel path only —
//    fixtures stay immutable; the destructive path is J4's create+delete).
// ---------------------------------------------------------------------------
test.fixme('J9: the topic-list delete control asks for confirmation; cancelling keeps the topic', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug));

  // Each row carries a delete control (icon-only trash in legacy — the new
  // UI must name it). Clicking it opens a confirmation modal titled "Șterge
  // subiect"; cancelling leaves the topic listed.
  // src: legacy/lib/admin/admin-topics/template.jade:24-25 (delete button)
  // src: legacy/lib/admin/admin-topics/view.js:69-93 (confirm → destroy)
  // src: legacy/lib/translations/lib/ro.json:38-41
  const row = page.getByRole('link', { name: new RegExp(topics.vote.slug, 'i') });
  await row.getByRole('button', { name: DELETE_TOPIC }).click();
  await expect(page.getByText(DELETE_TOPIC_CONFIRM_TITLE)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: CANCEL }).click();
  await expect(row).toBeVisible();

  // The server-side delete this flow would call is DELETE /topics/:id, gated
  // by canCreateTopics + the topic-level canDelete privilege — cited here so
  // the API activation (M4) covers the destructive path without this spec
  // mutating fixtures.
  // src: legacy/lib/api-v2/topics/index.js:218-228
});

// ---------------------------------------------------------------------------
// 5. Tag create: required name, image choice, success feedback.
// ---------------------------------------------------------------------------
test.fixme('J9: an admin creates a tag — name is required (max 50), an image is picked, the list shows it', async ({
  page,
  forum,
  users,
}) => {
  // The tag pages are gated on canEdit — an admin qualifies. (The legacy API
  // behind them is staff-gated; see the legacy-bug note on the sidebar test —
  // the new app gates API and page identically on the panel privilege.)
  // src: legacy/lib/admin/admin/admin.js:100-114 (privileges('canEdit'))
  // src: legacy/lib/api/tag/index.js:56-66 (POST /tag/create, staff)
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug, 'tags'));

  // The list page offers the add control…
  // src: legacy/lib/admin/admin-tags/template.jade:4-6
  await page.getByRole('link', { name: ADD_TAG }).click();
  await expect(page.getByRole('heading', { name: CREATE_TAG_HEADING })).toBeVisible();

  // …and the form requires a name (client validate='required', model
  // required + trim, maxlength 50 in both) and an image choice from the
  // fixed dictionary (radio per image, validate='any:image'; the model
  // enum-validates against the same dictionary and defaults to its first
  // entry).
  // src: legacy/lib/admin/admin-tags-form/template.jade:9-19
  // src: legacy/lib/models/tag.js:14 (name required, maxlength 50)
  // src: legacy/lib/models/tag.js:16 (image enum + default)
  // src: legacy/lib/tags-images/index.js:5-42 (the 9-image dictionary)
  // src: legacy/lib/translations/lib/ro.json:16 (name-required message)
  await expect(page.getByLabel(TAG_NAME)).toHaveJSProperty('required', true);
  await expect(page.getByRole('radio', { name: /agora/i })).toBeVisible();

  const name = uniqueTagName('create');
  await page.getByLabel(TAG_NAME).fill(name);
  await page.getByRole('radio', { name: /agora/i }).check();
  await page.getByRole('button', { name: SAVE }).click();
  await expect(page.getByText(TAG_SAVED)).toBeVisible();

  // The new tag appears in the tag list (each row links to its edit form).
  // src: legacy/lib/admin/admin-tags/template.jade:13-16
  await page.goto(adminPath(forum.slug, 'tags'));
  await expect(page.getByRole('link', { name: new RegExp(name, 'i') })).toBeVisible();

  // legacy-bug: the tag API reports failures with HTTP 200 and an { error }
  // body (_handleError), so the client cannot distinguish success from
  // failure by status. Not preserved — the new API answers 4xx with the
  // translated message; this spec asserts only the user-visible outcomes —
  // see docs/CHARACTERIZATION.md.
  //   // src: legacy/lib/api/tag/index.js:83-86
});

// ---------------------------------------------------------------------------
// 6. Tag uniqueness: names are deduplicated by their slug.
// ---------------------------------------------------------------------------
test.fixme('J9: creating a tag whose name slugifies to an existing tag does not create a duplicate', async ({
  page,
  forum,
  users,
}) => {
  // Uniqueness, READ from the source: every tag gets hash = slugify(name) at
  // creation, the hash carries a UNIQUE index, and a duplicate-key save
  // (11000) silently resolves to the EXISTING tag instead of erroring — so
  // 'J9-Unic …' and 'j9 unic …' (same slug) can never coexist.
  // src: legacy/lib/models/tag.js:13,25 (hash lowercased + unique index)
  // src: legacy/lib/db-api/tag.js:189-191 (hash = slugify(name))
  // src: legacy/lib/db-api/tag.js:193-204 (11000 → return the existing tag)
  const base = uniqueTagName('unic');
  await signIn(page, users.admin);
  await createTag(page, forum.slug, base);

  // Same letters, different casing/separators — identical slug.
  await createTag(page, forum.slug, base.toUpperCase().replaceAll('-', ' '));

  // legacy-bug: the duplicate create still shows the success message ("saved
  // successfully") although nothing was created — the user is never told the
  // name collides. Not preserved: the new app names the collision; the
  // invariant asserted here (one list entry) holds under both copies — see
  // docs/CHARACTERIZATION.md.
  //   // src: legacy/lib/admin/admin-tags-form/view.js:43-49 (unconditional
  //   //      success message on 200) + legacy/lib/db-api/tag.js:195-198
  await page.goto(adminPath(forum.slug, 'tags'));
  await expect(page.getByRole('link', { name: new RegExp(base, 'i') })).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// 7. Tag edit — and the deliberate ABSENCE of tag delete.
// ---------------------------------------------------------------------------
test.fixme('J9: an admin renames a tag; no tag-delete control exists for anyone', async ({
  page,
  forum,
  users,
}) => {
  const original = uniqueTagName('edit');
  await signIn(page, users.admin);
  await createTag(page, forum.slug, original);

  // Edit: the list row opens the prefilled form; saving updates the name.
  // src: legacy/lib/admin/admin/admin.js:116-124 (edit route)
  // src: legacy/lib/admin/admin-tags-form/view.js:6-16 (action /api/tag/:id)
  // src: legacy/lib/api/tag/index.js:68-81 + legacy/lib/db-api/tag.js:74-100
  //      (update = set + save)
  await page.goto(adminPath(forum.slug, 'tags'));
  await page.getByRole('link', { name: new RegExp(original, 'i') }).click();
  await expect(page.getByRole('heading', { name: EDIT_TAG_HEADING })).toBeVisible();
  const renamed = uniqueTagName('renamed');
  await page.getByLabel(TAG_NAME).fill(renamed);
  await page.getByRole('button', { name: SAVE }).click();
  await expect(page.getByText(TAG_SAVED)).toBeVisible();

  await page.goto(adminPath(forum.slug, 'tags'));
  await expect(page.getByRole('link', { name: new RegExp(renamed, 'i') })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(original, 'i') })).not.toBeVisible();

  // legacy-bug: renaming never regenerates the hash — the slug is computed
  // only at create, and the edit form posts only name + image — so a renamed
  // tag keeps its old slug forever and hash-based tag search misses its new
  // name. Not preserved: the new app keeps the tag's search identity in sync
  // with its name (or searches by name) — see docs/CHARACTERIZATION.md.
  //   // src: legacy/lib/db-api/tag.js:189-191 (hash set only in create)
  //   // src: legacy/lib/admin/admin-tags-form/template.jade:11,18 (form
  //   //      fields: name + image only)
  //   // src: legacy/lib/db-api/tag.js:46-61 (search queries hash only)

  // DELETE DOES NOT EXIST in legacy: the tag API has GET/POST routes only
  // (all/search/get/create/update — no DELETE), and neither the tag list nor
  // the tag form renders any delete control. The spec pins that invariant.
  // TODO-AMBIGUOUS: whether the NEW app adds tag deletion (and what happens
  // to topics carrying a deleted tag) is an open product decision with no
  // legacy counterpart — if it IS added, this test must be replaced via a
  // reviewed docs/CHARACTERIZATION.md change.
  //   // src: legacy/lib/api/tag/index.js:21-81 (the complete route list)
  //   // src: legacy/lib/admin/admin-tags/template.jade:1-16 (no delete)
  //   // src: legacy/lib/admin/admin-tags-form/template.jade:1-22 (no delete)
  await expect(page.getByRole('button', { name: /șterge|delete/i })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 8. The permissions surface is reachable from the panel (full
//    characterization = J3, cross-referenced).
// ---------------------------------------------------------------------------
test.fixme('J9: the permissions section opens from the sidebar and shows the visibility + role surfaces', async ({
  page,
  forum,
  users,
}) => {
  // J9 asserts only that the panel wires the section: the sidebar entry
  // (canEdit) leads to the permissions page with its two surfaces. WHAT the
  // page does — the four visibility options with confirmation, the per-role
  // sections, grant/revoke, owner-proofing — is J3's characterization
  // (j03-forum-roles.spec.ts) and is deliberately NOT restated here.
  // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:4-5
  // src: legacy/lib/admin/admin/admin.js:126-135 (canEdit gate + view)
  // src: legacy/lib/admin/admin-permissions/template.jade:1-12 (visibility +
  //      role sections composed on one page)
  // cross-ref: e2e/journeys/j03-forum-roles.spec.ts (visibility enumeration,
  //      grants, revokes, deep-link refusals per role)
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug));
  await page.getByRole('link', { name: PERMISSIONS_ENTRY }).click();
  await expect(page.getByRole('heading', { name: /vizibilitate|visibility/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /permisiuni|permissions/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 9. CSV export of topics: offered from the topic list, gated, and free of
//    any vote or personal data.
// ---------------------------------------------------------------------------
test.fixme('J9: the topic list offers a CSV download of all topics — ID + title (+ per-forum attrs), never vote data', async ({
  page,
  forum,
  users,
}) => {
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug));

  // The list page carries both CSV controls: download and update-from-CSV.
  // src: legacy/lib/admin/admin-topics/template.jade:20 (export-update slot)
  // src: legacy/lib/admin/admin-topics/export-update/component.js:61-84
  await expect(page.getByRole('link', { name: DOWNLOAD_CSV })).toBeVisible();
  await expect(page.getByText(UPDATE_FROM_CSV)).toBeVisible();

  // Clicking the link downloads GET /api/v2/topics.csv?forum=… as an
  // attachment named after the forum.
  // src: legacy/lib/admin/boot/routes.js:22 (the URL)
  // src: legacy/lib/api-v2/topics/csv.js:48-55 (text/csv + attachment
  //      filename <forum-name>-<unix-time>.csv)
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: DOWNLOAD_CSV }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${forum.slug}.*\\.csv$`));

  // Column set, READ from the export code: two fixed columns — 'Topic ID',
  // 'Topic Title' — plus ONE COLUMN PER forum.topicsAttrs entry (the
  // per-forum custom attribute definitions), i.e. the shape is fixed and the
  // tail is dynamic. The fixture forum defines no topicsAttrs, so its export
  // is exactly the two fixed columns.
  // src: legacy/lib/api-v2/topics/csv.js:12-15 (titles)
  // src: legacy/lib/api-v2/topics/csv.js:29-40 (header + rows concat attrs)
  // src: legacy/lib/models/forum/topics-attrs.js:3-40 (what topicsAttrs are)
  // TODO-AMBIGUOUS: docs/develop/fixtures.md gives agora-fixture no
  // topicsAttrs — if the contract ever grows them, the expected header tail
  // changes with it; only the fixed prefix + the no-votes invariant are
  // load-bearing here.
  const downloadPath = await download.path();
  const csv = readFileSync(downloadPath, 'utf8');
  const header = csv.split('\n')[0] ?? '';
  expect(header).toContain('Topic ID');
  expect(header).toContain('Topic Title');

  // GDPR invariant (NEW): no export may attribute votes or carry voter
  // identity — results are aggregate-only public and vote payloads are
  // pseudonymized. Legacy's topics export contains no vote data at all
  // (verified: id + title + attrs only), and the new app must keep it so.
  // src: decision G-7 / E1 (grill ledger,
  //      docs/plans/2026-08-18-democracyos-grill-decisions.md)
  // src: legacy/lib/api-v2/topics/csv.js:29-41 (the full row shape)
  expect(csv).not.toMatch(/voter|ballot|\bvote value\b/i);
  for (const user of Object.values(users)) {
    expect(csv).not.toContain(user.email);
  }

  // Gate breadth, cited for M4: the export requires a session +
  // canChangeTopics — which collaborators and authors also hold, not only
  // owner/admin. A signed-in participant must be refused.
  // src: legacy/lib/api-v2/topics/csv.js:23-27 (restrict + canChangeTopics)
  // src: legacy/lib/api-v2/middlewares/users.js:1-9 (restrict → 403)
  // src: legacy/lib/api-v2/middlewares/forums.js:8-21 (privilege → 403)
  // src: legacy/lib/privileges/forum.js:37-40 (who holds canChangeTopics)
  await signIn(page, users.participant);
  const refused = await page.request.get(`/api/v2/topics.csv?forum=${forum.slug}`);
  expect(refused.ok()).toBe(false);

  // NOT asserted (write path, J9 documents it for M4): POST /topics.csv
  // ingests an edited CSV back, updating ONLY the per-forum attrs columns —
  // same canChangeTopics gate.
  // src: legacy/lib/api-v2/topics/csv.js:58-110
  // src: legacy/lib/admin/admin-topics/export-update/component.js:16-59
});

// ---------------------------------------------------------------------------
// 10. CSV export of comments — the GDPR-critical surface.
// ---------------------------------------------------------------------------
test.fixme('J9: the comments CSV export carries the comment/reply columns with public author attribution — and NO vote data, NO emails', async ({
  page,
  forum,
  users,
}) => {
  // The admin Comments section is a single control in legacy: the CSV
  // download of every comment and reply on the forum.
  // src: legacy/lib/admin/admin/admin.js:142-145 (section renders component)
  // src: legacy/lib/admin/admin-comments/component.js:6-20 (just the link)
  await signIn(page, users.admin);
  await page.goto(adminPath(forum.slug));
  await page.getByRole('link', { name: COMMENTS_ENTRY }).click();
  await expect(page.getByRole('link', { name: DOWNLOAD_CSV })).toBeVisible();

  // The download is GET /api/v2/comments.csv?forum=… — text/csv, attachment
  // named after the forum.
  // src: legacy/lib/admin/boot/routes.js:21 (the URL)
  // src: legacy/lib/api-v2/comments/csv.js:84-93 (headers + filename)
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: DOWNLOAD_CSV }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${forum.slug}.*\\.csv$`));

  // Column set, READ from the export code — FIFTEEN fixed columns, one row
  // per reply (a reply-less comment yields one row with empty reply cells):
  // Topic ID/Title/URL, Comment ID/Date/Time/Date-time/Text/Author Fullname,
  // Reply ID/Date/Time/Date-time/Text/Author Fullname.
  // src: legacy/lib/api-v2/comments/csv.js:11-27 (titles)
  // src: legacy/lib/api-v2/comments/csv.js:29-34,59-82 (emptyReply + rows)
  const downloadPath = await download.path();
  const csv = readFileSync(downloadPath, 'utf8');
  const header = csv.split('\n')[0] ?? '';
  for (const column of [
    'Topic ID',
    'Topic Title',
    'Topic URL',
    'Comment ID',
    'Comment Text',
    'Comment Author Fullname',
    'Reply ID',
    'Reply Text',
    'Reply Author Fullname',
  ]) {
    expect(header).toContain(column);
  }

  // ------------------------------------------------------------------
  // GDPR-CRITICAL (decision G-7 / E1, grill ledger,
  // docs/plans/2026-08-18-democracyos-grill-decisions.md):
  // vote results are aggregate-only public and vote payloads are
  // pseudonymized — NO export may ever attribute a vote to a person.
  //
  // FINDING, derived by reading the complete legacy export surface (the
  // only two .csv handlers in the tree):
  //  1. Legacy's comments export writes NO vote data of any kind — neither
  //     topic votes nor comment up/downvotes appear in the columns, even
  //     though the underlying query loads the comments' embedded votes[]
  //     into memory (selected but never serialized).
  //     // src: legacy/lib/api-v2/comments/csv.js:59-82 (every cell written)
  //     // src: legacy/lib/api-v2/db-api/comments/index.js:531-556
  //     //      (populateTopics → ordinary scope)
  //     // src: legacy/lib/api-v2/db-api/comments/scopes.js:19-24 (select
  //     //      includes 'votes')
  //  2. It DOES export personal data: each row carries the comment/reply
  //     author's REAL full name (the fullName virtual = firstName +
  //     lastName) with exact timestamps and the full text of a political
  //     opinion. That is the SAME identity legacy shows publicly on every
  //     comment (displayName ≡ fullName under the spec'd config), so it is
  //     public-content attribution, not a hidden-data leak — but it is
  //     still a bulk personal-data export (E1: opinions are Art. 9 data)
  //     whose access breadth (canChangeTopics = collaborators and authors
  //     too) belongs in the DPIA (E3).
  //     // src: legacy/lib/api-v2/comments/csv.js:72,78 (author.fullName)
  //     // src: legacy/lib/models/user.js:90-92 (fullName virtual)
  //     // src: legacy/lib/models/user.js:101-109 (displayName ≡ fullName;
  //     //      the email suffix requires publicEmails + visibility
  //     //      'hidden', not the spec'd config)
  //  3. Emails are NEVER written to the file (the user scope selects email
  //     server-side, but no CSV cell serializes it) — asserted below as a
  //     permanent invariant.
  //     // src: legacy/lib/api-v2/db-api/users/scopes.js:5-20 (select email)
  //     // src: legacy/lib/api-v2/comments/csv.js:63-79 (no email cell)
  //
  // INTENDED BEHAVIOUR (encoded): exports carry at most the author identity
  // that is already public on the platform; never emails, never any vote
  // attribution. If the new app ever adds vote columns they must be
  // aggregate-only (per-topic totals), never per-user.
  // src: decision G-7 / E1 (grill ledger)
  // ------------------------------------------------------------------
  expect(header).not.toMatch(/vote|voter|ballot/i);
  expect(csv).not.toMatch(/\bvoter\b|\bballot\b/i);
  for (const user of Object.values(users)) {
    expect(csv).not.toContain(user.email);
  }

  // Row-level content (the fixture comment tree on t-vote) is NOT asserted:
  // e2e/fixtures/app.ts does not model the contract's comment tree yet
  // (M1 review finding N6, same activation prerequisite J8 records) — the
  // header + absence invariants above hold regardless of rows.
  // cross-ref: e2e/journeys/j08-comments.spec.ts (FIXTURE GAP note)

  // Gate: same as the topics export — session + canChangeTopics; a
  // participant is refused.
  // src: legacy/lib/api-v2/comments/csv.js:49-53
  await signIn(page, users.participant);
  const refused = await page.request.get(`/api/v2/comments.csv?forum=${forum.slug}`);
  expect(refused.ok()).toBe(false);

  // legacy-bug (robustness, not privacy): both exports hand-roll CSV quoting
  // — escapeTxt swaps double quotes for single quotes and strips newlines,
  // silently altering comment text in the export. Not preserved: the new
  // export uses RFC-4180 quoting so the text round-trips — see
  // docs/CHARACTERIZATION.md.
  //   // src: legacy/lib/api-v2/comments/csv.js:44-47
  //   // src: legacy/lib/api-v2/topics/csv.js:17-21
  // legacy-bug (scope): the comments export walks ALL topics of the forum —
  // drafts included (findAllFromForum applies no draft filter) — so comments
  // on unpublished topics leak into the export. Intended: the export covers
  // the same comment set an admin can see in the panel, and the new app must
  // decide draft handling deliberately at activation.
  //   // src: legacy/lib/api-v2/middlewares/topics.js:57-75 (no draft filter)
});
