// J10 — settings: profile, password change, notification preferences, and the
// EN ↔ RO locale switch (WU-M1-11, plan §4.2).
//
// Characterization spec derived by READING legacy source (never by observing a
// running system). Every assertion cites the legacy file:lines it was derived
// from; behaviours that are NEW (not in legacy) cite the decision log instead.
// All tests are quarantined with test.fixme until activation (SPEC-LEDGER row
// J10: activate at M4 via WU-M4-16, re-point at the real UI at WU-M5-11).
//
// Route names used with page.goto() are the legacy URL structure, adopted as
// the spec'd routes for the new app:
//   /settings (redirects to /settings/profile), /settings/profile,
//   /settings/password, /settings/notifications
//   // src: legacy/lib/settings/boot/routes.js:4-10 (route registration)
//   // src: legacy/lib/settings/settings/settings.js:18 (/settings → profile)
// API routes (M4 activation surface): POST /api/settings/profile,
// POST /api/settings/password, POST /api/settings/notifications.
//   // src: legacy/lib/api/settings/index.js:17,42,67
//   // src: legacy/lib/settings/settings-profile/template.jade:7 (form action)
//   // src: legacy/lib/settings/settings-password/template.jade:7
//   // src: legacy/lib/settings/settings-notifications/template.jade:7
//
// Accessible names are defined HERE, in Romanian with English fallback
// (e2e/README.md pattern) — the new UI must implement them (WCAG seeding, N16).
// Romanian copy is taken from the legacy RO locale where it exists
// (legacy/lib/translations/lib/ro.json); where an RO key is missing the
// assertion is marked TODO-AMBIGUOUS and the regex accepts the EN string too.
//
// Transport note for M4 (API-level activation): legacy reports a wrong
// current password as HTTP 200 + { error } (the route's own comment cites
// FormView's inability to render real error codes, issue #531).
// legacy-bug: errors delivered as HTTP 200, not preserved — the new API uses
// real error statuses; this journey asserts only the user-visible outcome, so
// its assertions survive that fix — see docs/CHARACTERIZATION.md.
// src: legacy/lib/api/settings/index.js:47-53 (200 + error on bad password)
//
// Auth/password conventions (sign-up, e-mail validation, sign-in, the min-6
// and retype-must-match password rules and their client-side-only legacy
// enforcement) are J1/J2 territory — cross-referenced from
// j01-signup.spec.ts / j02-forgot-password.spec.ts, not restated here.

import { expect, test } from '../fixtures/app.js';

type PageT = import('@playwright/test').Page;

// J10 edits the profile, password, notification preferences and locale of its
// subject account, so it NEVER uses fixture accounts for mutating steps —
// fixtures stay immutable (e2e/fixtures/users.ts:38-40;
// docs/develop/fixtures.md "Users"). Fixture accounts appear only in
// non-mutating steps (signing in to look around). Synthetic values only,
// never personal data (§4.1).
function uniqueSettingsProfile() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    firstName: 'Sorina',
    lastName: 'Setar',
    email: `j10-${stamp}@example.test`,
    password: 'parola-veche-j10-sintetica',
    newPassword: 'parola-noua-j10-sintetica',
    // Adult date of birth — the age-16 gate is a NEW requirement.
    // src: decision G-3/E4 (grill ledger)
    birthDate: '1990-01-01',
  };
}

// --- Helpers reused from the J1/J2 house style ------------------------------

// Fills and submits the sign-up form (J1 conventions; see j01-signup.spec.ts
// for the field-set derivation).
// src: legacy/lib/site/sign-up/component.js:138-194
// src: legacy/lib/translations/lib/ro.json:282,300,301,199,294
async function fillAndSubmitSignup(
  page: PageT,
  profile: { firstName: string; lastName: string; email: string; birthDate: string },
  password: string,
) {
  await page.goto('/signup');
  await page.getByLabel(/email/i).fill(profile.email);
  await page.getByLabel(/^prenume|first name/i).fill(profile.firstName);
  await page.getByLabel(/^nume|last name/i).fill(profile.lastName);
  await page.getByLabel(/data nașterii|date of birth/i).fill(profile.birthDate);
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(password);
  await page.getByLabel(/retipărește parola|retype password/i).fill(password);
  await page.getByRole('button', { name: /înregistr.*acum|sign ?up/i }).click();
}

// Fills and submits the sign-in form (J1 conventions).
// src: legacy/lib/site/sign-in/component.js:83-112
async function fillAndSubmitSignin(page: PageT, creds: { email: string; password: string }) {
  await page.goto('/signin');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(creds.password);
  await page.getByRole('button', { name: /autentificare|sign ?in|login/i }).click();
}

// Activation-time infrastructure: the validation link only exists inside the
// welcome e-mail (legacy/lib/api/signup/lib/signup.js:168-187). The J10
// activating WU (WU-M4-16) reuses the mail-capture fixture that lands with
// WU-M4-4 (J1); until then the journey stays pending and this stub keeps the
// contract visible.
function validationLinkFromMailbox(_email: string): Promise<string> {
  return Promise.reject(
    new Error('pending: mail-capture fixture lands with WU-M4-4 (J1 activation)'),
  );
}

// Signs up a fresh account, validates its e-mail, and LEAVES IT SIGNED IN —
// visiting the validation link signs the user in (J1's derivation).
// src: legacy/lib/api/signup/lib/signup.js:110-136 (validate flips emailValidated)
// src: legacy/lib/api/signup/index.js:50-60 (validate → jwt.signin cookie)
async function createValidatedAccount(page: PageT) {
  const profile = uniqueSettingsProfile();
  await fillAndSubmitSignup(page, profile, profile.password);
  const validateUrl = await validationLinkFromMailbox(profile.email);
  await page.goto(validateUrl);
  await expect(page.getByRole('button', { name: /sorina/i })).toBeVisible();
  return profile;
}

// ---------------------------------------------------------------------------

test.fixme('J10: the settings pages require a session — a signed-out visitor is refused', async ({
  page,
}) => {
  // Legacy guards every settings route with user.required, which loads the
  // session and, when there is none, redirects away (state 'unloaded' → '/';
  // a failed load of /me → sign-out + '/signin' — two legacy code paths).
  // src: legacy/lib/settings/settings/settings.js:55-61 (route chain: user.required)
  // src: legacy/lib/user/user.js:38-59 (user.required: redirect when not logged)
  // src: legacy/lib/user/user.js:128-131 (redirect default target '/')
  // The settings API is guarded server-side too: no req.user → HTTP 403 with
  // a redirect-to-/signin action (the M4 API-level assertion surface).
  // src: legacy/lib/utils/index.js:67-92 (restrict middleware, 403 + /signin)
  // src: legacy/lib/api/settings/index.js:17,42,67 (restrict on all three POSTs)
  // TODO-AMBIGUOUS: legacy's two client paths land on '/' or '/signin'
  // depending on how the session load fails; the source does not settle one
  // destination. This spec asserts only the refusal: no settings content, and
  // the visitor ends up somewhere with a sign-in affordance.
  await page.goto('/settings/profile');

  await expect(page).not.toHaveURL(/\/settings/);
  // The profile pane heading (t('settings.profile')) never renders.
  // src: legacy/lib/settings/settings-profile/template.jade:6 (h1)
  // src: legacy/lib/translations/lib/ro.json:261 ("Profil")
  await expect(page.getByRole('heading', { name: /^profil$|^profile$/i })).not.toBeVisible();
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).toBeVisible();
});

test.fixme('J10: /settings opens the profile pane, and the menu offers exactly the panes the role allows', async ({
  page,
  users,
}) => {
  // Signing in with a fixture account is non-mutating — ana only looks.
  const ana = users.participant;
  await fillAndSubmitSignin(page, { email: ana.email, password: ana.password });
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();

  // Bare /settings redirects to the profile pane.
  // src: legacy/lib/settings/settings/settings.js:18 (page redirect)
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/settings\/profile$/);

  // The settings menu announces itself and lists the three core panes:
  // profile, password, notifications.
  // src: legacy/lib/settings/settings/settings-container.jade:4-11 (menu entries)
  // src: legacy/lib/translations/lib/ro.json:265 ("Setări"), 261 ("Profil"),
  //      199 ("Parola"), 254 ("Notificări")
  await expect(page.getByText(/^set[ăa]ri$|^settings$/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /^profil$|^profile$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^parol[ăa]$|^password$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^notific[ăa]ri$|^notifications$/i })).toBeVisible();

  // The forums pane is only offered to users with canManage privileges, and
  // the user-badges pane only to staff — an ordinary participant sees neither.
  // src: legacy/lib/settings/settings/settings-container.jade:12-17 (conditions)
  // src: legacy/lib/settings/settings/settings.js:33-37 (same gating, router side)
  // src: legacy/lib/translations/lib/ro.json:263 ("Democrații" — the forums entry)
  // (The staff concept is replaced by admin RBAC in the new app — decision D6
  // (grill ledger) — but the negative assertion holds either way.)
  await expect(page.getByRole('link', { name: /democrații|communities/i })).not.toBeVisible();
  await expect(page.getByRole('link', { name: /user badges/i })).not.toBeVisible();

  // Forcing the URL of a pane the role does not allow is refused — legacy
  // redirects to /404.
  // src: legacy/lib/settings/settings/settings.js:39-41 (invalid path → /404)
  await page.goto('/settings/forums');
  await expect(page).not.toHaveURL(/\/settings\/forums/);
});

test.fixme('J10: the profile pane edits names and picture URL; the e-mail is visible but not editable', async ({
  page,
}) => {
  await createValidatedAccount(page);
  await page.goto('/settings/profile');

  // The pane announces itself.
  // src: legacy/lib/settings/settings-profile/template.jade:6 (h1 t('settings.profile'))
  // src: legacy/lib/translations/lib/ro.json:261 ("Profil")
  await expect(page.getByRole('heading', { name: /^profil$|^profile$/i })).toBeVisible();

  // Editable fields: first name, last name (both required, max 100), and the
  // profile-picture URL (optional).
  // src: legacy/lib/settings/settings-profile/template.jade:9-14 (names, required)
  // src: legacy/lib/settings/settings-profile/template.jade:21-30 (picture URL)
  // src: legacy/lib/translations/lib/ro.json:232 ("Prenume"), 233 ("Nume"),
  //      260 ("Sau adaugă URL-ul unei imagini aici...")
  // TODO-AMBIGUOUS: ro.json has no "settings.profile-picture" key — only EN
  // exists ("Profile Picture", legacy/lib/translations/lib/en.json:397). The
  // Romanian label is new-design (the gravatar copy at ro.json:228 says "poza
  // de profil"); the regex accepts both.
  await expect(page.getByLabel(/^prenume|first name/i)).toHaveJSProperty('required', true);
  await expect(page.getByLabel(/^nume|last name/i)).toHaveJSProperty('required', true);
  await expect(page.getByLabel(/poz[ăa] de profil|profile picture/i)).toBeVisible();

  // The gravatar path is offered alongside the URL field.
  // src: legacy/lib/settings/settings-profile/template.jade:27-29
  // src: legacy/lib/translations/lib/ro.json:228 ("Schimbă poza de profil la gravatar.com")
  await expect(page.getByRole('link', { name: /gravatar/i })).toBeVisible();

  // The e-mail is DISPLAYED but NOT editable. Legacy renders the input
  // disabled and the server never assigns req.body.email — the assignment is
  // commented out (upstream issue #223, "Temporarily disable email
  // submission, until we fix the whole flow").
  // src: legacy/lib/settings/settings-profile/template.jade:15-17 (disabled input)
  // src: legacy/lib/api/settings/index.js:25-28 (email assignment commented out)
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeDisabled();

  // Legacy's INTENT for a future e-mail change is preserved in a now-dead
  // branch: if the e-mail were modified, emailValidated would reset to false,
  // i.e. a changed address must be re-validated before it counts.
  // src: legacy/lib/api/settings/index.js:30-33 (isModified('email') → false)
  // TODO-AMBIGUOUS: whether the new app enables e-mail change from settings
  // is not derivable from legacy (legacy shipped it disabled). This spec pins
  // only the legacy-observable contract — the field is read-only here — and
  // records the dead branch as the intended re-validation rule IF a change
  // flow is ever built. An e-mail-change journey would be a new ledger row.

  // Editing the names and saving shows the success confirmation.
  // Whitespace is normalized (trimmed, runs collapsed) — legacy does this
  // client-side before submitting; the new app must normalize server-side
  // too (same disposition as the client-only password rules in J1/J2).
  // src: legacy/lib/settings/settings-profile/view.js:76-79 (postserialize trim)
  // src: legacy/lib/api/settings/index.js:21-22 (server stores what arrives)
  // src: legacy/lib/settings/settings-profile/view.js:55-61 (success message)
  // src: legacy/lib/translations/lib/ro.json:264 ("Profilul tău a fost modificat cu succes")
  // src: legacy/lib/translations/lib/ro.json:262 ("Salvează" — the submit button)
  await page.getByLabel(/^prenume|first name/i).fill('  Sorina   Ioana ');
  await page.getByLabel(/^nume|last name/i).fill(' Setar  ');
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await expect(
    page.getByText(/profilul .*a fost modificat cu succes|profile was successful?ly updated/i),
  ).toBeVisible();

  // The normalized values persist: a reload shows them stored, not the raw
  // input.
  await page.reload();
  await expect(page.getByLabel(/^prenume|first name/i)).toHaveValue('Sorina Ioana');
  await expect(page.getByLabel(/^nume|last name/i)).toHaveValue('Setar');
});

test.fixme('J10: changing the password from settings requires the CURRENT password', async ({
  page,
}) => {
  const profile = await createValidatedAccount(page);
  await page.goto('/settings/password');

  // The pane announces itself and asks for current password, new password,
  // and confirmation — all three required.
  // src: legacy/lib/settings/settings-password/template.jade:6 (h1)
  // src: legacy/lib/settings/settings-password/template.jade:10-17 (three fields)
  // src: legacy/lib/translations/lib/ro.json:229 ("Schimbă parola"),
  //      231 ("Parola curentă"), 200 ("Parola nouă"), 230 ("Confirmă parola nouă")
  await expect(
    page.getByRole('heading', { name: /schimb[ăa] parola|change password/i }),
  ).toBeVisible();
  for (const field of [
    page.getByLabel(/parol[ăa] curent[ăa]|current password/i),
    page.getByLabel(/parol[ăa] nou[ăa]|new password/i),
    page.getByLabel(/confirm[ăa] parola nou[ăa]|confirm (new )?password/i),
  ]) {
    await expect(field).toHaveJSProperty('required', true);
  }

  // The min-6 length rule and the confirm-must-match rule apply here exactly
  // as at sign-up/reset — see J1/J2 for the shared derivation (including the
  // legacy-bug that legacy enforced them client-side only; the settings
  // server route calls setPassword with whatever arrives, no length check).
  // src: legacy/lib/settings/settings-password/template.jade:11,14 (min-length:6)
  // src: legacy/lib/settings/settings-password/template.jade:17 (same:password)
  // src: legacy/lib/api/settings/index.js:55-61 (setPassword, no length check)
  // src: legacy/lib/translations/lib/ro.json:319 ("Trebuie să aibă cel puțin {n} caractere")
  await page.getByLabel(/parol[ăa] curent[ăa]|current password/i).fill(profile.password);
  await page.getByLabel(/parol[ăa] nou[ăa]|new password/i).fill('scurt');
  await page.getByLabel(/confirm[ăa] parola nou[ăa]|confirm (new )?password/i).fill('scurt');
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await expect(page.getByText(/cel puțin 6 caractere|at least 6 characters/i)).toBeVisible();

  // A WRONG current password is rejected with the invalid-password copy, and
  // the password does not change. The settings-specific gate: the route
  // re-authenticates the session's e-mail against current_password before
  // touching anything.
  // src: legacy/lib/api/settings/index.js:44-53 (auth(email, current) gate)
  // src: legacy/lib/translations/lib/ro.json:258 ("Parola curentă este invalidă")
  // legacy-bug: the rejection travels as HTTP 200 + { error }; FormView
  // renders the message but deliberately does not emit 'error' (fixes #610),
  // which makes the pane's own 403 handler dead code. Not preserved — the new
  // API answers with a real error status; the user-visible copy is the spec.
  // src: legacy/lib/form-view/form-view.js:123-127 (200+error → render, no emit)
  // src: legacy/lib/settings/settings-password/view.js:51-58 (dead 403 branch)
  await page.getByLabel(/parol[ăa] curent[ăa]|current password/i).fill('parola-gresita-j10');
  await page.getByLabel(/parol[ăa] nou[ăa]|new password/i).fill(profile.newPassword);
  await page
    .getByLabel(/confirm[ăa] parola nou[ăa]|confirm (new )?password/i)
    .fill(profile.newPassword);
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await expect(
    page.getByText(/parola curent[ăa] este invalid[ăa]|current password is invalid/i),
  ).toBeVisible();

  // With the RIGHT current password the change succeeds…
  // src: legacy/lib/api/settings/index.js:55-61 (setPassword + save)
  // src: legacy/lib/settings/settings-password/view.js:42-45 (success message)
  // src: legacy/lib/translations/lib/ro.json:259 ("Parola a fost modificată cu succes")
  // (same key J2's reset flow shows; EN carries the "successfuly" typo,
  // legacy/lib/translations/lib/en.json:394 — the regex accepts both.)
  await page.getByLabel(/parol[ăa] curent[ăa]|current password/i).fill(profile.password);
  await page.getByLabel(/parol[ăa] nou[ăa]|new password/i).fill(profile.newPassword);
  await page
    .getByLabel(/confirm[ăa] parola nou[ăa]|confirm (new )?password/i)
    .fill(profile.newPassword);
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).toBeVisible();

  // …and the new credential is real: sign out, sign back in with the new
  // password (the old one is locked out — J2 asserts that side of the coin).
  // src: legacy/lib/auth/mongoose.js:34-42 (setPassword re-derives hash+salt)
  // src: legacy/lib/api/signin/index.js:99-101 (sign-out clears the cookie)
  await page.getByRole('button', { name: /sorina/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
  await fillAndSubmitSignin(page, { email: profile.email, password: profile.newPassword });
  await expect(page.getByRole('button', { name: /sorina/i })).toBeVisible();
});

test.fixme('J10: notification preferences offer exactly two types, with legacy defaults, and toggling persists', async ({
  page,
}) => {
  await createValidatedAccount(page);
  await page.goto('/settings/notifications');

  // The pane announces itself and explains the toggles gate e-mails.
  // src: legacy/lib/settings/settings-notifications/template.jade:6,10
  // src: legacy/lib/translations/lib/ro.json:256,253 (both RO source strings
  //      carry typos — "Seteri", "Primeste" — the regexes accept corrected
  //      spellings too; fixing copy is not a behaviour change)
  await expect(
    page.getByRole('heading', { name: /set[ăae]ri pentru notific[ăa]ri|notifications? settings/i }),
  ).toBeVisible();
  await expect(page.getByText(/prime[sș]te un email c[âa]nd|get an email when/i)).toBeVisible();

  // EXACTLY TWO notification types exist end to end — the User model stores
  // exactly { replies, 'new-topic' } and the API persists exactly those two:
  // src: legacy/lib/models/user.js:36-39 (notifications shape + defaults)
  // src: legacy/lib/api/settings/index.js:69-71 (only replies + new-topic saved)
  // They correspond to the two user-facing notifier events legacy emits:
  //   'new-topic' pref ↔ the topic-published notification
  //     src: legacy/lib/api/topic/index.js:112-127 (notifier event on publish)
  //   'replies' pref ↔ the comment-reply notification
  //     src: legacy/lib/api-v2/middlewares/notifications.js:66-74 (comment-reply)
  // TODO-AMBIGUOUS: the pref→delivery gating itself lives inside the external
  // democracyos-notifier package (not in this repo), so it cannot be cited
  // here; the model's per-pref indexes are the in-repo evidence that delivery
  // queries filter on these flags.
  //     src: legacy/lib/models/user.js:51-52 (indexes on both prefs)
  // legacy-bug: the legacy view also builds a THIRD toggle, 'mentions', but
  // the template has no element for it, the model has no field for it, and
  // the API drops it — a ghost preference. Not preserved: the new app offers
  // exactly the two real types.
  // src: legacy/lib/settings/settings-notifications/view.js:54-68 (three names)
  // src: legacy/lib/settings/settings-notifications/template.jade:11-14 (only two)
  // The toggles are labelled with the event descriptions and read Da/Nu.
  // src: legacy/lib/translations/lib/ro.json:255 ("Un nou subiect este publicat"),
  //      257 ("Cineva a răspuns la unul dintre comentariile tale"),
  //      226-227 ("Nu" / "Da")
  const newTopic = page.getByRole('switch', {
    name: /un nou subiect este publicat|a new topic gets published/i,
  });
  const replies = page.getByRole('switch', {
    name: /cineva a răspuns|someone replies/i,
  });
  await expect(newTopic).toBeVisible();
  await expect(replies).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(2);

  // Defaults on a fresh account: replies ON, new-topic OFF.
  // src: legacy/lib/models/user.js:37-38 (replies default true, new-topic false)
  await expect(replies).toBeChecked();
  await expect(newTopic).not.toBeChecked();

  // Toggling new-topic on and saving persists the choice.
  // src: legacy/lib/api/settings/index.js:67-78 (POST persists both flags)
  // src: legacy/lib/settings/settings-notifications/view.js:44-48 (success)
  // legacy-bug: the legacy success message passes a raw English sentence
  // (with a typo, "notifiction") through t(); no locale file has that key, so
  // every locale shows untranslated typo'd English. Not preserved — the new
  // app shows real localized copy.
  // TODO-AMBIGUOUS: no legacy RO copy exists for this confirmation; the
  // wording below is new-design, the regex is deliberately loose.
  await newTopic.click();
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await expect(
    page.getByText(
      /set[ăa]rile .*notific[ăa]ri .*(actualizate|modificate|salvate)|notification settings .*(updated|saved)/i,
    ),
  ).toBeVisible();

  // Persisted for real, not just visually: a reload reads the stored flags.
  await page.reload();
  await expect(
    page.getByRole('switch', { name: /un nou subiect este publicat|a new topic gets published/i }),
  ).toBeChecked();
  await expect(
    page.getByRole('switch', { name: /cineva a răspuns|someone replies/i }),
  ).toBeChecked();
});

test.fixme('J10: the locale switch offers exactly Română and English, changes the UI language, and persists', async ({
  page,
}) => {
  await createValidatedAccount(page);
  await page.goto('/settings/profile');

  // The locale field lives on the profile pane, labelled "Limbă".
  // src: legacy/lib/settings/settings-profile/template.jade:18-20 (select)
  // src: legacy/lib/translations/lib/ro.json:234 ("Limbă")
  const locale = page.getByLabel(/^limb[ăa]$|^language$/i);
  await expect(locale).toBeVisible();

  // EXACTLY TWO languages are offered: Română and English.
  // src: decision C8 (grill ledger) — RO+EN only, drop the other 16 legacy
  //      locales (docs/plans/2026-08-18-democracyos-grill-decisions.md:245)
  // delta: legacy offered 18 — the select was built from
  // config.availableLocales, whose default list has 18 entries, each with an
  // RO display name:
  // src: legacy/lib/settings/settings-profile/view.js:27-36 (options from config)
  // src: legacy/config/defaults.json:135-154 (the 18-locale list, ca…zh_TW)
  // src: legacy/lib/translations/lib/ro.json:235-252 (18 settings.locale.* labels)
  // Option display names from the legacy locale files:
  // src: legacy/lib/translations/lib/ro.json:247 ("Română"), 237 ("Engleză")
  // src: legacy/lib/translations/lib/en.json:382 ("Romanian"), 372 ("English")
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('option', { name: /român[ăa]|romanian/i })).toBeVisible();
  await expect(page.getByRole('option', { name: /englez[ăa]|english/i })).toBeVisible();

  // A fresh account starts in Romanian — RO is the new app's default locale.
  // src: docs/plans/2026-08-18-democracyos-revival-plan.md:606 (WU-M6-12,
  //      "RO is the default locale")
  // (Legacy instead fell back to config.locale / the Accept-Language header
  // when the user had no stored locale:
  // src: legacy/lib/settings/settings-profile/view.js:34 (user.locale || config)
  // src: legacy/lib/l10n/index.js:8-12,23-26 (accept-language inference))
  await expect(page.getByRole('heading', { name: /^profil$/i })).toBeVisible();

  // Switching to English and saving changes the UI language. Legacy persisted
  // the choice to user.locale and force-reloaded the page when the saved
  // locale differed from the rendered one.
  // src: legacy/lib/api/settings/index.js:24 (user.locale = req.body.locale)
  // src: legacy/lib/models/user.js:18 (locale is a first-class user field)
  // src: legacy/lib/settings/settings-profile/view.js:63-67 (reload on change)
  await locale.selectOption({ label: 'English' });
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^profil$/i })).not.toBeVisible();

  // The locale PERSISTS across a reload: it is stored on the user, and the
  // server prefers the user's stored locale over everything except an
  // instance-wide enforceLocale override.
  // src: legacy/lib/l10n/index.js:14-31 (req.user.locale wins, lines 20-22)
  await page.reload();
  await expect(page.getByRole('heading', { name: /^profile$/i })).toBeVisible();

  // And back: RO ↔ EN is symmetric.
  await locale.selectOption({ label: 'Română' });
  await page.getByRole('button', { name: /salveaz[ăa]|save/i }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^profil$/i })).toBeVisible();
});

test.fixme('J10: settings expose the data-subject rights — access, portability, erasure (NEW, no legacy analogue)', async ({
  page,
  users,
}) => {
  // NEW requirements with NO legacy counterpart. The platform is a public
  // Romanian civic service processing Art. 9 political-opinion data, and the
  // settings surface is where a signed-in person exercises GDPR data-subject
  // rights: access + portability (an export of their data) and erasure.
  // src: decision E2/E3 (grill ledger) — consent-centric lawful basis + DPIA
  //      (docs/plans/2026-08-18-democracyos-grill-decisions.md:224-226,245)
  // src: decision G-3 (grill ledger) — "full GDPR compliance … data-subject
  //      rights flows" in scope from day one
  // src: docs/plans/2026-08-18-democracyos-revival-plan.md:608 (WU-M6-14,
  //      gdpr/{export.ts,erase.ts} — access/portability/erasure)
  // delta (the "no legacy analogue" evidence): legacy settings offered ONLY
  // profile / password / notifications (+ role-gated forums, staff badges) —
  // no export, no erasure, no consent surface anywhere in the app.
  // src: legacy/lib/settings/settings/settings-container.jade:4-17 (full menu)
  // src: legacy/lib/api/settings/index.js:17,42,67,80 (all four endpoints)
  //
  // Presence-only assertions: this journey must not trigger an erasure.
  // Deep flows (export content, erasure semantics, tally survival) belong to
  // journey J14 (plan §4.8: "J14 data-subject export/erasure").
  // All accessible names below are new-design (Romanian primary, EN fallback).
  const ana = users.participant;
  await fillAndSubmitSignin(page, { email: ana.email, password: ana.password });
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();

  await page.goto('/settings');
  // The settings navigation offers a data-and-privacy area…
  await page.getByRole('link', { name: /confidențialitate|datele mele|privacy|my data/i }).click();

  // …with the three rights controls:
  // 1. Access + portability: export/download my data (GDPR Art. 15 + 20).
  await expect(
    page.getByRole('button', {
      name: /exportă datele|descarcă datele|export.*data|download.*data/i,
    }),
  ).toBeVisible();
  // 2. Erasure: delete my account (GDPR Art. 17). Erasure semantics are
  //    already decided for the account itself: identity dies, the
  //    pseudonymous aggregates and the audit chain survive.
  //    src: docs/plans/2026-08-18-democracyos-revival-plan.md:608 (WU-M6-14)
  await expect(
    page.getByRole('button', { name: /șterge(re)? cont(ul)?|delete.*account/i }),
  ).toBeVisible();
  // 3. Consent management entry (granular, versioned, withdrawable).
  //    src: docs/plans/2026-08-18-democracyos-revival-plan.md:607 (WU-M6-13)
  await expect(page.getByText(/consimțământ|consent/i)).toBeVisible();

  // Erasure must be guarded — a destructive control that fires on a single
  // click would fail the platform's own bar for Art. 9 data. Asserted here
  // only as: the delete control does not erase without an explicit
  // confirmation step. (New-design; the confirmation copy is not pinned.)
  await page.getByRole('button', { name: /șterge(re)? cont(ul)?|delete.*account/i }).click();
  await expect(page.getByText(/confirm|sigur|ireversibil|permanent/i)).toBeVisible();
  await page.getByRole('button', { name: /anulează|renunț[ăa]|cancel/i }).click();
});

test.fixme('J10: consent withdrawal for voting/opinions exists and STATES its effect (semantics: open decision)', async ({
  page,
  users,
}) => {
  // NEW requirement, no legacy analogue (same delta evidence as above:
  // legacy/lib/settings/settings/settings-container.jade:4-17 — no consent
  // surface exists anywhere in legacy). Voting/opinion data is Art. 9
  // special-category data processed on explicit granular consent, and consent
  // that cannot be withdrawn as easily as it was given is not valid consent —
  // so the settings surface must offer withdrawal for voting/opinions
  // specifically.
  // src: decision E1/E2 (grill ledger) — Art. 9 votes; lawful basis =
  //      explicit granular consent for voting/opinions
  //      (docs/plans/2026-08-18-democracyos-grill-decisions.md:224-225,245)
  // src: docs/plans/2026-08-18-democracyos-revival-plan.md:607 (WU-M6-13 —
  //      consent "versioned, withdrawable, auditable")
  //
  // TODO-AMBIGUOUS (deliberately unpinned): WHAT withdrawal does to
  // already-cast ballots — delete them, anonymize them, or exclude them from
  // tallies — is an OPEN user decision. It is not settled by any ledger row:
  // WU-M6-14 fixes ACCOUNT-erasure semantics (identity dies, pseudonymous
  // aggregate + audit chain survive), but withdrawal-of-consent is a distinct
  // event the ledger leaves undecided. This spec therefore asserts ONLY that
  // the control exists and states its effect to the user — never WHICH effect.
  // When the decision lands, a follow-up assertion pins it (a reviewed
  // docs/CHARACTERIZATION.md / ledger change, never a quiet edit).
  const ana = users.participant;
  await fillAndSubmitSignin(page, { email: ana.email, password: ana.password });
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('link', { name: /confidențialitate|datele mele|privacy|my data/i }).click();

  // The withdrawal control names its subject: consent for voting/opinions.
  // (New-design accessible name, Romanian primary.)
  await expect(
    page.getByRole('button', {
      name: /retrage consimțământul.*(vot|opini)|withdraw consent.*(vot|opinion)/i,
    }),
  ).toBeVisible();

  // The control (or its immediate context) STATES what withdrawal will do to
  // existing votes/opinions — the user must not have to withdraw to find out.
  // The regex accepts any of the three candidate semantics plus a generic
  // effect statement, because the choice among them is the open decision.
  await expect(
    page.getByText(
      /voturile (tale )?(vor fi|rămân|sunt) .*(șterse|anonimizate|excluse|păstrate)|your votes (will be|are|remain) .*(deleted|anonymi[sz]ed|excluded|kept)/i,
    ),
  ).toBeVisible();

  // Withdrawal is not exercised here — doing so would mutate an immutable
  // fixture account (e2e/fixtures/users.ts:38-40) and its semantics are the
  // open decision above. The acting flow lands with J14 and the decision.
});
