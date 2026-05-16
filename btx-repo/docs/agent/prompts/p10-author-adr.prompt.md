---
id: P-10
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@chief-architect"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: TITLE, type: short-title, required: true }
  - { name: PROBLEM, type: paragraph, required: true }
  - { name: DECISION, type: sentence, required: true }
  - { name: ALTERNATIVES, type: "list[{option,why_not}]", required: true, min: 2 }
  - { name: REFS, type: list, required: true }
  - { name: SUPERSEDES, type: adr-id, required: false }
forbidden_paths: ["docs/adr/0000-template.md"]
expected_outputs:
  - { kind: pr, title_pattern: "[ADR] NNNN — <TITLE>" }
  - { kind: files_created, glob: "docs/adr/NNNN-*.md" }
  - { kind: files_modified, glob: "docs/adr/README.md" }
context_budget:
  read_in_full: ["docs/adr/README.md", "docs/adr/0000-template.md"]
  grep_only: ["docs/adr/00*.md"]
executable_acceptance:
  - { name: numbering, cmd: "tools/adr-validate", pass_when: "id sequential and unique" }
  - { name: template-sections, cmd: "tools/adr-validate --sections", pass_when: "all template sections present" }
  - { name: alternatives, cmd: "tools/adr-validate --min-alternatives 2", pass_when: "exit 0" }
  - { name: index-updated, cmd: "grep -q 'NNNN-' docs/adr/README.md", pass_when: "new row present" }
halt_conditions:
  - "editing accepted ADR Decision section (must supersede instead)"
  - "file exceeds ~2 pages / 300 lines"
  - "fewer than 2 alternatives discussed"
escalation: { to: "@chief-architect", channel: "#btx-arch" }
graph: { upstream: [], downstream: [P-01, P-03, P-04, P-05, P-07, P-14, P-18] }
---

# P-10 — Author an Architecture Decision Record (ADR)

> Use whenever you are about to deviate from a documented invariant or make a non-trivial architectural choice. ADRs are immutable once accepted; amend by superseding.

---

You are Claude Code drafting an ADR. The ADR must be concise, decision-first, traceable to the BRD, and reviewable.

## 0. Read first

- [`docs/adr/README.md`](../../adr/README.md) (index)
- [`docs/adr/0000-template.md`](../../adr/0000-template.md) (canonical template)
- Existing ADR-001..017 to ensure you are not duplicating or contradicting an accepted decision.
- BRD §22 (ADR list), §31 (standards)

## 1. Inputs

| Input | Value |
|---|---|
| Working title | `<<TITLE>>` |
| Forces / problem | `<<PROBLEM>>` |
| Proposed decision | `<<DECISION>>` |
| Alternatives | `<<ALTERNATIVES>>` |
| BRD/FR/CT references | `<<REFS>>` |
| Supersedes | `<<ADR_ID>>` (if any) |

## 2. Execute

1. **Pick number** = highest existing ADR + 1.
2. **File** `docs/adr/NNNN-<slug>.md` from the template.
3. **Decision** state in present tense, single paragraph, unambiguous.
4. **Consequences** list positive, negative, operational impact, migration.
5. **Alternatives** table with one-line "why not".
6. **References** BRD sections, Arch Doc sections, Annex pointers, standards, prior ADRs.
7. **Index** add a row to `docs/adr/README.md`.
8. **Supersedes** if applicable: mark the old ADR `superseded by NNNN`; link both directions.
9. **PR** title `[ADR] NNNN — <title>`.

## 3. Hard rules

- Do not edit an accepted ADR's Decision section. Supersede instead.
- Do not write more than ~2 pages. Decisions should be readable in 5 minutes.
- Do not state a decision without listing at least two real alternatives considered.
- Do not omit operational impact; if there is none, say so.

## 4. Acceptance

- [ ] File numbered correctly; index updated.
- [ ] Decision is one clear sentence in present tense.
- [ ] At least two alternatives discussed.
- [ ] Consequences include operational impact and migration.
- [ ] References to BRD / Arch / Annex / standards present.
- [ ] If superseding, both ADRs cross-link.
- [ ] CODEOWNERS approvals: `@chief-architect` + relevant domain lead.

## 5. Worked example

See [`_examples/p10.md`](./_examples/p10.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
