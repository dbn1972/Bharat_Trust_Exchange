---
id: P-32
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@qa-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: TEST_ID, type: "pattern[INT-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SCOPE,   type: "enum[control-plane|trust-node|connector|federation|cross-cloud|all]", required: true }
  - { name: MATRIX,  type: "object", required: true }   # { nodes: [...], clouds: [aws, gcp, azure, on-prem] }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "audits/<TEST_ID>/integration-plan.md" }
  - { kind: file_created, path: "audits/<TEST_ID>/module-map.yaml" }
  - { kind: file_created, path: "audits/<TEST_ID>/results.json" }
  - { kind: file_created, path: "evidence/audits/<TEST_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/architecture/overview.md", "ct/manifest.yaml", "docs/agent/prompts/p08-conformance-test.prompt.md"]
  skim: ["services/**/contracts/**", "docs/audit/events.yaml"]
executable_acceptance:
  - { name: module-map,           cmd: "tools/module-map-check audits/<TEST_ID>/module-map.yaml", pass_when: "every module: purpose, inputs, outputs, deps, data-owned, apis, events-pub, events-sub, failure-risks" }
  - { name: flow-coverage,        cmd: "tools/flow-coverage audits/<TEST_ID>/integration-plan.md", pass_when: "every Critical inter-module flow has ≥1 integration test" }
  - { name: cross-node,           cmd: "tools/run-integration --scope cross-node --matrix <MATRIX>", pass_when: "auth, audit chain, policy bundle sync, consent revoke propagate across all nodes pass" }
  - { name: cross-cloud,          cmd: "tools/run-integration --scope cross-cloud --matrix <MATRIX>", pass_when: "every cloud-adapter pair: object-store, KMS, signer, queue, identity works end-to-end" }
  - { name: failure-injection,    cmd: "tools/chaos-integration --scope <SCOPE>", pass_when: "auth/DB/cache/queue/connector failures degrade gracefully; no data loss; no silent audit gap" }
  - { name: data-consistency,     cmd: "tools/consistency-probe --scope <SCOPE>", pass_when: "write → audit → read consistency holds within documented bounds" }
  - { name: contract-tests-green, cmd: "tools/contract-tests --scope <SCOPE>", pass_when: "every published contract has a consumer test + a provider test, all green" }
  - { name: results-shape,        cmd: "tools/results-json-check audits/<TEST_ID>/results.json", pass_when: "schema valid; pass/fail per flow; failures linked to issue + owner" }
  - { name: evidence-pack,        cmd: "cosign verify-blob --signature evidence/audits/<TEST_ID>.tar.gz.sig evidence/audits/<TEST_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "any cross-node consent revoke that does not propagate within SLO"
  - "any audit chain gap under failure injection"
  - "any cross-cloud KMS / signer mismatch"
  - "any silent data loss under retry / DLQ"
escalation: { to: "@qa-lead, @architect, @platform", channel: "#btx-qa" }
graph: { upstream: [P-27], downstream: [P-08, P-19, P-28] }
---

# P-32 — Deep integration test design (cross-service / cross-Trust-Node / cross-cloud)

> System-level integration testing. Goes beyond per-service tests (P-19) and per-contract conformance tests (P-08): exercises **modules together, across Trust Nodes, across clouds**, under failure injection.

## 0. Read first

- [docs/architecture/overview.md](../../architecture/overview.md)
- [P-08 conformance test](./p08-conformance-test.prompt.md)
- [P-19 test backfill](./p19-test-backfill.prompt.md)
- `ct/manifest.yaml`

## 1. Inputs

```yaml
TEST_ID: INT-2026-05-16
SCOPE: federation
MATRIX:
  nodes:  [tn-mum, tn-blr, tn-del]
  clouds: [aws, gcp, on-prem]
```

## 2. Plan, then execute

1. **Module map.** Enumerate modules in SCOPE; for each: purpose, inputs, outputs, deps, data owned, APIs exposed, events published / subscribed, failure risks.
2. **Inter-module flows.** Document each source→target flow with trigger, API/event used, DB/cache/queue touched, expected outcome, failure behaviour, test coverage status. Tag each flow Critical/High/Medium/Low.
3. **Critical flow inventory** (must have integration test):
   - citizen consent grant + revoke propagation across nodes
   - audit chain append + cross-node sync + replay
   - policy bundle distribution + activation
   - cross-border share with step-up auth
   - federation join / leave / re-key
   - cross-cloud failover (KMS, object store, signer)
   - connector failure + DLQ replay
   - Trust Node mTLS rotation
4. **Failure injection.** For each Critical flow inject: auth outage, DB outage, cache outage, queue outage, connector outage, partition between nodes, partial cloud-adapter failure. Assert graceful degradation, no data loss, no silent audit gap.
5. **Data consistency probes.** Write → audit → read; reconcile chain heads across nodes.
6. **Contract tests** (P-08 alignment) — every published contract has consumer + provider test, all green.
7. **Results + evidence.** Machine-readable `results.json`; failures linked to issue + owner; sign evidence pack.

## 3. Hard rules

- **No mocks where real components can be containerised.** Cross-node tests use real Trust Node containers; cross-cloud tests use real (or LocalStack-grade) adapters.
- **No silent audit gap is acceptable.** A failure that drops an audit event is a hard fail.
- **Consent revocation must propagate within SLO** across all nodes; partial propagation is a hard fail.
- **No exploit-style fault injection.** Faults are operational (timeout, 5xx, partition), not malicious.
- **Failures get owners + ETAs.** No untriaged red rows.

## 4. Acceptance

- [ ] All `tools/*` checks exit 0.
- [ ] Critical flow inventory 100% covered.
- [ ] Failure-injection matrix executed; results attached.
- [ ] Results JSON validates; failures owned + ETA'd.
- [ ] Evidence pack signed and verifies.
- [ ] CODEOWNERS: `@qa-lead`, `@architect`, `@platform`.

## 5. Worked example

See [`_examples/p32.md`](./_examples/p32.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the run if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
