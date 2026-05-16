# Golden Paths — Recipes for the top 10 BTX tasks

> Step-by-step recipes agents (and humans) should follow for the most common changes. Each recipe lists files to touch, tests to write, docs to update and acceptance criteria. Follow these *verbatim*; deviate only with an explicit reason in the PR.

## Index

1. [Add a new control-plane API](#1-add-a-new-control-plane-api)
2. [Add a new Rego policy](#2-add-a-new-rego-policy)
3. [Add a new connector / source-system adapter](#3-add-a-new-connector--source-system-adapter)
4. [Add a new audit event field](#4-add-a-new-audit-event-field)
5. [Add a new conformance test](#5-add-a-new-conformance-test)
6. [Author or update an ADR](#6-author-or-update-an-adr)
7. [Author or update a tech spec](#7-author-or-update-a-tech-spec)
8. [File a DPIA for a new personal-data flow](#8-file-a-dpia-for-a-new-personal-data-flow)
9. [Run a STRIDE threat model for a service](#9-run-a-stride-threat-model-for-a-service)
10. [Onboard a new member (end-to-end)](#10-onboard-a-new-member-end-to-end)

---

## 1. Add a new control-plane API

**Scope:** new endpoint in `services/member-registry`, `service-catalogue`, `purpose-registry`, `approval-workflow`, or similar.

**Steps:**

1. Update OpenAPI: `services/<svc>/api/openapi.yaml`. Add path, request/response schemas, security (`oidc`), error model (RFC 7807).
2. Run `make contract-test` — fix lints, ensure no breaking change (or document if intentional + bump major).
3. Generate or hand-write handler in `internal/transport/http/`.
4. Domain logic in `internal/domain/` (pure, testable, no IO).
5. Persistence in `internal/adapter/` (PostgreSQL via repository pattern).
6. Authorisation: call PDP via `internal/adapter/pdp/` for any data-bearing operation; for governance actions use RBAC mapped from OIDC claims.
7. Audit emission: emit a business event to `btx.member.v1` / `btx.service.v1` / etc., schema-validated.
8. Tests:
   - Unit tests for domain
   - Integration test for handler (httptest + testcontainers PG)
   - Contract test against the OpenAPI
9. Telemetry: metrics (`btx_<svc>_requests_total`, latency histogram), traces, structured logs with `txn_id`/`actor_id`.
10. Update service `README.md` (tech spec) and `CHANGELOG.md`.

**Acceptance:**

- Linter clean, tests pass, coverage maintained
- OpenAPI renders in developer portal
- Audit event visible end-to-end in sandbox
- CODEOWNERS approval(s) recorded

---

## 2. Add a new Rego policy

**Scope:** new or updated authorisation rule under `policy/btx/`.

**Steps:**

1. Locate the right package:
   - `policy/btx/decisions.rego` — top-level decision combinator
   - `policy/btx/bola.rego` — object-level rules
   - `policy/btx/<domain>.rego` — domain-specific
2. Write the rule. Follow patterns in `BTX_Architecture_Annex_A_Engineering.md` §A.6.
3. Add a unit test file `policy/btx/<name>_test.rego`:
   - One `test_allow_*` happy path
   - One `test_deny_*` for each violation
   - One `test_obligation_*` for any obligation produced
4. Add or extend test fixtures under `policy/btx/testdata/` (members, services, purposes, grants).
5. Run `opa fmt -w policy/`, `regal lint policy/`, `opa test policy/ --bench`.
6. Coverage: `opa test --coverage --format=json policy/` → coverage of changed file ≥ 80%.
7. Sign-off: dual review (security + privacy) via CODEOWNERS.
8. After merge, the CI builds and signs the bundle (`cosign`) and pushes to the Signed Config Publisher in sandbox; canary at 5%, promote per Annex B §B.7.

**Acceptance:**

- All `opa test` pass
- Conformance tests CT-007, CT-017 still green
- Bundle signed and published in sandbox

---

## 3. Add a new connector / source-system adapter

**Scope:** new adapter under `connectors/<system>/`.

**Steps:**

1. Read Arch Doc §10.2 and Annex C §C.7 (tenant isolation).
2. Scaffold from `connectors/_template/` — gives you input validation, schema mapping, parameterised access skeleton, WAF rules, and a sandbox harness.
3. Implement against the **adapter SDK interface** in `connectors/sdk/`. Never call the source DB/app directly from BTX code; the adapter is the only boundary.
4. Input validation: validate every request against the service's published JSON Schema before backend call.
5. Output minimisation: emit raw response only inside the adapter; the response shaper enforces obligations.
6. Error mapping: map source errors to BTX error codes (Annex A §A.5.4).
7. Tests:
   - Unit tests with a fake backend
   - Integration test against the system's sandbox / mock
   - Negative tests: BOLA, injection (CT-017, CT-020)
8. Threat model: fill `docs/templates/threat-model-template.md` for the adapter.
9. DPIA if personal data flows.
10. Document the adapter in `connectors/<system>/README.md`.

**Acceptance:**

- CT-020 (legacy adapter security) passes
- Pen-test for SQLi / SSRF clean
- Schema-validated request/response in CI

---

## 4. Add a new audit event field

**Audit schemas are versioned. Adding a field is backward-compatible; removing or renaming requires a major bump.**

**Steps:**

1. Edit AsyncAPI in `services/audit-ledger/api/asyncapi.yaml` (event `AuditEventV1`).
2. If additive → keep `schema_version: btx.audit.v1`. If breaking → introduce `btx.audit.v2`, dual-write for ≥ one quarter, deprecate v1.
3. Update producers (Trust Node emitter, audit pipeline).
4. Update consumers (dashboard, reconcile job, SIEM exporter) to tolerate or use the new field.
5. Tests: schema-validation test for producers; consumer tests for both presence and absence of the field.
6. Update `BTX_Architecture_Annex_A_Engineering.md` §A.7 and `§21.3` of the main Arch Doc.
7. Open an ADR if the field changes semantics (e.g., adds a new decision value).

**Acceptance:**

- All producers/consumers green
- Hash-chain reconciliation still 100% (CT-015, CT-016)
- Dashboards updated

---

## 5. Add a new conformance test

**Steps:**

1. Pick the next ID after the highest existing `CT-<n>` in `certify/`.
2. Create `certify/CT-<n>-<slug>/` with:
   - `README.md` — purpose, requirement traced (BRD `FR-*`/`NFR-*`/threat `T*`)
   - `test.sh` or `test.go` — executable test
   - `expected/` — golden artefacts (logs, JSON)
3. Register the test in the conformance harness `certify/registry.yaml`.
4. Wire into CI (`make certify`) and the per-environment evidence pack manifest (Annex C §C.12).
5. Update `BTX_Architecture_Annex_C_Evidence.md` §C.3.3 with the new row.

**Acceptance:**

- New test passes in sandbox
- Evidence appears in `evidence/<env>/<release>/conformance/CT-<n>/`

---

## 6. Author or update an ADR

**Steps:**

1. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-short-slug.md` using the next number.
2. Fill: Title, Status (`proposed`), Date, Context, Decision, Consequences, Alternatives, References.
3. Open PR with title `[adr] NNNN — short title`.
4. Required reviewer: @chief-architect (plus area owners).
5. On merge, change status to `accepted` and update `docs/adr/README.md` index.
6. Superseding an old ADR: link both ways, mark old as `superseded by NNNN`.

**Do not** describe an architectural change in a service PR without an ADR. ADRs are searchable history.

---

## 7. Author or update a tech spec

A tech spec lives at `services/<svc>/README.md` and is the per-service contract.

**Steps:**

1. Copy `docs/templates/tech-spec-template.md` to `services/<svc>/README.md` on service creation.
2. Sections: Purpose, Inputs, Outputs, Data model, Dependencies, API contracts, Errors, Telemetry, Security, Privacy, Operations, Open questions.
3. Update on every notable change.
4. Cross-link from `docs/architecture/INDEX.md` if it's a top-level service.

---

## 8. File a DPIA for a new personal-data flow

**Required** for any service or service version whose response includes personal data, or whose request carries citizen context.

**Steps:**

1. Copy `docs/templates/dpia-template.md` to `dpia/<service-or-flow>.md`.
2. Fill all 11 fields per BRD §24.
3. Privacy lead reviews; can demand minimisation / response-shape changes.
4. Approvals stored in `dpia/<service>/approval.pdf` (or e-signature record).
5. CT-018 (DPIA gate) cannot pass without this artefact.

---

## 9. Run a STRIDE threat model for a service

**Steps:**

1. Copy `docs/templates/threat-model-template.md` to `threat-models/<service>.md`.
2. Draw DFD (Mermaid) showing trust boundaries.
3. Enumerate threats per STRIDE category; map to mitigations and evidence (test or runbook).
4. Sign-off by security lead.
5. Threats with residual risk > acceptable → mitigation plan with owner + due date.

CT-018-style gate: no production go-live without an approved threat model.

---

## 10. Onboard a new member (end-to-end)

This is operational, not code. Follow [`BTX_Architecture_Annex_B_Runbooks.md`](../../BTX_Architecture_Annex_B_Runbooks.md) §B.4.

Code-side support:

- Add the member's signed config target via `services/signed-config-publisher` configuration PR.
- Add adapter for their source system (Golden Path §3) if they're a provider.
- Run conformance suite against their sandbox TN; archive evidence pack.

---

## When in doubt

- The recipe doesn't fit your case → stop and ask, or open an RFC.
- A step requires bypassing a control → stop. The control wins.
- A step is missing for a recurring task → propose adding a new recipe in this file.
