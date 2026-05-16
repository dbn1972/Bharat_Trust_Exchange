---
id: P-17
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@chief-architect"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SPEC_PATH, type: filepath, required: true }
  - { name: VERSION, type: semver, required: true }
  - { name: RELEASE, type: "semver[vX.Y.Z]", required: true }
  - { name: RISK, type: "enum[low|medium|high]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "services/<svc>/PLAN.md" }
  - { kind: pr_series, atomic: true }
context_budget:
  read_in_full: ["<SPEC_PATH>", "docs/agent/golden-paths.md", "docs/agent/anti-patterns.md"]
  skim: ["docs/adr/README.md"]
executable_acceptance:
  - { name: plan-present, cmd: "test -f services/<svc>/PLAN.md", pass_when: "exists with ordered atomic PRs and prompt mapping" }
  - { name: per-pr-acceptance, cmd: "tools/plan-pr-acceptance services/<svc>/PLAN.md", pass_when: "each PR's prompt Acceptance is satisfied" }
  - { name: conformance, cmd: "make certify", pass_when: "exit 0" }
halt_conditions:
  - "any single PR exceeds 1500 LOC / 8 files"
  - "plan deviates from spec without spec update or ADR"
  - "coding started before plan reviewed"
escalation: { to: "@chief-architect", channel: "#btx-arch" }
graph: { upstream: [P-09, P-10], downstream: [P-01, P-02, P-03, P-04, P-05, P-08, P-19, P-12] }
---

# P-17 — Spec → code (turn an approved tech spec into a PR series)

> Use when a tech spec (filled `docs/templates/tech-spec-template.md`) is approved and you want the agent to produce a clean, atomic PR series that implements it.

---

You are Claude Code converting an approved BTX tech spec into code. Plan first, then ship in small, reviewable PRs.

## 0. Read first

- The approved tech spec at `services/<<SERVICE>>/README.md`
- Referenced ADRs and threat model / DPIA
- [`docs/agent/golden-paths.md`](../golden-paths.md) — pick the right path
- [`docs/agent/anti-patterns.md`](../anti-patterns.md)

## 1. Inputs

| Input | Value |
|---|---|
| Spec path | `<<SPEC_PATH>>` |
| Spec version | `<<VERSION>>` |
| Target release | `<<RELEASE>>` |
| Risk class | low / medium / high |

## 2. Execute

1. **Plan** produce a PR plan in `services/<<SERVICE>>/PLAN.md`:
   - Ordered list of PRs (1..N), each atomic and individually merge-safe.
   - Dependencies between PRs.
   - For each PR: which prompt template you will run (P-01 / P-02 / P-03 / …) and the specific section of the spec it satisfies.
2. **Confirm** wait for human/agent review of the plan before opening PRs.
3. **Ship PR-1..PR-N** sequentially:
   - Use the corresponding prompt's Execute + Acceptance.
   - Each PR closes a specific section of the spec; mark it `[done]` in the spec.
   - Update `PLAN.md` checkboxes as PRs merge.
4. **Continuous evidence** after each PR, re-run conformance for the affected CT-IDs.
5. **Close** when all PRs merge and conformance is green, mark the spec `status: active` and update `CHANGELOG.md`.

## 3. Hard rules

- Never collapse multiple PRs into one to "save time". Atomic PRs are reviewable; mega-PRs are not.
- Never start coding before the plan is reviewed.
- Never deviate silently from the spec; deviations require an updated spec or an ADR.

## 4. Acceptance

- [ ] `PLAN.md` exists and lists ordered atomic PRs with prompt mappings.
- [ ] Every PR maps cleanly to one spec section.
- [ ] Every PR satisfies its prompt's Acceptance block.
- [ ] Spec marked `active`; CHANGELOG entry recorded.
- [ ] Conformance green for the involved CTs.

## 5. Worked example

See [`_examples/p17.md`](./_examples/p17.md).

## 6. Self-score

Before opening each PR in the series, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json`. **Refuse to open any PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
