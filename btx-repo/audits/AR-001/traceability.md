# AR-001 — Traceability Matrix

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Document | traceability.md |
| Date | 2026-05-17 |
| Scope | BRD requirements → Screen → API → Service → Test → ADR |
| Related | [traceability.csv](./traceability.csv) |

---

## 1. Coverage Summary

| Category | Total requirements | Fully traced | Partially traced | No test coverage |
|---|---|---|---|---|
| Functional | 10 | 7 | 2 | 1 |
| Non-functional | 5 | 4 | 0 | 1 |
| Privacy (DPDP) | 6 | 3 | 2 | 1 |
| Security | 5 | 3 | 1 | 1 |
| **Total** | **26** | **17 (65%)** | **5 (19%)** | **4 (16%)** |

---

## 2. Gaps

| REQ_ID | Gap | Severity |
|---|---|---|
| FR-06 | ObjectStore not wired (B-02); export path untested | Blocking |
| FR-08 | Federation sync: no unit tests | High |
| FR-07 | Registry register: no unit tests | High |
| NFR-02 | k6 federation test never executed against staging | Medium |
| PRIV-02 | Retention/archival: B-02 blocks implementation | Blocking |
| PRIV-06 | Breach notification: IR-001 procedure not drill-tested | Medium |
| SEC-01 | kmsVerify not wired (B-01); signature check bypassed in prod | Blocking |
| SEC-04 | SBOM generated in pipeline YAML but pipeline not yet triggered in CI | Medium |

---

## 3. Requirement Traces (selected critical paths)

### FR-01: Citizen can grant consent

| Step | Artefact |
|---|---|
| Screen | [journey.md](../docs/design/surfaces/portal/consent-grant/journey.md) — W-01..W-04 |
| Component | [GrantFlow.tsx](../apps/portal/src/features/consent/GrantFlow/GrantFlow.tsx) |
| API | `POST /v1/consents` — server.ts L~50 |
| Service | `ConsentService.grant()` — services/control-plane/src/domain/consent-service.ts |
| Policy | `policies/consent/grant.rego` |
| Test (unit) | consent-service.test.ts "grant happy path" |
| Test (API +ve) | — (not covered) |
| ADR | ADR-0020 |

### FR-09 + FR-10: Fail-closed policy

| Step | Artefact |
|---|---|
| API | `POST /v1/consents` |
| Service | `ConsentService.grant()` — catch block → deny |
| Test | consent-service.test.ts "policy error → fail-closed" |
| ADR | ADR-0004 |

### PRIV-01: Data minimisation

| Step | Artefact |
|---|---|
| DPIA | dpia/consent-service.md §4 — declared fields only |
| API | `POST /v1/consents` — `dataFields` array from caller |
| Service | Stored verbatim; no extra enrichment |
| Test | consent-service.test.ts "outbox payload has no PII" |
| ADR | ADR-0025 |

---

## 4. Conclusion

65% of requirements are fully traced end-to-end. The 16% with no test coverage map predominantly to blocking items (B-01, B-02) that also appear in the readiness conditions. Resolving B-01 and B-02 would bring test coverage to approximately 81%. Remaining gaps (registry + trust-node unit tests) are recommended pre-GA work (R-02).
