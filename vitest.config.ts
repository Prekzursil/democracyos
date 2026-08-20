import { defineConfig } from 'vitest/config';

// Coverage lives here, not in .nycrc, and uses vitest's own v8 provider.
//
// Why not c8 wrapping vitest (the original WU-M0-4 approach): c8 sees the
// process-level V8 coverage, but vitest transforms TypeScript inside its worker,
// so nothing maps back to the .ts sources. Files that ARE executed by passing
// tests reported 0%, which meant the 100% bar could fail but could never pass —
// unsatisfiable the moment real globs entered the ratchet at M3a. Caught by the
// M0 adversarial review (finding B2). The v8 provider is transform-aware.
//
// The ratchet (plan N6): the PERCENTAGE never moves, only `include` grows.
// `include` deliberately points at a path that does not exist, so M0 is
// vacuously green. The plan's literal `include: []` cannot be used: with
// `all: true` an empty include matches EVERYTHING (verified — it sweeps tests
// and scripts and exits 1 at 0%), which is the opposite of vacuous.
export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['__coverage-ratchet-empty-until-M3a__/**'],
      exclude: [
        'legacy/**',
        'e2e/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/prisma/migrations/**',
        '**/generated/**',
        '**/test/**',
      ],
      // lcov is required so each layer (server/client/shared) can be uploaded
      // under its own flag at WU-M2-3; text keeps local runs readable.
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
