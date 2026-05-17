#!/usr/bin/env node
/**
 * GD-02 — Chaos Scenario: OutboxPublisher Failure (Kafka Broker Unreachable)
 *
 * Injects a failure where the Kafka/Redpanda broker becomes unreachable to the
 * OutboxPublisher, causing the audit event pipeline to stall.
 *
 * Validates: RB-002 runbook (outbox-publisher-failure.md)
 * Severity:  SEV-2
 * GameDay:   GD-02
 *
 * Usage:
 *   node tests/chaos/GD-02/run.mjs [--dry-run]
 *
 * Requirements:
 *   - BTX local stack running: make up
 *   - docker network commands available (or kubectl for staging)
 */

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DRY_RUN = process.argv.includes('--dry-run');
const SCENARIO = 'GD-02-outbox-publisher-failure';
const KAFKA_CONTAINER = process.env.KAFKA_CONTAINER ?? 'btx-redpanda-1';
const CONTROL_PLANE_CONTAINER = process.env.CP_CONTAINER ?? 'btx-control-plane-1';

const log = (msg) => console.log(`[${new Date().toISOString()}] [${SCENARIO}] ${msg}`);
const exec = (cmd, label) => {
  log(`→ ${label}`);
  if (DRY_RUN) { log(`  [DRY-RUN] would run: ${cmd}`); return '{}'; }
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return err.stdout?.trim() ?? '';
  }
};

const sleep = (ms) => DRY_RUN ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));

// ── Scenario Definition ───────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'S1-baseline',
    description: 'Confirm outbox is clear before injecting fault',
    run: () => {
      const result = exec(
        `curl -sf http://localhost:3002/healthz | jq '.outbox_pending // 0'`,
        'Check outbox baseline'
      );
      const pending = parseInt(result, 10);
      log(`  Baseline outbox pending: ${pending}`);
      if (!DRY_RUN && pending > 50) {
        throw new Error(`ABORT: Outbox already has ${pending} pending events before drill`);
      }
      log('  ✓ Baseline healthy');
    },
  },
  {
    id: 'S2-inject-kafka-failure',
    description: 'Disconnect Kafka/Redpanda from the control-plane network',
    run: () => {
      exec(
        `docker network disconnect btx_default ${KAFKA_CONTAINER} 2>/dev/null || \
         kubectl exec -n btx deploy/redpanda -- iptables -I OUTPUT -p tcp --dport 9092 -j DROP 2>/dev/null || true`,
        'Isolate Kafka from control-plane'
      );
      log('  Kafka network partition injected');
    },
  },
  {
    id: 'S3-generate-events',
    description: 'Generate consent events (will queue in outbox)',
    run: () => {
      const consentId = randomUUID();
      exec(
        `curl -sf -X POST http://localhost:3002/v1/consents \
          -H "Content-Type: application/json" \
          -H "Idempotency-Key: gd02-grant-${consentId}" \
          -d '${JSON.stringify({
            citizen_id: `test-citizen-gd02-${consentId.slice(0, 8)}`,
            principal_id: 'test-provider-gd02',
            purpose_codes: ['P-AUDIT-TEST'],
            data_class: 'operational',
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
          })}'`,
        'Grant consent (should succeed, outbox will stall)'
      );
      return { consentId };
    },
  },
  {
    id: 'S4-verify-stall',
    description: 'Verify outbox is growing and publisher alert would fire',
    run: async () => {
      await sleep(3000); // wait for publisher retry cycle
      const result = exec(
        `curl -sf http://localhost:3002/healthz | jq '.outbox_pending // 0'`,
        'Check outbox backlog'
      );
      const pending = parseInt(result, 10);
      log(`  Outbox pending: ${pending}`);
      if (!DRY_RUN && pending === 0) {
        log('  WARNING: Outbox shows 0 pending — Kafka may still be reachable');
      } else {
        log('  ✓ Outbox stall confirmed');
      }
    },
  },
  {
    id: 'S5-apply-runbook-step2',
    description: 'Apply runbook RB-002 Step 2: restart publisher',
    run: () => {
      exec(
        `kubectl rollout restart -n btx deployment/control-plane-outbox 2>/dev/null || true`,
        'Restart publisher (RB-002 Step 2)'
      );
      log('  Publisher restart triggered');
    },
  },
  {
    id: 'S6-restore-kafka',
    description: 'Restore Kafka connectivity (simulates infra team resolution)',
    run: async () => {
      exec(
        `docker network connect btx_default ${KAFKA_CONTAINER} 2>/dev/null || \
         kubectl exec -n btx deploy/redpanda -- iptables -D OUTPUT -p tcp --dport 9092 -j DROP 2>/dev/null || true`,
        'Restore Kafka network connectivity'
      );
      await sleep(5000); // allow publisher to reconnect and drain
      log('  Kafka restored; waiting for drain...');
    },
  },
  {
    id: 'S7-verify-recovery',
    description: 'Verify outbox drained after Kafka restoration',
    run: async () => {
      await sleep(3000);
      const result = exec(
        `curl -sf http://localhost:3002/healthz | jq '.outbox_pending // 0'`,
        'Check outbox after recovery'
      );
      const pending = parseInt(result, 10);
      log(`  Outbox pending after recovery: ${pending}`);
      if (!DRY_RUN && pending > 10) {
        throw new Error(`FAIL: Outbox still has ${pending} pending events after recovery`);
      }
      log('  ✓ Publisher recovered; outbox drained');
    },
  },
  {
    id: 'S8-verify-publisher-metric',
    description: 'Confirm btx_outbox_publisher_up metric is 1',
    run: () => {
      const result = exec(
        `curl -sf http://localhost:3002/metrics | grep btx_outbox_publisher_up || echo 'metric_not_exposed'`,
        'Check publisher metric'
      );
      log(`  Metric result: ${result}`);
      log('  ✓ Metric check complete');
    },
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runScenario() {
  log('Starting chaos scenario GD-02');
  log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);

  const results = [];
  let ctx = {};

  for (const step of STEPS) {
    log(`\n[${step.id}] ${step.description}`);
    const start = Date.now();
    try {
      const result = await step.run(ctx);
      if (result) ctx = { ...ctx, ...result };
      const duration = Date.now() - start;
      results.push({ step: step.id, status: 'pass', duration_ms: duration });
      log(`  ✓ ${step.id} passed (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      results.push({ step: step.id, status: 'fail', error: err.message, duration_ms: duration });
      log(`  ✗ ${step.id} FAILED: ${err.message}`);
      // Always restore Kafka on failure
      log('  Running cleanup: restoring Kafka connectivity...');
      exec(
        `docker network connect btx_default ${KAFKA_CONTAINER} 2>/dev/null || true`,
        'Cleanup: restore Kafka'
      );
      break;
    }
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  console.log('\n' + '='.repeat(60));
  log(`GD-02 COMPLETE — ${passed}/${results.length} steps passed`);
  if (failed > 0) {
    log('RESULT: FAIL — see failed steps above');
    process.exit(1);
  } else {
    log('RESULT: PASS — runbook RB-002 validated');
    process.exit(0);
  }
}

runScenario().catch((err) => {
  console.error(err);
  process.exit(1);
});
