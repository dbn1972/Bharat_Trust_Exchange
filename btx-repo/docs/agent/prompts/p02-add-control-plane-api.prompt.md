---
id: P-02
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@platform-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SERVICE_NAME, type: kebab-case, required: true }
  - { name: METHOD, type: "enum[GET|POST|PUT|PATCH|DELETE]", required: true }
  - { name: PATH, type: openapi-path, required: true }
  - { name: REQ_SCHEMA, type: jsonschema, required: true }
  - { name: RESP_SCHEMA, type: jsonschema, required: true }
  - { name: AUTHZ_RULE, type: text, required: true }
  - { name: AUDIT_EVENT, type: dotted, required: true }
  - { name: DATA_CLASS, type: enum, required: true }
  - { name: FR_IDS, type: list, required: true }
  - { name: CT_IDS, type: list, required: false }
forbidden_paths: ["policy/btx/decisions.rego", ".github/CODEOWNERS"]
expected_outputs:
  - { kind: pr, title_pattern: "[<SERVICE_NAME>] <METHOD> <PATH>" }
  - { kind: files_modified, glob: "services/<SERVICE_NAME>/api/openapi.yaml" }
context_budget:
  read_in_full: ["docs/agent/skills/add-control-plane-api.md", "services/<SERVICE_NAME>/README.md", "services/<SERVICE_NAME>/api/openapi.yaml"]
  skim: ["BTX_Architecture_Annex_A_Engineering.md"]
executable_acceptance:
  - { name: openapi-lint, cmd: "spectral lint services/<SERVICE_NAME>/api/openapi.yaml", pass_when: "exit 0" }
  - { name: openapi-breaking, cmd: "oasdiff breaking origin/main:services/<SERVICE_NAME>/api/openapi.yaml services/<SERVICE_NAME>/api/openapi.yaml", pass_when: "no breaking unless declared" }
  - { name: unit-cov, cmd: "make test SVC=<SERVICE_NAME> && tools/cov-gate 80", pass_when: "exit 0" }
  - { name: integration, cmd: "make integration SVC=<SERVICE_NAME>", pass_when: "exit 0" }
  - { name: contract, cmd: "make contract-test SVC=<SERVICE_NAME>", pass_when: "exit 0" }
halt_conditions:
  - "endpoint is data-bearing and AUTHZ_RULE does not invoke PurposeGuard"
  - "introduces new top-level resource without ADR"
  - "breaking change in OpenAPI without major version bump"
escalation: { to: "@platform-lead", channel: "#btx-arch" }
graph: { upstream: [P-01, P-04, P-09], downstream: [P-06, P-08, P-19, P-12] }
---
# P-02 — Add a control-plane API endpoint

> Use to add a REST endpoint on an existing control-plane service (Member Registry, Service Catalogue, SchemaHub, PurposeGuard admin, Consent/Grants, AuditLedger query, etc.).

---

You are Claude Code in the BTX repo. Add a new endpoint on `services/<<SERVICE_NAME>>/` exactly as designed. Do not introduce new architectural patterns.

## 0. Read first

- [`docs/agent/skills/add-control-plane-api.md`](../skills/add-control-plane-api.md) (step-by-step recipe)
- [`docs/agent/golden-paths.md`](../golden-paths.md) §1
- [`docs/agent/anti-patterns.md`](../anti-patterns.md) §1, §2, §6
- Architecture Doc §4, §6, §8, §9 (components, security, policy, audit)
- Annex A §A.5 (wire contract + error model), §A.6 (Rego), §A.7 (audit schema)
- `services/<<SERVICE_NAME>>/README.md` (current tech spec)
- `services/<<SERVICE_NAME>>/api/openapi.yaml` (current contract)

## 1. Inputs

| Input | Value |
|---|---|
| Service | `<<SERVICE_NAME>>` |
| Resource & verb | `<<METHOD>> <<PATH>>` (e.g. `POST /v1/grants`) |
| Request schema (fields, types, validation) | `<<REQ_SCHEMA>>` |
| Response schema | `<<RESP_SCHEMA>>` |
| BRD reference(s) | `<<FR_IDS>>` |
| Authorisation rule | `<<AUTHZ_RULE>>` (which role(s); whether PDP must decide) |
| Audit event name(s) | `<<AUDIT_EVENT>>` |
| Conformance tests touched | `<<CT_IDS>>` |
| Data class touched | `<<DATA_CLASS>>` |

## 2. Execute

1. **Update OpenAPI** `services/<<SERVICE_NAME>>/api/openapi.yaml`. Add path, request body, responses (including problem+json errors per RFC 7807). Run `make contract-test`.
2. **Transport handler** in `internal/transport/http/`. Parse + validate DTO → call domain method → serialise. No business logic.
3. **Domain method** in `internal/domain/`. Pure; deterministic given inputs and injected `Clock`. Return a domain result or a typed domain error.
4. **Repository** in `internal/adapter/db/`. Prepared statements. New migration in `migrations/` if schema changes (forward-only; never edit applied migrations).
5. **AuthZ**:
   - Governance endpoints: OIDC role mapping via middleware.
   - Data-bearing endpoints: call PurposeGuard `POST /v1/decisions` and propagate obligations. Fail closed on PDP errors with `BTX-AUTHZ-002`.
6. **Audit emission**: produce `<<AUDIT_EVENT>>` to `btx.audit.v1` with all required fields (Annex A §A.7). Validate against schema before send.
7. **Errors**: map domain errors to the BTX error codes table (Annex A §A.5.4). Never leak DB errors verbatim.
8. **Telemetry**: counter (`btx_<svc>_<endpoint>_requests_total`), latency histogram, OTel span `<<SERVICE>>.<<endpoint>>`. Log with `trace_id`, `txn_id`, `member_id`.
9. **Tests**:
   - Unit: domain happy + every negative branch.
   - Integration: handler + Postgres testcontainer + (where applicable) OPA testcontainer + Kafka testcontainer asserting the audit event.
   - Contract: OpenAPI examples drive request/response matching tests.
10. **Docs**: update `README.md` (interfaces, errors), `CHANGELOG.md`, and the relevant test mapping in the spec.
11. **Conformance**: if `<<CT_IDS>>` is non-empty, extend or add fixtures under `certify/<<CT_ID>>/` to assert the new behaviour.

## 3. Hard rules

- Authorisation lives in middleware or PDP — never inside the handler/domain.
- Validate every request body against the OpenAPI schema **at the boundary**; do not rely on language-level types alone.
- Never block on PDP without a timeout (≤ 250 ms; configurable). Fail closed.
- Schema-validate the audit event before publishing; failures are alerts, not silent drops.

## 4. Acceptance

- [ ] OpenAPI updated; `spectral` clean; `oasdiff` shows no unintended breaking change.
- [ ] Handler ≤ 30 LOC of glue; no domain logic.
- [ ] PDP call present (if data-bearing) with timeout + fail-closed test.
- [ ] Audit event emitted and schema-validated; integration test asserts event on Kafka.
- [ ] Domain unit tests cover all negative branches.
- [ ] All BTX error codes mapped; no raw DB errors in responses.
- [ ] Telemetry added (metric + trace + log fields).
- [ ] Migration is forward-only and idempotent.
- [ ] `CHANGELOG.md` updated.
- [ ] `services/<<SERVICE_NAME>>/README.md` tech spec updated (Interfaces, Errors).
- [ ] Conformance fixtures extended for `<<CT_IDS>>` (if any).
- [ ] CODEOWNERS approvals achievable (security/privacy if data-bearing).
- [ ] No anti-pattern introduced.

## 5. Worked example

See [`_examples/p02.md`](./_examples/p02.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
