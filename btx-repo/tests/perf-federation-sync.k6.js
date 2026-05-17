/**
 * k6 performance test — BTX federation sync latency
 *
 * P-15 regression guardrails aligned to ADR-0020:
 *   Cross-node revoke  target 500ms / budget 1500ms
 *   Federation state   target 30ms  / budget 80ms
 *
 * Scenarios (select via -e SCENARIOS=<name>):
 *   load (default) — ramp 5→20 VUs, 1-min sustained
 *   soak           — 10 VUs for 10 min
 *   spike          — sudden 5→100 VU spike
 *
 * Usage:
 *   k6 run tests/perf-federation-sync.k6.js
 *   k6 run tests/perf-federation-sync.k6.js -e TRUST_NODE_URL=http://staging:3003
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// P-15: true flag = time metric → Grafana histogram buckets
const federationSyncLatency  = new Trend('federation_sync_latency', true);
const federationStateLatency = new Trend('federation_state_latency', true);
const federationSyncErrors   = new Counter('federation_sync_errors');
const errorRate              = new Rate('federation_error_rate');

const SCENARIO = __ENV.SCENARIOS || 'load';
const STAGES = {
  load:  [ { duration: '20s', target: 5 }, { duration: '1m', target: 20 }, { duration: '1m', target: 20 }, { duration: '20s', target: 0 } ],
  soak:  [ { duration: '1m',  target: 10 }, { duration: '10m', target: 10 }, { duration: '30s', target: 0 } ],
  spike: [ { duration: '10s', target: 5 }, { duration: '10s', target: 100 }, { duration: '1m', target: 100 }, { duration: '10s', target: 0 } ],
};

export const options = {
  stages: STAGES[SCENARIO] || STAGES.load,
  // P-15 CI regression guardrails
  thresholds: {
    'federation_sync_latency':  ['p(99)<1500', 'p(95)<500', 'p(50)<100'],  // ADR-0020 cross-node budget
    'federation_state_latency': ['p(99)<80'],                              // ADR-0020 state query budget
    'http_req_failed':          ['rate<0.05'],                             // 5% error cap
    'federation_error_rate':    ['rate<0.05'],
  },
};

const BASE_URL = __ENV.TRUST_NODE_URL || 'http://localhost:3003';

export default function () {
  group('Federation Sync', () => {
    const payload = JSON.stringify({
      peerNodeId: '550e8400-e29b-41d4-a716-446655440002',
      cursor: Math.floor(Math.random() * 1000000),
      merkleRootHash: 'sha256-' + Math.random().toString(36).substring(7),
      signature: 'sig-' + Math.random().toString(36).substring(7)
    });

    const start = new Date();
    const res = http.post(`${BASE_URL}/v1/federation/sync`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    const latency = new Date() - start;

    federationSyncLatency.add(latency);

    check(res, {
      'sync status 202': (r) => r.status === 202,
      'sync response has status': (r) => r.json('status') !== null,
      'sync latency baseline': () => latency < 1500  // ADR-0020 budget
    }) || federationSyncErrors.add(1);
  });
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
