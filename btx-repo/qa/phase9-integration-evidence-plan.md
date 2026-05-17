# Phase 9: Integration Evidence Plan

## Overview
End-to-end integration testing strategy for Bharat Trust Exchange (BTX) federated trust fabric. Validates business logic, performance SLAs, and cross-node operations.

## Test Coverage

### E2E Flow Tests (`phase9-e2e-integration.test.ts`)

**Service Health**
- Control-plane health check (/healthz)
- Registry health check (/healthz)
- Trust-node health check (/healthz)

**Consent Lifecycle**
1. Register trust nodes via registry
2. Grant consent with policy evaluation (POST /v1/consents)
3. Query consent with authorization check (GET /v1/consents/{id})
4. Retrieve audit trail (GET /v1/consents/{id}/audit)
5. Revoke consent with cascade option (POST /v1/consents/{id}/revoke)

**Federation Sync**
1. Handle peer sync request with Merkle root verification
2. Get federation state for peer
3. List pending syncs for processing

**Performance Baselines**
- Consent grant: <100ms (baseline target: 30/80ms per ADR-0020)
- Consent query: <100ms (baseline target: 30/80ms)
- Idempotency key caching works correctly

### Performance Tests (k6)

**Consent Lifecycle Performance** (`perf-consent-lifecycle.k6.js`)
- Ramp-up: 10 → 50 VUs over 2 minutes
- Sustained: 50 VUs for 2 minutes
- Ramp-down: 50 → 0 VUs over 30 seconds

Thresholds:
- Grant latency p(99) < 50ms
- Query latency p(99) < 50ms
- HTTP p(95) < 100ms
- Error rate < 10%

**Federation Sync Performance** (`perf-federation-sync.k6.js`)
- Ramp-up: 5 → 20 VUs
- Sustained: 20 VUs for 1 minute
- Ramp-down

Thresholds:
- Sync latency p(99) < 1500ms (ADR-0020 cross-node budget)
- HTTP p(95) < 100ms
- Error rate < 5%

## Running Tests

### Prerequisites
```bash
# Start local stack
docker-compose up -d

# Build services
npm install
npm run build
```

### Execute E2E Tests
```bash
# Run all integration tests
npm test -- tests/phase9-e2e-integration.test.ts

# Run specific test
npm test -- tests/phase9-e2e-integration.test.ts --grep "Consent Lifecycle"
```

### Execute Performance Tests
```bash
# Install k6 (if not present)
# macOS: brew install k6
# Linux: apt-get install k6

# Run consent lifecycle perf
k6 run tests/perf-consent-lifecycle.k6.js

# Run federation sync perf (custom base URL)
TRUST_NODE_URL=http://localhost:3003 k6 run tests/perf-federation-sync.k6.js

# Run with custom environment
BASE_URL=https://prod.btx.example.com k6 run tests/perf-consent-lifecycle.k6.js
```

## Latency Budgets (ADR-0020)

| Operation | Target | Budget | Test |
|-----------|--------|--------|------|
| Policy decision | 5ms | 15ms | E2E baseline |
| Consent allow/deny | 30ms | 80ms | E2E query |
| Audit append | 20ms | 60ms | E2E audit trail |
| Cross-node revoke | 500ms | 1500ms | Perf federation sync |
| Registry lookup | 10ms | 30ms | E2E registration |
| Redis cache hit | 10ms | 30ms | E2E query |

## Evidence Artifacts

### Generated During Runs
- `tests/perf-summary.json` — k6 aggregate metrics
- Test logs with timestamps
- Error traces with stack

### Validation Checklist
- [ ] All services health OK
- [ ] Consent lifecycle E2E passes
- [ ] Federation sync E2E passes
- [ ] Grant latency within budget
- [ ] Query latency within budget
- [ ] Idempotency works
- [ ] Error rates < 10%
- [ ] No timeouts under 50 VU load
- [ ] Audit trail captured for all operations
- [ ] Cascading revoke propagates within SLA

## Post-Test Report

After running full suite, validate:
1. **Success Rate**: All tests pass
2. **Latency**: p(99) within ADR-0020 budgets
3. **Throughput**: Sustained 50 VU load stable
4. **Error Handling**: Failures handled gracefully (idempotency recovery, auth denials)
5. **Audit Trail**: All operations logged to audit_events
6. **Cross-Node**: Federation sync validated for 3+ nodes

## Next Steps
- If all thresholds met → proceed to Phase 10 (Cloud Conformance)
- If failures → debug via logs, fix services, re-run
- If latency above budget → profile with distributed tracing (OpenTelemetry)
