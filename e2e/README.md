# e2e — semantic characterization specs (plan §4.2, M1)

This suite is the **specification of record for the rewrite**: journeys J1–J10,
derived by _reading_ `legacy/lib/` (never by observing a running system),
targeting the new app that M4 (API) and M5 (UI) will build. It is the
definition of "ported" for every subsequent milestone.

## Running

```bash
npx playwright test --config e2e/playwright.config.ts   # or: npm run test:e2e
```

- `E2E_BASE_URL` — target origin. The default (`http://127.0.0.1:3000`) is a
  placeholder; no app exists until M4/M5, which is exactly why every spec is
  quarantined (below). The suite must exit 0 today with zero active tests.
- Chromium only. In CI: `retries: 2`, `trace: 'on-first-retry'`, screenshots
  and video retained on failure only.
- e2e is **never** measured by the coverage ratchet (`vitest.config.ts`
  excludes `e2e/**`) and the workflow that runs it is advisory (WU-M1-12).

## The pending-quarantine mechanism ("red-by-design, amber in practice")

Every spec that targets not-yet-built functionality is written as:

```ts
test.fixme('J5: a registered user votes yes and sees the tally update', async ({ page }) => { … });
```

`test.fixme` collects the spec but never runs the body: the suite reports it
**pending, not failing** — amber, never red — so a green run stays meaningful.
The controls that stop "pending" from becoming decorative (R13):

1. `e2e/SPEC-LEDGER.md` assigns every spec an activation milestone and the WU
   that flips it. A ledger row is a **milestone-exit number, not a vibe**.
2. Activating a spec = replacing `test.fixme` with `test` **and** flipping the
   ledger row in the same commit. A spec is never quietly deleted.
3. The advisory workflow prints the pending/active ratio on every run.
4. **M5 may not delete `legacy/` while any spec is pending.**

## Spec style (N9 — enforced, not advisory)

**Allowed selectors — these three only:**

- `page.getByRole('button', { name: /votează/i })`
- `page.getByLabel(…)`
- `page.getByText(…)`

**Banned** (the workflow greps for these and fails the job):

- CSS/DOM selectors (`page.locator('css=…')`, `page.locator('.class')`,
  `page.$`, `querySelector`)
- XPath (`xpath=`, `//div`)
- `data-testid` as a primary selector (`getByTestId`)
- Screenshot diffing (`toHaveScreenshot`/`toMatchSnapshot`;
  Chromatic/Applitools/Percy are charter-banned)

Because the target is a _new_ client, role/name selectors define the
accessible names the new UI must have — writing the spec first is how M1 seeds
WCAG 2.1 AA (N16) instead of retrofitting it in M8.

**Source citations:** every assertion carries a comment naming the legacy file
and line range it was derived from, e.g.
`// src: legacy/lib/api-v2/topics/index.js:88-134`. An assertion with no
citation is a review rejection — it means someone invented behaviour.

## Fixtures

`e2e/fixtures/{app,users}.ts` mirror `docs/develop/fixtures.md` — the shared
contract between this suite and the seed script (WU-M3a-10). Neither side may
drift from the contract file; every change lands there first. Synthetic values
only, never personal data (§4.1).
