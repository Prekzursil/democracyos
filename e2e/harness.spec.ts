import { expect, test } from './fixtures/app';

// Pending-quarantine mechanism (plan §4.2, "Red-by-design"). Specs target an
// app that does not exist until M4/M5, so every not-yet-activated spec is
// declared through test.fixme(...): Playwright collects it, reports it as
// SKIPPED (amber, pending), and never executes the body — the suite exits 0
// with zero failures. Activation = replacing test.fixme with test and flipping
// the row in e2e/SPEC-LEDGER.md, only at the milestone that row names.
//
// This file is the harness's own self-check, not a journey (J1–J10 live in
// e2e/journeys/ and are separate WUs). It exists so `npx playwright test`
// runs meaningfully — one pending spec, zero failures — before any journey
// lands, and so the mechanism itself is demonstrated in code.
test.fixme('harness quarantine: a pending spec reports amber, never red', async ({
  page,
  forum,
  users,
  topics,
}) => {
  // src: placeholder — real journey assertions each cite legacy/lib/...:LINE-LINE (§4.2).
  await page.goto('/');
  await expect(page.getByRole('heading', { name: forum.name })).toBeVisible();
  expect(users.registered.handle).toBe('ana-registered');
  expect(topics.vote.slug).toBe('t-vote');
});
