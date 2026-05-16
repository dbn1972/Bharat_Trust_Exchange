---
id: P-14
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@platform-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: MODULE, type: import-path, required: true }
  - { name: LOCKIN, type: text, required: true }
  - { name: ADAPTERS, type: list, required: true }
  - { name: CLOUDS, type: list, required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[portability] <MODULE>" }
  - { kind: files_modified, glob: "<MODULE>/**" }
  - { kind: files_created, glob: "<MODULE>/MIGRATION.md" }
context_budget:
  read_in_full: ["pkg/adapter/README.md", "docs/adr/0008-certified-cloud-adapters.md"]
executable_acceptance:
  - { name: sdk-leak, cmd: "tools/cloud-sdk-leak-check <MODULE>", pass_when: "0 imports of cloud SDKs in domain/transport" }
  - { name: baseline-tests, cmd: "make test MODULE=<MODULE>", pass_when: "unchanged green" }
  - { name: cross-cloud, cmd: "for c in <CLOUDS>; do make certify CLOUD=$c MODULE=<MODULE>; done", pass_when: "exit 0 on each" }
halt_conditions:
  - "feature-flag dual paths kept (old + new) instead of clean removal"
  - "semantics changed without ADR"
  - "any in-scope cloud failing conformance after refactor"
escalation: { to: "@platform-lead", channel: "#btx-platform" }
graph: { upstream: [P-10, P-07], downstream: [P-08, P-12] }
---

# P-14 — Refactor for portability (de-lock-in)

> Use when audit reveals cloud-specific code, SDK leakage, or proprietary service use in a path that should be portable (ADR-002, ADR-008).

---

You are Claude Code removing cloud lock-in from a BTX module. The goal is identical behaviour across certified clouds, behind adapter interfaces.

## 0. Read first

- ADR-002, ADR-008
- `pkg/adapter/` interfaces
- Annex C §C.8 (exit playbook), §C.3 (control-to-evidence)

## 1. Inputs

| Input | Value |
|---|---|
| Module / package under refactor | `<<MODULE>>` |
| Lock-in symptom | (e.g., direct `s3.New(...)`, IAM ARN hardcoded, KMS SDK calls) |
| Target adapters | object-store / kms / iam / dns / lb / log / backup / secret |
| Clouds in scope | aws / azure / gcp / nic / onprem |
| Behavioural baseline | tests that must pass unchanged |

## 2. Execute

1. **Map the leakage** list every cloud SDK import and every cloud-specific config; record under `<<MODULE>>/MIGRATION.md`.
2. **Choose adapters** for each leakage point pick the right interface in `pkg/adapter/`. If none fits, propose a new interface via ADR (P-10).
3. **Refactor** behind the adapter; keep public domain APIs unchanged. Inject the adapter in `cmd/` wiring.
4. **Per-cloud impls** ensure implementations exist for each in-scope cloud, with tests (P-07 if new).
5. **Snapshot tests** run the baseline test suite — behaviour must be byte-identical on the dominant cloud.
6. **Cross-cloud test** run conformance on all clouds in scope.
7. **Cleanup** delete the old direct SDK code paths in the same PR (no dual paths).
8. **Docs** update `MIGRATION.md` with before/after diagram; update the service tech spec.

## 3. Hard rules

- No "feature parity flag" that keeps the old direct path. Delete it.
- No leaking cloud SDK types across the adapter interface.
- No silent change in semantics; if semantics change, raise an ADR.
- No skipping the multi-cloud conformance run.

## 4. Acceptance

- [ ] All direct cloud SDK imports removed from `<<MODULE>>`.
- [ ] Adapter impls present for each in-scope cloud.
- [ ] Behavioural baseline passes unchanged on dominant cloud.
- [ ] Conformance green on every in-scope cloud.
- [ ] `MIGRATION.md` written; tech spec updated.
- [ ] CODEOWNERS approvals: `@platform-lead`, surface owner.

## 5. Worked example

See [`_examples/p14.md`](./_examples/p14.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
