# AR-001 — Release Readiness Report

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Document | readiness.md |
| Release | v0.1.0 |
| Date | 2026-05-17 |
| Auditor | @agent (autonomous) |
| Related | [scorecard.yaml](./scorecard.yaml) |

---

## 1. 10-Axis Scorecard

| # | Axis | Weight | Score (0–4) | Weighted | Status |
|---|---|---|---|---|---|
| 1 | Functional completeness | 20% | 3 | 0.60 | 🟡 |
| 2 | Security posture | 20% | 3 | 0.60 | 🟡 |
| 3 | Privacy compliance (DPDP 2023) | 15% | 4 | 0.60 | ✅ |
| 4 | Operational readiness | 15% | 3 | 0.45 | 🟡 |
| 5 | Test coverage | 10% | 3 | 0.30 | 🟡 |
| 6 | Performance | 5% | 3 | 0.15 | 🟡 |
| 7 | Portability / cloud agnosticism | 5% | 4 | 0.20 | ✅ |
| 8 | Documentation completeness | 5% | 4 | 0.20 | ✅ |
| 9 | Release engineering | 3% | 4 | 0.12 | ✅ |
| 10 | UX readiness | 2% | 2 | 0.04 | 🔴 |
| **Total** | | **100%** | — | **3.26 / 4.00** | **🟡 CONDITIONAL** |

**Promotion gate**: ≥ 3.0 → proceed with conditions. **3.26 — CONDITIONAL GO** for v0.1.0 with mandatory conditions below.

---

## 2. Per-Axis Detail

### Axis 1 — Functional Completeness (score: 3/4)

**Evidence**:
- All 3 services implemented with full CRUD/state machines ✅
- Transactional outbox + audit trail ✅
- Outbox publisher (Kafka drain) ✅
- Policy evaluation (OPA) ✅

**Deficiencies (–1)**:
- B-01: kmsVerify not wired in trust-node → **mandatory condition**
- B-02: ObjectStoreAdapter not wired → **mandatory condition**
- G-03: Consent expiry job not implemented → known issue (documented)

---

### Axis 2 — Security Posture (score: 3/4)

**Evidence**:
- STRIDE+LINDDUN threat model (T01–T15) ✅
- Fail-closed PDP (ADR-0004) ✅
- No PII in outbox payload (test-verified) ✅
- Cosign keyless + SLSA L3 release pipeline ✅
- Incident response runbooks ✅

**Deficiencies (–1)**:
- B-01: Trust-node uses stub KMS verify → signature validation bypassed in prod
- P-30 OWASP/ASVS scan results pending (see security-report.md)

---

### Axis 3 — Privacy Compliance DPDP 2023 (score: 4/4)

**Evidence**:
- DPIA with full 13-section coverage ✅
- Data residency enforcement (`ResidencyViolationError`) ✅
- Citizen notice text EN+HI+MR ✅
- Explicit consent checkbox (legal requirement) ✅ (implemented in GrantFlow)
- 8-rights matrix in DPIA ✅
- Grievance mechanism documented ✅
- 72h breach notification IR-001 ✅

---

### Axis 4 — Operational Readiness (score: 3/4)

**Evidence**:
- Runbooks RB-001 (cascade revocation) + RB-002 (outbox failure) ✅
- Chaos scripts GD-01 + GD-02 ✅
- Incident response IR-001 + IR-002 ✅
- OpenTelemetry spans in domain services ✅
- Prometheus + Grafana + Loki referenced in ADRs ✅

**Deficiencies (–1)**:
- Grafana dashboards not yet defined (no `.json` dashboard files)
- `validateEnv()` startup guard not implemented (N-05 from CR-001)

---

### Axis 5 — Test Coverage (score: 3/4)

**Evidence**:
- 12 unit tests (consent-service) ✅
- 20 negative API tests (consent) ✅
- k6 perf scripts with ADR-aligned thresholds ✅

**Deficiencies (–1)**:
- registry service: 0 unit tests
- trust-node service: 0 unit tests
- Integration tests: design complete (P-32) but not implemented
- No CI pipeline running tests automatically (`.github/workflows/release.yml` references test step but Makefile target not verified)

---

### Axis 6 — Performance (score: 3/4)

**Evidence**:
- k6 thresholds: p99 < 80ms consent, p99 < 1500ms federation ✅
- Capacity plan: 100K DAU, 3 TPS peak, pod sizing ✅
- PgBouncer transaction mode ✅

**Deficiencies (–1)**:
- No load test results yet (k6 scripts exist but never executed against staging)

---

### Axis 7 — Portability / Cloud Agnosticism (score: 4/4)

**Evidence**:
- Factory pattern in `pkg/bootstrap` ✅
- 4 KMS adapters (stub, AWS, GCP, Azure) ✅
- 4 ObjectStore adapters ✅
- MIGRATION.md per service ✅
- Zero SDK leakage in service layer ✅

---

### Axis 8 — Documentation Completeness (score: 4/4)

**Evidence**: All 15 doc types present (ADRs 0020–0025, threat model, DPIA, runbooks, chaos, IR, release notes, capacity plan, code review, design tokens, journey, a11y spec, handoff, usability plan) ✅

---

### Axis 9 — Release Engineering (score: 4/4)

**Evidence**: Full `.github/workflows/release.yml` with SBOM, Cosign, SLSA L3, evidence pack ✅. CHANGELOG.md at root ✅.

---

### Axis 10 — UX Readiness (score: 2/4)

**Evidence**:
- Design tokens ✅
- Journey + wireframes ✅
- A11y spec ✅
- React component scaffold ✅

**Deficiencies (–2)**:
- Portal application not runnable (no `package.json` in `apps/portal`, no bundler config)
- Figma prototype not linked
- Usability test not yet conducted (US-001 plan created)
- i18n strings not yet translated to HI/MR

---

## 3. Mandatory Conditions for v0.1.0 GA

| Condition | Linked item | Status |
|---|---|---|
| C-01 | ~~Fix B-01: Wire kmsVerify in trust-node/server.ts~~ | ✅ Fixed |
| C-02 | ~~Fix B-02: Wire ObjectStoreAdapter in control-plane~~ | ✅ Fixed |

---

## 4. Recommended Pre-GA Improvements

| Recommendation | Linked item | Priority |
|---|---|---|
| R-01 | Implement `validateEnv()` startup guard | N-05 | High |
| R-02 | Add registry + trust-node unit tests | — | High |
| R-03 | Run US-001 usability study | US-001 | Medium |
| R-04 | Add api_version to registry schema | G-05 | Medium |
| R-05 | Define Grafana dashboards | — | Medium |

---

## 5. Verdict

**v0.1.0: CONDITIONAL GO**  
Score: 3.26/4.00. All privacy and portability axes at maximum. Two blocking wiring issues (B-01, B-02) must be resolved before final release tag. All other gaps acceptable for controlled v0.1.0 rollout to pilot users with the known issues documented in release-notes/v0.1.0.md.
