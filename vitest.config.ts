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
//
// M0—M1 ran the ratchet VACUOUS (`include` pointing at a nonexistent path, so
// nothing was measured; the plan's literal `include: []` cannot be used — with
// `all: true` an empty include matches EVERYTHING). That became untenable at
// WU-M2 validation: the pinned qzp workflow (SHA 38b86a1f, PR #286 "assert the
// number", merged 12.08.2026 — AFTER the plan froze "still include: []" as
// M2's exit state) parses the coverage summary the run produced and FAILS on
// anything below the bar. A vacuous run prints `All files | 0 | 0 | 0 | 0`,
// which the workflow's jsts_coverage_assert.py reads as MEASURED 0.00% —
// reproduced locally with the exact embedded helper (exit 1, "line coverage
// 0.00% is below the required 100.00%"). An unmeasured run fails too, by
// design ("the 100% gate cannot pass unmeasured"), so vacuous-green is not
// expressible under this workflow at all. The ratchet therefore grows EARLY,
// in its own sanctioned direction (include only ever grows), to the M0
// package skeletons — which the M0 unit tests genuinely cover at 100% —
// instead of waiting for M3a. Deviation from the plan's "Ratchet at exit:
// still include: []" — recorded in the WU-M2 report.
export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['packages/*/src/**'],
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
