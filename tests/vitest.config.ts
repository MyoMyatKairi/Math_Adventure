import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: __dirname,
    include: ['integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
