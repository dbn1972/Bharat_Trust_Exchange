---
id: P-05
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@platform-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SYSTEM, type: kebab-case, required: true }
  - { name: PROTOCOL, type: "enum[rest|soap|db|file]", required: true }   # connector itself is Fastify+TS per ADR-0020
  - { name: SERVICE_IDS, type: list, required: true }
  - { name: DATA_CLASS, type: enum, required: true }
  - { name: PII, type: bool, required: true }
  - { name: SLA, type: "object{p95_ms,rps}", required: true }
forbidden_paths: ["services/trust-node/internal/shaper/**"]
expected_outputs:
  - { kind: pr, title_pattern: "[connector/<SYSTEM>] add" }
  - { kind: files_created, glob: "connectors/<SYSTEM>/**" }
context_budget:
  read_in_full: ["docs/agent/skills/add-connector.md", "connectors/_template/**", "BTX_Architecture_Annex_A_Engineering.md"]
  skim: ["docs/adr/0007-provider-side-minimisation.md"]
executable_acceptance:
  - { name: manifest-validate, cmd: "tools/connector-validate connectors/<SYSTEM>/manifest.yaml", pass_when: "exit 0" }
  - { name: unit-cov, cmd: "make test CONNECTOR=<SYSTEM> && tools/cov-gate 80", pass_when: "exit 0" }
  - { name: integration, cmd: "make integration CONNECTOR=<SYSTEM>", pass_when: "exit 0" }
  - { name: kms-via-adapter, cmd: "tools/check-kms-adapter connectors/<SYSTEM>", pass_when: "all crypto/secret access via pkg/adapter/{kms,secret}; no direct cloud SDK" }
  - { name: outbox-present, cmd: "tools/check-outbox connectors/<SYSTEM>", pass_when: "every Kafka publish paired with outbox row in same DB tx" }
  - { name: ct-adapter, cmd: "make certify CT=CT-020,CT-017", pass_when: "exit 0" }
  - { name: secrets-scan, cmd: "gitleaks detect --no-banner --source connectors/<SYSTEM>", pass_when: "0 findings" }
halt_conditions:
  - "connector performs minimisation (must be in Shaper)"
  - "PII=true and dpia/<SYSTEM>.md missing"
  - "accepts caller-provided URL/SQL/path"
escalation: { to: "@platform-lead, @security-lead", channel: "#btx-connectors" }
graph: { upstream: [P-09, P-10], downstream: [P-06, P-08, P-11, P-12] }
---

# P-05 — Build a connector (department source-system adapter)

> Use to integrate a new department backend (REST, SOAP, DB, file) behind a Trust Node.

---

You are Claude Code working in `connectors/`. Build a new connector that exposes `<<SYSTEM>>` to BTX **without** changing source ownership and **without** doing minimisation in the connector (the Shaper does that).

## 0. Read first

- [`docs/agent/skills/add-connector.md`](../skills/add-connector.md)
- Architecture Doc §4.3 (Connectors), §11 (Federation)
- Annex A §A.5 (wire contract), §A.6 (policy & minimisation)
- ADR-007 (minimisation is provider-side, in the Shaper, not the connector)
- ADR-008 (cloud adapters): for any cloud-specific access inside the connector

## 1. Inputs

| Input | Value |
|---|---|
| System name | `<<SYSTEM>>` |
| Protocol | REST / SOAP / DB (PG/Oracle/MSSQL) / file |
| Backend endpoints / queries | `<<ENDPOINTS>>` |
| Service IDs this connector backs | `<<SERVICE_IDS>>` |
| Data class | `<<DATA_CLASS>>` |
| Auth to backend | mTLS / OAuth2 / API key / DB user (secrets via Vault) |
| Source ↔ canonical mapping | `<<SCHEMA_MAP>>` |
| SLA (p95, throughput) | `<<SLA>>` |

## 2. Execute

1. **Scaffold** by copying `connectors/_template/` to `connectors/<<SYSTEM>>/`.
2. **Manifest** fill `connectors/<<SYSTEM>>/manifest.yaml` (owner, service IDs, data class, protocol, endpoints, auth, SLA, secrets paths).
3. **SDK methods** implement `Init`, `Handle`, `HealthCheck`. No side effects in package init.
4. **Input validation** against the SchemaHub-published JSON Schema for each `service_id`. Reject with `BTX-SCHEMA-001` on failure.
5. **Backend call**:
   - REST: typed HTTP client with URL templates; allowlist of base hosts.
   - SOAP: typed client; xmllint / xsd validation.
   - SQL: prepared statements only; no string concatenation.
   - File: allowlisted path; size + mime checks.
6. **Errors** map source faults to BTX error codes (Annex A §A.5.4): timeouts → `BTX-AVAIL-001` with retry-after; 4xx/5xx → specific codes.
7. **Secrets** consume only from Vault paths documented in the manifest.
8. **Telemetry** metrics, traces, structured logs. No backend payload bodies in logs.
9. **Threat model** at `threat-models/<<SYSTEM>>.md` using the template.
10. **DPIA** if personal data flows: `dpia/<<SYSTEM>>.md`.
11. **Tests**:
    - Unit with fake backend
    - Integration with sandbox/mock backend
    - Negative: BOLA (CT-017), injection (CT-020), schema validation
12. **Docs** `connectors/<<SYSTEM>>/README.md`: manifest summary, ops notes, dependencies, SLA, on-call, runbook links.

## 3. Hard rules

- Never minimise inside the connector. Minimisation is the Shaper's job.
- Never accept caller-provided URLs, SQL, file paths, or XPath/XQuery.
- Never log secrets, backend bodies, or PII.
- Never short-circuit input validation.
- Never cache responses inside the connector. Caching is policy-driven, applied later.

## 4. Acceptance

- [ ] Manifest complete; secrets reference Vault paths.
- [ ] All three SDK methods implemented with timeouts and context propagation.
- [ ] Strict input validation against the published schema.
- [ ] No string concatenation in any backend access path.
- [ ] Error model mapped to BTX codes.
- [ ] Telemetry present; no payload/PII in logs.
- [ ] Threat model approved; DPIA approved if applicable.
- [ ] Unit + integration + negative tests pass.
- [ ] CT-020 (legacy adapter security) and CT-017 (BOLA) green.
- [ ] CODEOWNERS approvals: service owner + security; privacy if personal data.
- [ ] No anti-pattern introduced.

## 5. Worked example

See [`_examples/p05.md`](./_examples/p05.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
