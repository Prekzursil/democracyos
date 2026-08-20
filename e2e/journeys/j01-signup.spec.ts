// J1 — sign-up → email validation → sign-in → sign-out (WU-M1-2, plan §4.2).
//
// Characterization spec derived by READING legacy source (never by observing a
// running system). Every assertion cites the legacy file:lines it was derived
// from; behaviours that are NEW (not in legacy) cite the decision log instead.
// All tests are quarantined with test.fixme until activation (SPEC-LEDGER row
// J1: activate at M4 via WU-M4-4, re-point at the real UI at WU-M5-4).
//
// Route names used with page.goto() are the legacy URL structure, adopted as
// the spec'd routes for the new app:
//   /signup, /signup/validate/:token, /signup/resend-validation-email, /signin
//   // src: legacy/lib/site/boot/router.js:34-48
//   // src: legacy/lib/api/signup/lib/signup.js:172-175 (validate URL shape)
//
// Accessible names are defined HERE, in Romanian with English fallback
// (e2e/README.md pattern) — the new UI must implement them (WCAG seeding, N16).
// Romanian copy is taken from the legacy RO locale where it exists
// (legacy/lib/translations/lib/ro.json); where the RO key is missing the
// assertion is marked TODO-AMBIGUOUS and the regex accepts the EN string too.
//
// Transport note for M4 (API-level activation): legacy reports most signin /
// validate failures as HTTP 200 + { error } bodies
// (legacy/lib/api/signin/index.js:28,47,52-57; legacy/lib/api/signup/index.js:56).
// legacy-bug: errors delivered as HTTP 200, not preserved — the new API uses
// real error statuses; this journey asserts only the user-visible outcome, so
// its assertions survive that fix — see docs/CHARACTERIZATION.md.

import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/app.js';

// J1 creates its own accounts — fixture users stay immutable
// (e2e/fixtures/users.ts:15-17; docs/develop/fixtures.md "Users").
// Synthetic values only, never personal data (§4.1).
function uniqueSignupProfile() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    firstName: 'Ionel',
    lastName: 'Jurnal',
    email: `j1-${stamp}@example.test`,
    password: 'parola-sintetica-j1',
    // Adult date of birth — the age-16 gate is a NEW requirement.
    // src: decision G-3/E4 (grill ledger)
    birthDate: '1990-01-01',
  };
}

/** An ISO date that makes the subject `years` old today (for the age gate). */
function birthDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + 1); // one day short of the birthday → still `years - 1`
  return d.toISOString().slice(0, 10);
}

type SignupProfile = ReturnType<typeof uniqueSignupProfile>;

// Fills and submits the sign-up form. Field set and requiredness derived from
// the legacy form: email / firstName / lastName / password / re_password, all
// required. src: legacy/lib/site/sign-up/component.js:138-194
// Labels: RO copy from legacy/lib/translations/lib/ro.json:282,300,301,199,294.
// The birth-date field is NEW. src: decision G-3/E4 (grill ledger)
async function fillAndSubmitSignup(page: Page, profile: SignupProfile) {
  await page.goto('/signup');
  await page.getByLabel(/email/i).fill(profile.email);
  await page.getByLabel(/^prenume|first name/i).fill(profile.firstName);
  await page.getByLabel(/^nume|last name/i).fill(profile.lastName);
  await page.getByLabel(/data nașterii|date of birth/i).fill(profile.birthDate);
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(profile.password);
  await page.getByLabel(/retipărește parola|retype password/i).fill(profile.password);
  await page.getByRole('button', { name: /înregistr.*acum|sign ?up/i }).click();
}

// Fills and submits the sign-in form.
// Fields: email + password, both required. src: legacy/lib/site/sign-in/component.js:83-112
// Submit button: legacy RO uses "Login" (ro.json:273); the new accessible name
// is defined here as Autentificare with legacy/EN fallbacks.
async function fillAndSubmitSignin(page: Page, creds: { email: string; password: string }) {
  await page.goto('/signin');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(creds.password);
  await page.getByRole('button', { name: /autentificare|sign ?in|login/i }).click();
}

// Activation-time infrastructure: the validation link only exists inside the
// welcome e-mail (legacy/lib/api/signup/lib/signup.js:168-187). WU-M4-4 must
// provide a mail-capture fixture this helper reads from; until then the
// journey stays pending and this stub keeps the contract visible.
function validationLinkFromMailbox(_email: string): Promise<string> {
  return Promise.reject(
    new Error('pending: mail-capture fixture lands with WU-M4-4 (J1 activation)'),
  );
}

test.fixme('J1: sign-up with the required fields lands on the check-your-email screen', async ({
  page,
}) => {
  const profile = uniqueSignupProfile();

  // The sign-up page announces itself.
  // src: legacy/lib/site/sign-up/component.js:108-114 (t('signup.with-email'))
  // src: legacy/lib/translations/lib/ro.json:299 ("Înregistreaza-te cu emailul")
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: /înregistr|sign ?up/i })).toBeVisible();

  // All five legacy fields are required; the new birth-date field is too.
  // src: legacy/lib/site/sign-up/component.js:138-194 (required on every input)
  // src: decision G-3/E4 (grill ledger) — birth date
  for (const field of [
    page.getByLabel(/email/i),
    page.getByLabel(/^prenume|first name/i),
    page.getByLabel(/^nume|last name/i),
    page.getByLabel(/data nașterii|date of birth/i),
    page.getByLabel(/^parol[aă]$|^password$/i),
    page.getByLabel(/retipărește parola|retype password/i),
  ]) {
    await expect(field).toHaveJSProperty('required', true);
  }

  await fillAndSubmitSignup(page, profile);

  // Success = the "congrats" screen: welcome by name, data received, check
  // your e-mail, and a resend-validation link. The account is NOT signed in
  // yet — emailValidated defaults to false and no session is created.
  // src: legacy/lib/site/sign-up/component.js:241-254 (congrats screen)
  // src: legacy/lib/translations/lib/ro.json:297,290,280,292
  // src: legacy/lib/models/user.js:26 (emailValidated default false)
  // src: legacy/lib/api/signup/index.js:27-44 (signup responds 200, no cookie)
  await expect(page.getByText(/bine ai venit/i)).toBeVisible();
  await expect(page.getByText(/datele de înregistrare au fost recepționate/i)).toBeVisible();
  await expect(page.getByText(/verifica(ți|ţi)? .*adresa .*email|check .*email/i)).toBeVisible();
  await expect(
    page.getByRole('link', { name: /retrimite emailul de validare|resend/i }),
  ).toBeVisible();

  // legacy-bug: in development environments legacy silently skips the e-mail
  // gate entirely (user.emailValidated = true at signup), not preserved — the
  // new app always requires validation — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/signup/lib/signup.js:36
});

test.fixme('J1: sign-up enforces the password rules (min 6, retype must match)', async ({
  page,
}) => {
  const profile = uniqueSignupProfile();
  await page.goto('/signup');

  // Password shorter than 6 characters is rejected with the min-length copy.
  // legacy-bug: legacy enforces the 6-char minimum ONLY client-side
  // (setCustomValidity); the server accepts any length, not preserved — the
  // new app enforces it server-side too — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/site/sign-up/component.js:76-88 (checkPassLength, n = 6)
  // src: legacy/lib/translations/lib/ro.json:319 ("Trebuie să aibă cel puțin {n} caractere")
  await page.getByLabel(/^parol[aă]$|^password$/i).fill('scurt');
  await page.getByLabel(/retipărește parola|retype password/i).fill('scurt');
  await page.getByRole('button', { name: /înregistr.*acum|sign ?up/i }).click();
  await expect(page.getByText(/cel puțin 6 caractere|at least 6 characters/i)).toBeVisible();

  // Retyped password must match the first one.
  // TODO-AMBIGUOUS: ro.json has no "common.pass-match-error" key — only EN
  // exists ("Don't match.", legacy/lib/translations/lib/en.json:224). The
  // Romanian wording is therefore new-design; the regex accepts both.
  // src: legacy/lib/site/sign-up/component.js:82-84 (re_password mismatch)
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(profile.password);
  await page.getByLabel(/retipărește parola|retype password/i).fill(`${profile.password}-alta`);
  await page.getByRole('button', { name: /înregistr.*acum|sign ?up/i }).click();
  await expect(
    page.getByText(/parolele nu (se potrivesc|coincid)|do(n'?t| not) match/i),
  ).toBeVisible();
});

test.fixme('J1: sign-up rejects an applicant under 16 (age gate)', async ({ page }) => {
  // NEW requirement, no legacy counterpart: Romania kept the GDPR default
  // age of digital consent, so the platform refuses accounts under 16.
  // The rejection copy is new-design and defined here.
  // src: decision G-3/E4 (grill ledger)
  const profile = { ...uniqueSignupProfile(), birthDate: birthDateYearsAgo(15) };
  await fillAndSubmitSignup(page, profile);

  await expect(page.getByText(/cel puțin 16 ani|at least 16/i)).toBeVisible();
  // No account is created — the check-your-email screen never appears.
  await expect(page.getByText(/datele de înregistrare au fost recepționate/i)).not.toBeVisible();
});

test.fixme('J1: sign-up with an already-registered e-mail is rejected', async ({ page, users }) => {
  // TODO-AMBIGUOUS: e-mail uniqueness is enforced by the passport-local-
  // mongoose plugin (usernameField: 'email' → User.register raises
  // UserExistsError), whose message text lives in the dependency, not in this
  // repo — the exact user-facing copy cannot be derived from source. The
  // BEHAVIOUR (second registration with the same e-mail fails, no duplicate
  // account) is unambiguous; the wording below is new-design.
  // src: legacy/lib/auth/mongoose.js:9-24 (plugin config, usernameField email)
  // src: legacy/lib/api/signup/lib/signup.js:40-46 (User.register error → 400)
  const profile = { ...uniqueSignupProfile(), email: users.participant.email };
  await fillAndSubmitSignup(page, profile);

  await expect(
    page.getByText(/există deja un cont|already (registered|exists|in use)/i),
  ).toBeVisible();
  await expect(page.getByText(/datele de înregistrare au fost recepționate/i)).not.toBeVisible();
});

test.fixme('J1: sign-in before validating the e-mail is refused, with a resend link', async ({
  page,
}) => {
  const profile = uniqueSignupProfile();
  await fillAndSubmitSignup(page, profile);

  // The gate: a correct password on an unvalidated account does NOT sign in.
  // src: legacy/lib/api/signin/index.js:52-57 (emailValidated check, code EMAIL_NOT_VALIDATED)
  // src: legacy/lib/translations/lib/ro.json:221 ("…nu este validată…")
  await fillAndSubmitSignin(page, { email: profile.email, password: profile.password });
  await expect(page.getByText(/nu este validată|not.*validated/i)).toBeVisible();

  // The refusal offers the resend-validation path.
  // src: legacy/lib/site/sign-in/component.js:46-52,76-82 (showResend on EMAIL_NOT_VALIDATED)
  // src: legacy/lib/translations/lib/ro.json:292 ("Retrimite emailul de validare")
  await expect(
    page.getByRole('link', { name: /retrimite emailul de validare|resend/i }),
  ).toBeVisible();

  // Still signed out: the header offers sign-in, not the user menu.
  // src: legacy/lib/api/signin/index.js:52-57 (next() never reached, no jwt cookie)
  await page.goto('/');
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).toBeVisible();
});

test.fixme('J1: the e-mailed validation link validates the account, exactly once', async ({
  page,
}) => {
  const profile = uniqueSignupProfile();
  await fillAndSubmitSignup(page, profile);

  // The welcome e-mail carries /signup/validate/<tokenId>. The token is
  // single-purpose, per-user (re-issuing deletes previous ones) and carries
  // scope 'email-validation'.
  // src: legacy/lib/api/signup/lib/signup.js:168-187 (token + validateUrl)
  // src: legacy/lib/db-api/token.js:62-65,81-106 (scope, delete-then-create)
  // src: legacy/lib/models/token.js:5-10 (scope enum, user ref, createdAt)
  const validateUrl = await validationLinkFromMailbox(profile.email);

  // Visiting the link validates the e-mail, consumes the token, signs the
  // user in, and shows the welcome screen.
  // src: legacy/lib/api/signup/lib/signup.js:110-136 (emailValidated=true; token.remove)
  // src: legacy/lib/api/signup/index.js:50-60 (addPrivileges → jwt.signin cookie)
  // src: legacy/lib/site/resend/component.js:19-36,146-168 (auto-post; welcome screen)
  // src: legacy/lib/translations/lib/ro.json:297,284,289
  await page.goto(validateUrl);
  await expect(page.getByText(/bine ai venit/i)).toBeVisible();
  await expect(page.getByText(/emailul tău a fost validat/i)).toBeVisible();
  await expect(page.getByText(/acum poți să argumentezi și să votezi/i)).toBeVisible();

  // legacy-bug: emailValidate looks the token up by id only and never checks
  // token.scope — a password-reset token id would validate an e-mail. Not
  // preserved: the new app accepts only scope email-validation tokens here —
  // see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/signup/lib/signup.js:110-136 (no scope check)

  // Single use: the same link a second time must fail, offering resend.
  // src: legacy/lib/api/signup/lib/signup.js:128-132 (token.remove after use)
  // src: legacy/lib/site/resend/component.js:26-28 (error → back to resend form)
  // legacy-bug: legacy's failure copy is the generic "There was an error."
  // (legacy/lib/translations/lib/en.json:219; no RO key), not preserved — the
  // new UI names the problem (link invalid/expirat) — see docs/CHARACTERIZATION.md.
  await page.goto(validateUrl);
  await expect(page.getByText(/link.*(invalid|expirat)|invalid|expired/i)).toBeVisible();
  await expect(page.getByText(/retrimite emailul de validare|resend/i)).toBeVisible();

  // delta (schema design, not legacy): the legacy Token has NO expiry — only
  // createdAt, no TTL index, and emailValidate never checks age, so a
  // validation link works forever. The new schema adds expiresAt and the
  // validate endpoint must refuse an expired token the same way it refuses a
  // consumed one (asserted above via the shared invalid/expirat copy).
  // src: legacy/lib/models/token.js:5-14 (no expiry field, no TTL index)
  // src: legacy/lib/api/signup/lib/signup.js:110-136 (no age/expiry check)
});

test.fixme('J1: sign-in with valid credentials starts a persistent session', async ({
  page,
  users,
}) => {
  // Fixture accounts are pre-validated (e2e/fixtures/users.ts:15-17), so ana
  // passes the e-mail gate.
  const ana = users.participant;

  // E-mail matching is case-insensitive: both sides normalize to lowercase.
  // src: legacy/lib/normalize-email/normalize-email.js:3-11 (toLowerCase)
  // src: legacy/lib/api/signin/index.js:26 (signin normalizes the input)
  // src: legacy/lib/models/user.js:19-25,129-132 (lowercase on store)
  await fillAndSubmitSignin(page, { email: ana.email.toUpperCase(), password: ana.password });

  // Success: redirected to the home page, header shows the user badge with
  // the user's first name instead of the sign-in link.
  // src: legacy/lib/site/sign-in/component.js:33-44 (redirect to / on success)
  // src: legacy/lib/header/user-badge/component.js:73-79 (badge shows firstName)
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).not.toBeVisible();

  // The session survives a reload — it lives in an httpOnly cookie session,
  // not in page state. (Legacy: 15-day JWT, refreshed when <1 day remains;
  // those durations are implementation detail, the persistence is the spec.)
  // src: legacy/lib/jwt/index.js:8-10,20-24 (httpOnly cookie on signin)
  // src: legacy/lib/jwt/token.js:6-18 (15-day expiry)
  // src: legacy/lib/jwt/index.js:26-72 (cookie → user on every request)
  await page.reload();
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();
});

test.fixme('J1: sign-in rejects a wrong password and an unknown e-mail with the same message', async ({
  page,
  users,
}) => {
  // Anti-enumeration is legacy-intended behaviour worth preserving: wrong
  // password and unknown e-mail produce the IDENTICAL generic message.
  // TODO-AMBIGUOUS: ro.json has no signin.errors.incorrect-password /
  // incorrect-username keys — only EN exists ("Password or email are
  // incorrect", legacy/lib/translations/lib/en.json:412-413). The Romanian
  // wording is new-design; the regex accepts both.
  // src: legacy/lib/auth/mongoose.js:14-19 (both errors mapped to the same pair)
  const rejection = /parola sau emailul .*(incorect|greșit)|password or email are incorrect/i;

  // Wrong password on an existing, validated account.
  // src: legacy/lib/api/signin/index.js:27-50 (auth failure → info.message shown)
  await fillAndSubmitSignin(page, {
    email: users.participant.email,
    password: 'parola-gresita-j1',
  });
  await expect(page.getByText(rejection)).toBeVisible();

  // Unknown e-mail: same message, no account-existence oracle.
  // src: legacy/lib/api/signin/index.js:30-49 (no-user path → same copy)
  // src: legacy/lib/auth/mongoose.js:17-18 (IncorrectPassword ≡ IncorrectUsername)
  await fillAndSubmitSignin(page, {
    email: 'nimeni-inexistent@example.test',
    password: 'orice-parola',
  });
  await expect(page.getByText(rejection)).toBeVisible();

  // Either way, still signed out.
  await page.goto('/');
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).toBeVisible();
});

test.fixme('J1: sign-out from the user menu ends the session', async ({ page, users }) => {
  const ana = users.participant;
  await fillAndSubmitSignin(page, { email: ana.email, password: ana.password });
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();

  // Sign-out lives in the user-badge menu, labelled "Deconectare".
  // src: legacy/lib/header/user-badge/component.js:73-79,98-102 (menu + logout entry)
  // src: legacy/lib/translations/lib/ro.json:153 ("Deconectare")
  await page.getByRole('button', { name: /ana/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();

  // The session cookie is cleared and the UI returns to the signed-out state.
  // src: legacy/lib/api/signin/index.js:99-101 (DELETE /signin clears the cookie)
  // src: legacy/lib/site/user/user.js:67-78 (client drops the user on logout)
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /ana/i })).not.toBeVisible();

  // Signed out for real, not just visually: a reload stays signed out.
  // src: legacy/lib/jwt/index.js:26-72 (no cookie → no user on the request)
  await page.reload();
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).toBeVisible();
});
