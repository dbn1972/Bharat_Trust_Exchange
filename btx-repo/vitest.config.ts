import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,        // expose describe, it, expect, beforeEach, afterEach, vi globally
    environment: 'node',
    include: [
      'services/**/src/__tests__/**/*.test.ts',
      'services/**/tests/unit/**/*.test.ts',
      'services/**/tests/integration/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['node_modules', 'dist'],
  },
});
