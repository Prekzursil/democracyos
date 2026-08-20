import { defineConfig, devices } from '@playwright/test';

// e2e harness (WU-M1-1, plan §4.2). The app these specs target does not exist
// until M4 (API) / M5 (UI), so the baseURL default is a placeholder that no
// spec may rely on being live: every spec stays quarantined via test.fixme(...)
// until its activation milestone in e2e/SPEC-LEDGER.md. The suite is therefore
// meaningful with zero active tests — pending (amber), never failing (red).
export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  fullyParallel: true,
  // A stray test.only would silently shrink the suite in CI — refuse it there.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    // Artifacts only when something goes wrong; screenshot diffing as an
    // assertion mechanism is charter-banned (§4.2) — these are debug output.
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
