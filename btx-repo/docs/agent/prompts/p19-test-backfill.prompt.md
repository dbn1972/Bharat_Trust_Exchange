---
id: P-19
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@qa-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SERVICE, type: kebab-case, required: true }
  - { name: CURRENT_COV, type: percent, required: true }
  - { name: GAPS, type: list, required: true }
  - { name: TARGET_COV, type: percent, required: false, default: 80 }
forbidden_paths: ["services/<SERVICE>/internal/domain/**"]   # no behaviour changes
expected_outputs:
  - { kind: pr, title_pattern: "[<SERVICE>] test backfill" }
context_budget:
  read_in_full: ["services/<SERVICE>/README.md", "docs/test-strategy.md", "BTX_Architecture_Annex_A_Engineering.md"]
executable_acceptance:
  - { name: coverage, cmd: "make test SVC=<SERVICE> && tools/cov-gate <TARGET_COV>", pass_when: "exit 0" }
  - { name: mutation, cmd: "tools/mutate SVC=<SERVICE>", pass_when: "score >= 60 on critical packages" }
  - { name: negative-coverage, cmd: "tools/error-code-coverage SVC=<SERVICE>", pass_when: "100% of BTX error codes covered" }
  - { name: e2e-green, cmd: "make e2e SVC=<SERVICE>", pass_when: "exit 0" }
halt_conditions:
  - "behaviour change (semantics modified) snuck into the PR"
  - "test mocks the system under test"
  - "new flaky tests introduced"
escalation: { to: "@qa-lead", channel: "#btx-qa" }
graph: { upstream: [], downstream: [P-12] }
---

# P-19 — Backfill missing tests for a service

> Use when a service has coverage gaps, weak negative tests, missing contract or policy tests, or no perf guardrails.

---

You are Claude Code adding tests to an existing service. Improve confidence without changing behaviour.

## 0. Read first

- [`docs/test-strategy.md`](../../test-strategy.md)
- The service's `README.md` (tech spec) and current test suites
- Annex A §A.6 (Rego tests), §A.7 (audit), §A.5 (errors)

## 1. Inputs

| Input | Value |
|---|---|
| Service | `<<SERVICE>>` |
| Current coverage | `<<COV%>>` |
| Known gaps | `<<GAPS>>` |
| Target coverage | ≥ 80% (≥ 90% for policy/crypto/audit) |

## 2. Execute

1. **Inventory**
   - Coverage report by file.
   - Mutation testing report (e.g., Stryker / go mutate) on critical packages.
   - Contract test inventory vs OpenAPI/AsyncAPI.
   - Negative-test inventory vs BTX error code table (Annex A §A.5.4).
2. **Prioritise** by risk: policy decisions, signing, audit emission, error paths, BOLA-prone endpoints.
3. **Write tests**
   - Unit: one per uncovered branch in the priority packages.
   - Negative: one per BTX error code the service can return.
   - Integration: hermetic, testcontainers; assert audit event lands and metrics increment.
   - Contract: drive from OpenAPI examples; lint with `spectral`; diff with `oasdiff`.
   - Property / fuzz where applicable (parsers, validators).
   - Perf: add k6 thresholds if missing.
4. **Refactor for testability** only minimal, behaviour-preserving (extract a function, inject a Clock, expose a port). No semantics change in this PR.
5. **Quarantine cleanup** remove or fix any `t.Skip` / `@Disabled` with expired tickets.
6. **Update spec** mark the test mapping in `README.md`.

## 3. Hard rules

- No behaviour changes. If a test surfaces a bug, open a separate PR via the right prompt.
- No tests that mock the system under test.
- No assertions that only check "no exception". Assert the observable outcome.
- No flakes — quarantine policy applies.

## 4. Acceptance

- [ ] Coverage targets met.
- [ ] Negative tests cover every BTX error code the service emits.
- [ ] Contract tests pass and gate CI.
- [ ] Integration tests assert audit + metrics.
- [ ] Mutation score improves (target ≥ 60% on critical packages).
- [ ] No new behaviour; existing E2E green.
- [ ] CODEOWNERS approvals: `@qa-lead` + service owner.

## 5. Worked example

See [`_examples/p19.md`](./_examples/p19.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
