// J3 — create a forum (multi-forum hub) → set visibility → grant a collaborator
// role (WU-M1-4, plan §4.2).
//
// Characterization spec derived by READING legacy source (never by observing a
// running system). Every assertion cites the legacy file:lines it was derived
// from; behaviours that are NEW (not in legacy) cite the decision log instead.
// All tests are quarantined with test.fixme until activation (SPEC-LEDGER row
// J3: activate at M4 via WU-M4-6, re-point at the real UI at WU-M5-5).
//
// Route names used with page.goto() are the legacy URL structure, adopted as
// the spec'd routes for the new app:
//   /forums/new                    // src: legacy/lib/settings/boot/routes.js:4
//   /:forum                        // src: legacy/lib/site/boot/routes.js:4-6 (multiForum)
//   /:forum/admin/permissions      // src: legacy/lib/admin/boot/routes.js:4-19
//
// ROLE TAXONOMY (verified against source for this journey): the full role
// enum is exactly admin, collaborator, author, participant.
//   // src: legacy/lib/models/forum/roles.js:7-13
// `owner` is NOT in that array — it lives on `forum.owner` (the comment on
// roles.js line 8 says so explicitly) and is checked via isOwner().
//   // src: legacy/lib/models/forum/roles.js:8
//   // src: legacy/lib/models/forum/index.js:55,105-108
// `moderator` is appended ONLY when config.moderatorEnabled, which defaults to
// false — moderator behaviour is config-gated and NOT asserted here; if the
// new app revives the flag, a new reviewed spec must cover it.
//   // src: legacy/lib/models/forum/roles.js:15
//   // src: legacy/config/defaults.json:19
// There is no 'registered' role anywhere in the legacy source (fixtures
// finding N1). This journey iterates `fixtureUserByRole` (e2e/fixtures/users.ts)
// which is keyed by the real roles plus owner.
//
// The hub target: this suite specs the MULTI-forum configuration
// (config.multiForum) with open forum creation (config.restrictForumCreation
// false, the legacy default) — any signed-in user may create a forum and
// becomes its owner. The staff-only variant is config-gated in legacy and is
// NOT part of this journey.
//   // src: legacy/lib/middlewares/forum-middlewares/index.js:138-152
//   // src: legacy/config/defaults.json:129-130
//
// Transport note for M4 (API-level activation): legacy statuses are
// 200 create / 400 validation / 401 privilege / 404 missing / 500 grant-revoke
// failures (see the legacy-bug note on the grant test). This journey asserts
// only user-visible outcomes, so its assertions survive the new API's use of
// proper statuses — see docs/CHARACTERIZATION.md.
//
// Romanian copy is taken from the legacy RO locale where it exists
// (legacy/lib/translations/lib/ro.json — the forum.form.* keys). The entire
// admin-permissions.* namespace has NO Romanian keys (only EN,
// legacy/lib/translations/lib/en.json:7-39), so every permissions-panel name
// below is new-design Romanian with the legacy EN string as fallback.

import { expect, test } from '../fixtures/app';
import { type FixtureRole, type FixtureUser, fixtureUserByRole } from '../fixtures/users';

type Page = import('@playwright/test').Page;

// Signs in a fixture user. Same conventions as J1 (fields: email + password;
// src: legacy/lib/site/sign-in/component.js:83-112).
async function signIn(page: Page, user: FixtureUser) {
  await page.goto('/signin');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(user.password);
  await page.getByRole('button', { name: /autentificare|sign ?in|login/i }).click();
}

// A forum name valid under the legacy rules: 1-80 chars, alphanumeric or '-',
// not starting nor finishing with '-'. src: legacy/lib/regexps/index.js:14-17
function uniqueForumName(): string {
  return `j3-forum-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Fills and submits the forum-creation form. Field set derived from the legacy
// form: name (the URL segment) + title required; summary and cover optional.
// src: legacy/lib/settings/forum-new/forum-form/template.jade:7-35
// Labels: RO copy from legacy/lib/translations/lib/ro.json:140-147.
async function fillAndSubmitForumForm(
  page: Page,
  forum: { name: string; title: string; summary?: string },
) {
  await page.goto('/forums/new');
  await page.getByLabel(/url/i).fill(forum.name);
  await page.getByLabel(/titlu|title/i).fill(forum.title);
  if (forum.summary !== undefined) {
    await page.getByLabel(/rezumat|summary/i).fill(forum.summary);
  }
  await page.getByRole('button', { name: /creeaz[aă]|create/i }).click();
}

test.fixme('J3: forum creation requires a session; any signed-in user may create one', async ({
  page,
  users,
}) => {
  // A signed-out visitor cannot reach the creation form — the legacy route is
  // gated by user.required before anything renders.
  // src: legacy/lib/settings/forum-new/forum-new.js:13 (user.required gate)
  await page.goto('/forums/new');
  await expect(page.getByRole('button', { name: /autentificare|sign ?in|login/i })).toBeVisible();
  await expect(page.getByLabel(/url/i)).not.toBeVisible();

  // In the multi-forum hub with open creation (restrictForumCreation false,
  // the legacy default) ANY signed-in user may create a forum — an ordinary
  // participant included. Staff-only creation is a config-gated variant that
  // this suite does not spec.
  // src: legacy/lib/middlewares/forum-middlewares/index.js:138-152
  // src: legacy/config/defaults.json:129-130 (multiForum/restrictForumCreation defaults)
  await signIn(page, users.participant);
  await page.goto('/forums/new');
  // The form announces itself; RO heading copy from the legacy locale.
  // src: legacy/lib/settings/forum-new/forum-form/template.jade:5
  // src: legacy/lib/translations/lib/ro.json:143 ("Creeaza copia mea de DemocracyOS")
  // TODO-AMBIGUOUS: the legacy RO heading names the old brand; the new heading
  // wording is new-design — the regex pins only the "create" intent.
  await expect(page.getByRole('heading', { name: /creeaz[aă]|creeaza|create/i })).toBeVisible();
  await expect(page.getByLabel(/url/i)).toBeVisible();
});

test.fixme('J3: creating a forum with the required fields publishes it at its URL, public by default, owned by its creator', async ({
  page,
  users,
}) => {
  const name = uniqueForumName();
  await signIn(page, users.participant);

  // Required fields: the URL name and the title. Summary and cover are
  // optional (no `required`/`validate=required` on them in the legacy form).
  // src: legacy/lib/settings/forum-new/forum-form/template.jade:17,23 (validate=required)
  // src: legacy/lib/models/forum/index.js:34-42 (name+title required in the model)
  await page.goto('/forums/new');
  await expect(page.getByLabel(/url/i)).toHaveJSProperty('required', true);
  await expect(page.getByLabel(/titlu|title/i)).toHaveJSProperty('required', true);

  await fillAndSubmitForumForm(page, {
    name: name.toUpperCase(), // deliberately uppercased — see normalization below
    title: 'Forumul cartierului J3',
    summary: 'Un forum de test creat de J3.',
  });

  // The stored name is normalized: trimmed and lowercased, so the uppercase
  // input above must land at the lowercase URL.
  // src: legacy/lib/models/forum/index.js:36-41 (trim + lowercase on name)
  // legacy-bug: after creating, legacy dumps the user on the HOME page
  // (page('/') then window.location='/') instead of the new forum, not
  // preserved — the new app lands the creator on the forum it just created —
  // see docs/CHARACTERIZATION.md.
  // src: legacy/lib/settings/forum-new/forum-form/forum-form.js:49-55
  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forumul cartierului j3/i })).toBeVisible();

  // Visibility is NOT part of the creation payload — the server only reads
  // name/title/body/summary/cover/permissions — so a new forum starts with
  // the model default: public.
  // src: legacy/lib/api/forum/index.js:157-166 (create payload, no visibility)
  // src: legacy/lib/models/forum/index.js:56-60 (visibility default 'public')
  // A public forum is listed on the hub for everyone, signed-out included.
  // src: legacy/lib/db-api/forum.js:40-42 (listing hides only 'private')
  await page.getByRole('button', { name: /ana/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forumul cartierului j3/i })).toBeVisible();

  // The creator is the owner: the server sets owner from the session, never
  // from the form.
  // src: legacy/lib/api/forum/index.js:161 (owner: req.user._id)
  // src: legacy/lib/models/forum/index.js:105-108 (isOwner compares forum.owner)
});

test.fixme('J3: a 300-character summary is accepted (legacy off-by-one fixed)', async ({
  page,
  users,
}) => {
  // legacy-bug: the form allows exactly 300 characters (maxlength=300 and
  // client rule max-length:300) but the model validator requires
  // summary.length < 300 — strictly less — so a 300-char summary passes the
  // client and is then rejected by the server. Not preserved: the new app
  // honours the UI contract, limit 300 INCLUSIVE — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/settings/forum-new/forum-form/template.jade:28 (maxlength=300)
  // src: legacy/lib/models/forum/index.js:43-53 (validator: length < 300)
  const name = uniqueForumName();
  await signIn(page, users.participant);
  await fillAndSubmitForumForm(page, {
    name,
    title: 'Forum cu rezumat maxim',
    summary: 'r'.repeat(300),
  });

  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forum cu rezumat maxim/i })).toBeVisible();
});

test.fixme('J3: forum names are validated — format, reserved names, uniqueness', async ({
  page,
  users,
}) => {
  await signIn(page, users.participant);

  // Format: 1-80 chars, alphanumeric or '-', not starting nor finishing with
  // '-'. A leading hyphen must be rejected with a format error.
  // src: legacy/lib/regexps/index.js:14-17 (the name pattern + its comment)
  // src: legacy/lib/models/forum/index.js:36-41,94-98 (match + nameIsValid)
  // TODO-AMBIGUOUS: legacy has no user-facing copy for the FORMAT failure —
  // the /forum/exists endpoint folds invalid names into { exists: true }, so
  // the UI shows "URL-ul nu este disponibil" (unavailable) for a name that is
  // merely malformed. legacy-bug: invalid-format conflated with already-taken,
  // not preserved — the new app names the actual problem; the regex below
  // accepts either family of copy — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/forum/index.js:64-73 (invalid → exists: true)
  // src: legacy/lib/translations/lib/ro.json:147 ("URL-ul nu este disponibil")
  await fillAndSubmitForumForm(page, { name: '-incepe-cu-cratima', title: 'Format invalid' });
  await expect(
    page.getByText(/nu este disponibil|format invalid|invalid|unavailable|not available/i),
  ).toBeVisible();

  // Reserved names can never be forum URLs — they collide with app routes.
  // 'admin' is in the reserved list; so are forums/topics/signin/settings etc.
  // src: legacy/lib/models/forum/reserved-names.js:5-24
  // src: legacy/lib/models/forum/index.js:90-92 (validator 'Reserved name')
  await fillAndSubmitForumForm(page, { name: 'admin', title: 'Nume rezervat' });
  await expect(
    page.getByText(/nu este disponibil|rezervat|reserved|unavailable|not available/i),
  ).toBeVisible();

  // Uniqueness: the fixture forum's name is taken (names are unique among
  // non-deleted forums; a soft-deleted forum frees its name).
  // src: legacy/lib/models/forum/index.js:76-88 (pre-save uniqueness over deletedAt: null)
  // src: legacy/lib/db-api/forum.js:221-229 (exists check, same filter)
  // legacy-bug: uniqueness is enforced by a find-then-save in a pre-save hook
  // with NO unique index (the name index at models/forum/index.js:71 is not
  // unique) — two concurrent creates can both pass the find and both save, a
  // RACE. Not preserved: the new Postgres schema enforces
  // UNIQUE (lower(name)) WHERE "deletedAt" IS NULL (plan WU-M3a-3), so the
  // user-visible behaviour — second create refused — is what this asserts —
  // see docs/CHARACTERIZATION.md.
  await fillAndSubmitForumForm(page, { name: 'agora-fixture', title: 'Nume duplicat' });
  await expect(
    page.getByText(/nu este disponibil|există deja|unavailable|not available|already/i),
  ).toBeVisible();
});

test.fixme('J3: the owner sees exactly four visibility options and changes one with confirmation', async ({
  page,
  forum,
  users,
}) => {
  await signIn(page, users.owner);
  await page.goto(`/${forum.slug}/admin/permissions`);

  // The permissions page has a Visibility section listing the visibility
  // values as radio options, each with title + description, in the enum
  // order: private, closed, public, collaborative.
  // src: legacy/lib/models/forum/visibilities.js:5-10 (the four values)
  // src: legacy/lib/admin/admin-permissions/template.jade:3-12 (radio per value)
  // TODO-AMBIGUOUS: the admin-permissions.* namespace has NO Romanian keys —
  // titles below pair new-design RO with the legacy EN titles ("Secret",
  // "Restricted", "Open for All", "Collaborative").
  // src: legacy/lib/translations/lib/en.json:27-36
  await expect(page.getByRole('heading', { name: /vizibilitate|visibility/i })).toBeVisible();
  const visibilityOptions = [
    /secret/i, // private
    /restricționat|restrictionat|restricted/i, // closed
    /deschis|public|open for all/i, // public
    /colaborativ|collaborative/i, // collaborative
  ];
  for (const option of visibilityOptions) {
    await expect(page.getByRole('radio', { name: option })).toBeVisible();
  }

  // The fixture forum is public, so that radio is the checked one.
  // src: legacy/lib/admin/admin-permissions/template.jade:10 (checked = current)
  // src: docs/develop/fixtures.md "Forum" (agora-fixture is public)
  await expect(page.getByRole('radio', { name: /deschis|public|open for all/i })).toBeChecked();

  // Selecting another visibility asks for confirmation before applying;
  // declining reverts the radio to the stored value.
  // src: legacy/lib/admin/admin-permissions/admin-permissions.js:77-98
  // TODO-AMBIGUOUS: the legacy confirm-modal button labels live in the shared
  // modal component, not in the permissions code — accept/decline wording is
  // new-design; the regexes pin only the intent.
  await page.getByRole('radio', { name: /restricționat|restrictionat|restricted/i }).check();
  await expect(page.getByText(/sigur|are you sure/i)).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /anuleaz[aă]|renunț|cancel/i })
    .click();
  await expect(page.getByRole('radio', { name: /deschis|public|open for all/i })).toBeChecked();

  // Accepting persists it. The update endpoint applies ONLY the visibility
  // key — every other field in the payload is ignored by this route (the
  // general edit form is a different endpoint).
  // src: legacy/lib/api/forum/index.js:202-217 (PUT /forum/:id)
  // src: legacy/lib/db-api/forum.js:74-78 (pick(data, ['visibility']))
  await page.getByRole('radio', { name: /restricționat|restrictionat|restricted/i }).check();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /confirm|da\b|yes|ok/i })
    .click();
  await page.reload();
  await expect(
    page.getByRole('radio', { name: /restricționat|restrictionat|restricted/i }),
  ).toBeChecked();

  // Restore the fixture state (fixtures are immutable between journeys).
  await page.getByRole('radio', { name: /deschis|public|open for all/i }).check();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /confirm|da\b|yes|ok/i })
    .click();
});

test.fixme('J3: visibility controls what a signed-out visitor can see', async ({ page, users }) => {
  // Derivation (privilege table): canView is true for ANYONE — signed-out
  // included — when visibility is public, closed or collaborative; a private
  // forum is viewable only by its owner or by users holding ANY role on it.
  // src: legacy/lib/privileges/forum.js:15-19 (canView)
  // src: legacy/lib/models/forum/index.js:116-131,138-149 (hasRole/hasVisibility)
  //
  // Build the private forum inside the journey so fixtures stay immutable:
  // ana creates it, makes it Secret, and grants elena participant.
  const name = uniqueForumName();
  await signIn(page, users.participant);
  await fillAndSubmitForumForm(page, { name, title: 'Forum secret J3' });
  await page.goto(`/${name}/admin/permissions`);
  await page.getByRole('radio', { name: /secret/i }).check();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /confirm|da\b|yes|ok/i })
    .click();
  // Grant elena (role participant) so the with-a-role case is assertable.
  // The grant flow itself is characterized in the collaborator test below;
  // the per-role add-field label is defined there.
  // src: legacy/lib/admin/admin-permissions/admin-permissions.js:43-58 (role sections)
  await page.getByLabel(/adaug[aă] participant|add a person/i).fill(users.voter.email);
  await page.getByRole('option', { name: new RegExp(users.voter.handle, 'i') }).click();

  // Signed out: the private forum is NOT viewable and NOT listed on the hub.
  // src: legacy/lib/privileges/forum.js:15-19 (private fails canView w/o role)
  // src: legacy/lib/middlewares/forum-middlewares/index.js:119-136 (privilege gate refuses)
  // src: legacy/lib/db-api/forum.js:40-42 (listing: visibility $ne 'private')
  await page.getByRole('button', { name: /ana/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forum secret j3/i })).not.toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Forum secret J3')).not.toBeVisible();

  // Signed in WITH a role (elena, participant on this forum): viewable. This
  // is what the participant role unlocks on a private forum — visibility,
  // nothing administrative.
  // src: legacy/lib/privileges/forum.js:18 (hasRole with no role filter)
  // src: legacy/lib/translations/lib/en.json:23 (participant description)
  await signIn(page, users.voter);
  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forum secret j3/i })).toBeVisible();

  // NOTE (config-gated, not asserted): on a 'collaborative' forum the
  // canCreateTopics/canPublishTopics privileges short-circuit to true before
  // any user check — topic creation there is open to any signed-in user (the
  // route-level session guard still applies).
  // src: legacy/lib/privileges/forum.js:31-35,42-46
});

test.fixme('J3: the owner grants collaborator; the grant is visible, owner-proof, and revocable', async ({
  page,
  users,
}) => {
  // Fresh forum so the fixture forum's permission lists stay immutable.
  const name = uniqueForumName();
  await signIn(page, users.owner);
  await fillAndSubmitForumForm(page, { name, title: 'Forum permisiuni J3' });
  await page.goto(`/${name}/admin/permissions`);

  // The panel renders an Owner section (read-only: no add input, no revoke)
  // and then one section per role, in roles.js order: admin, collaborator,
  // author, participant.
  // src: legacy/lib/admin/admin-permissions/admin-permissions.js:43-75
  // src: legacy/lib/models/forum/roles.js:7-13
  // src: legacy/lib/admin/admin-permissions/role/template.jade:1-6
  // TODO-AMBIGUOUS: admin-permissions.roles.* has no RO keys — headings are
  // new-design RO over legacy EN (en.json:9-26).
  await expect(page.getByRole('heading', { name: /permisiuni|permissions/i })).toBeVisible();
  for (const heading of [
    /proprietar|owner/i,
    /administratori|administrators/i,
    /colaboratori|collaborators/i,
    /autori|authors/i,
    /participanți|participanti|participants/i,
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  // Grant: type a person into the Collaborators add-field and pick them. The
  // legacy input is placeholder-only ("Add a person", en.json:5) with NO
  // label — an a11y gap; the new UI must give each role section's add-field a
  // real accessible name (WCAG seeding, N16). This spec defines them as
  // "Adaugă <rol>" with the legacy EN placeholder as fallback.
  // src: legacy/lib/admin/admin-permissions/add-user-input/template.jade:1-4
  // src: legacy/lib/translations/lib/en.json:5 ("Add a person")
  // src: legacy/lib/admin/admin-permissions/role/role.js:38-43,68-91 (onSelect → grant)
  // src: legacy/lib/stores/forum-store/forum-store.js:84-99 (POST …/permissions)
  // src: legacy/lib/api/forum/index.js:127-140 (route requires canEdit)
  // The Permission record's role enum is roles.js and its DEFAULT is
  // 'collaborator' — the canonical grant this journey characterizes.
  // src: legacy/lib/models/forum/index.js:16-28 (enum roles, default collaborator)
  // TODO-AMBIGUOUS: how the add-field searches (name vs e-mail) lives in the
  // user search endpoint, out of J3 scope — the spec pins only the outcome.
  await page.getByLabel(/adaug[aă] colaborator|add a person/i).fill(users.participant.email);
  await page.getByRole('option', { name: new RegExp(users.participant.handle, 'i') }).click();
  await expect(page.getByText(users.participant.handle)).toBeVisible();

  // Owner-proofing: granting any role to the forum owner is refused with a
  // dedicated error — the owner can never hold a second role.
  // src: legacy/lib/models/forum/index.js:156-162 (FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE)
  // src: legacy/lib/translations/lib/en.json:37 ("The forum owner cannot be given another role.")
  // legacy-bug: the API surfaces grant failures as HTTP 500 (a client error
  // reported as a server fault), not preserved — the new API answers 4xx with
  // the translated message; the user-visible message is what this asserts —
  // see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/forum/index.js:132-139 (catch → status 500)
  await page.getByLabel(/adaug[aă] colaborator|add a person/i).fill(users.owner.email);
  await page.getByRole('option', { name: new RegExp(users.owner.handle, 'i') }).click();
  await expect(
    page.getByText(/proprietarul .*nu (poate|i se poate)|owner cannot be given another role/i),
  ).toBeVisible();

  // A user holds ONE permission per forum: granting a different role to an
  // already-permissioned user REPLACES the old role (set, not append).
  // src: legacy/lib/models/forum/index.js:151-154,164-176 (getPermission + set)
  // src: legacy/lib/admin/admin-permissions/role/role.js:129-133 (moves lists on grant)
  await page.getByLabel(/adaug[aă] autor|add a person/i).fill(users.participant.email);
  await page.getByRole('option', { name: new RegExp(users.participant.handle, 'i') }).click();
  // now under Authors, no longer under Collaborators — one entry total.
  await expect(page.getByText(users.participant.handle)).toHaveCount(1);

  // Revoke: the revoke control asks for confirmation naming role and user,
  // then removes the entry. Revoking a role the user does not hold is an
  // error ("The user doesnt have that permission." / "User not found.").
  // src: legacy/lib/admin/admin-permissions/role/role.js:93-127 (confirm + revoke)
  // src: legacy/lib/api/forum/index.js:142-155 (DELETE …/permissions)
  // src: legacy/lib/models/forum/index.js:178-199 (USER_NOT_FOUND / USER_DONT_HAVE_PERMISSION)
  // legacy-bug: the EN confirm copy misspells revoke ("rovoke", en.json:8),
  // not preserved — new copy is spelled; the regex pins intent only.
  await page.getByRole('button', { name: /revoc[aă]|revoke/i }).click();
  await expect(page.getByText(/sigur|are you sure/i)).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /revoc[aă]|revoke/i })
    .click();
  await expect(page.getByText(users.participant.handle)).not.toBeVisible();
});

// What each role unlocks in the admin surface of the FIXTURE forum. Expected
// values derived from the privilege table:
//  - admin panel entry: canChangeTopics || canCreateTopics — owner, admin,
//    collaborator, author (identical grants at forum level); participant NO.
//    // src: legacy/lib/admin/admin/admin.js:157-160 (hasAccessToForumAdmin)
//    // src: legacy/lib/privileges/forum.js:31-40 (both privileges: owner|admin|collaborator|author)
//  - permissions + edit-forum sections: canEdit — owner or admin ONLY.
//    // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:3-6 (canEdit gate)
//    // src: legacy/lib/privileges/forum.js:21-24 (canEdit)
//    // src: legacy/lib/admin/admin/admin.js:126-135 (permissions route re-checks canEdit)
//  - publishing topics: canPublishTopics — owner or admin ONLY (collaborator
//    and author can create/change but NOT publish on a non-collaborative
//    forum). Asserted at the surface level here; J4 owns the topic flows.
//    // src: legacy/lib/privileges/forum.js:42-46
// TODO-AMBIGUOUS: at forum level author ≡ collaborator (identical privilege
// grants, privileges/forum.js:31-40). The EN role descriptions promise a
// difference ("Author … not publish them, nor edit published ones" vs
// "Collaborators can add, edit and delete topics", en.json:12,15) whose
// enforcement lives in the topic routes, not in forum privileges — J4/J9
// must characterize it; J3 asserts only the shared forum-level surface.
const adminSurfaceByRole: Record<FixtureRole, { adminPanel: boolean; permissions: boolean }> = {
  owner: { adminPanel: true, permissions: true },
  admin: { adminPanel: true, permissions: true },
  collaborator: { adminPanel: true, permissions: false },
  author: { adminPanel: true, permissions: false },
  participant: { adminPanel: false, permissions: false },
};

for (const [role, user] of Object.entries(fixtureUserByRole) as [FixtureRole, FixtureUser][]) {
  const surface = adminSurfaceByRole[role];

  test.fixme(`J3: admin surface for role '${role}' — panel ${surface.adminPanel ? 'reachable' : 'refused'}, permissions ${surface.permissions ? 'available' : 'hidden'}`, async ({
    page,
    forum,
  }) => {
    await signIn(page, user);
    await page.goto(`/${forum.slug}/admin`);

    if (surface.adminPanel) {
      // The panel opens on the Topics section (the /admin root redirects
      // there) with the sidebar visible.
      // src: legacy/lib/admin/admin/admin.js:59-61 (redirect to admin.topics)
      // src: legacy/lib/translations/lib/ro.json:10 ("Subiecte")
      await expect(page.getByRole('link', { name: /subiecte|topics/i })).toBeVisible();
    } else {
      // No admin access: bounced back to the forum home, no admin sidebar.
      // src: legacy/lib/admin/admin/admin.js:157-160 (redirect '/')
      await expect(page.getByRole('link', { name: /subiecte|topics/i })).not.toBeVisible();
    }

    // The Permissions and Edit-forum entries exist only with canEdit.
    // src: legacy/lib/admin/admin-sidebar/sidebar-template.jade:4-6
    // TODO-AMBIGUOUS: the sidebar entry's EN label is "Privileges"
    // (admin-sidebar.permissions.title, en.json:43) while the page heading is
    // "Permissions" (en.json:26); no RO key exists for either — the new-design
    // RO label is "Permisiuni" and the regex accepts all three.
    const permissionsLink = page.getByRole('link', {
      name: /permisiuni|privilegii|privileges|permissions/i,
    });
    if (surface.permissions) {
      await expect(permissionsLink).toBeVisible();
      await permissionsLink.click();
      await expect(page.getByRole('heading', { name: /vizibilitate|visibility/i })).toBeVisible();
    } else {
      await expect(permissionsLink).not.toBeVisible();
      // Deep-linking straight to the permissions URL must ALSO refuse — the
      // route re-checks canEdit server-side, it is not just a hidden link.
      // src: legacy/lib/admin/admin/admin.js:126-135 (privileges('canEdit'))
      // src: legacy/lib/middlewares/forum-middlewares/index.js:119-136 (401 path)
      await page.goto(`/${forum.slug}/admin/permissions`);
      await expect(
        page.getByRole('heading', { name: /vizibilitate|visibility/i }),
      ).not.toBeVisible();
    }
  });
}

test.fixme('J3: deleting a forum is owner-only; admin and collaborator are refused', async ({
  page,
  users,
}) => {
  // canDelete is the narrowest privilege: the OWNER, and no role — not even
  // admin — qualifies. Deletion is a soft delete (deletedAt), which also
  // frees the name for reuse (the uniqueness filter is deletedAt: null).
  // src: legacy/lib/privileges/forum.js:26-29 (canDelete: isOwner only)
  // src: legacy/lib/api/forum/index.js:219-234 (DELETE gated on canDelete)
  // src: legacy/lib/models/forum/index.js:100-103 (soft delete sets deletedAt)
  // src: legacy/lib/models/forum/index.js:78-88 (uniqueness ignores deleted)
  //
  // TODO-AMBIGUOUS: legacy has NO UI control for forum deletion (the
  // edit-forum panel exposes name/title/summary/cover only,
  // legacy/lib/admin/admin-edit-forum/component.js:40-115) — deletion exists
  // only as the API route. The control below (a delete action inside the
  // owner's edit-forum page) is new-design; M4 activates this API-level.
  const name = uniqueForumName();
  await signIn(page, users.owner);
  await fillAndSubmitForumForm(page, { name, title: 'Forum de șters J3' });

  // Grant carmen admin on the fresh forum, then verify SHE cannot delete it.
  await page.goto(`/${name}/admin/permissions`);
  await page.getByLabel(/adaug[aă] administrator|add a person/i).fill(users.admin.email);
  await page.getByRole('option', { name: new RegExp(users.admin.handle, 'i') }).click();

  await page.getByRole('button', { name: /dan/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();

  // Admin: full edit surface, but NO delete.
  // src: legacy/lib/privileges/forum.js:21-24 (admin has canEdit) vs 26-29
  await signIn(page, users.admin);
  await page.goto(`/${name}/admin/edit-forum`);
  await expect(
    page.getByRole('button', { name: /șterge forumul|delete forum/i }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: /carmen/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();

  // Owner: delete succeeds and the forum stops resolving.
  await signIn(page, users.owner);
  await page.goto(`/${name}/admin/edit-forum`);
  await page.getByRole('button', { name: /șterge forumul|delete forum/i }).click();
  await expect(page.getByText(/sigur|are you sure/i)).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /confirm|da\b|yes|ok/i })
    .click();
  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forum de șters j3/i })).not.toBeVisible();

  // The freed name may be reused (soft delete + deletedAt:null uniqueness).
  // src: legacy/lib/models/forum/index.js:78-88; legacy/lib/db-api/forum.js:221-229
  await fillAndSubmitForumForm(page, { name, title: 'Forum renăscut J3' });
  await page.goto(`/${name}`);
  await expect(page.getByRole('heading', { name: /forum renăscut j3/i })).toBeVisible();
});

test.fixme('J3: ownership cannot be transferred — there is no such action for anyone', async ({
  page,
  forum,
  users,
}) => {
  // Legacy has NO ownership-transfer route: nothing in the forum API writes
  // forum.owner after creation (create sets it from the session; update picks
  // only visibility; the permissions routes touch the permissions array
  // only), and the owner section of the permissions panel is rendered
  // read-only (canRevoke: false, canAdd: false). The EN copy states it
  // outright: "The owner is unique, and cannot be changed."
  // src: legacy/lib/api/forum/index.js:157-166,202-217,127-155 (no owner write path)
  // src: legacy/lib/db-api/forum.js:74-78 (update picks visibility only)
  // src: legacy/lib/admin/admin-permissions/admin-permissions.js:67-75 (owner row read-only)
  // src: legacy/lib/translations/lib/en.json:21 (owner description)
  //
  // TODO-AMBIGUOUS: whether the NEW app adds ownership transfer is an open
  // product decision with no legacy counterpart. Until decided, the spec pins
  // the legacy invariant: no transfer control exists, for any role — if
  // transfer IS added later, this test must be replaced by an owner-only
  // transfer characterization via a reviewed docs/CHARACTERIZATION.md change.
  for (const user of [users.owner, users.admin]) {
    await signIn(page, user);
    await page.goto(`/${forum.slug}/admin/permissions`);
    await expect(
      page.getByRole('button', { name: /transfer[aă]? proprietatea|transfer ownership/i }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: new RegExp(user.handle.split('-')[0], 'i') }).click();
    await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
  }
});
