import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,        // expose describe, it, expect, beforeEach, afterEach, vi globally
    environment: 'node',
    include: [
      // Pure unit tests — mocked dependencies, no real IO
      'services/**/src/__tests__/**/*.test.ts',
      // Lightweight integration scaffolding (no server imports)
      'services/**/tests/integration/**/*.test.ts',
      'services/**/tests/unit/**/*.test.ts',
    ],
    exclude: [
      // health.test.ts files import the real Fastify server (which pulls pg/ioredis etc.)
      // and trigger onReady lifecycle — run them via `make integration` with Docker up.
      '**/tests/unit/health.test.ts',
      // federation-sync needs trust-node service running
      '**/tests/integration/federation-sync.test.ts',
      // phase7/9 use mocha/chai — not vitest-compatible
      'tests/**',
      'node_modules',
      'dist',
    ],
  },
});
