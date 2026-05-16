---
id: P-07
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@platform-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: CLOUD, type: "enum[aws|azure|gcp|nic|state-cloud|onprem|oci|other]", required: true }
  - { name: ADAPTER, type: "enum[iam|kms|hsm|objectstore|dns|lb|log|backup|secret]", required: true }
  - { name: CAPS, type: list, required: true }
  - { name: RESIDENCY, type: text, required: true }
forbidden_paths: ["services/**/internal/domain/**", "services/**/internal/transport/**"]
expected_outputs:
  - { kind: pr, title_pattern: "[adapter/<ADAPTER>/<CLOUD>] add" }
  - { kind: files_created, glob: "pkg/adapter/<ADAPTER>/<CLOUD>*" }
  - { kind: files_created, glob: "infrastructure/<CLOUD>/**" }
context_budget:
  read_in_full: ["pkg/adapter/<ADAPTER>.go", "BTX_Architecture_Document.md", "BTX_Architecture_Annex_C_Evidence.md"]
  skim: ["docs/adr/0008-certified-cloud-adapters.md"]
executable_acceptance:
  - { name: unit, cmd: "go test ./pkg/adapter/<ADAPTER>/...", pass_when: "exit 0" }
  - { name: iac-plan, cmd: "tofu -chdir=infrastructure/<CLOUD> plan -out tfplan && tofu show -json tfplan > evidence/plan.json", pass_when: "exit 0" }
  - { name: helm-render, cmd: "helm template deploy/helm -f deploy/values-<CLOUD>.yaml > /dev/null", pass_when: "exit 0" }
  - { name: conformance, cmd: "make certify CLOUD=<CLOUD> CT=CT-001,CT-024,CT-025", pass_when: "exit 0" }
  - { name: iac-scan, cmd: "tfsec infrastructure/<CLOUD>", pass_when: "0 high" }
halt_conditions:
  - "cloud SDK types leak across the adapter interface boundary"
  - "a managed cloud service is used for a BTX trust control (PDP/audit chain/signer) — Cloud KMS is the only permitted exception per ADR-0020"
  - "keys not tenant-owned (no CMK configured)"
  - "KMS adapter not implemented for this cloud — KMS is mandatory v1 per ADR-0020 for envelope encryption, mTLS CA and audit-root signing"
escalation: { to: "@platform-lead, @security-lead", channel: "#btx-platform" }
graph: { upstream: [P-10], downstream: [P-08, P-12, P-14] }
---

# P-07 — Add or extend a certified cloud adapter

> Use to add a new cloud target (e.g. OCI, Yotta) or to extend a capability (e.g. KMS, IAM) for an existing cloud. Portability is provable, not promised (ADR-002, ADR-008).

---

You are Claude Code working in `infrastructure/` and `pkg/adapter/`. Your job is to add or extend an adapter so that the BTX product core continues to run identically across clouds.

## 0. Read first

- Architecture Doc §12 (cloud-agnostic), §16 (deployment)
- Annex C §C.3 (control-to-evidence), §C.8 (exit playbook)
- ADR-002, ADR-008, ADR-016
- `pkg/adapter/` interface definitions: `IamAdapter`, `KmsAdapter`, `HsmAdapter`, `ObjectStoreAdapter`, `DnsAdapter`, `LoadBalancerAdapter`, `LogAdapter`, `BackupAdapter`, `SecretAdapter`

## 1. Inputs

| Input | Value |
|---|---|
| Cloud target | `<<CLOUD>>` (aws / azure / gcp / nic / state-cloud / onprem-openshift / other) |
| Adapter | `<<ADAPTER>>` (iam, kms, hsm, objectstore, dns, lb, log, backup, secret) |
| Capabilities to implement | `<<CAPS>>` |
| Region / residency constraints | `<<RESIDENCY>>` |
| BRD reference | §22 ADR-002/008, §25 |

## 2. Execute

1. **Interface compliance** read `pkg/adapter/<<ADAPTER>>.go`. Implement every method; do not add cloud-specific methods to the interface.
2. **Implementation** in `pkg/adapter/<<ADAPTER>>/<<CLOUD>>.go` (or equivalent in your language).
3. **IaC** add `infrastructure/<<CLOUD>>/` modules (OpenTofu) for the dependent resources (KMS keys, IAM roles, buckets, DNS zones). No clickops; everything in code.
4. **Helm overlays** add `deploy/values-<<CLOUD>>.yaml` differences; keep the application chart unchanged.
5. **Secrets** wire to the cloud's secret store via the SecretAdapter; no inline secrets in values.
6. **Conformance** run the conformance suite (CT-001..025) against a sandbox of `<<CLOUD>>`. Add a CI matrix entry.
7. **Evidence pack** produce `evidence/<<CLOUD>>/<release>/` with signed test reports, IaC plan output, SBOMs, image attestations.
8. **Exit playbook** update Annex C §C.8 with any cloud-specific gotchas.
9. **Docs** `infrastructure/<<CLOUD>>/README.md` with prerequisites, bootstrap steps, on-call.

## 3. Hard rules

- Do not leak cloud SDK types across the adapter interface boundary.
- Do not invoke cloud APIs from `internal/domain/` or `internal/transport/`.
- Do not use a managed cloud service for any BTX-product responsibility (PDP, audit chain, signer) where the open-source alternative exists; managed services may host the broker/DB but not the trust controls.
- Encryption keys are tenant-owned (CMK) on every cloud.

## 4. Acceptance

- [ ] Interface methods implemented; tests in `pkg/adapter/<<ADAPTER>>/<<CLOUD>>_test.go`.
- [ ] OpenTofu modules apply against a sandbox; plan output captured.
- [ ] Helm overlay renders cleanly; no business-logic changes.
- [ ] CT-001 (deployment portability), CT-024 (KMS rotation) and the adapter-specific CTs pass on `<<CLOUD>>`.
- [ ] Evidence pack signed and stored.
- [ ] Exit playbook updated.
- [ ] CODEOWNERS approvals: `@platform-lead`, `@security-lead`.
- [ ] No anti-pattern introduced.

## 5. Worked example

See [`_examples/p07.md`](./_examples/p07.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
