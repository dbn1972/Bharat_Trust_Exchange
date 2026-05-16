---
id: P-08
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@qa-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: CT_ID, type: "pattern[CT-\\d{3}]", required: true }
  - { name: INVARIANT, type: sentence, required: true }
  - { name: SURFACES, type: list, required: true }
  - { name: CLOUDS, type: list, required: true }
forbidden_paths: [".github/CODEOWNERS"]
expected_outputs:
  - { kind: pr, title_pattern: "[certify] <CT_ID>" }
  - { kind: files_created, glob: "certify/<CT_ID>/**" }
context_budget:
  read_in_full: ["BTX_Architecture_Annex_C_Evidence.md", "docs/test-strategy.md"]
  skim: ["docs/adr/0010-conformance-before-production.md"]
executable_acceptance:
  - { name: hermetic, cmd: "make certify CT=<CT_ID>", pass_when: "exit 0 from clean checkout" }
  - { name: determinism, cmd: "make certify CT=<CT_ID> && make certify CT=<CT_ID> && diff -r evidence/run1 evidence/run2", pass_when: "identical except timestamps" }
  - { name: cross-cloud, cmd: "for c in <CLOUDS>; do make certify CT=<CT_ID> CLOUD=$c; done", pass_when: "exit 0 on each" }
  - { name: evidence-sign, cmd: "cosign sign-blob --yes evidence/<CT_ID>/report.json --output-signature evidence/<CT_ID>/report.sig", pass_when: "exit 0" }
halt_conditions:
  - "test depends on external network beyond testcontainers"
  - "fixture contains real or realistic PII"
  - "test asserts on implementation detail rather than invariant"
escalation: { to: "@qa-lead", channel: "#btx-qa" }
graph: { upstream: [], downstream: [P-12] }
---

# P-08 — Implement or extend a conformance test (CT-NNN)

> Use to implement, extend or harden a CT-001..025 conformance test. Conformance is the gate to production (ADR-010).

---

You are Claude Code working under `certify/`. Conformance tests are the evidence pack reviewers see. They must be deterministic, hermetic, and assert the architectural invariant — not the implementation detail.

## 0. Read first

- Architecture Doc §21 (Conformance & evidence)
- Annex C §C.3.3 (control-to-evidence matrix), §C.12 (evidence pack format)
- BRD §26 (CT catalogue)
- [`docs/test-strategy.md`](../../test-strategy.md)
- ADR-010

## 1. Inputs

| Input | Value |
|---|---|
| Conformance ID | `CT-<<NNN>>` |
| Invariant under test | `<<INVARIANT>>` (one sentence) |
| Surfaces involved | services / TN / policy / audit / cloud adapter |
| Fixtures needed | members, services, purposes, grants, certs |
| Expected outputs | metrics, audit events, decision logs |
| Cloud matrix | which certified clouds it runs on |

## 2. Execute

1. **Layout** `certify/CT-<<NNN>>/` containing `README.md`, `manifest.yaml`, fixtures, test code.
2. **Manifest** fields: `id`, `title`, `invariant`, `surfaces`, `fixtures`, `expected`, `clouds`, `owner`.
3. **Hermetic setup** spin up only what's needed via testcontainers (Postgres, Kafka, OPA, SPIRE, MinIO, Vault). Pin all images by digest.
4. **Determinism** inject Clock; seed PRNGs; freeze time where needed; assert on canonical sorted JSON.
5. **Test body** assert the invariant explicitly. Don't assert on implementation paths.
6. **Evidence collection** capture artefacts: test report (JUnit), decision logs, audit events, signed receipts. Output to `evidence/<run>/CT-<<NNN>>/`.
7. **Signing** evidence pack signed by CI with cosign; verification step included.
8. **Cloud matrix** mark which clouds this CT runs on; add to `certify/manifest.yaml`.
9. **CI** ensure it runs in the release pipeline. If it must run nightly, add to `nightly` job.
10. **Docs** update `certify/README.md` index.

## 3. Hard rules

- No network egress beyond testcontainers.
- No real PII in any fixture — only synthetic.
- No assertion on log strings only — always assert on structured events / metrics where possible.
- No flakes — quarantine policy applies (test-strategy §Flakes).

## 4. Acceptance

- [ ] Manifest complete and validated.
- [ ] Hermetic; runs from a clean checkout with `make certify CT=<<NNN>>`.
- [ ] Asserts the architectural invariant, not the implementation detail.
- [ ] Evidence pack produced, signed, archived.
- [ ] Added to `certify/README.md` index.
- [ ] Runs on every cloud listed in the manifest.
- [ ] CODEOWNERS approvals: `@qa-lead` + relevant surface owner.

## 5. Worked example

See [`_examples/p08.md`](./_examples/p08.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
