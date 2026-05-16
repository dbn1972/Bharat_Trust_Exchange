---
id: P-22
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@design-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SURFACE, type: "enum[citizen-wallet|operator-console|member-portal|public-portal|consent-ui|auditor-dashboard]", required: true }
  - { name: JOB, type: sentence, required: true }
  - { name: USERS, type: list, required: true }
  - { name: CONSTRAINTS, type: list, required: true }
  - { name: DPIA_REF, type: filepath, required: false }
forbidden_paths: ["usability/recordings/**", "usability/raw/**"]
expected_outputs:
  - { kind: file_created, path: "docs/design/surfaces/<SURFACE>/<feature>/journey.md" }
  - { kind: file_created, path: "docs/design/surfaces/<SURFACE>/<feature>/wireframes.md" }
  - { kind: file_created, path: "docs/design/surfaces/<SURFACE>/<feature>/ia.md" }
  - { kind: file_created, path: "docs/design/surfaces/<SURFACE>/<feature>/research-brief.md" }
context_budget:
  read_in_full: ["docs/design/ux-principles.md", "docs/design/content-style-guide.md", "<DPIA_REF>"]
  skim: ["docs/design/design-system.md", "BRD §<feature>"]
executable_acceptance:
  - { name: journey-validate, cmd: "tools/journey-validate docs/design/surfaces/<SURFACE>/<feature>/journey.md", pass_when: "every step has actor + intent + system response + failure path" }
  - { name: ia-coverage, cmd: "tools/ia-coverage docs/design/surfaces/<SURFACE>/<feature>/", pass_when: "every job-to-be-done has a screen; every screen reachable in <= 3 steps from surface entry" }
  - { name: consent-moment-check, cmd: "tools/consent-moment-check docs/design/surfaces/<SURFACE>/<feature>/", pass_when: "PII share => explicit consent moment present with purpose/fields/retention/revoke" }
  - { name: research-brief, cmd: "tools/research-brief-validate docs/design/surfaces/<SURFACE>/<feature>/research-brief.md", pass_when: "hypothesis falsifiable; segments defined; safeguards present" }
halt_conditions:
  - "any PII share without an explicit consent moment in the journey"
  - "any destructive action without confirm + reason + audit hook in the journey"
  - "any operator action without keyboard path in the wireframes"
  - "design proposes a token that doesn't exist (open P-21 first)"
escalation: { to: "@design-lead, @privacy-lead", channel: "#btx-design" }
graph: { upstream: [P-09], downstream: [P-23, P-25] }
---

# P-22 — UX research → journey & wireframes (Figma)

> Use to take a job-to-be-done and turn it into a researched, defensible journey + information architecture + low-fidelity wireframes. Output is text + diagrams + a Figma frame index — *not* pixels.

---

## 0. Read first

- [docs/design/ux-principles.md](../../design/ux-principles.md)
- [docs/design/content-style-guide.md](../../design/content-style-guide.md)
- DPIA / threat model if PII is involved
- BRD section for the feature

## 1. Inputs

```yaml
SURFACE: <…>
JOB: "<plain-language job, e.g. 'Citizen grants minimised consent for income verification'>"
USERS: [<segments, each with constraints>]
CONSTRAINTS: ["low-end Android", "Hindi-first", "no real PII in research", "<5s on 3G"]
DPIA_REF: dpia/<…>.md       # if PII involved
```

## 2. Plan, then execute

1. **Research brief** — write a falsifiable hypothesis per segment; declare safeguards (no real PII; consent; recordings opt-in).
2. **Journey map** — Mermaid `sequenceDiagram` of actor↔system; one step per row; every step has intent + system response + failure path. Mark **consent moments** explicitly.
3. **Information architecture** — list of screens, their entry/exit, and the path matrix. Every job step has a screen. Every screen reachable ≤ 3 steps from surface entry.
4. **Wireframes** — Markdown sketches (ASCII or Mermaid) with annotations referencing existing components by name. Do *not* invent components — if missing, open P-21.
5. **Figma index** — list the Figma frames the designer will produce; provide names matching IA.

## 3. Hard rules

- **No PII share without an explicit consent moment** in the journey (P-09 / DPIA-aligned).
- **Safe-default** path is always the keyboard default and the larger affordance.
- **Operator / auditor flows are keyboard-complete** — list shortcuts in the IA.
- **Reading level**: ≤ 7 for citizen surfaces, ≤ 10 for member.
- **No new tokens or components invented here** — refer only to active ones. Missing? Open P-21 first.
- **Recordings / raw research data** never enter this PR — store under `usability/` with retention rules per P-25.

## 4. Acceptance

- [ ] `tools/journey-validate` exit 0.
- [ ] `tools/ia-coverage` exit 0.
- [ ] `tools/consent-moment-check` exit 0 (or N/A documented).
- [ ] `tools/research-brief-validate` exit 0.
- [ ] Every operator action has a keyboard path.
- [ ] Figma frame index matches IA names exactly.
- [ ] Linked DPIA / threat model (if PII).
- [ ] CODEOWNERS approvals: `@design-lead`; `@privacy-lead` if PII.

## 5. Worked example

See [`_examples/p22.md`](./_examples/p22.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
