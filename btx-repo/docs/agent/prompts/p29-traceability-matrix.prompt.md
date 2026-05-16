---
id: P-29
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@architect"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: MATRIX_ID, type: "pattern[TRC-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SCOPE,     type: "enum[control-plane|trust-node|connector|federation|all]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "audits/<MATRIX_ID>/traceability.csv" }
  - { kind: file_created, path: "audits/<MATRIX_ID>/traceability.md" }
  - { kind: file_created, path: "evidence/audits/<MATRIX_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/brd/btx-brd.md", "docs/api/openapi.yaml", "docs/agent/prompts/prompt_graph.yaml"]
  skim: ["docs/adr/*.md", "ct/manifest.yaml", "docs/audit/events.yaml"]
executable_acceptance:
  - { name: matrix-shape, cmd: "tools/traceability-check audits/<MATRIX_ID>/traceability.csv", pass_when: "10 columns; one row per BRD requirement; no empty Status" }
  - { name: full-chain,   cmd: "tools/traceability-chain audits/<MATRIX_ID>/traceability.csv", pass_when: "every Complete row has refs in all 8 link columns" }
  - { name: brd-coverage, cmd: "tools/brd-coverage audits/<MATRIX_ID>/traceability.csv docs/brd/btx-brd.md", pass_when: "every BRD requirement appears ≥ once" }
  - { name: ct-coverage,  cmd: "tools/ct-coverage audits/<MATRIX_ID>/traceability.csv ct/manifest.yaml", pass_when: "every Complete row links to ≥ 1 conformance test ID" }
  - { name: orphan-tests, cmd: "tools/orphan-tests ct/manifest.yaml audits/<MATRIX_ID>/traceability.csv", pass_when: "no CT exists without a BRD/ADR row" }
  - { name: evidence-pack, cmd: "cosign verify-blob --signature evidence/audits/<MATRIX_ID>.tar.gz.sig evidence/audits/<MATRIX_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "any BRD requirement with Status=Complete but missing CT or audit-event ref"
  - "any orphan CT (test exists for no requirement) on safety-critical paths"
  - "any policy bundle rule with no BRD/ADR linkage"
escalation: { to: "@architect, @qa-lead", channel: "#btx-audit" }
graph: { upstream: [P-27], downstream: [P-28] }
---

# P-29 — Traceability matrix

> One row per BRD requirement linked across **screen → API → service → schema → policy → audit-event → CT → ADR → docs**. Output is a machine-checkable CSV + narrative MD.

## 0. Read first

- [docs/brd/btx-brd.md](../../brd/btx-brd.md)
- [docs/api/openapi.yaml](../../api/openapi.yaml)
- P-27 drift register (upstream)
- `ct/manifest.yaml`

## 1. Inputs

```yaml
MATRIX_ID: TRC-2026-05-16
SCOPE: all
```

## 2. Plan, then execute

1. Enumerate BRD requirements within SCOPE (FR-NNN, NFR-NNN).
2. For each, populate the 10 columns (below).
3. Mark `Status` ∈ {Complete | Partial | Missing}. Complete requires non-empty refs in all 8 link columns + ≥ 1 green CT.
4. Cross-check: every CT in `ct/manifest.yaml` must trace back to ≥ 1 BRD/ADR row (no orphan tests on safety-critical paths).
5. Write narrative `traceability.md` summarising coverage % per area + top gaps.
6. Sign `evidence/audits/<MATRIX_ID>.tar.gz`.

### CSV columns (in order)

1. `requirement_id` (BRD FR/NFR/ADR ref)
2. `requirement_summary`
3. `screen_or_journey` (P-22/P-23 frame refs)
4. `api_endpoint` (OpenAPI path + method)
5. `backend_service` (service + handler file)
6. `schema_or_entity` (table / aggregate)
7. `policy_rule` (rego path + rule name)
8. `audit_event` (event name from `docs/audit/events.yaml`)
9. `conformance_test` (CT ID, comma-separated)
10. `status` + `gap_or_risk`

## 3. Hard rules

- **No "Complete" without all 8 links.** A requirement without a CT or audit event is **at most Partial**.
- **Citizen-impacting requirements must have a usability evidence (P-25) ref** in `gap_or_risk` if Partial/Missing.
- **No orphan CTs on safety-critical paths.** Either tie back to a BRD/ADR row, or delete/move the test.
- **No silent policy rules.** Every Rego rule must trace to a BRD/ADR row.

## 4. Acceptance

- [ ] All `tools/*-check` and `tools/*-coverage` exit 0.
- [ ] Coverage ≥ stage threshold (alpha 60%, beta 90%, rc 100% on safety-critical).
- [ ] `traceability.md` summarises top 10 gaps with owners.
- [ ] Evidence pack signed and verifies.
- [ ] CODEOWNERS: `@architect`, `@qa-lead`.

## 5. Worked example

See [`_examples/p29.md`](./_examples/p29.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the matrix if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
