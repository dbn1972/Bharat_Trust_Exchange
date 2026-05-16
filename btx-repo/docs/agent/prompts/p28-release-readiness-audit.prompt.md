---
id: P-28
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@release-manager"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: REVIEW_ID,     type: "pattern[RRA-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: TARGET_STAGE,  type: "enum[internal-demo|external-demo|alpha|beta|rc|production]", required: true }
  - { name: RELEASE_TAG,   type: "pattern[v\\d+\\.\\d+\\.\\d+(-\\w+)?]", required: true }
  - { name: UPSTREAM_AUDITS, type: list, required: true }   # P-26/P-27/P-29/P-30/P-31/P-32 IDs
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "audits/<REVIEW_ID>/readiness.md" }
  - { kind: file_created, path: "audits/<REVIEW_ID>/scorecard.yaml" }
  - { kind: file_created, path: "evidence/audits/<REVIEW_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/runbooks/release.md", "docs/agent/prompts/p12-release-engineering.prompt.md"]
  skim: ["audits/*/", "ci/last/"]
executable_acceptance:
  - { name: scorecard-shape, cmd: "tools/scorecard-check audits/<REVIEW_ID>/scorecard.yaml", pass_when: "10 axes scored 1..10 with rationale + evidence_refs[]" }
  - { name: gate-criteria,   cmd: "tools/release-gate audits/<REVIEW_ID>/scorecard.yaml --stage <TARGET_STAGE>", pass_when: "all blocking axes ≥ stage threshold" }
  - { name: blockers-listed, cmd: "tools/blockers-check audits/<REVIEW_ID>/readiness.md", pass_when: "every must-fix has owner + ETA + linked PR/issue" }
  - { name: upstream-fresh,  cmd: "tools/audit-freshness audits/<REVIEW_ID>/readiness.md", pass_when: "every upstream audit referenced is ≤ 14 days old" }
  - { name: ir-runbook-drilled, cmd: "tools/drill-check docs/runbooks/release.md", pass_when: "last release rollback drill ≤ 30 days for rc/production" }
  - { name: evidence-pack,   cmd: "cosign verify-blob --signature evidence/audits/<REVIEW_ID>.tar.gz.sig evidence/audits/<REVIEW_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "any Critical drift from P-27 unremediated"
  - "any High or Critical security finding from P-30 unremediated for rc/production"
  - "P-31 perf budget breached for rc/production"
  - "P-15 SLO budget exhausted in last 30 days for production"
  - "no signed P-11 chaos drill in last 30 days for production"
  - "no signed P-13 incident-response drill in last 90 days for production"
escalation: { to: "@release-manager, @architect, @security-lead", channel: "#btx-release" }
graph: { upstream: [P-26, P-27, P-30, P-31, P-32], downstream: [P-12] }
---

# P-28 — Release readiness audit (pre-P-12 gate)

> Decides whether <RELEASE_TAG> is safe to ship at <TARGET_STAGE>. Produces a 10-axis scorecard + go/no-go verdict. Feeds [P-12 release engineering](./p12-release-engineering.prompt.md).

## 0. Read first

- [P-12 release engineering](./p12-release-engineering.prompt.md)
- [docs/runbooks/release.md](../../runbooks/release.md)
- The upstream audits listed in `UPSTREAM_AUDITS`

## 1. Inputs

```yaml
REVIEW_ID: RRA-2026-05-16
TARGET_STAGE: beta
RELEASE_TAG: v0.7.0-beta.3
UPSTREAM_AUDITS:
  - PSR-2026-05-16     # P-26 status
  - CLV-2026-05-16     # P-27 cross-layer
  - SEC-2026-05-10     # P-30 security
  - SCL-2026-05-11     # P-31 scalability
  - INT-2026-05-12     # P-32 integration
  - TRC-2026-05-13     # P-29 traceability
```

## 2. Plan, then execute (the 10-axis scorecard)

Score each axis 1..10 with rationale + evidence:

| # | Axis | Source signals |
|---|---|---|
| 1 | Product completeness | P-26 inventory + BRD coverage |
| 2 | Contract alignment | P-27 drift register (no Critical open) |
| 3 | Build trustworthiness | CI green; reproducible; signed artefacts (P-12) |
| 4 | Test trustworthiness | P-19 + P-08 CT pass rate per stage gate |
| 5 | Security posture | P-30 findings: no Critical; High count |
| 6 | Privacy posture | DPIA current; P-09 minimisation honoured; consent flows tested |
| 7 | Scalability fitness | P-31 cache/queue/SLO budgets within target |
| 8 | Operational readiness | Runbooks current; P-11 drill ≤ 30 d; P-13 IR drill ≤ 90 d |
| 9 | Documentation accuracy | P-27 docs-vs-reality drift = 0 high+ |
| 10 | Federation/integration | P-32 cross-Trust-Node + cross-cloud integration tests green |

### Stage thresholds (every blocking axis must meet)

| Stage | Min per blocking axis | Hard gates |
|---|---|---|
| internal-demo | ≥ 5 | none |
| external-demo | ≥ 6 | no Critical privacy/security finding |
| alpha | ≥ 6 | axes 5 + 6 ≥ 7 |
| beta | ≥ 7 | axes 2 + 5 + 6 + 8 ≥ 8; P-11 drill signed |
| rc | ≥ 8 | all upstream audits ≤ 14 d; no Critical anywhere; P-31 within budget |
| production | ≥ 8 (axes 5,6,8 ≥ 9) | P-11 ≤ 30 d, P-13 ≤ 90 d, P-15 SLO budget healthy |

## 3. Hard rules

- **No "go with conditions" for production.** Either all gates pass, or it does not ship.
- **No stage upgrade against P-26 stage assessment.** If P-26 says we are at alpha, P-28 cannot certify rc.
- **Citizen surface regressions are hard blockers** — P-25 Critical findings on citizen surfaces block any stage above internal-demo.
- **Every must-fix item must have owner + ETA + linked PR or issue.** No vague TODOs.

## 4. Acceptance

- [ ] `tools/scorecard-check` exit 0.
- [ ] `tools/release-gate` exit 0 for `TARGET_STAGE`.
- [ ] `tools/blockers-check` exit 0.
- [ ] `tools/audit-freshness` exit 0.
- [ ] `tools/drill-check` exit 0 (rc/production only).
- [ ] Verdict: `go | go-with-fixes | no-go` recorded with rationale.
- [ ] Evidence pack signed and verifies.
- [ ] CODEOWNERS: `@release-manager`, `@architect`, `@security-lead`.

## 5. Worked example

See [`_examples/p28.md`](./_examples/p28.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not certify release if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
