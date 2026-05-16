---
id: P-15
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@platform-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SLO, type: text, required: true }
  - { name: SURFACE, type: text, required: true }
  - { name: BASELINE, type: "object{p95_ms,rps}", required: true }
  - { name: HYPOTHESIS, type: sentence, required: true }
forbidden_paths: ["policy/btx/**", "services/**/internal/audit/**"]
expected_outputs:
  - { kind: pr, title_pattern: "[perf/<SURFACE>] <change>" }
  - { kind: files_modified, glob: "tests/perf/**" }
context_budget:
  read_in_full: ["BTX_Architecture_Annex_A_Engineering.md", "BTX_Architecture_Annex_C_Evidence.md", "docs/test-strategy.md"]
executable_acceptance:
  - { name: perf-bench, cmd: "k6 run --thresholds tests/perf/<SURFACE>.thresholds.json tests/perf/<SURFACE>.js", pass_when: "all thresholds green; p95 improvement >= 10%" }
  - { name: regression-guard, cmd: "tools/perf-diff baseline.json result.json", pass_when: "no regression > 10% p95 or > 5% throughput" }
  - { name: conformance, cmd: "make certify", pass_when: "exit 0" }
halt_conditions:
  - "hidden functional change in a perf PR"
  - "weakened security/audit/policy control to gain speed (without ADR)"
  - "PDP decisions cached beyond obligation TTL"
escalation: { to: "@platform-lead", channel: "#btx-perf" }
graph: { upstream: [], downstream: [P-12] }
---

# P-15 — Performance & capacity tuning

> Use to hit or restore SLO targets, or to plan capacity for new load.

---

You are Claude Code tuning BTX performance. Use the budgets and formulas already in the design — do not invent.

## 0. Read first

- Architecture Doc §13 (Performance) and the perf budgets
- [ADR-0020](../../adr/0020-btx-hot-path-stack-v1.md) §Latency budgets (v1 SLOs) — the table below
- Annex A §A.1.1 (latency budget per hop)
- Annex C §C.1 (capacity formulas), §C.4 (cost model)
- [`docs/test-strategy.md`](../../test-strategy.md) §Performance

### v1 latency budgets (machine-checkable thresholds per ADR-0020)

| Hot path | p95 | p99 | Tested by |
|---|---|---|---|
| Policy decision (in-proc JS rules) | 5 ms | 15 ms | `tests/perf/policy.js` |
| Consent allow / deny REST API | 30 ms | 80 ms | `tests/perf/consent.js` |
| Audit append (DB tx + outbox row) | 20 ms | 60 ms | `tests/perf/audit.js` |
| Cross-Trust-Node consent revoke propagation | 500 ms | 1 500 ms | `tests/perf/cross-node.js` |
| Registry / policy read (Redis hit) | 10 ms | 30 ms | `tests/perf/registry.js` |
| Operator UI TTFB (Next.js RSC) | 200 ms | 500 ms | `tests/perf/ui.js` |

k6 threshold files under `tests/perf/*.thresholds.json` must encode these as hard gates. CI fails on any breach.

## 1. Inputs

| Input | Value |
|---|---|
| Target SLO(s) | `<<SLO>>` (e.g., p95 ≤ 350 ms end-to-end) |
| Surface | service / TN hop / DB / Kafka |
| Current measurements | baseline numbers + dashboards |
| Suspected bottleneck | hypothesis (CPU, locks, GC, IO, network, policy eval) |
| Constraints | budget, dependencies, no-functional-change requirement |

## 2. Execute

1. **Measure** capture a clean baseline with `tests/perf/` (k6) and traces. Identify the top spans/CPU/IO.
2. **Hypothesise** state the bottleneck and the smallest change you expect to move it.
3. **Change** apply one change at a time. Keep the diff narrow.
4. **Re-measure** confirm improvement; revert if no improvement.
5. **Iterate** at most three changes per PR.
6. **Capacity plan** if scale changes, update Annex C §C.1 numbers and add a sizing note in the service tech spec.
7. **Guardrails** add a perf regression test (k6 thresholds) that fails CI if p95 / throughput regress beyond budget.
8. **Trace explorer** ensure the dashboard reflects the new behaviour (latency histogram bucket adjustments if needed).

## 3. Hard rules

- No functional changes hidden in a perf PR.
- No removal of security / audit / policy controls to "make it faster". If a control is the bottleneck, ADR.
- No caching of PDP decisions beyond the obligation TTL.
- No reducing audit completeness for throughput.

## 4. Acceptance

- [ ] Baseline → improved numbers documented in PR.
- [ ] Perf regression test added/updated; CI threshold guards.
- [ ] No control regressed; conformance still green.
- [ ] Capacity / cost updates reflected in Annex C if applicable.
- [ ] CODEOWNERS approvals: `@platform-lead`.

## 5. Worked example

See [`_examples/p15.md`](./_examples/p15.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
