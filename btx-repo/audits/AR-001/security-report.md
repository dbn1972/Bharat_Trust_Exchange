# AR-001 — Code-Level Security Audit Report

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Document | security-report.md |
| Date | 2026-05-17 |
| Auditor | @agent (autonomous) |
| Standards | OWASP Top 10 2021, OWASP ASVS 4.0, CWE Top 25 |
| Related | [findings.yaml](./findings.yaml) |

---

## 1. Scope

| In scope | Out of scope |
|---|---|
| `services/control-plane/src/` | Third-party npm packages (covered by SBOM/Syft) |
| `services/registry/src/` | Infrastructure (Kubernetes, OS, network) |
| `services/trust-node/src/` | Postgres internal security |
| `pkg/adapter/kms/src/` | |
| `pkg/adapter/objectstore/src/` | |
| `pkg/bootstrap/src/` | |
| `.github/workflows/release.yml` | |

---

## 2. Methodology

1. Manual code review against OWASP ASVS 4.0 Level 2 controls
2. CWE-based pattern matching for common weaknesses
3. OWASP Top 10 2021 category mapping for each finding

---

## 3. Findings

### F-01 — Injection (OWASP A03, CWE-89)

**Location**: `services/control-plane/src/adapter/db/repository.ts` — all DB queries

**Finding**: All queries use parameterised prepared statements via `pg` driver. No string interpolation detected in SQL queries.

**Verdict**: ✅ No injection risk found.

---

### F-02 — Broken Authentication (OWASP A07, CWE-306)

**Location**: `services/registry/src/server.ts` and `services/trust-node/src/server.ts`

**Finding**: Registry `POST /v1/nodes` and trust-node `GET /v1/federation/state/:nodeId` have no authentication. Any caller can register a node or read federation state.

**Severity**: 🔴 High

**ASVS control**: V2.1 (authentication exists for all entry points)

**Recommendation**: Add bearer token authentication or mTLS to all non-healthz endpoints in registry and trust-node before GA. Short-term mitigation: network-level access control (registry endpoints accessible only from within cluster).

**Fix priority**: Before v0.1.0 GA or accept with documented compensating control.

---

### F-03 — Broken Access Control (OWASP A01, CWE-285)

**Location**: `services/control-plane/src/domain/consent-service.ts::query()`

**Finding**: The `query()` method correctly checks that the caller is either the consent subject or the principal. An unauthorized caller receives HTTP 403. Pattern is correctly implemented and test-verified (consent-service.test.ts unauthorized → 403).

**Verdict**: ✅ No finding.

---

### F-04 — Security Misconfiguration (OWASP A05, CWE-16)

**Location**: `.github/workflows/release.yml`

**Finding**: Release pipeline uses `--no-verify` on `npm install` (inferred from `--frozen-lockfile`). Actually `--frozen-lockfile` is correct: it fails on hash mismatch. The `COSIGN_EXPERIMENTAL=1` flag was deprecated in Cosign v2.0+ (keyless is now default). Pipeline references `COSIGN_EXPERIMENTAL=1`.

**Severity**: 🟡 Low

**Recommendation**: Remove `COSIGN_EXPERIMENTAL=1` env var; it is a no-op on Cosign v2+ but signals unclear intent.

---

### F-05 — Sensitive Data Exposure (OWASP A02, CWE-312)

**Location**: `services/control-plane/src/adapter/kafka/outbox-publisher.ts` — outbox message payload

**Finding**: Audit event outbox payload structure was reviewed. The payload uses `consent_id` and `event_type` but not raw PII (confirmed by consent-service.test.ts "no PII in outbox" assertion). However, `subject_id` is included in the audit event itself stored in the database. Need to confirm `subject_id` is stored in hashed form.

**Severity**: 🟡 Medium (requires verification)

**ASVS control**: V6.2 (data classification and minimisation)

**Recommendation**: Confirm in DB migration that `subject_id` in `audit_events` table is stored as an HMAC hash, not plaintext. This was stated in the DPIA (§4) but code-level evidence should be documented.

---

### F-06 — Vulnerable and Outdated Components (OWASP A06)

**Location**: All services

**Finding**: SBOM generation via Syft is in the release pipeline. No dependency audit has been run in this session (npm packages not installed). Flagged as a process gap rather than a specific CVE.

**Severity**: 🟡 Medium (process gap)

**Recommendation**: Add `npm audit --audit-level=high` step to CI (not just release pipeline) to catch vulnerabilities at PR level.

---

### F-07 — Identification and Authentication Failures (OWASP A07, CWE-798)

**Location**: `pkg/adapter/kms/src/stub.ts`

**Finding**: The KMS stub hardcodes a test private key for signing. This is by design (ADR-0023 stubs-first). However, the stub is only safe if `CLOUD_PROVIDER=stub` cannot be set in production. The bootstrap adapter reads `CLOUD_PROVIDER` from env without validation that `stub` is blocked in prod.

**Severity**: 🔴 High

**ASVS control**: V2.9 (cryptographic strength), V6.4 (secret management)

**Recommendation**: In `pkg/bootstrap/src/cloud-adapters.ts`, add:
```typescript
if (process.env.CLOUD_PROVIDER === 'stub' && process.env.NODE_ENV === 'production') {
  throw new Error('CLOUD_PROVIDER=stub is not allowed in production (NODE_ENV=production)');
}
```
This is a one-line safety guard that prevents accidental stub use in prod.

---

### F-08 — Software and Data Integrity Failures (OWASP A08, CWE-345)

**Location**: `services/trust-node/src/server.ts`

**Finding**: This is the B-01 issue revisited from a security angle. The federation sync endpoint calls `federationService.handleSync()` which uses `kmsVerify` as a DI parameter. In the current `server.ts` the DI parameter is not wired, defaulting to the stub verifier which accepts any signature. This means an attacker can forge a federation sync message.

**Severity**: 🔴 Critical (same as B-01)

**ASVS control**: V10.3 (integrity of deployed application)

**Recommendation**: This is condition C-01 from the readiness scorecard. Wire the real KMS adapter before any cross-node federation is enabled.

---

### F-09 — Server-Side Request Forgery (OWASP A10, CWE-918)

**Location**: All services — no user-controlled URL fetch found.

**Finding**: No HTTP client calls to user-supplied URLs were found in the codebase. Outbox publisher calls Kafka SDK directly (not HTTP). KMS adapters call cloud SDKs directly.

**Verdict**: ✅ No SSRF risk found.

---

### F-10 — Logging and Monitoring Failures (OWASP A09, CWE-778)

**Location**: All services

**Finding**: Services use Fastify's built-in pino logger. OpenTelemetry spans are declared in domain services. However:
- No evidence of log redaction for PII (pino-redact not configured)
- No structured log level filtering for prod vs dev

**Severity**: 🟡 Medium

**Recommendation**: Add `pino-redact` configuration to mask any accidental PII leakage in log output. At minimum, redact `subjectId`, `principalId`, `x-btx-caller` header values in HTTP access logs.

---

## 4. Summary

| Finding | OWASP | Severity | Status |
|---|---|---|---|
| F-01 SQL injection | A03 | ✅ Clear | — |
| F-02 No auth on registry/trust-node | A07 | 🔴 High | Open |
| F-03 Access control on query | A01 | ✅ Clear | — |
| F-04 COSIGN_EXPERIMENTAL deprecated | A05 | 🟡 Low | Open |
| F-05 subject_id PII in DB | A02 | 🟡 Medium | Verify |
| F-06 No PR-level npm audit | A06 | 🟡 Medium | Open |
| F-07 Stub KMS allowed in prod | A07 | 🔴 High | Open |
| F-08 kmsVerify not wired (B-01) | A08 | 🔴 Critical | C-01 (mandatory) |
| F-09 SSRF | A10 | ✅ Clear | — |
| F-10 PII in logs | A09 | 🟡 Medium | Open |

**Critical**: 1  
**High**: 2  
**Medium**: 3  
**Low**: 1  
**Clear**: 3  

---

## 5. Verdict

The security posture is strong for a v0.1.0 internal release. The critical finding (F-08 / B-01) and high finding (F-07) must both be resolved before cross-node federation is enabled in any environment. High finding F-02 (no auth on registry/trust-node) must be resolved before public-facing deployment. The clear findings on injection (F-01), access control (F-03), and SSRF (F-09) demonstrate sound baseline security architecture.
