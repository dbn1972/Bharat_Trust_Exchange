---
id: P-12
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@release-manager"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: TAG, type: "semver[vX.Y.Z]", required: true }
  - { name: SCOPE, type: list, required: true }
  - { name: ENVS, type: "list[sandbox|staging|prod]", required: true }
  - { name: CLOUDS, type: list, required: true }
  - { name: RISK, type: "enum[low|medium|high]", required: true }
forbidden_paths: [".github/CODEOWNERS", "docs/adr/00*.md"]
expected_outputs:
  - { kind: tag, pattern: "v<X>.<Y>.<Z>" }
  - { kind: files_created, glob: "evidence/<TAG>/**" }
  - { kind: files_created, glob: "release-notes/<TAG>.md" }
context_budget:
  read_in_full: ["docs/security/secure-sdlc.md", "BTX_Architecture_Annex_C_Evidence.md"]
  skim: ["docs/adr/0010-conformance-before-production.md", "docs/adr/0016-opentofu-helm-argocd-deployment.md"]
executable_acceptance:
  - { name: conformance-all, cmd: "for c in <CLOUDS>; do make certify CLOUD=$c; done", pass_when: "exit 0 on each" }
  - { name: sign-images, cmd: "tools/sign-all-images <TAG>", pass_when: "all images cosign-signed, SLSA L3 attestations present" }
  - { name: bundle-tuf, cmd: "tools/policy-bundle-verify", pass_when: "TUF roles verify" }
  - { name: evidence-pack, cmd: "tools/evidence-pack assemble <TAG> && cosign sign-blob --yes evidence/<TAG>/pack.tar.gz --output-signature evidence/<TAG>/pack.sig", pass_when: "exit 0" }
  - { name: canary-plan, cmd: "test -f release-notes/<TAG>-canary.md", pass_when: "file present with rollback rules" }
halt_conditions:
  - "any CT-001..025 failing on a target cloud"
  - "unsigned image, missing SBOM, or missing SLSA attestation"
  - "RISK=high without explicit auto-rollback rules"
escalation: { to: "@release-manager, @security-lead, @platform-lead", channel: "#btx-releases" }
graph: { upstream: [P-08], downstream: [P-20] }
---

# P-12 — Release engineering (signed, attested, evidenced)

> Use to cut a BTX release. The release is the artefact + the evidence pack. Both are signed.

---

You are Claude Code preparing a release. Production promotion is gated by conformance and a signed evidence pack (ADR-010, Annex C §C.12).

## 0. Read first

- [`docs/security/secure-sdlc.md`](../../security/secure-sdlc.md)
- Annex C §C.12 (evidence pack format), §C.3.3 (control-to-evidence)
- BRD §26 (CT catalogue), §30.3 (release gate)
- ADR-010, ADR-016

## 1. Inputs

| Input | Value |
|---|---|
| Release tag | `vX.Y.Z` |
| Scope | services, charts, policy bundles included |
| Target environments | sandbox → staging → prod |
| Cloud matrix | which certified clouds |
| Risk level | low / medium / high (drives canary plan) |

## 2. Execute

1. **Pre-flight**
   - All PRs merged; CHANGELOG entries present per module.
   - Open security advisories triaged.
   - Open conformance failures triaged or waived (waivers logged).
2. **Build**
   - Reproducible builds; pin base images by digest.
   - Generate SBOMs (Syft) per artefact.
   - Cosign-sign images; generate in-toto SLSA L3 attestations.
   - Build & sign the policy bundle (TUF roles, ADR-012).
3. **Tag** create `vX.Y.Z` annotated tag; signed.
4. **Conformance** run CT-001..025 against each certified cloud; gather evidence.
5. **Evidence pack** assemble `evidence/vX.Y.Z/` per Annex C §C.12: SBOMs, attestations, conformance reports, IaC plan diffs, threat model status, DPIA status, change log, signers. Cosign-sign the pack.
6. **Promote sandbox → staging** via ArgoCD; soak per Annex B §B.10.
7. **Canary in prod** per risk level (5% → 25% → 100%); auto-rollback rules tied to SLO burn.
8. **Release notes** generate via P-20; publish to the operator portal.
9. **Post-release** monitor SLOs and audit anomaly metrics for 24 h; close release in the operator portal.

## 3. Hard rules

- No prod promotion without a passing CT-001..025 evidence pack on the target cloud.
- No image without SBOM + cosign signature + SLSA L3 attestation.
- No policy bundle without TUF role verification.
- No canary without an auto-rollback rule.
- No release notes without a security & privacy summary.

## 4. Acceptance

- [ ] Tag created and signed.
- [ ] All artefacts signed; provenance verifiable.
- [ ] Evidence pack assembled, signed, archived.
- [ ] Conformance green on each target cloud.
- [ ] Canary plan documented and executed.
- [ ] Release notes published (P-20).
- [ ] Post-release monitoring window closed cleanly.
- [ ] CODEOWNERS approvals: `@release-manager`, `@security-lead`, `@platform-lead`.

## 5. Worked example

See [`_examples/p12.md`](./_examples/p12.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
