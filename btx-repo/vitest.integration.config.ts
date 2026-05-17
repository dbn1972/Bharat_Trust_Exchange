import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 120000,
    include: ['tests/**/*.test.ts'],
  },
});