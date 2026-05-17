/**
 * k6 performance test suite for BTX
 * Validates latency budgets and throughput under load
 * 
 * Usage:
 *   k6 run tests/perf-consent-lifecycle.k6.js
 *   k6 run tests/perf-federation-sync.k6.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics
const consentGrantLatency = new Trend('consent_grant_latency', { unit: 'ms' });
const consentQueryLatency = new Trend('consent_query_latency', { unit: 'ms' });
const federationSyncLatency = new Trend('federation_sync_latency', { unit: 'ms' });

const consentGrantErrors = new Counter('consent_grant_errors');
const consentQueryErrors = new Counter('consent_query_errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp-up to 10 VUs
    { duration: '1m', target: 50 },   // Ramp-up to 50 VUs
    { duration: '2m', target: 50 },   // Sustained at 50 VUs
    { duration: '30s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    'consent_grant_latency': ['p(99)<50'],     // 99th percentile < 50ms
    'consent_query_latency': ['p(99)<50'],     // 99th percentile < 50ms
    'federation_sync_latency': ['p(99)<100'],  // 99th percentile < 100ms
    'http_req_duration': ['p(95)<100'],        // 95th percentile < 100ms
    'http_req_failed': ['rate<0.1'],           // <10% error rate
  }
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
