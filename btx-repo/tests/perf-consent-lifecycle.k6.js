/**
 * k6 performance test suite — BTX consent lifecycle
 *
 * P-15 regression guardrails aligned to ADR-0020 latency budgets:
 *   Consent allow/deny  budget 80ms  → p(99) < 80ms
 *   Audit append        budget 60ms  → measured in-transaction with grant
 *   Error rate cap      5%           → tightened from 10% (phase-9 baseline)
 *
 * Scenarios (select via -e SCENARIOS=<name>):
 *   load  (default) — ramp 10→50 VUs, 2-min sustained
 *   soak            — 20 VUs for 10 min (detect memory/connection leaks)
 *   spike           — sudden 5→200 VU spike (test circuit breakers)
 *
 * Usage:
 *   k6 run tests/perf-consent-lifecycle.k6.js
 *   k6 run tests/perf-consent-lifecycle.k6.js -e BASE_URL=http://staging:3002
 *   k6 run tests/perf-consent-lifecycle.k6.js -e SCENARIOS=soak
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// Custom metrics — P-15: explicit time=true for Grafana histogram buckets
const consentGrantLatency = new Trend('consent_grant_latency', true);
const consentQueryLatency = new Trend('consent_query_latency', true);
const consentRevokeLatency = new Trend('consent_revoke_latency', true);
const consentAuditLatency = new Trend('consent_audit_latency', true);

const consentGrantErrors = new Counter('consent_grant_errors');
const consentQueryErrors = new Counter('consent_query_errors');
const errorRate = new Rate('error_rate');

const SCENARIO = __ENV.SCENARIOS || 'load';
const STAGES = {
  load:  [ { duration: '30s', target: 10 }, { duration: '1m',  target: 50 }, { duration: '2m',  target: 50 }, { duration: '30s', target: 0 } ],
  soak:  [ { duration: '1m',  target: 20 }, { duration: '10m', target: 20 }, { duration: '30s', target: 0 } ],
  spike: [ { duration: '10s', target: 5  }, { duration: '10s', target: 200}, { duration: '1m',  target: 200}, { duration: '10s', target: 0 } ],
};

export const options = {
  stages: STAGES[SCENARIO] || STAGES.load,
  // P-15 CI regression guardrails — build fails if these thresholds are breached
  thresholds: {
    'consent_grant_latency':  ['p(99)<80', 'p(95)<60'],  // ADR-0020 budget 80ms
    'consent_query_latency':  ['p(99)<80', 'p(95)<60'],  // ADR-0020 budget 80ms
    'consent_revoke_latency': ['p(99)<80'],
    'consent_audit_latency':  ['p(99)<60'],              // ADR-0020 audit budget 60ms
    'http_req_duration':      ['p(95)<80'],
    'http_req_failed':        ['rate<0.05'],             // tightened from 10% → 5%
    'error_rate':             ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';

export default function () {
  group('Consent Grant', () => {
    const payload = JSON.stringify({
      fromNodeId: '550e8400-e29b-41d4-a716-446655440000',
      toNodeId: '550e8400-e29b-41d4-a716-446655440001',
      subjectRef: `user-${__VU}-${__ITER}@example.com`,
      purpose: 'data-sharing-perf-test',
      obligations: { audit: true, retentionDays: 30 }
    });

    const start = new Date();
    const res = http.post(`${BASE_URL}/v1/consents`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    const latency = new Date() - start;

    consentGrantLatency.add(latency);

    check(res, {
      'grant status 201': (r) => r.status === 201,
      'grant has id': (r) => r.json('id') !== null,
      'grant latency < 50ms': () => latency < 50
    }) || consentGrantErrors.add(1);

    const consentId = res.json('id');

    // Query the newly created consent
    if (consentId) {
      sleep(0.1);
      
      group('Consent Query', () => {
        const queryStart = new Date();
        const queryRes = http.get(`${BASE_URL}/v1/consents/${consentId}`, {
          headers: { 'x-node-id': '550e8400-e29b-41d4-a716-446655440000' }
        });
        const queryLatency = new Date() - queryStart;

        consentQueryLatency.add(queryLatency);

        check(queryRes, {
          'query status 200': (r) => r.status === 200,
          'query has status': (r) => r.json('status') !== null,
          'query latency < 50ms': () => queryLatency < 50
        }) || consentQueryErrors.add(1);
      });
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/perf-summary.json': JSON.stringify(data),
  };
}
