---
id: P-04
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@security-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: INTENT, type: "list[allow|deny|minimise|escalate]", required: true }
  - { name: WHEN, type: text, required: true }
  - { name: OBLIGATIONS, type: list, required: false }
  - { name: FR_IDS, type: list, required: true }
  - { name: CT_IDS, type: list, required: true }
forbidden_paths: ["policy/btx/testdata/fixtures-frozen/**"]
expected_outputs:
  - { kind: pr, title_pattern: "[policy] <slug>" }
  - { kind: files_modified, glob: "policy/btx/**" }
context_budget:
  read_in_full: ["docs/agent/skills/add-rego-policy.md", "policy/btx/decisions.rego", "BTX_Architecture_Annex_A_Engineering.md"]
  skim: ["docs/adr/0011-opa-rego-as-pdp-language.md"]
executable_acceptance:
  - { name: fmt, cmd: "opa fmt --list policy/", pass_when: "no diffs" }
  - { name: regal, cmd: "regal lint policy/", pass_when: "exit 0" }
  - { name: opa-test, cmd: "opa test policy/ -c -v", pass_when: "100% pass, cov >= 80%" }
  - { name: opa-build, cmd: "opa build -b policy/ -o /tmp/bundle.tar.gz", pass_when: "exit 0" }
  - { name: ct-policy, cmd: "make certify CT=CT-007,CT-013,CT-017", pass_when: "exit 0" }
halt_conditions:
  - "weakens or removes an existing deny without an accepted ADR"
  - "adds a wildcard allow (e.g. `allow { true }`)"
  - "changes obligations without a Shaper test update"
escalation: { to: "@security-lead, @privacy-lead", channel: "#btx-policy" }
graph: { upstream: [P-09], downstream: [P-08, P-12] }
---

# P-04 — Author or change a Rego policy in PurposeGuard

> Use for any change under `policy/btx/`. Policy is a contract; treat it with the same rigour as production code.

---

You are Claude Code working on BTX PurposeGuard policies. **Policy is the law of the platform.** Do not change semantics without a privacy/security review and explicit test evidence.

## 0. Read first

- [`docs/agent/skills/add-rego-policy.md`](../skills/add-rego-policy.md)
- Architecture Doc §8 (Policy), §6 (Security)
- Annex A §A.6 (worked Rego + tests), §A.6.1 (DecisionRequest schema)
- ADR-004, ADR-011

## 1. Inputs

| Input | Value |
|---|---|
| Intent | allow / deny / minimise / escalate (or a combination) |
| Trigger | `<<WHEN>>` (service IDs, members, purposes, attributes) |
| Inputs available in DecisionRequest | confirm completeness; if missing, propose schema extension |
| Obligations to attach | shape (`yes_no_assertion` / `masked` / `signed_claim` / `selective_disclosure`), TTL, audit tags |
| BRD requirement | `<<FR_IDS>>` |
| Conformance tests touched | CT-007 (purpose), CT-013 (minimisation), CT-017 (BOLA), as applicable |

## 2. Execute

1. **Locate the file**: `decisions.rego` (top-level combinator), `bola.rego` (object-level), or a new `policy/btx/<domain>.rego`.
2. **Write the rule** using the conventions in Annex A §A.6:
   - `package btx.<domain>`
   - `import future.keywords`
   - Express violations as `deny[msg] { … }` (or `contains` style) and the final consolidation rule sets `decision := …` with `obligations`.
3. **Fixtures**: extend (do not rewrite) `policy/btx/testdata/` with the minimum members, services, purposes, grants needed.
4. **Tests**: in `policy/btx/<name>_test.rego` add:
   - `test_allow_…` happy paths
   - `test_deny_<violation>_…` one per deny branch
   - `test_obligation_<obligation>_…` one per obligation
5. **Coverage**: `opa test policy/ --coverage` ≥ 80% for the changed file.
6. **Lint**: `opa fmt -w policy/` and `regal lint policy/`.
7. **Bundle build**: `opa build -b policy/` to confirm compile success.
8. **Signing**: do not sign locally; CI signs on merge (TUF roles, ADR-012).
9. **Docs**: update `policy/btx/README.md` (rule catalogue table). Add a line to `CHANGELOG.md` of the policy module.
10. **Roll-out plan**: state in PR description: sandbox canary → 5% → 25% → 100%; rollback = republish previous signed bundle (Annex B §B.7).

## 3. Hard rules

- Do not embed member or service IDs in code paths; drive them from fixtures / config.
- Do not introduce wildcards (`allow { true }`); every allow path must be conditioned.
- Do not weaken an existing deny without an ADR.
- A new obligation requires a Shaper test that proves it is honoured (CT-013).

## 4. Acceptance

- [ ] `opa fmt` and `regal lint` clean.
- [ ] All tests pass; coverage ≥ 80% for the changed file.
- [ ] Negative test for every deny branch and obligation.
- [ ] Bundle compiles via `opa build`.
- [ ] No fixture deletion; only additive changes.
- [ ] CT-007 / CT-013 / CT-017 still pass (and extended if applicable).
- [ ] `policy/btx/README.md` and `CHANGELOG.md` updated.
- [ ] PR includes roll-out + rollback plan and references the BRD/FR.
- [ ] CODEOWNERS approvals: `@security-lead` and `@privacy-lead`.

## 5. Worked example

See [`_examples/p04.md`](./_examples/p04.md).

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
