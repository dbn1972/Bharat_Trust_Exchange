---
id: P-06
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@audit-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: EVENT, type: dotted, required: true }
  - { name: TOPIC, type: kafka-topic, required: false, default: "btx.audit.v1" }
  - { name: TRIGGER, type: text, required: true }
  - { name: HASHED_FIELDS, type: list, required: false }
forbidden_paths: ["schemas/audit/btx.audit.v1.json"]  # additive change only via dedicated PR
expected_outputs:
  - { kind: pr, title_pattern: "[audit] emit <EVENT>" }
context_budget:
  read_in_full: ["BTX_Architecture_Annex_A_Engineering.md", "pkg/audit/README.md", "schemas/audit/btx.audit.v1.json"]
  skim: ["docs/adr/0005-audit-as-trust-product.md"]
executable_acceptance:
  - { name: schema-validate, cmd: "tools/audit-schema-check", pass_when: "exit 0" }
  - { name: unit, cmd: "make test PKG=pkg/audit", pass_when: "exit 0" }
  - { name: integration-kafka, cmd: "make integration AUDIT=1", pass_when: "event lands within 2s with required fields" }
  - { name: ct-audit, cmd: "make certify CT=CT-015,CT-016", pass_when: "exit 0" }
  - { name: log-pii, cmd: "tools/log-pii-check .", pass_when: "0 findings" }
halt_conditions:
  - "event payload contains request/response body or PII"
  - "silent drop path on producer error (must alert)"
  - "bypasses pkg/audit and calls broker directly"
escalation: { to: "@audit-lead", channel: "#btx-audit" }
graph: { upstream: [], downstream: [P-08, P-12] }
---

# P-06 — Wire audit emission to a code path

> Use to add a new audit event, or to enrich an existing one, anywhere in the BTX codebase. Audit is a product (ADR-005) — treat the schema as a public contract.

---

You are Claude Code adding tamper-evident audit to a code path. The event you emit will end up in the hash chain, be anchored, be exported to SIEMs, and may be surfaced to citizens. Get the contract right.

## 0. Read first

- Architecture Doc §9 (Audit)
- Annex A §A.7 (event schema, partitioning, hash chain, anchor signing)
- Annex B §B.8 (audit pipeline operations), §B.12 (anomaly response)
- ADR-005, ADR-015

## 1. Inputs

| Input | Value |
|---|---|
| Event name | `<<EVENT>>` (e.g. `exchange.decision`) |
| Topic | `btx.audit.v1` (default) or sub-topic |
| Trigger | when in the code path does this fire |
| Required fields | confirm with Annex A §A.7 |
| Sensitive fields (must be IDs / hashes only) | `<<HASHED_FIELDS>>` |
| Conformance tests | CT-015 (chain integrity), CT-016 (anchor verifiability) |

## 2. Execute

1. **Confirm schema** in `schemas/audit/btx.audit.v1.json`. If the event needs a new field, propose an additive backwards-compatible change first; coordinate with `@audit-lead`.
2. **Producer code** call the shared audit client (`pkg/audit`). Build the event with:
   - `txn_id`, `parent_txn_id` (if any), `member_id`, `service_id`, `purpose_code`
   - `decision`, `obligations`, `error_code` (if applicable)
   - timestamps (`ts_start`, `ts_emit`)
   - cryptographic context: `kid`, `bundle_id`, `policy_version`
   - **never** the request/response body
3. **Schema validation** validate the event in-process before publish; fail closed with an alert metric (`btx_audit_emit_failures_total`) — do not silently drop.
4. **Idempotency** include `event_id` (UUID v7); downstream digester deduplicates.
5. **Async path** publish via the local sidecar producer; never block the request path on broker availability beyond the SLO.
6. **Backpressure** if the producer queue fills, increment `btx_audit_backpressure_total`, log, and follow the documented policy (Annex B §B.8.4).
7. **Tests**:
   - Unit: builder produces a schema-valid event for every code branch.
   - Integration: Kafka testcontainer asserts the event lands with all required fields.
   - Negative: schema-invalid event triggers fail-closed path.
8. **Docs** update `services/<svc>/README.md` audit table; update `schemas/audit/CHANGELOG.md` if schema changed.

## 3. Hard rules

- No bodies, no PII in events. Only IDs and hashes (`sha256:…`).
- No silent drops. Every emit failure is a metric + log + alert.
- No new field without an additive schema change and a `CHANGELOG.md` entry.
- No bypass of `pkg/audit` — direct producer calls are forbidden.

## 4. Acceptance

- [ ] Event validates against `btx.audit.v1`.
- [ ] All required fields populated; sensitive fields are IDs/hashes only.
- [ ] Schema-validation in-process before publish.
- [ ] Failure-to-emit metric + log + alert wired.
- [ ] Idempotent `event_id` set.
- [ ] Integration test asserts the event on the topic.
- [ ] CT-015 and CT-016 still pass.
- [ ] Docs updated.
- [ ] CODEOWNERS approvals: `@audit-lead`.

## 5. Worked example

See [`_examples/p06.md`](./_examples/p06.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
