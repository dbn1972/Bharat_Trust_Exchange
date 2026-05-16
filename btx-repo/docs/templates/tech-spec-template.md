# Tech Spec — `<service-name>`

> Save as `services/<service-name>/README.md`. This is the contract for the service. Keep it current; CI fails if `openapi.yaml` references undefined endpoints documented here, and vice versa.

| Field | Value |
|---|---|
| Service | `<service-name>` |
| Owner | @<owner> |
| On-call | `#<service-channel>` |
| Status | draft \| active \| deprecated |
| Version | semver, matches `CHANGELOG.md` |
| BRD references | FR-…, NFR-…, CT-… |
| ADR references | ADR-… |
| Threat model | `threat-models/<service>.md` |
| DPIA | `dpia/<service>.md` (if personal data) |

## 1. Purpose

One paragraph. What does this service do and why does it exist?

## 2. Scope

| In scope | Out of scope |
|---|---|
| | |

## 3. Users and clients

| Caller | How it calls | AuthN | AuthZ |
|---|---|---|---|
| | | | |

## 4. Interfaces

### 4.1 APIs

- OpenAPI: `services/<svc>/api/openapi.yaml`
- AsyncAPI: `services/<svc>/api/asyncapi.yaml` (if events)

### 4.2 Events produced

| Topic | Schema | Trigger |
|---|---|---|
| | | |

### 4.3 Events consumed

| Topic | Schema | Behaviour |
|---|---|---|
| | | |

## 5. Data model

- ERD: link or inline mermaid
- DDL: `services/<svc>/internal/adapter/db/migrations/`
- Retention: per data class
- Encryption: at rest + in transit

## 6. Dependencies

| Dependency | Type | Criticality |
|---|---|---|
| PostgreSQL | datastore | hard |
| Kafka | event bus | hard |
| KMS | crypto | hard |
| Other services | sync / async | soft / hard |

## 7. Errors

| Code | HTTP | Meaning |
|---|---|---|
| `BTX-…-001` | | |

Refer to `BTX_Architecture_Annex_A_Engineering.md` §A.5.4 for shared codes.

## 8. Security

- AuthN: OIDC / mTLS / both
- AuthZ: PDP via PurposeGuard for data; RBAC for governance
- Crypto: per Annex A §A.8
- Secrets: Vault paths

## 9. Privacy

- Personal data touched? yes/no
- Lawful basis / consent / notice
- Minimisation rule
- Retention
- DPIA link

## 10. Performance

| SLI | SLO | p95 latency | Throughput |
|---|---|---|---|
| availability | 99.9% | … | … |

## 11. Capacity & cost

- Sizing per Annex C §C.1
- Cost line per Annex C §C.4

## 12. Telemetry

- Metrics: `btx_<svc>_…`
- Traces: OTel spans named `<svc>.<operation>`
- Logs: JSON, fields documented
- Dashboards: link

## 13. Operations

- Runbooks: `docs/runbooks/<svc>/`
- DR plan: link
- Backup: link
- Drill cadence: per Annex B §B.16

## 14. Conformance

| CT | Test path | Last evidence |
|---|---|---|
| CT-… | `certify/CT-…/` | |

## 15. Migration & versioning

- SemVer policy
- Schema migration tool: Flyway / Liquibase
- Backwards compatibility window

## 16. Open questions

- [ ] …

## 17. References

- Architecture Doc sections
- Annex A/B/C sections
- ADR list
