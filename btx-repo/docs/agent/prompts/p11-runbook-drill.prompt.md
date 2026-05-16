---
id: P-11
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@sre-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: NAME, type: kebab-case, required: true }
  - { name: TRIGGER, type: text, required: true }
  - { name: SEVERITY, type: "enum[SEV-1|SEV-2|SEV-3|routine]", required: true }
  - { name: OWNER, type: handle, required: true }
  - { name: GD_ID, type: "pattern[GD-\\d{2}]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[runbook] <NAME>" }
  - { kind: files_created, glob: "docs/runbooks/**/<NAME>.md" }
  - { kind: files_created, glob: "tests/chaos/<GD_ID>/**" }
context_budget:
  read_in_full: ["docs/templates/runbook-template.md", "BTX_Architecture_Annex_B_Runbooks.md"]
executable_acceptance:
  - { name: template-conformance, cmd: "tools/runbook-validate docs/runbooks/**/<NAME>.md", pass_when: "all sections present, destructive steps flagged" }
  - { name: chaos-runs, cmd: "make chaos GD=<GD_ID>", pass_when: "scenario runs to completion in staging" }
  - { name: alert-link, cmd: "tools/runbook-alert-check docs/runbooks/**/<NAME>.md", pass_when: "every trigger linked to alert id" }
halt_conditions:
  - "destructive step lacks 4-eye / confirmation"
  - "no rollback path documented"
  - "no drill cadence entered in Annex B §B.16"
escalation: { to: "@sre-lead", channel: "#btx-sre" }
graph: { upstream: [], downstream: [P-13] }
---

# P-11 — Write a runbook (+ chaos drill)

> Use to document a repeatable operational procedure, paired with a chaos scenario that verifies it.

---

You are Claude Code documenting BTX operations. A good runbook is copy-paste-executable, has explicit verification, and is paired with a drill that proves it works.

## 0. Read first

- Annex B (Runbooks) — at least the runbook nearest in spirit to yours
- Annex B §B.15 (GameDay scenarios), §B.16 (drill calendar)
- [`docs/templates/runbook-template.md`](../../templates/runbook-template.md)

## 1. Inputs

| Input | Value |
|---|---|
| Procedure | `<<NAME>>` |
| Trigger / symptoms | `<<TRIGGER>>` |
| Severity | SEV-1 / SEV-2 / SEV-3 / routine |
| Owner | `<<OWNER>>` |
| Related runbooks | `<<RELATED>>` |
| Drill scenario id | `GD-<<NN>>` |

## 2. Execute

1. **Runbook** create `docs/runbooks/<area>/<<NAME>>.md` from the template. Fill every section: when-to-use, prerequisites, pre-flight, numbered steps (mark destructive), verification, rollback, failure modes, comms, evidence, drill cadence.
2. **Chaos scenario** add a scenario to `tests/chaos/GD-<<NN>>/` that injects the failure the runbook responds to. Use a chaos tool already in the stack (LitmusChaos / Chaos Mesh / a custom controller).
3. **Drill calendar** add or confirm an entry in Annex B §B.16.
4. **Telemetry hooks** make sure detection of the trigger is observable (metric or alert); reference the alert ID in the runbook.
5. **Evidence** include a sample evidence bundle template (what to capture during a real incident).
6. **CHANGELOG** add to `docs/runbooks/CHANGELOG.md`.

## 3. Hard rules

- Every destructive step is explicitly marked and requires confirmation/4-eye where applicable.
- Every step has a verification command or check.
- Every runbook has a tested rollback path.
- Every runbook is drilled at least quarterly (unless the architecture forbids reproduction, in which case state why and how to simulate).

## 4. Acceptance

- [ ] Runbook follows the template; all sections present.
- [ ] Steps are copy-paste-runnable; destructive ones flagged.
- [ ] Verification commands present.
- [ ] Rollback path documented.
- [ ] Chaos scenario exists and runs in CI (or staging) on a schedule.
- [ ] Linked to alerts/metrics that surface the trigger.
- [ ] Drill cadence entered in Annex B §B.16.
- [ ] CODEOWNERS approvals: `@sre-lead` + surface owner.

## 5. Worked example

See [`_examples/p11.md`](./_examples/p11.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
