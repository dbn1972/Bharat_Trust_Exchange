# AR-001 — Cross-Layer Validation

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Document | cross-layer.md |
| Date | 2026-05-17 |
| Scope | All layers: BRD → Tech Spec → DB schema → API → Service → Policy → Test |
| Method | Manual trace + diff scan |
| Related | [drift.yaml](./drift.yaml) |

---

## 1. Layer Map

```
BRD requirements
  └─► Tech spec / ADRs
        └─► DB schema (migrations/)
              └─► Domain model (domain/*.ts)
                    └─► API contract (server.ts routes + Fastify schema)
                          └─► Service logic (domain/*-service.ts)
                                └─► Policy (policies/*.rego)
                                      └─► Tests
```

---

## 2. Consent Layer Trace

| Layer | Artefact | Field: principalId | Field: subjectId | Field: purpose | Field: dataFields | Field: expiresAt | Field: status |
|---|---|---|---|---|---|---|---|
| Domain model | `domain/consent.ts` | ✅ `principal_id` | ✅ `subject_id` | ✅ `purpose` | ✅ `data_fields` (array) | ✅ `expires_at` | ✅ `status` |
| DB schema | `migrations/001_init_consents.sql` | ✅ `principal_id` | ✅ `subject_id` | ✅ `purpose` | ✅ `data_fields jsonb` | ✅ `expires_at` | ✅ `status` enum |
| API request schema | `server.ts` POST /v1/consents | ✅ `principalId` | ✅ `subjectId` | ✅ `purpose` | ✅ `dataFields` | ✅ `expiresAt` | — |
| API response schema | `server.ts` consent response | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Policy | `policies/consent/grant.rego` | ✅ `input.principal_id` | ✅ `input.subject_id` | ✅ `input.purpose` | — (not evaluated) | — | — |
| Unit tests | `consent-service.test.ts` | ✅ | ✅ | ✅ | ✅ (PII check) | — | ✅ |

**No drift detected in consent core fields.**

---

## 3. Federation Layer Trace

| Layer | Artefact | Field: nodeId | Field: cursor | Field: signature | Field: state |
|---|---|---|---|---|---|
| Domain model | `domain/federation.ts` | ✅ | ✅ | ✅ | ✅ |
| DB schema | `migrations/` | ✅ (inferred from FederationRepository) | ✅ | ✅ | ✅ |
| API request | `server.ts` POST /v1/federation/sync | ✅ | ✅ | ✅ | — |
| Service | `federation-service.ts` | ✅ | ✅ | ✅ | ✅ |

**No drift detected in federation fields.**

---

## 4. Registry Layer Trace

| Layer | Artefact | Field: nodeId | Field: status | Field: capabilities | Field: apiVersion |
|---|---|---|---|---|---|
| Domain model | `domain/trust-node.ts` | ✅ | ✅ | ✅ | ⚠️ Not in domain model |
| DB schema | `migrations/` | ✅ | ✅ | ✅ | ❌ Missing (G-05) |
| API request | `server.ts` POST /v1/nodes | ✅ | ✅ | ✅ | ❌ Not in schema |
| API response | `server.ts` node response | ✅ | ✅ | ✅ | ❌ Not returned |

**Drift detected: `api_version` field proposed in ADR-0024 (versioning strategy) does not exist in DB schema, domain model, or API surface. Logged as G-05.**

---

## 5. Audit Event Layer Trace

| Layer | Artefact | Field: eventType | Field: consentId | Field: principalId | PII check |
|---|---|---|---|---|---|
| Domain model | `domain/consent.ts` `AuditEventType` | ✅ | ✅ | ✅ | — |
| DB schema | `audit_events` table | ✅ | ✅ | ✅ | ✅ subject_id is hashed |
| Outbox payload | `appendInTransaction` | ✅ | ✅ | ✅ | ✅ (no PII confirmed in CR-001 test) |
| Policy | ADR-0025 + DPIA | ✅ | ✅ | ✅ | ✅ |

**No drift detected in audit event fields.**

---

## 6. Drift Summary

| Drift ID | Layer pair | Field | Severity | Status |
|---|---|---|---|---|
| DFT-01 | Domain ↔ DB ↔ API (registry) | `api_version` absent | Medium | Open (G-05) |
| DFT-02 | Service ↔ Transport (trust-node) | `kmsVerify` not wired | Blocking | Open (B-01) |
| DFT-03 | Service ↔ Transport (control-plane) | `ObjectStoreAdapter` not wired | Blocking | Open (B-02) |

---

## 7. Contract Conformance

| Contract check | Method | Result |
|---|---|---|
| Fastify schema PASS | `make lint` conformance | ✅ PASS |
| API versioning (`/v1/` prefix) | All routes inspected | ✅ All routes use `/v1/` |
| Sunset header (ADR-0024) | Server middleware | ❌ Not yet implemented — `Sunset` header not added to responses |
| Outbox payload has no PII | Test assertion | ✅ (consent-service.test.ts outbox PII check) |
| Data residency check on startup | Code path | ✅ `ResidencyViolationError` in bootstrap |

**Additional drift**: `Sunset` response header (required by ADR-0024 for future deprecation) not yet implemented in any service. Logged as DFT-04.

| Drift ID | Layer pair | Description | Severity |
|---|---|---|---|
| DFT-04 | ADR-0024 ↔ server.ts | Sunset header not emitted | Low |
