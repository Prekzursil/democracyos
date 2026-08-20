// J8 — comment → reply → upvote/downvote → flag as spam → author edits →
// author deletes (plan §4.2, WU-M1-9). Semantic characterization spec:
// behaviour derived by READING legacy/lib/ (never a running system), targeting
// the NEW app built in M4 (API) / M5 (UI). Every assertion cites the legacy
// source it was derived from; a fresh reviewer re-derives each one from the
// citation, not from this file's prose.
//
// Pending-by-design: every spec is quarantined via test.fixme until its
// activation row in e2e/SPEC-LEDGER.md (row J8: activate at M4 via WU-M4-10,
// re-point at the real UI at WU-M5-8). The filename matches the ledger row.
//
// FIXTURE GAP (M1 review finding N6, flagged for the orchestrator): the
// contract file docs/develop/fixtures.md defines a "Comment tree" corpus on
// t-vote, but e2e/fixtures/app.ts does NOT yet model it, and this WU may not
// add it (one-file rule). Until app.ts grows a comment-tree fixture mirroring
// the contract, this journey cannot activate. The specs below therefore
// create every comment they need INSIDE the journey (which the contract
// requires anyway for edit/delete targets — fixtures stay immutable,
// docs/develop/fixtures.md "Comment tree") and reference the contract tree
// only conceptually.
// TODO-AMBIGUOUS (contract, not source): docs/develop/fixtures.md "Comment
// tree" says root comment → reply → "nested reply", and attributes comments
// to `ana-registered` — a handle that no longer exists after the N1
// correction (the users table says `ana-participant`). A *nested* reply is
// also unrepresentable in the legacy model: replies are a flat embedded
// array with no children (see the threading test below). The contract file
// needs a follow-up fix; this spec asserts the flat, one-level shape the
// legacy source actually supports.
//
// Threading depth, READ from the model: a Comment embeds `replies:
// [CommentReplySchema]`, and CommentReplySchema has author/text/createdAt/
// editedAt only — no `replies` of its own, so a reply can never have
// children. Depth is exactly one level (root comment → flat replies).
//   src: legacy/lib/models/comment.js:35-40 (CommentReplySchema fields)
//   src: legacy/lib/models/comment.js:70-86 (CommentSchema.replies at :73)
//
// Comment-vote semantics, READ from the model: `vote()` first calls
// `unvote(user)` then pushes the new vote — so re-voting REPLACES the
// previous vote (never accumulates), and `score` is recomputed as
// upvotes − downvotes on both paths. The UI additionally maps a click on an
// already-active control to unvote (toggle-off, DELETE /comments/:id/vote).
//   src: legacy/lib/models/comment.js:142-148 (vote: unvote-then-push)
//   src: legacy/lib/models/comment.js:169-188 (unvote + score recompute)
//   src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:12-25
//        (active upvote/downvote onClick → onUnvote)
//   src: legacy/lib/site/topic-layout/topic-article/comments/connector.js:29-46
//        (POST value | DELETE = unvote)
//
// Verification-stage note (decision G-10, grill ledger): Stage 1
// (e-mail + Turnstile) may read and COMMENT; Stage 2 (phone) is required to
// vote on TOPICS. Legacy gates comment up/downvotes with the same
// `canComment` privilege as commenting itself (never `canVote`):
//   src: legacy/lib/api-v2/comments/index.js:95-109 (vote route uses
//        middlewares.topics.privileges.canComment)
// TODO-AMBIGUOUS: whether G-10 pulls comment up/downvotes into the Stage-2
// tier or leaves them in the commenting tier is undecided. This spec encodes
// the legacy reading (comment votes are part of the commenting tier, so the
// Stage-1 participant may cast them); docs/CHARACTERIZATION.md must record
// the deliberate choice at activation.

import { expect, test } from '../fixtures/app';
import type { Page } from '@playwright/test';
import type { FixtureUser } from '../fixtures/users';

// ---------------------------------------------------------------------------
// Accessible names (Romanian-primary, EN fallback). The new UI must expose
// these names; the regexes are derived from the legacy translation catalogue.
// Legacy renders several of these controls as icon-only or placeholder-only
// elements — keyboard- and screen-reader-unreachable; the names pinned here
// are how M1 seeds WCAG 2.1 AA (N16, plan §4.2).
// ---------------------------------------------------------------------------

// The comments section heading.
// src: legacy/lib/site/topic-layout/topic-article/comments/component.js:33-36
//      (h2 renders t('comments.arguments'))
// src: legacy/lib/translations/lib/ro.json:90 ("Argumente")
// src: legacy/lib/translations/lib/en.json:178 ("Arguments")
const COMMENTS_HEADING = /argumente|arguments/i;

// The sort control and its default. GET /comments accepts sort enum
// ['score','-score','createdAt','-createdAt'], default '-score'; the client
// labels '-score' as "Relevanță" and starts there.
// src: legacy/lib/api-v2/comments/index.js:17-21 (sort enum, default -score)
// src: legacy/lib/site/topic-layout/topic-article/comments/order-by/component.js:9-18,44-51
//      (active default '-score'; button renders ordered-by + active label)
// src: legacy/lib/translations/lib/ro.json:104,115-117 ("Comandat de",
//      sorts: newest/oldest/Relevanță)
// src: legacy/lib/translations/lib/en.json:194,206-208
// legacy-bug (copy): the RO value of comments.ordered-by is "Comandat de" —
// a mistranslation ("commanded by"); intended is "Ordonate după". Not
// preserved; the regex accepts both — see docs/CHARACTERIZATION.md.
const ORDERED_BY_RELEVANCE = /(ordonate după|comandat de|ordered by)\s*relevanț[aă]|relevance/i;

// The comment composer. Legacy exposes it only via placeholder text (no
// <label>), which getByLabel cannot target in the old markup — the new UI
// must attach a real accessible label. The RO name is taken from the unused
// catalogue key comments.your-argument; EN from the legacy placeholder.
// src: legacy/lib/site/topic-layout/topic-article/comments/form/component.js:102-114
//      (textarea, placeholder t('comments.create.placeholder'), maxLength 4096)
// src: legacy/lib/translations/lib/en.json:183 ("Write an argument...")
// src: legacy/lib/translations/lib/ro.json:118 ("comments.your-argument":
//      "Argumentul tău")
// TODO-AMBIGUOUS: ro.json has NO comments.create.placeholder key — only EN
// exists. The Romanian label is therefore new-design; the regex accepts the
// candidate RO copy and the EN string.
const COMMENT_FIELD = /argumentul tău|scrie un argument|write an argument/i;

// The publish button.
// src: legacy/lib/site/topic-layout/topic-article/comments/form/component.js:115-121
//      (submit button, t('comments.create.publish'))
// src: legacy/lib/translations/lib/en.json:184 ("Publish")
// TODO-AMBIGUOUS: ro.json has NO comments.create.publish key. The nearest RO
// catalogue entry is comments.send "Trimite" (ro.json:112, used by an older
// form). The RO wording is new-design; the regex accepts both candidates.
const PUBLISH = /publică|trimite|publish/i;

// The per-comment reply control (footer) and the reply composer.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:27-48
//      (reply toggle, title t('comments.arguments.reply'); count labelled
//      singular t('comments.reply') / plural t('comments.replies'))
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/replies/form/component.js:100-112
//      (reply textarea, placeholder t('comments.arguments.reply'))
// src: legacy/lib/translations/lib/ro.json:92,107,109 ("Răspunde acestui
//      argument" / "Răspunsuri" / "Răspunde")
// src: legacy/lib/translations/lib/en.json:180,197,199
const REPLY_TO_ARGUMENT = /răspunde acestui argument|reply to this argument/i;

// Comment up/downvotes. Legacy renders these as icon-only buttons (no
// accessible name); the catalogue carries the names the new UI must use.
// Anchored, because the RO downvote name contains the upvote name.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:12-25
//      (icon-only upvote/downvote buttons)
// src: legacy/lib/translations/lib/ro.json:87-88 ("Nu sunt de acord" /
//      "Sunt de acord")
// src: legacy/lib/translations/lib/en.json:175-176 ("Downvote" / "Upvote")
const UPVOTE = /^sunt de acord$|^upvote$/i;
const DOWNVOTE = /^nu sunt de acord$|^downvote$/i;

// The per-comment options menu. Legacy renders the trigger as an icon-only
// arrow button with no accessible name.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:32-45
//      (options trigger, icon-arrow-down, no text)
// TODO-AMBIGUOUS: no catalogue key exists for this control in any locale;
// the name below is new-design and must be recorded in
// docs/CHARACTERIZATION.md at activation.
const COMMENT_OPTIONS = /opțiuni|options/i;

// Options-menu entries.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:46-82
//      (remove for owner|canDeleteComments; edit for owner; report-spam /
//      not-spam for non-owners, with the flag count appended in parens)
// src: legacy/lib/translations/lib/ro.json:83-85,96 ("Nu este Spam" /
//      "Șterge argument" / "Raportează ca Spam" / "Modifică argument")
// src: legacy/lib/translations/lib/en.json:171-173,186
const REMOVE_ARGUMENT = /șterge argument|remove argument/i;
const EDIT_ARGUMENT = /modifică argument|edit argument/i;
const REPORT_SPAM = /raportează ca spam|report as spam/i;
const NOT_SPAM = /nu este spam|not spam/i;

// The spam-hidden state and its reveal toggle.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:41-48,137-150
//      (flags.length >= config.spamLimit → replaced by flagged-as-spam +
//      show toggle)
// src: legacy/lib/translations/lib/ro.json:82,86 ("Acest argument a fost
//      marcat ca spam." / "Arată.")
// src: legacy/lib/translations/lib/en.json:170,174
const FLAGGED_AS_SPAM = /acest argument a fost marcat ca spam|flagged as spam/i;
const SHOW_SPAM = /arată|show/i;

// Delete confirmation overlay.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:209-229
//      (confirm-remove text + cancel/ok buttons)
// src: legacy/lib/translations/lib/ro.json:91,122,128 ("Vrei să ștergi acest
//      răspuns?" / "Anulează" / "OK")
// src: legacy/lib/translations/lib/en.json:179,215,222
// legacy-bug (copy): the RO confirm copy for a ROOT comment says "răspuns"
// (reply) — ro.json:91 is byte-identical to the reply key ro.json:108. Not
// preserved: the new UI names the right object; the regex accepts both — see
// docs/CHARACTERIZATION.md.
const CONFIRM_REMOVE =
  /vrei să ștergi acest (argument|răspuns)|do you want to remove this (argument|reply|comment)/i;
const OK = /^ok$/i;
const CANCEL = /anulează|cancel/i;

// The has-replies refusal.
// src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:24-38,231-246
//      (HAS_REPLIES rejection → cannot-remove overlay)
// src: legacy/lib/translations/lib/ro.json:94 ("Commentariul are răspunsuri
//      și nu poate fi șters!" — the "Commentariul" typo is legacy's)
// src: legacy/lib/translations/lib/en.json:182
const CANNOT_REMOVE =
  /(comm?entariul are răspunsuri|comment has replies).*(nu poate fi șters|cannot be removed)/i;

// Signed-out state of the composer.
// src: legacy/lib/site/topic-layout/topic-article/comments/form/component.js:84,142-158
//      (NeedsLogin alert with signin + signup links)
// src: legacy/lib/translations/lib/ro.json:113 ("Trebuie să fii înregistrat
//      pentru a argumenta")
// src: legacy/lib/translations/lib/en.json:204
const SIGN_IN_REQUIRED =
  /trebuie să fii înregistrat pentru a argumenta|must be signed in to argue/i;

// Empty state of the list.
// src: legacy/lib/translations/lib/ro.json:101 ("Niciun utilizator nu a adus
//      încă argumente pe acest subiect")
// src: legacy/lib/translations/lib/en.json:191
const NO_COMMENTS = /niciun utilizator nu a adus încă argumente|no user has made an argument/i;

// ---------------------------------------------------------------------------
// Helpers. J1 owns the full auth journey; J8 only needs sessions. Re-signing
// in replaces the previous session (single jwt cookie — see J1's citations).
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

/** Unique comment text so page-level text queries stay unambiguous. */
function uniqueText(label: string): string {
  return `j8-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// Posts a top-level comment as the CURRENT session. Transport: POST
// /api/v2/comments { topicId, text }.
// src: legacy/lib/api-v2/comments/index.js:53-93 (route: restrict →
//      validate → canComment → api.comments.create)
// src: legacy/lib/site/topic-layout/topic-article/comments/connector.js:48-60
//      (client posts { text, topicId })
async function postComment(page: Page, text: string): Promise<void> {
  await page.getByLabel(COMMENT_FIELD).fill(text);
  await page.getByRole('button', { name: PUBLISH }).click();
  await expect(page.getByText(text)).toBeVisible();
}

/** The card (article) containing the given comment text — role + text only. */
function commentCard(page: Page, text: string) {
  // Each comment renders as an <article>; scoping is by role + contained
  // text, never by CSS/id.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:152-153
  //      (comment renders as <article>)
  return page.getByRole('article').filter({ hasText: text });
}

// ---------------------------------------------------------------------------
// 1. A signed-out visitor can read the discussion but not join it.
// ---------------------------------------------------------------------------
test.fixme('J8: a visitor sees the comments section, sorted by relevance, but must sign in to argue', async ({
  page,
  forum,
  topics,
}) => {
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  // The section announces itself and the list is publicly readable: GET
  // /comments is gated only by the forum's canView, which is true for every
  // public forum — no session required.
  // src: legacy/lib/api-v2/comments/index.js:8-51 (GET route: no restrict;
  //      forums.privileges.canView only)
  // src: legacy/lib/privileges/forum.js:15-19 (canView true for public)
  // src: legacy/lib/site/topic-layout/topic-article/comments/component.js:33-36
  await expect(page.getByRole('heading', { name: COMMENTS_HEADING })).toBeVisible();

  // Default ordering is by score descending, labelled "Relevanță".
  // src: legacy/lib/api-v2/comments/index.js:17-21 (default '-score')
  // src: legacy/lib/site/topic-layout/topic-article/comments/order-by/component.js:9-18,44-51
  await expect(page.getByRole('button', { name: ORDERED_BY_RELEVANCE })).toBeVisible();

  // Signed out, the composer is replaced by the sign-in-required alert with
  // sign-in and sign-up links.
  // src: legacy/lib/site/topic-layout/topic-article/comments/form/component.js:84,142-158
  await expect(page.getByLabel(COMMENT_FIELD)).not.toBeVisible();
  await expect(page.getByText(SIGN_IN_REQUIRED)).toBeVisible();
  await expect(page.getByRole('link', { name: /login|autentificare/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /înregistr|sign ?up/i })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. A Stage-1 participant posts a top-level comment.
// ---------------------------------------------------------------------------
test.fixme('J8: a stage-1 participant posts a top-level comment and sees it in the list', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // Commenting is allowed at stage1-email (decision G-10, grill ledger) —
  // ana is the canonical account for it (e2e/fixtures/users.ts:54-63).
  // Legacy analogue: POST /comments requires only a session plus the
  // topic-level canComment privilege, which is true for every signed-in
  // user on a public forum.
  // src: legacy/lib/api-v2/comments/index.js:53-74 (restrict + canComment)
  // src: legacy/lib/api-v2/middlewares/users.js:1-9 (no session → 403
  //      NOT_LOGGED_IN)
  // src: legacy/lib/privileges/topic.js:46-50 (canComment: public → true)
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  const text = uniqueText('top-level');
  await postComment(page, text);

  // The stored comment is created with context 'topic' and the topic as its
  // reference, and the response exposes the ordinary scope — the new card
  // shows the author's name, the text, and a zero score.
  // src: legacy/lib/api-v2/db-api/comments/index.js:173-186 (create)
  // src: legacy/lib/models/comment.js:82 (score default 0)
  // src: legacy/lib/api-v2/db-api/comments/scopes.js:6-25 (exposes text,
  //      score, replies, flags…)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:16-31
  //      (card header shows author displayName)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:7-11
  //      (card footer shows the score)
  const card = commentCard(page, text);
  await expect(card.getByText(/ana/i)).toBeVisible();
  await expect(card.getByText(/^0$/)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Comment body rules: non-empty, ≤ 4096 chars, line breaks reduced.
// ---------------------------------------------------------------------------
test.fixme('J8: the comment body must be non-empty and at most 4096 characters', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  // Empty submission is refused. Client: submit trims and returns without
  // posting. Server: the model validator rejects empty text with
  // comments.cannot-be-empty.
  // src: legacy/lib/site/topic-layout/topic-article/comments/form/component.js:64-73
  //      (trim; text === '' → return)
  // src: legacy/lib/models/comment.js:42-44,50-53,72 (minTextValidator,
  //      msg comments.cannot-be-empty; text trim + required)
  // src: legacy/lib/translations/lib/ro.json:93 ("Argumentul nu poate fi gol")
  await page.getByLabel(COMMENT_FIELD).fill('   ');
  await page.getByRole('button', { name: PUBLISH }).click();
  await expect(page.getByText(NO_COMMENTS)).toBeVisible();

  // 4096 is the hard cap, enforced by the model validator (and mirrored as
  // the textarea's maxLength).
  // src: legacy/lib/models/comment.js:46-48,50-53 (maxTextValidator 4096,
  //      msg comments.argument-limited)
  // src: legacy/lib/site/topic-layout/topic-article/comments/form/component.js:110
  //      (maxLength='4096')
  // src: legacy/lib/translations/lib/ro.json:89 ("Argumentul este limitat la
  //      4096 caractere")
  const over = `j8-overlimit-${'x'.repeat(4096)}`;
  await page.getByLabel(COMMENT_FIELD).fill(over);
  await page.getByRole('button', { name: PUBLISH }).click();
  await expect(page.getByText(over)).not.toBeVisible();

  // Three or more consecutive line breaks are stored as exactly two — the
  // schema setter rewrites the text before save.
  // src: legacy/lib/models/comment.js:63-65,72 (reduceLB setter on text)
  const marker = uniqueText('linebreaks');
  await page.getByLabel(COMMENT_FIELD).fill(`${marker}-sus\n\n\n\n${marker}-jos`);
  await page.getByRole('button', { name: PUBLISH }).click();
  await expect(page.getByText(new RegExp(`${marker}-sus\\n\\n${marker}-jos`))).toBeVisible();
});

// ---------------------------------------------------------------------------
// 4. Replying — and the threading depth is exactly one level.
// ---------------------------------------------------------------------------
test.fixme('J8: a user replies to a comment; replies cannot themselves be replied to', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // ana posts the root; elena replies — mirroring the contract's tree shape
  // (docs/develop/fixtures.md "Comment tree") built in-journey because
  // e2e/fixtures/app.ts does not model it yet (finding N6).
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const rootText = uniqueText('root');
  await postComment(page, rootText);

  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));

  // The reply composer opens from the card's reply control and posts to
  // POST /comments/:id/reply { text }; the same canComment gate applies.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:27-48
  //      (reply toggle)
  // src: legacy/lib/api-v2/comments/index.js:145-182 (reply route)
  // src: legacy/lib/api-v2/db-api/comments/index.js:197-233 (doReply pushes
  //      an embedded reply subdocument and saves the parent)
  const card = commentCard(page, rootText);
  await card.getByRole('button', { name: REPLY_TO_ARGUMENT }).click();
  const replyText = uniqueText('reply');
  await page.getByLabel(REPLY_TO_ARGUMENT).fill(replyText);
  await page.getByRole('button', { name: PUBLISH }).click();

  // The reply renders under its parent with the replier's name, and the
  // parent's footer counts it (singular label at one).
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/replies/list/component.js:6-28,71-90
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:32-45
  //      (repliesCount, singular/plural label)
  // src: legacy/lib/models/comment.js:128-130 (repliesCount virtual)
  // src: legacy/lib/translations/lib/ro.json:109 ("Răspunde" — legacy reuses
  //      the verb as the singular label; EN "Reply", en.json:199)
  await expect(card.getByText(replyText)).toBeVisible();
  await expect(card.getByText(/elena/i)).toBeVisible();
  await expect(card.getByText(/1\s*(răspunsuri|răspuns(?!ă)|repl(y|ies))/i)).toBeVisible();

  // ONE LEVEL ONLY: the reply subdocument has no replies of its own (the
  // model cannot express a deeper tree) and the reply row offers no reply
  // control (only its author's edit and the moderator/author delete).
  // src: legacy/lib/models/comment.js:35-40 (CommentReplySchema:
  //      author/text/createdAt/editedAt only — no children)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/replies/list/component.js:71-110
  //      (a reply renders header + content + delete overlay; no reply button)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/replies/list/header/component.js:31-67
  //      (reply menu: delete / edit only)
  const replyRow = page.getByRole('article').filter({ hasText: replyText });
  await expect(replyRow.getByRole('button', { name: REPLY_TO_ARGUMENT })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 5. Upvote / downvote: cast, replace, toggle-off.
// ---------------------------------------------------------------------------
test.fixme('J8: re-voting a comment replaces the vote; re-clicking the same control removes it', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const text = uniqueText('votable');
  await postComment(page, text);

  // elena (a different user — see spec 6 for why that matters) votes.
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const card = commentCard(page, text);

  // Upvote: POST /comments/:id/vote { value: 'positive' }; the only legal
  // values are positive|negative; score becomes upvotes − downvotes = 1.
  // src: legacy/lib/api-v2/comments/index.js:95-123 (route + value enum)
  // src: legacy/lib/models/comment.js:10-14 (Vote value enum)
  // src: legacy/lib/models/comment.js:142-148 (score = up − down)
  // src: legacy/lib/api-v2/db-api/comments/scopes.js:58-65 (currentUser
  //      upvoted/downvoted exposed to the voter)
  await card.getByRole('button', { name: UPVOTE }).click();
  await expect(card.getByText(/^1$/)).toBeVisible();

  // Switching to downvote REPLACES the previous vote: vote() first unvotes,
  // then pushes — one vote per user at all times, so the score swings to −1
  // (never 0 from double-counting).
  // src: legacy/lib/models/comment.js:142-148 (unvote-then-push)
  // src: legacy/lib/models/comment.js:169-188 (unvote removes ALL of the
  //      user's votes and recomputes score)
  await card.getByRole('button', { name: DOWNVOTE }).click();
  await expect(card.getByText(/^-1$/)).toBeVisible();

  // Re-clicking the active control unvotes (DELETE /comments/:id/vote) —
  // score returns to 0.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:19-25
  //      (downvoted ? onUnvote : onDownvote)
  // src: legacy/lib/site/topic-layout/topic-article/comments/connector.js:39-46
  //      (DELETE = unvote)
  // src: legacy/lib/api-v2/comments/index.js:125-143 (unvote route)
  await card.getByRole('button', { name: DOWNVOTE }).click();
  await expect(card.getByText(/^0$/)).toBeVisible();

  // legacy-bug (drift risk): comment.score is DENORMALIZED — recomputed
  // imperatively only inside vote()/unvote() (comment.js:146,184) from the
  // embedded votes[] and stored at :82; nothing ever reconciles it, so any
  // other write path (imports, admin edits, a crash between push and save)
  // leaves score permanently out of sync with votes[], and the '-score'
  // default sort then lies. Intended behaviour (encoded above): score is
  // always derivable from the votes — the new app computes it from the vote
  // store or maintains it transactionally.
  //   src: legacy/lib/models/comment.js:82,142-148,169-188
  // legacy-bug (unbounded growth): votes[] and flags[] are unbounded
  // embedded arrays on the comment document (comment.js:81,83, subdocs at
  // :10-14,20-24) — every voter/flagger grows the document toward Mongo's
  // 16MB document cap and every list query drags the full arrays along
  // (scopes select 'votes', scopes.js:19-24). Intended behaviour: votes and
  // flags live in their own relation, aggregated on read.
  //   src: legacy/lib/models/comment.js:10-14,20-24,81,83
});

// ---------------------------------------------------------------------------
// 6. A user may NOT vote their own comment.
// ---------------------------------------------------------------------------
test.fixme('J8: the author of a comment cannot upvote or downvote it', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const text = uniqueText('own-vote');
  await postComment(page, text);

  // The UI hides both vote controls on the author's own card…
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/footer/component.js:12-25
  //      (buttons render only when !isOwner)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:135
  //      (isOwner = session user id === comment.author.id)
  const card = commentCard(page, text);
  await expect(card.getByRole('button', { name: UPVOTE })).not.toBeVisible();
  await expect(card.getByRole('button', { name: DOWNVOTE })).not.toBeVisible();

  // …and the server refuses regardless of the UI: verifyAutovote rejects
  // with 400 NO_AUTOVOTE ("A user can't vote his own comment.") before any
  // write happens, so the score is untouched.
  // src: legacy/lib/api-v2/db-api/comments/index.js:97-121 (vote →
  //      verifyAutovote → 400 NO_AUTOVOTE)
  await expect(card.getByText(/^0$/)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 7. Flagging as spam — and its restrictions.
// ---------------------------------------------------------------------------
test.fixme("J8: a user flags another user's comment as spam, can withdraw the flag, and can never flag their own", async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const text = uniqueText('flaggable');
  await postComment(page, text);

  // elena flags ana's comment from the options menu. The only flag value in
  // the schema is 'spam', and the API hardcodes it — flagging IS spam
  // reporting.
  // src: legacy/lib/models/comment.js:20-24 (Flag value enum ['spam'])
  // src: legacy/lib/api-v2/comments/index.js:224-242 (flag route)
  // src: legacy/lib/api-v2/db-api/comments/index.js:381-388 (doFlag passes
  //      the literal 'spam')
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const card = commentCard(page, text);
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  // The menu offers "Raportează ca Spam" only while the user has no flag on
  // this comment…
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:73-82
  await card.getByRole('button', { name: REPORT_SPAM }).click();

  // …and flips to "Nu este Spam" (with the flag count) once flagged —
  // withdrawing posts /comments/:id/unflag. Re-flagging can never stack:
  // flag() first unflags the same user, so one flag per user is invariant.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:63-72
  //      (not-spam entry + count in parens)
  // src: legacy/lib/models/comment.js:200-206 (flag: unflag-then-push)
  // src: legacy/lib/api-v2/comments/index.js:244-262 (unflag route)
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await expect(card.getByRole('button', { name: NOT_SPAM })).toBeVisible();
  await card.getByRole('button', { name: NOT_SPAM }).click();
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await expect(card.getByRole('button', { name: REPORT_SPAM })).toBeVisible();

  // A user can never flag their own comment: the UI omits both spam entries
  // on the author's own card, and the server refuses with NO_AUTO_FLAG.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:64,74
  //      (both entries gated on !isOwner)
  // src: legacy/lib/api-v2/db-api/comments/index.js:372-379 (verifyAutoFlag)
  // legacy-bug: verifyAutoFlag sets err.code but — unlike verifyAutovote at
  // index.js:113-121 — no err.status, so the refusal surfaces as HTTP 500,
  // not 400. Not preserved: the new API returns a 4xx — see
  // docs/CHARACTERIZATION.md.
  const elenaText = uniqueText('own-flag');
  await postComment(page, elenaText);
  const ownCard = commentCard(page, elenaText);
  await ownCard.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await expect(ownCard.getByRole('button', { name: REPORT_SPAM })).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 8. The spam threshold: at config.spamLimit flags the comment is veiled.
// ---------------------------------------------------------------------------
test.fixme('J8: a comment reaching the spam-flag threshold is hidden behind a notice with a reveal toggle', async ({
  page,
  forum,
  topics,
  users,
}) => {
  // The threshold behaviour, READ from the source: when flags.length >=
  // config.spamLimit (default 5) the card is REPLACED by the
  // flagged-as-spam notice plus an inline "Arată." reveal that shows the
  // comment again for that pageview. Below the threshold nothing changes.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:41-48
  //      (componentWillMount: flags.length >= config.spamLimit → IS_SPAM)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:137-150
  //      (IS_SPAM replaces the card; show toggle restores it)
  // src: legacy/config/defaults.json:117 (spamLimit: 5) +
  //      legacy/docs/configuration.md:139-141 (SPAM_LIMIT, default 5)
  // legacy-bug: the threshold is CLIENT-side presentation only — the API
  // returns flagged comments unchanged in every listing (no flags filter in
  // the db-api list, legacy/lib/api-v2/db-api/comments/index.js:30-44) and
  // nothing ever notifies a moderator. Intended behaviour: the threshold is
  // evaluated server-side and surfaces in a moderation queue — see
  // docs/CHARACTERIZATION.md.
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const text = uniqueText('spam-threshold');
  await postComment(page, text);

  // Five distinct non-author accounts flag it — exactly config.spamLimit.
  // (The fixture corpus has exactly five accounts besides ana:
  // docs/develop/fixtures.md "Users".)
  const flaggers = [users.voter, users.author, users.collaborator, users.admin, users.owner];
  for (const flagger of flaggers) {
    await signIn(page, flagger);
    await page.goto(topicPath(forum.slug, topics.vote.slug));
    const card = commentCard(page, text);
    await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
    await card.getByRole('button', { name: REPORT_SPAM }).click();
  }

  // At the threshold, a fresh render veils the comment…
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  await expect(page.getByText(FLAGGED_AS_SPAM)).toBeVisible();
  await expect(page.getByText(text)).not.toBeVisible();

  // …and the reveal toggle brings it back.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:145-148
  await page.getByRole('button', { name: SHOW_SPAM }).click();
  await expect(page.getByText(text)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 9. Editing: author-only, no time window; others never see the affordance.
// ---------------------------------------------------------------------------
test.fixme('J8: the author edits their own comment; a non-author has no edit affordance', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const original = uniqueText('editable');
  await postComment(page, original);

  // The edit entry lives in the options menu, for the owner only.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:54-62
  //      (edit gated on isOwner)
  const card = commentCard(page, original);
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await card.getByRole('button', { name: EDIT_ARGUMENT }).click();

  // The inline edit form is prefilled with the current text and submits via
  // PUT /comments/:id { text }; the server stamps editedAt.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/content/component.js:12-35
  //      (edit form: prefilled textarea + OK/Cancel)
  // src: legacy/lib/api-v2/comments/index.js:264-283 (PUT route)
  // src: legacy/lib/api-v2/db-api/comments/index.js:465-474 (doEdit sets
  //      text + editedAt)
  const edited = uniqueText('edited');
  await card.getByLabel(COMMENT_FIELD).fill(edited);
  await card.getByRole('button', { name: OK }).click();
  await expect(page.getByText(edited)).toBeVisible();
  await expect(page.getByText(original)).not.toBeVisible();

  // NO TIME WINDOW: the edit pipeline is verifyAuthorEdit → doEdit and
  // contains no createdAt/age check of any kind — the author may edit
  // forever. The ONLY rule is authorship (NOT_YOURS otherwise).
  // src: legacy/lib/api-v2/db-api/comments/index.js:440-474 (the complete
  //      edit path: authorship is the sole guard)
  // src: legacy/lib/api-v2/db-api/comments/index.js:456-463 (verifyAuthorEdit
  //      → NOT_YOURS)
  // legacy-bug: PUT /comments/:id declares NO payload validation schema
  // (contrast POST /comments at index.js:55-71) — the route forwards
  // req.body.text unchecked and only the model validators catch it. Not
  // preserved: the new API validates the edit payload like the create — see
  // docs/CHARACTERIZATION.md.
  //   src: legacy/lib/api-v2/comments/index.js:264-283 (no validate())

  // TODO-AMBIGUOUS (edited marker): every catalogue ships comments.edited
  // ("modificat", ro.json:97; "edited", en.json:187) but NO component
  // consumes the key and the legacy card never shows an edited indicator,
  // although editedAt is stored and exposed (scopes.js:6-17). The new UI
  // SHOULD show one (the data and copy both exist); treat the exact
  // placement/wording as new-design to record in docs/CHARACTERIZATION.md.
  await expect(card.getByText(/modificat|edited/i)).toBeVisible();

  // A non-author gets no edit affordance on the card…
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:54-62
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const cardAsOther = commentCard(page, edited);
  await cardAsOther.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await expect(cardAsOther.getByRole('button', { name: EDIT_ARGUMENT })).not.toBeVisible();

  // …and the server refuses an edit by anyone but the author — including
  // admins and the forum owner: verifyAuthorEdit checks authorship only, so
  // NOT even canDeleteComments roles may rewrite someone's words.
  // src: legacy/lib/api-v2/db-api/comments/index.js:456-463 (authorship is
  //      the only test — no privilege bypass exists on the edit path)
  await expect(page.getByText(edited)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 10. Deleting: author-only (plus moderators), blocked while replies exist.
// ---------------------------------------------------------------------------
test.fixme('J8: the author deletes their own comment after confirming; a comment with replies is refused', async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const text = uniqueText('deletable');
  await postComment(page, text);

  // The remove entry opens a confirmation overlay; cancelling keeps the
  // comment.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:46-53
  //      (remove entry for owner or canDeleteComments)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:209-229
  //      (CONFIRM_REMOVE overlay: cancel + ok)
  const card = commentCard(page, text);
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await card.getByRole('button', { name: REMOVE_ARGUMENT }).click();
  await expect(card.getByText(CONFIRM_REMOVE)).toBeVisible();
  await card.getByRole('button', { name: CANCEL }).click();
  await expect(page.getByText(text)).toBeVisible();

  // Confirming deletes it — DELETE /comments/:id removes the document (a
  // hard delete: replies, votes and flags are embedded and vanish with it).
  // src: legacy/lib/api-v2/comments/index.js:184-200 (delete route)
  // src: legacy/lib/api-v2/db-api/comments/index.js:268-291 (doRemoveComment
  //      → comment.remove())
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await card.getByRole('button', { name: REMOVE_ARGUMENT }).click();
  await card.getByRole('button', { name: OK }).click();
  await expect(page.getByText(text)).not.toBeVisible();

  // A comment WITH replies cannot be deleted by its author: the server
  // rejects with HAS_REPLIES (unless the requester holds canDeleteComments
  // or legacy staff) and the UI explains why.
  // src: legacy/lib/api-v2/db-api/comments/index.js:257-266 (verifyNoReplies:
  //      replies.length > 0 && !user.staff → 400 HAS_REPLIES; canDeleteComments
  //      bypasses at :258)
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/component.js:24-38,231-246
  //      (HAS_REPLIES → cannot-remove overlay)
  const parentText = uniqueText('has-replies');
  await postComment(page, parentText);
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const parentCard = commentCard(page, parentText);
  await parentCard.getByRole('button', { name: REPLY_TO_ARGUMENT }).click();
  await page.getByLabel(REPLY_TO_ARGUMENT).fill(uniqueText('blocking-reply'));
  await page.getByRole('button', { name: PUBLISH }).click();

  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const blocked = commentCard(page, parentText);
  await blocked.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await blocked.getByRole('button', { name: REMOVE_ARGUMENT }).click();
  await blocked.getByRole('button', { name: OK }).click();
  await expect(page.getByText(CANNOT_REMOVE)).toBeVisible();
  await expect(page.getByText(parentText)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 11. Moderation boundaries: who may delete someone else's comment.
// ---------------------------------------------------------------------------
test.fixme("J8: only admins and the forum owner may delete another user's comment — collaborators may not", async ({
  page,
  forum,
  topics,
  users,
}) => {
  await signIn(page, users.participant);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  const text = uniqueText('moderated');
  await postComment(page, text);

  // The privilege, READ from the source: canDeleteComments = forum owner or
  // forum-role admin (plus 'moderator' only when config.moderatorEnabled,
  // and legacy staff only in single-forum mode — neither is modelled in the
  // fixture corpus; see e2e/fixtures/users.ts:10-15).
  // src: legacy/lib/privileges/forum.js:48-52 (canDeleteComments)
  // src: legacy/lib/api-v2/db-api/comments/index.js:244-255 (removeComment:
  //      canDeleteComments bypasses; otherwise author-only → 400 NOT_YOURS)

  // An ordinary participant (elena) gets no remove entry on ana's card, and
  // the server would refuse with NOT_YOURS.
  // src: legacy/lib/site/topic-layout/topic-article/comments/list/comment/header/component.js:46-53
  //      (remove rendered only for isOwner || canDeleteComments)
  await signIn(page, users.voter);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  let card = commentCard(page, text);
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await expect(card.getByRole('button', { name: REMOVE_ARGUMENT })).not.toBeVisible();

  // A collaborator is elevated but NOT a comment moderator — the boundary
  // case that catches over-broad checks: canDeleteComments names admin
  // only, never collaborator.
  // src: legacy/lib/privileges/forum.js:48-52 (no 'collaborator' in the list;
  //      contrast canCreateTopics at :31-35 which does include it)
  await signIn(page, users.collaborator);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  card = commentCard(page, text);
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await expect(card.getByRole('button', { name: REMOVE_ARGUMENT })).not.toBeVisible();

  // An admin DOES hold canDeleteComments: the remove entry appears on a
  // comment they do not own, and the replies guard does not apply to them
  // (verifyNoReplies short-circuits on the privilege).
  // src: legacy/lib/privileges/forum.js:48-52 (admin qualifies)
  // src: legacy/lib/api-v2/db-api/comments/index.js:244-245,257-258
  //      (both guards bypass on canDeleteComments)
  await signIn(page, users.admin);
  await page.goto(topicPath(forum.slug, topics.vote.slug));
  card = commentCard(page, text);
  await card.getByRole('button', { name: COMMENT_OPTIONS }).click();
  await card.getByRole('button', { name: REMOVE_ARGUMENT }).click();
  await card.getByRole('button', { name: OK }).click();
  await expect(page.getByText(text)).not.toBeVisible();

  // legacy-bug (schema, verified while deriving): comments carry a topicId
  // field meant for side-comment lookups, but (a) it has NO index — the
  // schema indexes createdAt, score and (reference, context) only — and
  // (b) the api-v2 create path never even sets it, storing the topic in
  // `reference` instead. Every by-topic query therefore scans on
  // (reference, context). Intended behaviour: the new schema has exactly one
  // indexed topic foreign key.
  //   src: legacy/lib/models/comment.js:80 (topicId declared)
  //   src: legacy/lib/models/comment.js:88-90 (the only three indexes)
  //   src: legacy/lib/api-v2/db-api/comments/index.js:178-185 (create sets
  //        reference + context, never topicId)
});
