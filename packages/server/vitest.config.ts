import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The schema probe files share live tables in the dev database (TRUNCATE
    // between suites); running them in parallel would interleave resets.
    fileParallelism: false,
  },
});
