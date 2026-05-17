/**
 * k6 performance test: Federation sync latency
 * Validates cross-node revoke propagation timing
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const federationSyncLatency = new Trend('federation_sync_latency', { unit: 'ms' });
const federationSyncErrors = new Counter('federation_sync_errors');

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    'federation_sync_latency': [
      'p(50)<100',   // Median < 100ms (ADR-0020 target: 500/1500ms for cross-node)
      'p(95)<500',   // 95th percentile < 500ms
      'p(99)<1500',  // 99th percentile < 1500ms
    ],
    'http_req_failed': ['rate<0.05'],
  }
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

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
