#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { ok, fail } from './_check-common.mjs';

const service = process.argv[2] || 'control-plane';

const suiteMap = {
  all: [
    'tests/phase7-integration.test.ts',
    'tests/phase9-e2e-integration.test.ts',
  ],
  'control-plane': ['tests/phase7-integration.test.ts'],
  registry: ['tests/phase9-e2e-integration.test.ts'],
  'trust-node': ['tests/phase9-e2e-integration.test.ts'],
};

const suites = suiteMap[service];
if (!suites) {
  fail('run-integration', 'unsupported-service', { service, supported: Object.keys(suiteMap) });
}

try {
  execFileSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts', ...suites],
    { stdio: 'inherit', env: process.env }
  );
  ok('run-integration', { service, suites });
} catch (error) {
  fail('run-integration', 'integration-suite-failed', {
    service,
    suites,
    message: error instanceof Error ? error.message : String(error),
  });
}
