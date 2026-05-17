# AR-001 — Product Status Review

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Date | 2026-05-17 |
| Auditor | @agent (autonomous) |
| Scope | BTX v0.1.0 — all services, policies, docs, UX |
| Branch | `agent/autonomous-phase-1` |
| Related | [inventory.yaml](./inventory.yaml) |

---

## 1. Purpose

This review establishes an honest, evidence-based inventory of what exists, what is implemented, what is stubbed, and what is absent in the BTX v0.1.0 release candidate. It is the authoritative source of record for the release readiness scorecard (AR-001/readiness.md).

---

## 2. Services

| Service | Status | Notes |
|---|---|---|
| `services/control-plane` | ✅ Implemented | Consent grant/revoke/query/audit. Transactional outbox. DB repo. Fastify server. |
| `services/registry` | ✅ Implemented | Node register/lookup/list. DB repo. Fastify server. |
| `services/trust-node` | ✅ Implemented | Federation sync state machine. kmsVerify DI. Fastify server. |

### Known gaps in services
| Gap ID | Service | Description | Severity |
|---|---|---|---|
| B-01 | trust-node | `kmsVerify` injected but not wired in `server.ts` — stub used in prod | Blocking |
| B-02 | control-plane | `ObjectStoreAdapter` not wired for audit archival | Blocking |
| G-03 | control-plane | Consent expiry job not implemented — manual revoke required | High |
| G-04 | control-plane | Redis idempotency key not behind interface (testability gap) | Medium |
| G-05 | registry | `api_version` column missing from `trust_nodes` schema | Medium |

---

## 3. Cloud Adapters

| Adapter | Stub | AWS | GCP | Azure | Notes |
|---|---|---|---|---|---|
| KMS sign | ✅ | ✅ | ✅ | ✅ | Factory in `pkg/bootstrap` |
| KMS verify | ✅ | ✅ | ✅ | ✅ | Not wired in trust-node (B-01) |
| ObjectStore put | ✅ | ✅ | ✅ | ✅ | Not wired in control-plane (B-02) |

---

## 4. API Surface

| Endpoint | Service | Status | Auth | Notes |
|---|---|---|---|---|
| `POST /v1/consents` | control-plane | ✅ | `x-btx-caller` header | Policy eval |
| `POST /v1/consents/:id/revoke` | control-plane | ✅ | `x-btx-caller` | Policy eval + cascade |
| `GET /v1/consents/:id` | control-plane | ✅ | `x-btx-caller` | Own or authorized |
| `GET /v1/consents/:id/audit` | control-plane | ✅ | `x-btx-caller` | Read-only |
| `POST /v1/nodes` | registry | ✅ | None (stub) | Node registration |
| `GET /v1/nodes/:id` | registry | ✅ | None (stub) | Lookup |
| `GET /v1/nodes` | registry | ✅ | None (stub) | List |
| `POST /v1/federation/sync` | trust-node | ✅ | Signature verify | kmsVerify DI |
| `GET /v1/federation/state/:nodeId` | trust-node | ✅ | None (stub) | |
| `GET /v1/federation/pending` | trust-node | ✅ | None (stub) | |
| `GET /healthz` | all | ✅ | None | |

---

## 5. Policies

| Policy | File | Status |
|---|---|---|
| Consent grant | `policies/consent/grant.rego` | ✅ (as per Phases 0–10 build) |
| Consent revoke | `policies/consent/revoke.rego` | ✅ |
| Data residency check | ADR-0025 + `ResidencyViolationError` | ✅ |
| OBL-RESIDENCY-CHECK | Referenced in ADR-0025 + DPIA | ✅ (documented; enforcement in startup hook) |

---

## 6. Documentation

| Document | Status |
|---|---|
| ADRs 0020–0025 | ✅ |
| Threat model (STRIDE+LINDDUN) | ✅ |
| DPIA (DPDP 2023) | ✅ |
| Runbooks (RB-001, RB-002) | ✅ |
| Chaos scenarios (GD-01, GD-02) | ✅ |
| Incident response (IR-001, IR-002) | ✅ |
| Release notes (internal + public) | ✅ |
| MIGRATION.md per service | ✅ |
| Capacity plan | ✅ |
| Code review CR-001 | ✅ |
| Design tokens | ✅ |
| Journey + wireframes | ✅ |
| A11y + interaction spec | ✅ |
| Design-to-code handoff | ✅ |
| Usability test plan + script | ✅ |

---

## 7. Tests

| Test suite | Status | Notes |
|---|---|---|
| Unit: consent-service | ✅ | 12 tests; grant/revoke/query/audit |
| API negative: consent API | ✅ | 20 tests; 400/403/404/422 |
| Perf: consent k6 | ✅ | Scenarios + aligned thresholds |
| Perf: federation k6 | ✅ | Scenarios + aligned thresholds |
| Chaos: GD-01, GD-02 | ✅ (scripts) | Not run in CI yet |
| Integration tests | ❌ Not yet | P-32 design exists |
| E2E portal tests | ❌ Not yet | Backlog |

---

## 8. Release Pipeline

| Stage | Status | Notes |
|---|---|---|
| Lint + test | ✅ | `.github/workflows/release.yml` |
| Reproducible builds | ✅ | NODE_ENV=production, `--frozen-lockfile` |
| SBOM (Syft) | ✅ | Per service |
| Cosign keyless | ✅ | SLSA L3 |
| Policy bundle sign | ✅ | OPA bundle |
| Conformance | ✅ | Fastify schema PASS |
| Evidence pack | ✅ | `evidence/v0.1.0/README.md` |

---

## 9. Open Items Summary

| Severity | Count | Items |
|---|---|---|
| Blocking | 2 | B-01 (kmsVerify), B-02 (objectstore archival) |
| High | 1 | G-03 (consent expiry job) |
| Medium | 2 | G-04 (Redis interface), G-05 (api_version column) |
| Low | 0 | — |

**Recommendation**: B-01 and B-02 must be resolved before v0.1.0 GA. G-03 acceptable with known-issue documentation. G-04/G-05 acceptable for v0.1.0 with backlog tracking.
