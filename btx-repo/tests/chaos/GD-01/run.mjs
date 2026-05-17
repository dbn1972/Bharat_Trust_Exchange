#!/usr/bin/env node
/**
 * GD-01 — Chaos Scenario: Consent Revocation Cascade Failure
 *
 * Injects a failure where the OutboxPublisher is killed mid-cascade to simulate
 * a consent revocation not propagating to peer trust nodes.
 *
 * Validates: RB-001 runbook (consent-revocation-cascade.md)
 * Severity:  SEV-2
 * GameDay:   GD-01
 *
 * Usage:
 *   SCENARIO=cascade node tests/chaos/GD-01/run.mjs [--dry-run]
 *
 * Requirements:
 *   - BTX local stack running: make up
 *   - kubectl configured for staging cluster OR local docker-compose for local drill
 *   - btx-cli available in PATH
 */

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const SCENARIO = 'GD-01-consent-cascade-failure';

const log = (msg) => console.log(`[${new Date().toISOString()}] [${SCENARIO}] ${msg}`);
const exec = (cmd, label) => {
  log(`→ ${label}`);
  if (DRY_RUN) { log(`  [DRY-RUN] would run: ${cmd}`); return '{}'; }
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
};

// ── Scenario Definition ───────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'S1-setup',
    description: 'Grant a test consent that will be the revocation target',
    run: () => {
      const consentId = randomUUID();
      const body = JSON.stringify({
        citizen_id: `test-citizen-gd01-${consentId.slice(0, 8)}`,
        principal_id: 'test-provider-gd01',
        purpose_codes: ['P-FINANCIAL-LOOKUP'],
        data_class: 'citizen_portable',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      });
      const result = exec(
        `curl -sf -X POST http://localhost:3002/v1/consents \
          -H "Content-Type: application/json" \
          -H "Idempotency-Key: gd01-grant-${consentId}" \
          -d '${body}'`,
        'Grant test consent'
      );
      const parsed = JSON.parse(result);
      log(`  Created consent: ${parsed.id}`);
      return { consentId: parsed.id };
    },
  },
  {
    id: 'S2-inject-fault',
    description: 'Kill the OutboxPublisher to simulate cascade failure',
    run: () => {
      exec(
        `kubectl scale -n btx deployment/control-plane-outbox --replicas=0 2>/dev/null || \
         docker-compose -f docker-compose.yml stop control-plane-outbox 2>/dev/null || true`,
        'Stop OutboxPublisher'
      );
      // Allow time for publisher to stop
      exec('sleep 2', 'Wait for publisher to stop');
    },
  },
  {
    id: 'S3-trigger-revoke',
    description: 'Revoke the consent (should succeed but cascade should be stalled)',
    run: (ctx) => {
      const result = exec(
        `curl -sf -X POST http://localhost:3002/v1/consents/${ctx.consentId}/revoke \
          -H "Content-Type: application/json" \
          -d '{"reason": "gd01-chaos-test"}'`,
        'Revoke consent'
      );
      const parsed = JSON.parse(result);
      log(`  Revoke response status: ${parsed.status}`);
      return { ...ctx, revokeStatus: parsed.status };
    },
  },
  {
    id: 'S4-verify-stall',
    description: 'Verify outbox backlog is growing (cascade stalled)',
    run: () => {
      const result = exec(
        `curl -sf http://localhost:3002/healthz | jq '.outbox_pending // 0'`,
        'Check outbox backlog'
      );
      const pending = parseInt(result, 10);
      log(`  Outbox pending events: ${pending}`);
      if (!DRY_RUN && pending === 0) {
        throw new Error('FAIL: Expected outbox backlog > 0 after publisher killed');
      }
      log('  ✓ Cascade stall injected successfully');
    },
  },
  {
    id: 'S5-apply-runbook',
    description: 'Apply runbook RB-001: restart OutboxPublisher',
    run: () => {
      exec(
        `kubectl scale -n btx deployment/control-plane-outbox --replicas=1 2>/dev/null || \
         docker-compose -f docker-compose.yml start control-plane-outbox 2>/dev/null || true`,
        'Restart OutboxPublisher (RB-001 Step 3)'
      );
      exec('sleep 5', 'Allow publisher to drain');
    },
  },
  {
    id: 'S6-verify-recovery',
    description: 'Verify outbox drained and cascade completed',
    run: () => {
      const result = exec(
        `curl -sf http://localhost:3002/healthz | jq '.outbox_pending // 0'`,
        'Check outbox cleared'
      );
      const pending = parseInt(result, 10);
      log(`  Outbox pending after recovery: ${pending}`);
      if (!DRY_RUN && pending > 0) {
        throw new Error(`FAIL: Outbox still has ${pending} pending events after recovery`);
      }
      log('  ✓ Recovery successful — outbox drained');
    },
  },
  {
    id: 'S7-check-audit',
    description: 'Verify audit trail shows revoke + cascade events',
    run: (ctx) => {
      const result = exec(
        `curl -sf http://localhost:3002/v1/consents/${ctx.consentId}/audit`,
        'Fetch audit trail'
      );
      const events = JSON.parse(result);
      const hasRevoke = events.some((e) => e.event_type === 'consent.revoked');
      log(`  Audit events: ${events.length}; has revoke event: ${hasRevoke}`);
      if (!DRY_RUN && !hasRevoke) {
        throw new Error('FAIL: No consent.revoked event in audit trail');
      }
      log('  ✓ Audit trail complete');
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runScenario() {
  log('Starting chaos scenario GD-01');
  log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);

  const results = [];
  let ctx = {};

  for (const step of STEPS) {
    log(`\n[${step.id}] ${step.description}`);
    const start = Date.now();
    try {
      const result = step.run(ctx);
      if (result) ctx = { ...ctx, ...result };
      const duration = Date.now() - start;
      results.push({ step: step.id, status: 'pass', duration_ms: duration });
      log(`  ✓ ${step.id} passed (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      results.push({ step: step.id, status: 'fail', error: err.message, duration_ms: duration });
      log(`  ✗ ${step.id} FAILED: ${err.message}`);
      // Continue to cleanup even on failure
      if (step.id !== 'S5-apply-runbook' && step.id !== 'S6-verify-recovery') {
        log('  Attempting recovery cleanup...');
        try {
          exec(
            `kubectl scale -n btx deployment/control-plane-outbox --replicas=1 2>/dev/null || true`,
            'Emergency cleanup: restore OutboxPublisher'
          );
        } catch (_) {}
      }
      break;
    }
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log('\n' + '='.repeat(60));
  log(`GD-01 COMPLETE — ${passed}/${results.length} steps passed`);
  if (failed > 0) {
    log('RESULT: FAIL — see failed steps above');
    process.exit(1);
  } else {
    log('RESULT: PASS — runbook RB-001 validated');
    process.exit(0);
  }
}

runScenario().catch((err) => {
  console.error(err);
  process.exit(1);
});
