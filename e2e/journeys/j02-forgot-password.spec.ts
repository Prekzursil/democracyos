// J2 — forgot password → reset → sign-in with the new password (WU-M1-3, plan §4.2).
//
// Characterization spec derived by READING legacy source (never by observing a
// running system). Every assertion cites the legacy file:lines it was derived
// from; behaviours that are NEW (not in legacy) cite the decision log or are
// flagged as schema deltas. All tests are quarantined with test.fixme until
// activation (SPEC-LEDGER row J2: activate at M4 via WU-M4-5, re-point at the
// real UI at WU-M5-4).
//
// Route names used with page.goto() are the legacy URL structure, adopted as
// the spec'd routes for the new app:
//   /forgot (request form), /forgot/reset/:token (set-new-password form)
//   // src: legacy/lib/site/boot/router.js:49-56
//   // src: legacy/lib/api/forgot/lib/forgotpassword.js:49 (resetUrl shape)
// API routes (M4 activation surface): POST /forgot, POST /forgot/verify,
// POST /forgot/reset. // src: legacy/lib/api/forgot/index.js:19-57
//
// Accessible names are defined HERE, in Romanian with English fallback
// (e2e/README.md pattern) — the new UI must implement them (WCAG seeding, N16).
// Romanian copy is taken from the legacy RO locale where it exists
// (legacy/lib/translations/lib/ro.json); where an RO key is missing the
// assertion is marked TODO-AMBIGUOUS and the regex accepts the EN string too.
//
// Transport note for M4 (API-level activation): legacy reports an unknown
// e-mail as HTTP 200 + { error } and every other forgot/reset failure as
// HTTP 500 + { error } (legacy/lib/api/forgot/index.js:29-42,45-50,52-57 —
// the route's own FIXME comments call this a "horrible hack").
// legacy-bug: errors delivered as 200/500 blankets, not preserved — the new
// API uses real error statuses; this journey asserts only the user-visible
// outcome, so its assertions survive that fix — see docs/CHARACTERIZATION.md.
//
// Signed-out-only routes: legacy redirects an authenticated visitor away from
// /forgot (and its children) to the home page.
// src: legacy/lib/site/boot/router.js:49-56 (onEnter: restrictLoggedin)
// src: legacy/lib/site/boot/router.js:86-91 (restrictLoggedin → window.location = '/')

import { expect, test } from '../fixtures/app';

type PageT = import('@playwright/test').Page;

// J2 resets passwords, so it NEVER uses fixture accounts for the mutating
// steps — fixtures stay immutable (e2e/fixtures/users.ts:38-40;
// docs/develop/fixtures.md "Users"). Fixture accounts appear only in
// non-mutating steps (requesting a reset e-mail; signing in unchanged).
// Synthetic values only, never personal data (§4.1).
function uniqueResetProfile() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    firstName: 'Rodica',
    lastName: 'Resetescu',
    email: `j2-${stamp}@example.test`,
    oldPassword: 'parola-veche-j2-sintetica',
    newPassword: 'parola-noua-j2-sintetica',
    // Adult date of birth — the age-16 gate is a NEW requirement.
    // src: decision G-3/E4 (grill ledger)
    birthDate: '1990-01-01',
  };
}

// --- Helpers reused from the J1 house style (j01-signup.spec.ts) -----------

// Fills and submits the sign-up form. Field set and requiredness derived from
// the legacy form: email / firstName / lastName / password / re_password, all
// required. src: legacy/lib/site/sign-up/component.js:138-194
// Labels: RO copy from legacy/lib/translations/lib/ro.json:282,300,301,199,294.
// The birth-date field is NEW. src: decision G-3/E4 (grill ledger)
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

// Fills and submits the sign-in form.
// Fields: email + password, both required. src: legacy/lib/site/sign-in/component.js:83-112
// Submit button: legacy RO uses "Login" (ro.json:273); the new accessible name
// is defined here as Autentificare with legacy/EN fallbacks (J1 convention).
async function fillAndSubmitSignin(page: PageT, creds: { email: string; password: string }) {
  await page.goto('/signin');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/^parol[aă]$|^password$/i).fill(creds.password);
  await page.getByRole('button', { name: /autentificare|sign ?in|login/i }).click();
}

// --- J2's own helpers -------------------------------------------------------

// Requests a password reset from the /forgot form.
// Form: single required e-mail field labelled with the signup e-mail key,
// submit button t('forgot.reset').
// src: legacy/lib/site/forgot/component.js:68-77 (email input, required)
// src: legacy/lib/site/forgot/component.js:79-91 (submit, t('forgot.reset'))
// src: legacy/lib/translations/lib/ro.json:137 ("Resetează Parola!")
async function requestPasswordReset(page: PageT, email: string) {
  await page.goto('/forgot');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /reseteaz[ăa] parola|reset password/i }).click();
}

// Opens a reset link and submits a new password (typed twice).
// Form: two required password fields + send button.
// src: legacy/lib/site/reset/component.js:90-110 (password + re_password, required)
// src: legacy/lib/site/reset/component.js:111-124 (submit, t('form.send'))
// src: legacy/lib/translations/lib/ro.json:200,202,139 ("Parola nouă",
//      "Scrie parola din nou", "Trimite")
async function submitNewPassword(page: PageT, resetUrl: string, password: string) {
  await page.goto(resetUrl);
  await page.getByLabel(/parol[ăa] nou[ăa]|new password/i).fill(password);
  await page.getByLabel(/scrie parola din nou|retype (new )?password/i).fill(password);
  await page.getByRole('button', { name: /^trimite$|^send$/i }).click();
}

// Activation-time infrastructure: the reset link only exists inside the
// forgot-password e-mail (legacy/lib/api/forgot/lib/forgotpassword.js:44-58 —
// notifier event 'forgot-password' with { to, resetUrl }). WU-M4-5 must
// provide a mail-capture fixture this helper reads from; until then the
// journey stays pending and this stub keeps the contract visible.
function resetLinkFromMailbox(_email: string): Promise<string> {
  return Promise.reject(
    new Error('pending: mail-capture fixture lands with WU-M4-5 (J2 activation)'),
  );
}

// Same stub for the signup validation link (J1 contract, reused here to mint
// a validated account J2 may safely mutate).
// src: legacy/lib/api/signup/lib/signup.js:168-187 (token + validateUrl)
function validationLinkFromMailbox(_email: string): Promise<string> {
  return Promise.reject(
    new Error('pending: mail-capture fixture lands with WU-M4-4/WU-M4-5 (mail capture)'),
  );
}

// Signs up a fresh account and validates its e-mail — the precondition for a
// password reset, because legacy refuses to issue reset tokens for
// unvalidated accounts.
// src: legacy/lib/api/forgot/lib/forgotpassword.js:36-40 (emailValidated gate)
// src: legacy/lib/api/signup/lib/signup.js:110-136 (validate flips emailValidated)
async function createValidatedAccount(page: PageT) {
  const profile = uniqueResetProfile();
  await fillAndSubmitSignup(page, profile, profile.oldPassword);
  const validateUrl = await validationLinkFromMailbox(profile.email);
  await page.goto(validateUrl);
  // Validating also signs the user in (J1) — sign out so the signed-out-only
  // /forgot route is reachable (router.js:49-56 restrictLoggedin).
  // src: legacy/lib/api/signup/index.js:50-60 (validate → jwt.signin cookie)
  // src: legacy/lib/api/signin/index.js:99-101 (DELETE /signin clears the cookie)
  await page.getByRole('button', { name: /rodica/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
  return profile;
}

/** Extracts the token id from a reset URL: /forgot/reset/:token.
 *  src: legacy/lib/api/forgot/lib/forgotpassword.js:49 (resetUrl shape)
 *  src: legacy/lib/site/boot/router.js:53-55 (reset/:token route) */
function tokenIdFromResetUrl(resetUrl: string): string {
  const id = resetUrl.split('/').at(-1);
  if (!id) throw new Error(`no token id in reset url: ${resetUrl}`);
  return id;
}

// ---------------------------------------------------------------------------

test.fixme('J2: requesting a reset for a known validated e-mail shows the sent confirmation', async ({
  page,
  users,
}) => {
  // Requesting a reset does not mutate the account (it only mints a token),
  // so the immutable fixture participant is safe to use here.
  const ana = users.participant; // emailValidated: true (e2e/fixtures/users.ts:56-63)

  // The forgot page announces itself with the question heading and explains
  // what will happen.
  // src: legacy/lib/site/forgot/component.js:47 (h1 t('forgot.question'))
  // src: legacy/lib/translations/lib/ro.json:136 ("Ai uitat parola?")
  // src: legacy/lib/site/forgot/component.js:49-51 (t('forgot.explanation'))
  // src: legacy/lib/translations/lib/ro.json:133 ("Îți vom trimite un email…")
  await page.goto('/forgot');
  await expect(page.getByRole('heading', { name: /ai uitat parola|forgot password/i })).toBeVisible();
  await expect(
    page.getByText(/link pentru resetarea parolei|link to reset your password/i),
  ).toBeVisible();

  // The single e-mail field is required.
  // src: legacy/lib/site/forgot/component.js:70-77 (type email, required)
  await expect(page.getByLabel(/email/i)).toHaveJSProperty('required', true);

  // E-mail matching is case-insensitive: the server normalizes the request
  // to lowercase before the lookup, exactly like signin.
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:31 (normalizeEmail)
  // src: legacy/lib/normalize-email/normalize-email.js:3-11 (toLowerCase)
  await requestPasswordReset(page, ana.email.toUpperCase());

  // Success: the form is replaced by the sent confirmation.
  // src: legacy/lib/site/forgot/component.js:27-33 (onSuccess → success: true)
  // src: legacy/lib/site/forgot/component.js:52-57 (success message; form hidden)
  // src: legacy/lib/translations/lib/ro.json:135 ("Tocmai ți-am trimis un email…")
  await expect(
    page.getByText(/tocmai ți-am trimis un email|we just sent a message/i),
  ).toBeVisible();

  // The token minted for that e-mail carries scope 'password-reset' — it is a
  // reset credential and nothing else (asserted end-to-end in the cross-scope
  // test below).
  // src: legacy/lib/db-api/token.js:45-48 (createPasswordResetToken → 'password-reset')
  // src: legacy/lib/models/token.js:7 (scope enum ['password-reset', 'email-validation'])
});

test.fixme('J2: an unknown e-mail gets the SAME confirmation — no account-existence oracle', async ({
  page,
}) => {
  // legacy-bug: legacy is an enumeration ORACLE here, not preserved. For an
  // unknown address the server answers HTTP 200 + { error: "No user found for
  // that email address <the address>" } — echoing the address back — and the
  // UI prints that error verbatim, so anyone can probe which e-mails have
  // accounts. Deliberate fix (docs/CHARACTERIZATION.md): the new app answers
  // an unknown e-mail with the IDENTICAL sent confirmation as a known one and
  // sends nothing.
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:35 (no-user error + email)
  // src: legacy/lib/api/forgot/index.js:36-38 (delivered as HTTP 200 + error)
  // src: legacy/lib/site/forgot/component.js:35-37,61-67 (UI renders the error list)
  // src: legacy/lib/translations/lib/ro.json:127 (the leaked copy, RO)
  // src: legacy/lib/translations/lib/en.json:221 (the leaked copy, EN)
  await requestPasswordReset(page, 'nimeni-inexistent-j2@example.test');

  await expect(
    page.getByText(/tocmai ți-am trimis un email|we just sent a message/i),
  ).toBeVisible();
  await expect(
    page.getByText(/niciun utilizator nu a fost găsit|no user found for that email/i),
  ).not.toBeVisible();

  // legacy-bug (same oracle, second branch, also not preserved): an existing
  // but UNVALIDATED account is answered with HTTP 500 + the distinct copy
  // "forgot.error.email-not-valid" and status 'notvalidated' — a second way
  // to distinguish accounts. (Two asides, both cited: the error message is
  // the raw i18n KEY, never passed through t() — compare line 35 which does
  // translate — and no client code consumes the 'notvalidated' status; the
  // redirection its FIXME comment wants was never built.) The new app shows
  // the uniform sent confirmation for this branch too.
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:36-40 (unvalidated branch)
  // src: legacy/lib/api/forgot/index.js:31-35 (500 + status passthrough)
  // src: legacy/lib/translations/lib/ro.json:132 (the distinct copy)
  // TODO-AMBIGUOUS: what the new app does BEHIND the uniform confirmation for
  // an unvalidated account (send nothing? re-send the validation e-mail
  // instead?) is not derivable from legacy source — legacy simply refused.
  // The user-visible contract asserted here is only: the response is uniform.
});

test.fixme('J2: the e-mailed link opens the reset form, which enforces the password rules', async ({
  page,
}) => {
  const profile = await createValidatedAccount(page);
  await requestPasswordReset(page, profile.email);

  // The reset e-mail carries /forgot/reset/<tokenId>.
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:44-58 (token + resetUrl e-mailed)
  // src: legacy/lib/site/boot/router.js:53-55 (reset/:token route)
  const resetUrl = await resetLinkFromMailbox(profile.email);
  await page.goto(resetUrl);

  // The reset page announces itself and asks for the new password twice,
  // both fields required.
  // src: legacy/lib/site/reset/component.js:58 (h1 t('forgot.reset'))
  // src: legacy/lib/translations/lib/ro.json:137 ("Resetează Parola!")
  // src: legacy/lib/site/reset/component.js:90-110 (two required password inputs)
  // src: legacy/lib/translations/lib/ro.json:200,202 ("Parola nouă", "Scrie parola din nou")
  await expect(
    page.getByRole('heading', { name: /reseteaz[ăa] parola|reset password/i }),
  ).toBeVisible();
  for (const field of [
    page.getByLabel(/parol[ăa] nou[ăa]|new password/i),
    page.getByLabel(/scrie parola din nou|retype (new )?password/i),
  ]) {
    await expect(field).toHaveJSProperty('required', true);
  }

  // A new password shorter than 6 characters is rejected with the min-length
  // copy.
  // legacy-bug: legacy enforces the 6-char minimum ONLY client-side
  // (setCustomValidity in the submit handler); the server-side resetPassword
  // calls user.setPassword with whatever arrives, any length. Not preserved —
  // the new app enforces the minimum server-side too — see
  // docs/CHARACTERIZATION.md.
  // src: legacy/lib/site/reset/component.js:31-48 (validatePass, n = 6)
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:91-114 (no length check)
  // src: legacy/lib/translations/lib/ro.json:319 ("Trebuie să aibă cel puțin {n} caractere")
  await page.getByLabel(/parol[ăa] nou[ăa]|new password/i).fill('scurt');
  await page.getByLabel(/scrie parola din nou|retype (new )?password/i).fill('scurt');
  await page.getByRole('button', { name: /^trimite$|^send$/i }).click();
  await expect(page.getByText(/cel puțin 6 caractere|at least 6 characters/i)).toBeVisible();

  // The retyped password must match the first one.
  // TODO-AMBIGUOUS: ro.json has no "common.pass-match-error" key — only EN
  // exists ("Don't match.", legacy/lib/translations/lib/en.json:224). The
  // Romanian wording is therefore new-design; the regex accepts both (same
  // disposition as J1's signup mismatch).
  // src: legacy/lib/site/reset/component.js:39-41 (re_password mismatch)
  await page.getByLabel(/parol[ăa] nou[ăa]|new password/i).fill(profile.newPassword);
  await page
    .getByLabel(/scrie parola din nou|retype (new )?password/i)
    .fill(`${profile.newPassword}-alta`);
  await page.getByRole('button', { name: /^trimite$|^send$/i }).click();
  await expect(
    page.getByText(/parolele nu (se potrivesc|coincid)|do(n'?t| not) match/i),
  ).toBeVisible();
});

test.fixme('J2: completing the reset lets the NEW password in and locks the OLD one out', async ({
  page,
}) => {
  const profile = await createValidatedAccount(page);
  await requestPasswordReset(page, profile.email);
  const resetUrl = await resetLinkFromMailbox(profile.email);

  // Submitting a valid new password succeeds with the updated confirmation.
  // src: legacy/lib/site/reset/component.js:23-25 (onSuccess → t('settings.password-updated'))
  // src: legacy/lib/site/reset/component.js:82-89 (success alert rendered)
  // src: legacy/lib/translations/lib/ro.json:259 ("Parola a fost modificată cu succes")
  // (the EN source string carries a typo, "successfuly" — the regex accepts
  // both spellings; src: legacy/lib/translations/lib/en.json:394)
  await submitNewPassword(page, resetUrl, profile.newPassword);
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).toBeVisible();

  // TODO-AMBIGUOUS: legacy ALSO signs the user in on the spot — the reset
  // route ends in jwt.signin, setting the session cookie — while the reset
  // page itself just shows the success alert and stays put, offering no
  // navigation. Whether the new app keeps the auto-signin or routes the user
  // to /signin is a UX decision the source does not settle; this journey
  // asserts the explicit sign-in path below, which must hold either way
  // (sign out first so the assertion is about credentials, not the cookie).
  // src: legacy/lib/api/forgot/index.js:52-57 (resetPassword → jwt.signin)
  // src: legacy/lib/jwt/index.js:8-10,20-24 (httpOnly cookie on signin)

  // Sign-in with the NEW password succeeds: header shows the user badge.
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:99-104 (setPassword + save)
  // src: legacy/lib/auth/mongoose.js:34-42 (setPassword re-derives hash+salt)
  // src: legacy/lib/site/sign-in/component.js:33-44 (redirect to / on success)
  // src: legacy/lib/header/user-badge/component.js:73-79 (badge shows firstName)
  await fillAndSubmitSignin(page, { email: profile.email, password: profile.newPassword });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: /rodica/i })).toBeVisible();

  // Sign out, then the OLD password is refused with the same generic
  // rejection as any bad credential (anti-enumeration copy shared with J1).
  // src: legacy/lib/api/signin/index.js:99-101 (DELETE /signin clears the cookie)
  // src: legacy/lib/auth/mongoose.js:12-24 (passport-local-mongoose verifies
  //      against the stored hash+salt, which setPassword just replaced)
  // src: legacy/lib/api/signin/index.js:27-50 (auth failure → info.message shown)
  // TODO-AMBIGUOUS: ro.json has no signin.errors.incorrect-password key — only
  // EN exists (legacy/lib/translations/lib/en.json:412-413); RO wording is
  // new-design, regex accepts both (same disposition as J1).
  await page.getByRole('button', { name: /rodica/i }).click();
  await page.getByRole('link', { name: /deconectare|log ?out|sign ?out/i }).click();
  await fillAndSubmitSignin(page, { email: profile.email, password: profile.oldPassword });
  await expect(
    page.getByText(/parola sau emailul .*(incorect|greșit)|password or email are incorrect/i),
  ).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /autentificare|sign ?in|login/i })).toBeVisible();
});

test.fixme('J2: a reset link is single-use, and re-requesting a reset revokes the older link', async ({
  page,
}) => {
  const profile = await createValidatedAccount(page);

  // Single use: a successful reset deletes the token, so the same link a
  // second time is refused (the id no longer resolves).
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:105-108 (token.remove after use)
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:76-78 ('No token for id' on re-use)
  // legacy-bug: legacy's refusal is HTTP 500 + the untranslated developer
  // string "No token for id <id>" rendered into the errors list, not
  // preserved — the new UI names the problem (link invalid/expirat) — see
  // docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/forgot/index.js:52-54 (500 + error passthrough)
  // src: legacy/lib/site/reset/component.js:27-29,70-81 (onFail → errors list)
  await requestPasswordReset(page, profile.email);
  const firstResetUrl = await resetLinkFromMailbox(profile.email);
  await submitNewPassword(page, firstResetUrl, profile.newPassword);
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).toBeVisible();

  await submitNewPassword(page, firstResetUrl, `${profile.newPassword}-again`);
  await expect(page.getByText(/link.*(invalid|expirat)|invalid|expired/i)).toBeVisible();
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).not.toBeVisible();

  // Re-issue semantics: creating a reset token first DELETES every existing
  // token for that user at the same scope — so requesting twice leaves only
  // the newest link alive, and the older one is refused.
  // src: legacy/lib/db-api/token.js:81-106 (Token.remove({user, scope}) then create)
  // src: legacy/lib/db-api/token.js:45-48 (the forgot flow uses scope 'password-reset')
  await requestPasswordReset(page, profile.email);
  const olderUrl = await resetLinkFromMailbox(profile.email);
  await requestPasswordReset(page, profile.email);
  const newerUrl = await resetLinkFromMailbox(profile.email);

  await submitNewPassword(page, olderUrl, `${profile.newPassword}-old-link`);
  await expect(page.getByText(/link.*(invalid|expirat)|invalid|expired/i)).toBeVisible();

  // …and the newest link still works.
  await submitNewPassword(page, newerUrl, `${profile.newPassword}-new-link`);
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).toBeVisible();
});

test.fixme('J2: an invalid or expired reset link is refused', async ({ page }) => {
  // A link whose token id resolves to nothing is refused. In legacy the
  // failure surfaces on SUBMIT, not on page load — the reset page never
  // pre-verifies its token (the POST /forgot/verify endpoint exists but no
  // legacy client code calls it). The new app may verify eagerly on load;
  // this spec asserts the refusal at the latest common point, after submit.
  // src: legacy/lib/site/reset/component.js:60-69 (form posts token only on submit)
  // src: legacy/lib/api/forgot/index.js:45-50 (the orphaned verify endpoint)
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:71-81 (verifyToken: findById, else error)
  // src: legacy/lib/db-api/token.js:19-31 (get = Token.findById, nothing more)
  await submitNewPassword(
    page,
    '/forgot/reset/000000000000000000000000',
    'parola-oricare-j2-sintetica',
  );
  await expect(page.getByText(/link.*(invalid|expirat)|invalid|expired/i)).toBeVisible();
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).not.toBeVisible();

  // delta (schema design, not legacy): the legacy Token has NO expiry — the
  // schema holds only user/scope/meta/createdAt, none of its three indexes is
  // a TTL index, and verifyToken never compares createdAt to anything — so a
  // legacy reset link works FOREVER (until used or superseded). The new
  // schema adds expiresAt, and the reset endpoint must refuse an expired
  // token exactly like a missing one (the shared invalid/expirat copy
  // asserted above) — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/models/token.js:5-14 (no expiry field, no TTL index)
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:71-81 (no age check)
});

test.fixme('J2: a reset token is scope-bound — it must not validate an e-mail, nor vice versa', async ({
  page,
}) => {
  // Tokens carry an explicit scope ('password-reset' | 'email-validation')…
  // src: legacy/lib/models/token.js:7 (scope enum, required)
  // …but legacy NEVER checks it on consumption, in either direction:
  // legacy-bug (found by J1, re-asserted here from the J2 side): emailValidate
  // looks its token up by id only — a password-reset token id validates an
  // e-mail. Not preserved — the new app accepts only scope email-validation
  // tokens on the validate endpoint — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/signup/lib/signup.js:110-136 (findById, no scope check)
  // legacy-bug (symmetric, J2's own finding): the forgot flow's verifyToken is
  // the same bare findById — an email-validation token id resets a password.
  // Not preserved — the reset endpoint accepts only scope password-reset
  // tokens — see docs/CHARACTERIZATION.md.
  // src: legacy/lib/api/forgot/lib/forgotpassword.js:71-81,91-96 (no scope check)
  // src: legacy/lib/db-api/token.js:19-31 (get = findById only)
  const profile = await createValidatedAccount(page);
  await requestPasswordReset(page, profile.email);
  const resetUrl = await resetLinkFromMailbox(profile.email);
  const resetTokenId = tokenIdFromResetUrl(resetUrl);

  // Direction 1: the reset token presented to the e-mail-validation endpoint
  // is refused (J1's invalid-link copy; route shape from J1's citations).
  // src: legacy/lib/site/boot/router.js:44-45 (/signup/validate/:token route)
  // src: legacy/lib/site/resend/component.js:19-36 (auto-posts the token on load)
  await page.goto(`/signup/validate/${resetTokenId}`);
  await expect(page.getByText(/link.*(invalid|expirat)|invalid|expired/i)).toBeVisible();

  // The refused cross-scope attempt must NOT have consumed the reset token:
  // the genuine reset still works afterwards. (In legacy the cross-scope call
  // SUCCEEDED and then deleted the token — signup.js:128-132 — so this
  // assertion pins the whole intended fix, refusal plus non-consumption.)
  // src: legacy/lib/api/signup/lib/signup.js:128-132 (legacy consumed it; new app must not)
  await submitNewPassword(page, resetUrl, profile.newPassword);
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).toBeVisible();

  // Direction 2: an email-validation token presented to the reset endpoint is
  // refused. A second, fresh signup supplies the email-validation token (its
  // link is /signup/validate/<tokenId> — same id-in-path shape).
  // src: legacy/lib/api/signup/lib/signup.js:168-187 (validate URL carries token.id)
  // src: legacy/lib/db-api/token.js:62-65 (scope 'email-validation')
  const second = uniqueResetProfile();
  await fillAndSubmitSignup(page, second, second.oldPassword);
  const validateUrl = await validationLinkFromMailbox(second.email);
  const validationTokenId = tokenIdFromResetUrl(validateUrl);

  await submitNewPassword(
    page,
    `/forgot/reset/${validationTokenId}`,
    'parola-furata-j2-sintetica',
  );
  await expect(page.getByText(/link.*(invalid|expirat)|invalid|expired/i)).toBeVisible();
  await expect(
    page.getByText(/parola a fost modificată cu succes|password was successful?ly updated/i),
  ).not.toBeVisible();
});

test.fixme('J2: the forgot routes are signed-out-only — a signed-in user is sent home', async ({
  page,
  users,
}) => {
  // Legacy guards /forgot and /forgot/reset/:token with restrictLoggedin,
  // which bounces an authenticated visitor to the home page. Signing in with
  // a fixture account is non-mutating, so the immutable participant is safe.
  // src: legacy/lib/site/boot/router.js:49-56 (onEnter: restrictLoggedin)
  // src: legacy/lib/site/boot/router.js:86-91 (restrictLoggedin → '/')
  const ana = users.participant;
  await fillAndSubmitSignin(page, { email: ana.email, password: ana.password });
  await expect(page.getByRole('button', { name: /ana/i })).toBeVisible();

  await page.goto('/forgot');
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('heading', { name: /ai uitat parola|forgot password/i }),
  ).not.toBeVisible();
});
