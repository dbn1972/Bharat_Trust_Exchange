---
id: P-03
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@security-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: FEATURE, type: title, required: true }
  - { name: SUB_COMPONENT, type: "enum[envoy|signer|replay|shaper|bundle|adapter-router]", required: true }
  - { name: THREAT_IDS, type: list, required: true }
  - { name: ADR_IDS, type: list, required: true }
  - { name: CT_IDS, type: list, required: true }
  - { name: BUDGET_MS, type: int, required: true }
forbidden_paths: [".github/CODEOWNERS", "docs/adr/0000-template.md"]
expected_outputs:
  - { kind: pr, title_pattern: "[trust-node] <FEATURE>" }
  - { kind: files_created, glob: "services/trust-node/design/**" }
  - { kind: files_modified, glob: "threat-models/trust-node.md" }
context_budget:
  read_in_full: [AGENTS.md, "docs/agent/anti-patterns.md", "services/trust-node/README.md", "BTX_Architecture_Annex_A_Engineering.md"]
  skim: ["BTX_Architecture_Annex_B_Runbooks.md"]
executable_acceptance:
  - { name: unit-cov, cmd: "make test SVC=trust-node && tools/cov-gate 90", pass_when: "exit 0" }
  - { name: integration, cmd: "make integration SVC=trust-node", pass_when: "exit 0" }
  - { name: perf, cmd: "k6 run --thresholds tests/perf/trust-node.thresholds.json tests/perf/trust-node/<FEATURE_SLUG>.js", pass_when: "all thresholds green" }
  - { name: conformance, cmd: "make certify CT=<CT_IDS>", pass_when: "exit 0" }
  - { name: log-redaction, cmd: "tools/log-pii-check services/trust-node", pass_when: "0 findings" }
halt_conditions:
  - "removes or weakens mTLS / signing / replay / PDP / audit"
  - "adds latency > BUDGET_MS p95"
  - "hand-edits Envoy config in cluster instead of generating from signed bundle"
escalation: { to: "@security-lead", channel: "#btx-trust-node" }
graph: { upstream: [P-04, P-09, P-10], downstream: [P-06, P-08, P-11, P-12] }
---

# P-03 — Implement a Trust Node (data-plane) feature

> Use for behaviour changes inside the Trust Node: Envoy filters, ext_authz interaction, signing, replay cache, response shaper, adapter routing, bundle handling.

---

You are Claude Code working on the BTX Trust Node. The Trust Node is the **only** sanctioned ingress/egress path for member exchanges. You will modify it with extreme care: this is the data-plane boundary.

## 0. Read first

- [`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md)
- [`docs/agent/anti-patterns.md`](../anti-patterns.md) (everything; this is the highest-risk surface)
- Architecture Doc §4.1, §4.4, §6, §13
- Annex A §A.1 (sequence diagrams), §A.5 (wire contract), §A.6 (Rego), §A.8 (crypto), §A.11 (bundle layout)
- ADRs: 003, 004, 009, 011, 012, 013, 014, 017
- `services/trust-node/README.md` and current Envoy/OPA config templates
- Annex B §B.6 (revocation), §B.7 (bundle publishing)

## 1. Inputs

| Input | Value |
|---|---|
| Feature title | `<<FEATURE>>` |
| Affected sub-component | Envoy filter / signer / replay cache / shaper / bundle loader / adapter router |
| Threats it mitigates / introduces | `<<THREAT_IDS>>` (Annex A §A.12 / Arch §6) |
| ADRs that apply | `<<ADR_IDS>>` |
| Conformance tests affected | `<<CT_IDS>>` |
| Performance budget impact | `<<BUDGET_MS>>` |

## 2. Plan, then execute

1. **Design note** add a short note under `services/trust-node/design/<<FEATURE_SLUG>>.md` capturing intent, sequence, failure modes, performance budget.
2. **Threat model delta** update `threat-models/trust-node.md` STRIDE rows.
3. **Implement**:
   - Envoy: configuration changes via the **generated** TN config (driven by the signed bundle). No hand-edited Envoy files in clusters.
   - OPA: policy changes go through P-04 (separate PR).
   - Signer / replay cache / shaper: code in `services/trust-node/internal/`.
   - Bundle handling: verify TUF role chain on every refresh; refuse expired/unsigned.
4. **Fail-closed** verify every new decision path defaults to deny on error.
5. **Performance**: keep within `<<BUDGET_MS>>` ms p95 added latency. Add a perf test in `tests/perf/trust-node/`.
6. **Tests**:
   - Unit on the changed module.
   - Integration with Envoy + OPA + KMS-fake + Kafka via testcontainers.
   - Negative tests: expired SVID, bad signature, replay, expired bundle, PDP timeout, KMS outage.
7. **Observability**: add metrics (`btx_tn_<feature>_…`), traces, structured logs. No request bodies in logs.
8. **Conformance**: extend `certify/<<CT_IDS>>/`.
9. **Runbook**: if the feature has an operator-facing failure mode, add to `docs/runbooks/trust-node/` using `docs/templates/runbook-template.md`. If chaos-relevant, add a scenario to `tests/chaos/`.

## 3. Hard rules

- Never bypass mTLS, signing, replay, PDP or audit. If a code path appears to allow this "just in this case", stop and open an ADR.
- Never log request/response bodies. Log only IDs, decisions, error codes.
- Never extend bundle TTL beyond the cap defined in Annex A §A.11 without an ADR.
- Never call out to external systems from inside the Envoy filter path; offload to the upstream cluster.
- Replay cache: ensure the nonce window matches the request signature TTL.

## 4. Acceptance

- [ ] Threat model and design note updated.
- [ ] Fail-closed paths covered by tests.
- [ ] Perf test added; p95 within budget on the test bench.
- [ ] No log/metric/trace contains PII or body content.
- [ ] Negative tests added (SVID, sig, replay, bundle, PDP, KMS).
- [ ] Conformance suite for `<<CT_IDS>>` still passes.
- [ ] Runbook updated (if operator-relevant).
- [ ] No anti-pattern introduced.
- [ ] CODEOWNERS approvals: security + platform.

## 5. Worked example

See [`_examples/p03.md`](./_examples/p03.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
