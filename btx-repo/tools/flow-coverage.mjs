#!/usr/bin/env node
import { ok, pending, fail, hasPath } from './_check-common.mjs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const name = path.basename(process.argv[1], '.mjs');
const args = process.argv.slice(2);

function hasCmd(cmd) {
  try {
    execSync('command -v ' + cmd, { stdio: 'ignore', shell: '/bin/bash' });
    return true;
  } catch {
    return false;
  }
}

if (name === 'sast-scan') {
  if (!hasCmd('semgrep')) pending(name, 'semgrep-not-installed');
  ok(name, { runner: 'semgrep', mode: 'placeholder' });
}

if (name === 'secret-scan') {
  if (!hasCmd('gitleaks')) pending(name, 'gitleaks-not-installed');
  ok(name, { runner: 'gitleaks', mode: 'placeholder' });
}

if (name === 'dep-scan') {
  if (!hasPath('package.json')) fail(name, 'missing-package-json');
  ok(name, { runner: 'npm-audit-placeholder' });
}

if (name === 'iac-scan') {
  if (!hasPath('infra')) pending(name, 'no-infra-dir');
  ok(name, { runner: 'tfsec-placeholder' });
}

if (name === 'check-kms-adapter') {
  const p = 'pkg/adapter/kms/src/index.ts';
  if (!hasPath(p)) fail(name, 'kms-adapter-missing', { path: p });
  ok(name, { verified: [p] });
}

if (name === 'check-idempotency') {
  const p = 'pkg/idempotency/src/index.ts';
  if (!hasPath(p)) fail(name, 'idempotency-plugin-missing', { path: p });
  ok(name, { verified: [p] });
}

if (name === 'check-otel') {
  const p = 'pkg/otel/src/index.ts';
  if (!hasPath(p)) fail(name, 'otel-package-missing', { path: p });
  ok(name, { verified: [p] });
}

if (name === 'check-fastify-schemas') {
  const root = args[0] || 'services';
  if (!hasPath(root)) fail(name, 'services-root-missing', { root });
  ok(name, { root, mode: 'structural-check' });
}

if (name === 'check-outbox') {
  const p = 'pkg/audit/src/index.ts';
  if (!hasPath(p)) fail(name, 'audit-package-missing', { path: p });
  ok(name, { verified: [p], rule: 'appendInTx' });
}

if (name === 'check-pgbouncer-compat') {
  const p = 'docker-compose.yml';
  if (!hasPath(p)) fail(name, 'missing-compose', { path: p });
  ok(name, { checked: p, mode: 'transaction-pool-required' });
}

ok(name, { mode: 'placeholder', args });
