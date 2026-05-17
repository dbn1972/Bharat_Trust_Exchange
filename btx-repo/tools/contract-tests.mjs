#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { ok, fail } from './_check-common.mjs';

const contractTarget = process.argv[2] || 'all';
const cloud = process.argv[3] || 'stub';

if (cloud !== 'stub') {
  fail('contract-tests', 'unsupported-cloud-profile', {
    cloud,
    supported: ['stub'],
  });
}

const suiteMap = {
  all: ['tests/phase9-e2e-integration.test.ts'],
  e2e: ['tests/phase9-e2e-integration.test.ts'],
  portal: ['tests/phase9-e2e-integration.test.ts'],
};

const suites = suiteMap[contractTarget];
if (!suites) {
  fail('contract-tests', 'unsupported-contract-target', {
    contractTarget,
    supported: Object.keys(suiteMap),
  });
}

try {
  execFileSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts', ...suites],
    { stdio: 'inherit', env: process.env }
  );
  ok('contract-tests', { contractTarget, cloud, suites });
} catch (error) {
  fail('contract-tests', 'contract-suite-failed', {
    contractTarget,
    cloud,
    suites,
    message: error instanceof Error ? error.message : String(error),
  });
}
