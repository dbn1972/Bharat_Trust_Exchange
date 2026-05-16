---
id: P-27
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@architect"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: REVIEW_ID, type: "pattern[CLV-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SCOPE,     type: "enum[control-plane|trust-node|connector|federation|all]", required: true }
  - { name: LAYERS,    type: "list[enum: spec|schema|api|backend|frontend|policy|audit|docs|tests]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "audits/<REVIEW_ID>/cross-layer.md" }
  - { kind: file_created, path: "audits/<REVIEW_ID>/drift.yaml" }
  - { kind: file_created, path: "evidence/audits/<REVIEW_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/architecture/overview.md", "docs/api/openapi.yaml", "docs/brd/btx-brd.md"]
  skim: ["services/*/schema/*", "policy/bundle.tar.gz.json", "docs/audit/chain.md"]
executable_acceptance:
  - { name: openapi-vs-handlers, cmd: "tools/openapi-diff docs/api/openapi.yaml services/*/routes/", pass_when: "every documented endpoint has a handler; every handler has an OpenAPI entry" }
  - { name: schema-vs-api,       cmd: "tools/schema-api-diff services/*/schema/ docs/api/openapi.yaml", pass_when: "field/enum/nullability/foreign-ref drift = 0" }
  - { name: policy-vs-brd,       cmd: "tools/policy-coverage-check policy/ docs/brd/btx-brd.md", pass_when: "every BRD policy claim has a Rego rule + test" }
  - { name: audit-vs-actions,    cmd: "tools/audit-coverage-check docs/audit/events.yaml services/*/handlers", pass_when: "every state-changing action emits a defined audit event" }
  - { name: docs-vs-reality,     cmd: "tools/docs-reality-diff docs/ services/", pass_when: "no documented module missing in code; no code module missing from docs" }
  - { name: drift-yaml-schema,   cmd: "tools/drift-yaml-check audits/<REVIEW_ID>/drift.yaml", pass_when: "every drift row has {layer_a, layer_b, severity, owner, fix_plan}" }
  - { name: evidence-pack,       cmd: "cosign verify-blob --signature evidence/audits/<REVIEW_ID>.tar.gz.sig evidence/audits/<REVIEW_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "any Critical drift on policy ↔ BRD (silent permission expansion)"
  - "any Critical drift on audit ↔ actions (state change with no audit event)"
  - "any Critical drift on schema ↔ API (data loss / data corruption risk)"
escalation: { to: "@architect, @security-lead, @privacy-lead", channel: "#btx-audit" }
graph: { upstream: [P-26], downstream: [P-28, P-29, P-30, P-31, P-32] }
---

# P-27 — Cross-layer validation

> Detects **contract drift** across spec ↔ schema ↔ API ↔ backend ↔ frontend ↔ policy ↔ audit ↔ docs ↔ tests. Output is a severity-ranked drift register + fix plan.

## 0. Read first

- [docs/architecture/overview.md](../../architecture/overview.md)
- [docs/api/openapi.yaml](../../api/openapi.yaml)
- [docs/brd/btx-brd.md](../../brd/btx-brd.md)
- P-26 status review (upstream)

## 1. Inputs

```yaml
REVIEW_ID: CLV-2026-05-16
SCOPE: all
LAYERS: [spec, schema, api, backend, frontend, policy, audit, docs, tests]
```

## 2. Plan, then execute

1. **Pairwise drift matrix.** For each ordered layer pair, list mismatches:
   - **spec ↔ schema** — entities, tenancy boundaries, lifecycle fields, audit fields.
   - **schema ↔ api** — fields, enums, nullability, IDs, list/filter/sort capabilities.
   - **api ↔ backend** — every documented endpoint has a handler; every handler has a doc entry; auth + permission + error model match.
   - **backend ↔ frontend** — frontend calls real endpoints; form validation matches; loading/error/success states present; role-gated UI matches role-gated API.
   - **policy ↔ brd / api** — every BRD permission claim has a Rego rule + Rego test; no silent permission expansion.
   - **audit ↔ actions** — every state-changing action emits an audit event in the chain.
   - **docs ↔ reality** — no documented module missing in code; no code module missing from docs.
   - **tests ↔ contracts** — every API contract has a contract test; every Rego rule has a policy test; every audit event has a chain test.
2. **Severity tag.** Critical / High / Medium / Low — per impact on trust, privacy, citizen, or release.
3. **Owner + fix plan.** Each row owned; each row has a fix plan (PR, CT, ADR, doc update).
4. **drift.yaml** structured for machine consumption by P-28 (release readiness).
5. **Evidence pack.** Sign `evidence/audits/<REVIEW_ID>.tar.gz`.

## 3. Hard rules

- **Critical drift blocks release.** Any Critical on policy / audit / schema must be remediated before P-28 can mark release-ready.
- **No "looks aligned" claims.** Each row must cite the artefacts compared (file paths + line ranges).
- **No silent permission expansion.** A policy ↔ BRD drift where the policy is *more* permissive than the BRD is automatically Critical.
- **No silent audit gap.** A state-changing action with no audit event is automatically Critical.

## 4. Acceptance

- [ ] All six `tools/*-diff` checks exit 0 (or every diff has a drift.yaml entry).
- [ ] `tools/drift-yaml-check` exit 0.
- [ ] Critical rows have either a merged remediation PR or a signed risk-acceptance.
- [ ] Evidence pack signed and verifies.
- [ ] CODEOWNERS: `@architect`, `@security-lead`, `@privacy-lead`.

## 5. Worked example

See [`_examples/p27.md`](./_examples/p27.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the review if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
