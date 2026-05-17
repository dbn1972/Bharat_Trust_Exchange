---
id: P-34
version: 1.0.0
last_reviewed: 2026-05-17
owner: "@qa-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: TEST_SCOPE, type: "enum[phase7|phase9|federation|all]", required: true }
  - { name: STACK_MODE, type: "enum[docker-compose|testcontainers]", required: true }
  - { name: AUTH_MODE, type: "enum[api-key|dev-open]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[e2e] production-grade integration harness for <TEST_SCOPE>" }
  - { kind: files_modified, glob: "tests/**/*.ts" }
  - { kind: files_modified, glob: "services/**/tests/**/*.ts" }
  - { kind: evidence, path: "evidence/e2e/**" }
context_budget:
  read_in_full: ["docs/agent/prompts/p32-deep-integration-test.prompt.md", "tests/phase7-integration.test.ts", "tests/phase9-e2e-integration.test.ts"]
  skim: ["services/**/src/server.ts", "docker-compose.yml", "scripts/*.sh", "tests/**"]
executable_acceptance:
  - { name: phase7, cmd: "pnpm vitest run tests/phase7-integration.test.ts", pass_when: "real end-to-end assertions pass" }
  - { name: phase9, cmd: "pnpm vitest run tests/phase9-e2e-integration.test.ts", pass_when: "real end-to-end assertions pass" }
  - { name: no-mocha-deps, cmd: "grep -RIn \"from 'mocha'\\|from 'chai'\" tests services --include='*.test.ts' && test $? -ne 0", pass_when: "exit_code == 0" }
  - { name: no-placeholder-assertions, cmd: "grep -RIn \"Placeholder for\\|expect(true)\" tests services --include='*.test.ts' && test $? -ne 0", pass_when: "exit_code == 0" }
  - { name: evidence, cmd: "find evidence/e2e -type f | wc -l", pass_when: ">= 3 evidence files created" }
halt_conditions:
  - "test harness cannot authenticate against protected endpoints"
  - "tests require compiled .js artifacts in src/ directories to run"
  - "critical path still uses expect(true) or skip-only logic after two iterations"
escalation: { to: "@qa-lead, @architect", channel: "#btx-qa" }
graph: { upstream: [P-19, P-32], downstream: [P-28] }
---

# P-34 — Build a production-grade end-to-end integration harness

## Read first

- [P-32 deep integration test design](./p32-deep-integration-test.prompt.md)
- `tests/phase7-integration.test.ts`
- `tests/phase9-e2e-integration.test.ts`
- `services/**/tests/**/*.test.ts`
- `docker-compose.yml`

## Inputs

| Name | Meaning |
|---|---|
| `TEST_SCOPE` | Which integration set to finish first |
| `STACK_MODE` | Whether the harness uses docker-compose or testcontainers |
| `AUTH_MODE` | How tests authenticate against protected APIs |

## Execute

1. Convert the current phase 7 and phase 9 tests into one consistent runner stack based on Vitest.
2. Remove Mocha/Chai-only tests that are currently outside the normal quality gates or migrate them fully.
3. Replace every placeholder assertion (`expect(true)`, structural DB version check, skip-on-health-only scaffolding) with real setup, actions, and outcomes.
4. Start the full BTX stack hermetically in test setup, including registry, control-plane, trust-node, queue, Redis, DB, and object store.
5. Add authenticated end-to-end flows for:
   - trust node registration
   - consent grant/query/revoke
   - audit retrieval
   - federation sync
   - idempotency behavior
   - broker provider switching (Redpanda/Apache Kafka)
6. Capture machine-readable evidence under `evidence/e2e/`.
7. Make the tests runnable in CI without relying on stale compiled `.js` artifacts.

## Hard rules

- No `expect(true)` placeholders.
- No tests that only check service health and call that “integration”.
- No dependence on `.js` files under `src/`.
- Use real BTX APIs and real containers where feasible.
- Authentication and authorization paths must be exercised, not bypassed silently.

## Acceptance

- [ ] `tests/phase7-integration.test.ts` passes with real assertions.
- [ ] `tests/phase9-e2e-integration.test.ts` passes with real assertions.
- [ ] No remaining Mocha/Chai dependency in test paths that represent release evidence.
- [ ] No remaining placeholder assertions in targeted test files.
- [ ] Evidence emitted under `evidence/e2e/`.
- [ ] CI path documented and runnable.

## Worked example

See [`_examples/p34.md`](./_examples/p34.md).

## Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json`. Do not open the PR if the test evidence axis is below 8.
