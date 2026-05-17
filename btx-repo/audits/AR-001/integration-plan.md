# AR-001 — Deep Integration Test Design

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Document | integration-plan.md |
| Date | 2026-05-17 |
| Scope | Cross-service + cross-Trust-Node + cross-cloud integration scenarios |
| Status | Design — not yet implemented |
| Related | [module-map.yaml](./module-map.yaml) |

---

## 1. Test Philosophy

Unit tests verify domain logic in isolation (stubs injected). Integration tests verify the full wiring:
- Domain logic + real adapter (real Postgres, real Redis, real Kafka via Redpanda)
- Cross-service calls (registry → trust-node → control-plane)
- Cross-Trust-Node federation (two trust-node instances communicating)
- Cross-cloud portability (same test suite against AWS stub + GCP stub)

All integration tests run in Docker Compose (local) and CI (ephemeral container environment).

---

## 2. Module Interaction Map

```
Citizen Portal (browser)
  │
  ▼ POST /v1/consents
control-plane ─► PostgreSQL (consents, audit_events, outbox)
                │
                ├─► Redis (idempotency)
                │
                └─► OutboxPublisher ─► Redpanda/Kafka (consent.events topic)
                                             │
                                             ▼
                                    downstream consumers
                                    (simulated in integration tests)

trust-node ─► control-plane (federation sync carries consent cursor)
           │
           └─► KMS adapter (sign/verify sync messages)

registry ─► trust-node (node lookup before sync)
```

---

## 3. Integration Test Scenarios

### IT-01 — Full Consent Lifecycle (single node)

**Scope**: control-plane + Postgres + Redis + Redpanda

**Steps**:
1. POST /v1/consents → expect 201, `consentId` returned
2. Check Postgres: consent row exists with status=active
3. Check Postgres: audit_event row exists with type=CONSENT_GRANTED
4. Check Postgres: outbox row exists
5. Wait for OutboxPublisher to drain outbox (poll 5s)
6. Check Redpanda: message on `consent.events` topic
7. POST /v1/consents/:id/revoke → expect 200
8. Check Postgres: consent status = revoked
9. Check Redpanda: revocation message on topic
10. POST /v1/consents/:id/revoke again → expect 422 (idempotent)
11. GET /v1/consents/:id/audit → expect 2 entries (grant + revoke)

**Pass criteria**: All assertions pass within 30s

---

### IT-02 — Policy Deny (control-plane + OPA)

**Scope**: control-plane + OPA policy bundle

**Steps**:
1. POST /v1/consents with a purpose code that policy denies → expect 403
2. Verify no consent row created in Postgres
3. Verify no outbox row created

**Pass criteria**: 403 response; DB clean

---

### IT-03 — Fail-Closed on PDP Error

**Scope**: control-plane + OPA (OPA stopped mid-test)

**Steps**:
1. Stop OPA container
2. POST /v1/consents → expect 500 (PDP unreachable → fail-closed)
3. Verify no consent row created

**Pass criteria**: 500 response (or 503); DB clean

---

### IT-04 — Data Residency Gate

**Scope**: control-plane bootstrap + env config

**Steps**:
1. Start service with `CLOUD_REGION=us-east-1`
2. Expect process to exit with `ResidencyViolationError`

**Pass criteria**: Process exits; error message contains "ResidencyViolationError"

---

### IT-05 — Cross-Trust-Node Federation Sync

**Scope**: trust-node A + trust-node B + KMS stub + Postgres

**Steps**:
1. Register Node A and Node B in registry
2. Node A has consent cursor = 100
3. Node B sends POST /v1/federation/sync to Node A with signed payload
4. Node A verifies signature via KMS
5. Node A updates cursor + federation state
6. GET /v1/federation/state/:nodeBId from Node A → expect cursor = from Node B

**Pass criteria**: Federation state updated; signature verification logged

**Note**: Requires B-01 (kmsVerify wiring) to be resolved first.

---

### IT-06 — Outbox Publisher Failure Recovery (Chaos)

**Scope**: control-plane + Redpanda + OutboxPublisher

**Steps**:
1. Create 5 consents (5 outbox rows)
2. Kill Redpanda container
3. Wait 10s — confirm outbox rows still pending
4. Restart Redpanda
5. Wait for OutboxPublisher to drain (poll 30s)
6. Verify all 5 messages delivered to Redpanda

**Pass criteria**: Messages eventually delivered (at-least-once)

**Related chaos**: GD-02 (network partition scenario)

---

### IT-07 — Cross-Cloud Adapter Conformance

**Scope**: KMS stub + KMS AWS stub + KMS GCP stub (all run against real adapter interface)

**Steps** (for each cloud adapter):
1. Call `kmsSign({ payload: testPayload })`
2. Call `kmsVerify({ payload: testPayload, signature })` → expect true
3. Call `kmsVerify({ payload: differentPayload, signature })` → expect false
4. Call `objectStorePut({ key, data })` → expect no error
5. Call `objectStoreGet({ key })` → expect data matches

**Pass criteria**: All adapters pass all 5 assertions

---

### IT-08 — Consent Query Authorization (cross-principal)

**Scope**: control-plane + Postgres

**Steps**:
1. Create consent with `subjectId=citizen-A`, `principalId=principal-X`
2. GET /v1/consents/:id with `x-btx-caller=citizen-A` → expect 200
3. GET /v1/consents/:id with `x-btx-caller=principal-X` → expect 200
4. GET /v1/consents/:id with `x-btx-caller=principal-Y` → expect 403

**Pass criteria**: 200/200/403 as specified

---

## 4. Test Infrastructure

| Component | Technology | Notes |
|---|---|---|
| Test runner | Jest + testcontainers-node | Spins up Postgres/Redis/Redpanda per test suite |
| Postgres | postgres:16 (Docker) | Migrations applied via `runMigrations()` helper |
| Redis | redis:7 (Docker) | Flushed between suites |
| Redpanda | redpandadata/redpanda:latest | Single-node; `rpk` CLI for topic inspection |
| OPA | openpolicyagent/opa:latest | Loaded with policy bundle from `policies/` |
| KMS stub | in-process (Node) | No Docker required |

---

## 5. Implementation Plan

| Step | Action | Owner | Notes |
|---|---|---|---|
| 1 | Create `tests/integration/` directory | @backend-lead | |
| 2 | Write `helpers/containers.ts` (testcontainers setup) | @backend-lead | |
| 3 | Implement IT-01 (consent lifecycle) | @backend-lead | Highest priority |
| 4 | Implement IT-02 + IT-03 (policy) | @backend-lead | |
| 5 | Implement IT-04 (residency gate) | @backend-lead | |
| 6 | Implement IT-07 (cross-cloud) | @backend-lead | After P-17/P-18 |
| 7 | Implement IT-05 (federation) | @backend-lead | After B-01 fixed |
| 8 | Add integration test step to CI | @devops | |

---

## 6. Coverage Gap After Integration Tests

Once IT-01 through IT-08 are implemented, remaining coverage gaps:
- Portal E2E tests (consent grant flow in browser — Playwright)
- Multi-region federation (two geographic regions)
- DPDP deletion compliance test (confirm data deleted after retention period)
