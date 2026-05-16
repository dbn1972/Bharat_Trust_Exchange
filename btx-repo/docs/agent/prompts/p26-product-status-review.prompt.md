---
id: P-26
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@product-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: REVIEW_ID,   type: "pattern[PSR-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SCOPE,       type: "enum[control-plane|trust-node|connector|cloud-adapter|design-system|federation|all]", required: true }
  - { name: STAGE_CLAIM, type: "enum[concept|design-complete|prototype|alpha|beta|rc|production]", required: true }
  - { name: EVIDENCE_REFS, type: list, required: true }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "audits/<REVIEW_ID>/status.md" }
  - { kind: file_created, path: "audits/<REVIEW_ID>/inventory.yaml" }
  - { kind: file_created, path: "evidence/audits/<REVIEW_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/architecture/overview.md", "docs/brd/btx-brd.md", "docs/agent/prompts/prompt_graph.yaml"]
  skim: ["services/*/README.md", "docs/adr/*.md", "docs/design/README.md"]
executable_acceptance:
  - { name: inventory-shape, cmd: "tools/audit-inventory-check audits/<REVIEW_ID>/inventory.yaml", pass_when: "every module has status in {built|partial|missing} + evidence_refs[]" }
  - { name: stage-justified, cmd: "tools/audit-stage-check audits/<REVIEW_ID>/status.md --claim <STAGE_CLAIM>", pass_when: "claimed stage is supported by evidence per stage-gate criteria" }
  - { name: no-orphans,      cmd: "tools/audit-orphans audits/<REVIEW_ID>/inventory.yaml", pass_when: "every BRD requirement maps to ≥1 module row; every module maps to ≥1 BRD requirement or ADR" }
  - { name: confidence-set,  cmd: "grep -E 'confidence: (low|medium|high)' audits/<REVIEW_ID>/status.md", pass_when: "match found" }
  - { name: evidence-pack,   cmd: "cosign verify-blob --signature evidence/audits/<REVIEW_ID>.tar.gz.sig evidence/audits/<REVIEW_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "claimed stage > actual evidence — refuse to sign; downgrade and note blockers"
  - "evidence references are stale (> 30 days) for any 'built' row"
  - "any module marked 'built' lacks linked CT or test evidence"
escalation: { to: "@product-lead, @architect", channel: "#btx-audit" }
graph: { upstream: [], downstream: [P-27, P-28, P-29] }
---

# P-26 — Product status review (concept → production-ready)

> First audit in the governance track. Establishes ground truth: **what is fully built, what is partial, what is missing.** No remediation — only honest inventory + stage assessment.

## 0. Read first

- [docs/brd/btx-brd.md](../../brd/btx-brd.md)
- [docs/architecture/overview.md](../../architecture/overview.md)
- [docs/agent/prompts/prompt_graph.yaml](./prompt_graph.yaml)
- All ADRs touching SCOPE

## 1. Inputs

```yaml
REVIEW_ID: PSR-2026-05-16
SCOPE: all
STAGE_CLAIM: beta
EVIDENCE_REFS:
  - "ci/run/4521"            # build logs
  - "ct/run/890"             # conformance tests
  - "audits/SEC-2026-04/"    # last security audit
```

## 2. Plan, then execute

1. **Module discovery.** Walk SCOPE; for every module record name, owner, BRD/FR refs, ADR refs, code paths, CT IDs, test refs.
2. **Per-module triage.** Mark each module `built | partial | missing`. A row is `built` only if (a) code merged to main, (b) ≥1 conformance test green, (c) docs current, (d) ADRs in `accepted` state.
3. **Mismatch list.** Spec vs implementation: documented but not implemented, implemented but undocumented, BRD requirements with no module.
4. **Stage assessment.** Apply gate criteria below; compare against `STAGE_CLAIM`; produce one of {below-claim | matches-claim | exceeds-claim} with rationale.
5. **Risk ranking.** Top 10 gaps ordered by user/citizen impact and trust impact.
6. **Confidence + assumptions.** Note any assumption used and your confidence (low/medium/high).
7. **Evidence pack.** Sign `evidence/audits/<REVIEW_ID>.tar.gz`.

### Stage-gate criteria (apply strictly)

| Stage | Required evidence |
|---|---|
| concept | BRD + first ADR set |
| design-complete | Architecture + design system + DPIA-lite + threat-model-lite |
| prototype | Bootstrapped service + one happy path + UI wireframes |
| alpha | All core APIs + audit chain + policy bundle + ≥60% CT pass |
| beta | Federation across ≥2 Trust Nodes + ≥2 connectors + ≥90% CT pass + perf budget set + runbook drilled |
| rc | All P-08 CTs green + P-15 perf within budget + P-30 security findings ≤ High closed + P-32 integration tests green |
| production | rc evidence + P-11 chaos drill green + P-13 IR drill green + signed release per P-12 |

## 3. Hard rules

- **No optimism.** A row is `partial` until it meets every `built` criterion.
- **Stage downgrades are mandatory.** If evidence does not support `STAGE_CLAIM`, downgrade and name blockers.
- **No screenshots-only evidence.** Each `built` row must reference code, tests, and docs.
- **Confidence is per-row.** Aggregate confidence is the min of row confidences.

## 4. Acceptance

- [ ] `tools/audit-inventory-check` exit 0.
- [ ] `tools/audit-stage-check` exit 0 (claim supported, or downgrade recorded).
- [ ] `tools/audit-orphans` exit 0.
- [ ] Confidence + assumptions recorded.
- [ ] Top-10 gaps listed with severity + owner.
- [ ] Evidence pack signed and verifies.
- [ ] CODEOWNERS approvals: `@product-lead`, `@architect`.

## 5. Worked example

See [`_examples/p26.md`](./_examples/p26.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the review if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
