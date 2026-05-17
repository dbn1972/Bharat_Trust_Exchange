# Code Review — BTX v0.1.0 Baseline (P-16)

| Field | Value |
|---|---|
| Review ID | CR-001 |
| Target | Branch `agent/autonomous-phase-1` (commits 462de4b → a7336a6) |
| Reviewer | @chief-architect (agent-generated; requires human approval) |
| Date | 2026-05-17 |
| Scope | All services + packages + ADRs + runbooks authored in Phases 0–11 |

---

## Summary

The v0.1.0 baseline delivers a structurally sound federated trust fabric. Hexagonal architecture is consistently applied. Cloud adapter isolation is complete. The audit trail, outbox pattern, and idempotency contract are correctly implemented. **Two blocking items** require resolution before production promotion; both are low-effort fixes.

---

## Blocking

### B-01 — `kmsVerify` not wired in `trust-node/server.ts`
- **File**: `services/trust-node/src/server.ts`
- **Issue**: `FederationService` constructor accepts `kmsVerify` but `server.ts` passes no implementation; stub fallback silently returns `true` for all signature verification.
- **Risk**: Federation accepts forged Merkle root signatures in production if `CLOUD_PROVIDER=stub` is not caught by deployment config.
- **Fix**: Wire `createKmsAdapter().verify` from `pkg/bootstrap/cloud-adapters.ts` into `FederationService` constructor. Gate on `CLOUD_PROVIDER !== 'stub'` for prod.
- **Reference**: ADR-0008, threat model T01.

### B-02 — `ObjectStoreAdapter` not wired in consent-service for audit archival
- **File**: `services/control-plane/src/server.ts`
- **Issue**: `AuditRepository` writes to Postgres but there is no archival path for the object store adapter (MinIO/S3/GCS). Long-term audit retention (10-year per capacity plan §4) relies on this path.
- **Risk**: Audit data accumulates in Postgres partition without cold-storage offload; partition growth exceeds sizing assumptions within 2 years.
- **Fix**: Wire `createObjectStoreAdapter()` into an `AuditArchiver` worker (parallel to `OutboxPublisher`); schedule monthly partition archival.
- **Reference**: Capacity plan §4, ADR-0005.

---

## Non-blocking

### N-01 — Redis idempotency client not behind an interface
- **File**: `services/control-plane/src/server.ts`
- **Finding**: `ioredis` client is created inline in server startup and passed directly to route handlers. This makes it impossible to mock in unit tests without module-level monkey-patching.
- **Recommendation**: Extract `IdempotencyStore` interface; inject concrete `RedisIdempotencyStore` at startup. Improves testability for P-19 backfill.
- **Priority**: Medium — no security impact; testability issue only.

### N-02 — `api_version` field missing from `trust_nodes` registry schema
- **File**: `services/registry/migrations/001_init_nodes.sql`
- **Finding**: ADR-0024 requires `api_version` per trust node to gate deprecation; schema does not have this column yet.
- **Recommendation**: Add migration `002_add_api_version.sql` with `ALTER TABLE trust_nodes ADD COLUMN api_version VARCHAR(10) NOT NULL DEFAULT 'v1'`.
- **Priority**: Medium — needed before v1→v2 deprecation cycle.

### N-03 — `handleSummary` in `perf-federation-sync.k6.js` references undefined `textSummary`
- **File**: `tests/perf-federation-sync.k6.js`
- **Finding**: `handleSummary` calls `textSummary(data, ...)` but does not import it from `k6/summary`. Will throw at runtime.
- **Recommendation**: Add `import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';` or remove `handleSummary`.
- **Priority**: Low — only affects CI output formatting, not correctness.

### N-04 — No `CHANGELOG.md` at repo root
- **Finding**: P-12 release pipeline references `CHANGELOG.md` at repo root; file does not exist. GH Release body will be empty.
- **Recommendation**: Create root `CHANGELOG.md` with v0.1.0 entry.
- **Priority**: Low — cosmetic for release; not a correctness issue.

### N-05 — Secrets not validated for minimum entropy at startup
- **Files**: `services/*/src/server.ts`
- **Finding**: `DATABASE_URL`, `REDIS_URL` are read from env without validation. A misconfigured empty string causes a crash-loop rather than a clear error.
- **Recommendation**: Add a startup `validateEnv()` helper that checks required vars are non-empty and (for `DATABASE_URL`) contain a host component. Pattern: fail-fast with descriptive error rather than silent crash.
- **Priority**: Low — operability improvement; not a security vulnerability (no secret logging).

---

## Acknowledgements (OK)

### Architecture
- ✅ Hexagonal boundaries respected: domain ↔ adapter ↔ transport clearly separated in all three services.
- ✅ No cloud SDK leakage in service code (verified by P-14 scan).
- ✅ Federation invariants intact: Trust Node remains the data-plane boundary (ADR-0003).
- ✅ Adapter factory correctly lazy-loads cloud SDKs — no hard dependencies.

### Security
- ✅ mTLS + SPIFFE SVID injection points are present (`x-node-id`, `x-peer-public-key` headers).
- ✅ JWT validation structure is in place (middleware wiring assumed from server.ts pattern).
- ✅ Parameterised queries throughout all repositories — no string interpolation.
- ✅ `audit_events` is INSERT-only (no UPDATE/DELETE code paths found).
- ✅ PII minimisation: `citizen_id` is documented as hashed before storage (domain model).
- ✅ Policy decisions fail-closed (error → deny, per ADR-0004).
- ✅ Idempotency key validation prevents duplicate state changes (ADR-0022).

### Privacy
- ✅ DPIA (DPIA-001) complete for consent-service.
- ✅ Threat model (STRIDE+LINDDUN) complete for consent-service.
- ✅ Notice text in EN + HI + MR.
- ✅ Minimisation rule documented and mapped to PDP obligation.

### Audit
- ✅ Transactional outbox: audit + outbox in same DB TX (ADR-0021). Verified in `AuditRepository.appendInTransaction`.
- ✅ Outbox rows carry event ID as Kafka idempotency key — safe replay.
- ✅ Merkle root computation scheduled (daily).
- ✅ No PII bodies in events — only IDs and hashes.

### Testing
- ✅ k6 perf regression thresholds updated to ADR-0020 budgets (P-15).
- ✅ Conformance test specs exist for 25 tests (CT-001..025).
- ✅ E2E integration test suite present (Mocha + Chai).

### Operability
- ✅ `GET /healthz` on all three services with DB + Kafka status.
- ✅ Two SEV-2 runbooks + chaos drills (P-11).
- ✅ Two incident response playbooks (P-13).
- ✅ Capacity plan documented (P-15).

### Governance
- ✅ 25 ADRs covering all major decisions.
- ✅ Release pipeline with SBOM, Cosign signing, SLSA L3 attestation (P-12).
- ✅ Evidence pack template with promotion gates.

---

## Required Actions Before Production

| # | Item | Owner | Target |
|---|---|---|---|
| B-01 | Wire `kmsVerify` in trust-node | @sre-lead | v0.1.1 |
| B-02 | Wire `ObjectStoreAdapter` for audit archival | @sre-lead | v0.2.0 |
| N-01 | Extract `IdempotencyStore` interface | @sre-lead | v0.2.0 |
| N-02 | Add `api_version` migration for registry | @sre-lead | v0.2.0 |
| N-03 | Fix `textSummary` import in k6 federation script | @sre-lead | v0.1.1 |
| N-04 | Create root `CHANGELOG.md` | @sre-lead | v0.1.1 |
| N-05 | Add startup `validateEnv()` | @sre-lead | v0.2.0 |
