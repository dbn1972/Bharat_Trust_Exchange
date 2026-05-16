---
id: P-25
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@research-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: STUDY_ID, type: "pattern[U-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SURFACE, type: "enum[citizen-wallet|operator-console|member-portal|public-portal|consent-ui|auditor-dashboard]", required: true }
  - { name: HYPOTHESES, type: list, required: true }
  - { name: SEGMENTS, type: list, required: true }
  - { name: SAFEGUARDS_REVIEWED_BY, type: handle, required: true }
forbidden_paths: ["usability/recordings/**"]   # never inline raw recordings into PR
expected_outputs:
  - { kind: file_created, path: "usability/<STUDY_ID>/plan.md" }
  - { kind: file_created, path: "usability/<STUDY_ID>/script.md" }
  - { kind: file_created, path: "usability/<STUDY_ID>/findings.md" }
  - { kind: file_created, path: "evidence/usability/<STUDY_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/design/usability-test-template.md", "docs/design/ux-principles.md", "docs/design/a11y.md"]
  skim: ["dpia/usability-research.md"]
executable_acceptance:
  - { name: safeguards-signed, cmd: "tools/usability-safeguards-check usability/<STUDY_ID>/plan.md", pass_when: "privacy review signed; no real PII; recordings opt-in; retention <= 90d; right-to-forget documented" }
  - { name: hypotheses-falsifiable, cmd: "tools/hypotheses-check usability/<STUDY_ID>/plan.md", pass_when: "every hypothesis has a measurable target" }
  - { name: pilot-done, cmd: "grep -q 'Pilot:' usability/<STUDY_ID>/plan.md && grep -q 'pilot-completed: true' usability/<STUDY_ID>/plan.md", pass_when: "pilot run + script refinement noted" }
  - { name: findings-severity, cmd: "tools/findings-severity usability/<STUDY_ID>/findings.md", pass_when: "every finding tagged Critical|Major|Minor with owner + linked frame" }
  - { name: remediation-pr, cmd: "tools/findings-remediation usability/<STUDY_ID>/findings.md", pass_when: "every Critical/Major finding has a remediation PR opened within 5 business days" }
  - { name: evidence-pack, cmd: "cosign verify-blob --signature evidence/usability/<STUDY_ID>.tar.gz.sig evidence/usability/<STUDY_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "any real PII used in research environment"
  - "recordings stored without opt-in"
  - "participant compensation withheld for incomplete sessions"
  - "Critical finding (mis-share / consent confusion) on citizen surface — block release until fixed"
escalation: { to: "@research-lead, @privacy-lead, @design-lead", channel: "#btx-research" }
graph: { upstream: [P-22, P-23], downstream: [P-20] }
---

# P-25 — Usability test plan + evidence (with citizen safeguards)

> Use to design, run and evidence a usability study. Output is a signed evidence pack + severity-ranked findings + remediation PRs. **This prompt's first job is to protect participants.**

---

## 0. Read first

- [docs/design/usability-test-template.md](../../design/usability-test-template.md)
- [docs/design/ux-principles.md](../../design/ux-principles.md)
- [docs/design/a11y.md](../../design/a11y.md)
- DPIA for research itself if processing any participant data
- The journey + hi-fi from P-22 / P-23

## 1. Inputs

```yaml
STUDY_ID: U-2026-05-NN
SURFACE: <…>
HYPOTHESES:
  - "≥ 80% of citizens correctly identify what data is shared before pressing Share"
  - "median time-to-revoke ≤ 30 s"
SEGMENTS:
  - { name: "rural Hindi-first", n: 6, recruit: "…" }
  - { name: "citizens with disabilities", n: 3, recruit: "low vision, motor, hearing — 1 each" }
SAFEGUARDS_REVIEWED_BY: "@privacy-lead"
```

## 2. Plan, then execute

1. **Privacy review first.** No recruitment before `@privacy-lead` signs the safeguards section. If processing participant data, update [dpia/usability-research.md](../../../dpia/usability-research.md).
2. **Plan** — copy [usability-test-template.md](../../design/usability-test-template.md) to `usability/<STUDY_ID>/plan.md`; fill hypotheses, segments, safeguards, method, metrics.
3. **Script** — author moderated script in `usability/<STUDY_ID>/script.md` (no deceptive tasks; warm-up; explicit a11y panel if applicable).
4. **Pilot** — run 2 internal pilot sessions; refine script; mark `pilot-completed: true`.
5. **Run** — schedule sessions; obtain signed consent + opt-in for recording; pay compensation regardless of completion; honour stop-at-any-time.
6. **Analyse** — affinity-map, severity-rank (Critical | Major | Minor), link to frames / components / tokens.
7. **Findings** — `usability/<STUDY_ID>/findings.md` with severity + owner + linked frame + remediation plan.
8. **Remediation** — open PRs for every Critical and Major finding within 5 business days; Critical findings on citizen surfaces block the next release.
9. **Evidence pack** — assemble `evidence/usability/<STUDY_ID>.tar.gz` (redacted recordings if opt-in, transcripts, notes, plan, script, findings). Sign with cosign.
10. **Public summary** (citizen-wallet / consent-ui only) — sanitised summary published on the public portal.

## 3. Hard rules

- **No real PII** in the research environment. Synthetic but realistic data only.
- **Informed consent** signed before every session; participant keeps a copy.
- **Recordings**: opt-in only; encrypted; retention ≤ 90 days; deletable on request.
- **No deceptive tasks.** No upsell. No marketing.
- **Compensation** paid regardless of completion. No "complete to get paid" coercion.
- **Right to be forgotten**: any participant can request deletion of their session evidence at any time.
- **Critical findings on citizen / consent surfaces block release** — do not close the study or proceed to P-20 until remediated or risk-accepted by `@privacy-lead`.

## 4. Acceptance

- [ ] `tools/usability-safeguards-check` exit 0.
- [ ] `tools/hypotheses-check` exit 0.
- [ ] Pilot completed; script refined.
- [ ] `tools/findings-severity` exit 0.
- [ ] `tools/findings-remediation` exit 0 (or risk-acceptance recorded for Major / Minor).
- [ ] `evidence/usability/<STUDY_ID>.tar.gz` exists and verifies under cosign.
- [ ] Public summary published (for citizen-wallet / consent-ui).
- [ ] CODEOWNERS approvals: `@research-lead`, `@privacy-lead`, `@design-lead`.

## 5. Worked example

See [`_examples/p25.md`](./_examples/p25.md).

## 6. Self-score

Before closing the study, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the study if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
