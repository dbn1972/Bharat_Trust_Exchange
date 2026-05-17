---
id: P-33
version: 1.0.0
last_reviewed: 2026-05-17
owner: "@platform-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: GATE_SCOPE, type: "enum[integration|certify|contract|security|all]", required: true }
  - { name: TARGET_STAGE, type: "enum[alpha|beta|rc|production]", required: true }
  - { name: CLOUDS, type: list, required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[release-gates] replace placeholder checks with executable gates" }
  - { kind: files_modified, glob: "tools/*.mjs" }
  - { kind: files_modified, glob: "scripts/*.sh" }
  - { kind: files_modified, glob: "Makefile" }
  - { kind: evidence, path: "evidence/release-gates/**" }
context_budget:
  read_in_full: ["docs/agent/prompts/_frame.md", "docs/agent/prompts/p28-release-readiness-audit.prompt.md", "docs/agent/prompts/p32-deep-integration-test.prompt.md"]
  skim: ["tools/*.mjs", "scripts/*.sh", "Makefile", "ct/**", "tests/**"]
executable_acceptance:
  - { name: no-placeholder-modes, cmd: "grep -RIn \"mode: 'placeholder'\\|placeholder\" tools scripts | grep -v _template && test $? -ne 0", pass_when: "exit_code == 0" }
  - { name: integration-real, cmd: "make integration SVC=control-plane", pass_when: "runs executable tests, not structural placeholder output" }
  - { name: certify-real, cmd: "make certify CT=all CLOUD=<first(CLOUDS)>", pass_when: "runs executable checks with real pass/fail evidence" }
  - { name: evidence-shape, cmd: "find evidence/release-gates -type f | wc -l", pass_when: ">= 3 evidence files created" }
  - { name: lint, cmd: "make lint", pass_when: "exit_code == 0" }
  - { name: test, cmd: "make test", pass_when: "exit_code == 0" }
halt_conditions:
  - "gate implementation would silently downgrade a failing check into warning-only for rc/production"
  - "replacement requires external SaaS dependency that breaks hermetic CI"
  - "real gate cannot emit machine-readable evidence per run"
escalation: { to: "@platform-lead, @qa-lead, @security-lead", channel: "#btx-release" }
graph: { upstream: [P-27, P-28, P-32], downstream: [P-12] }
---

# P-33 — Replace placeholder release gates with executable verification

## Read first

- [Prompt frame](./_frame.md)
- [P-28 release readiness audit](./p28-release-readiness-audit.prompt.md)
- [P-32 deep integration test design](./p32-deep-integration-test.prompt.md)
- `Makefile`
- `tools/*.mjs`
- `scripts/run-integration.sh`
- `scripts/run-ct.sh`

## Inputs

| Name | Meaning |
|---|---|
| `GATE_SCOPE` | Which gate family to replace first: integration, certify, contract, security, or all |
| `TARGET_STAGE` | Highest release stage the gate must be trusted for |
| `CLOUDS` | Cloud matrix to validate in the new gate implementation |

## Execute

1. Inventory every placeholder gate currently reachable via `make integration`, `make certify`, `make contract-test`, and related `tools/*.mjs` scripts.
2. Classify each gate as structural-only, best-effort, or executable. Produce a gap list and use it to scope the PR.
3. Replace placeholder logic with real commands and real assertions:
   - real service/container startup checks
   - real contract execution
   - real security/secret/IaC scanning where tools are available
   - explicit machine-readable fail paths
4. Emit evidence per run under `evidence/release-gates/` with timestamps, command outputs, and normalized result JSON.
5. Update `Makefile` and shell scripts so `make integration` and `make certify` are meaningful release gates rather than success-shaped placeholders.
6. Add or update tests that validate the new gate behavior does not report PASS when underlying checks are skipped or absent.
7. Verify the full acceptance block from a clean checkout.

## Hard rules

- Do not leave any `PASS` path that only proves a file exists when the prompt claims functional verification.
- Do not treat missing security tools as success for `beta`/`rc`/`production`; either install, vendor, or fail with actionable output.
- Do not introduce non-hermetic network calls in CI.
- Every gate result must produce machine-readable evidence and a human-readable summary.
- If a gate remains partially stubbed, mark it explicitly as non-production and do not wire it into release readiness claims.

## Acceptance

- [ ] No reachable placeholder-only PASS path remains in the selected `GATE_SCOPE`.
- [ ] `make integration` executes real assertions.
- [ ] `make certify` executes real assertions.
- [ ] Evidence files are emitted under `evidence/release-gates/`.
- [ ] `make lint` passes.
- [ ] `make test` passes.
- [ ] Release-stage behavior is documented for `alpha`, `beta`, `rc`, and `production`.

## Worked example

See [`_examples/p33.md`](./_examples/p33.md).

## Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json`. If any axis is below 8, do not claim the release gates are production-ready.
