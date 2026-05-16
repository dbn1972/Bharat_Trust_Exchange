---
id: P-16
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@chief-architect"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: PR, type: url, required: true }
  - { name: SCOPE, type: list, required: true }
  - { name: RISK, type: "enum[low|medium|high]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: review_comment, structure: "Summary / Blocking / Non-blocking / Acknowledgements" }
context_budget:
  read_in_full: ["AGENTS.md", "CLAUDE.md", "docs/agent/anti-patterns.md"]
  skim: ["BTX_Architecture_Document.md"]
executable_acceptance:
  - { name: diff-size, cmd: "gh pr diff <PR> | wc -l", pass_when: "<= 1500 LOC or split rationale present" }
  - { name: ci-green, cmd: "gh pr checks <PR>", pass_when: "all required checks pass" }
  - { name: codeowners, cmd: "gh pr view <PR> --json reviews", pass_when: "required CODEOWNERS approvals present" }
halt_conditions:
  - "approving a PR with unresolved blocking finding"
  - "security/privacy/audit regression waved through"
escalation: { to: "@chief-architect", channel: "#btx-arch" }
graph: { upstream: [], downstream: [] }
---

# P-16 — Code review (architecture-conformant)

> Use to review a PR for architectural and security conformance. Output: a structured review comment.

---

You are Claude Code reviewing a PR against the BTX architectural invariants. Be specific, kind, and uncompromising on the non-negotiables.

## 0. Read first

- [`AGENTS.md`](../../../AGENTS.md), [`CLAUDE.md`](../../../CLAUDE.md)
- [`docs/agent/anti-patterns.md`](../anti-patterns.md)
- The relevant tech spec, ADRs, threat model and DPIA.

## 1. Inputs

| Input | Value |
|---|---|
| PR link / branch | `<<PR>>` |
| Scope | files / surfaces touched |
| Risk class | low / medium / high |

## 2. Execute (review checklist)

For every PR, check each of the following. Write findings under the matching heading; if "OK" say so explicitly.

### Architecture
- Hexagonal boundaries respected? No domain logic in transport / cmd / adapter.
- No new cloud SDK leakage? Adapter pattern used?
- Federation invariants intact? Trust Node remains the boundary?

### Security
- AuthN via SPIFFE/mTLS or OIDC; no static tokens.
- AuthZ via PurposeGuard for data-bearing paths; fail-closed on PDP errors.
- No PII / secrets in logs, metrics, traces, error messages.
- Crypto matches Annex A §A.8; no new algorithms without ADR.

### Privacy
- DPIA present and current if personal data flows.
- Minimisation enforced by provider-side Shaper (not by consumer).
- Retention obeyed.

### Audit
- Every state change and data-bearing decision emits a schema-valid event.
- No bodies in events; only IDs and hashes.
- Idempotency keys present.

### API & data
- OpenAPI updated and linted; `oasdiff` shows no unintended breaking change.
- Migrations forward-only, idempotent, reviewed.
- Prepared statements only; no string concatenation.

### Testing
- Unit coverage ≥ 80% (≥ 90% on policy/crypto/audit).
- Negative tests for every error code.
- Integration tests hermetic with testcontainers.
- Contract tests pass; perf regression tests where relevant.

### Operability
- Telemetry added: metric + trace + log.
- Runbook updates if a new failure mode.
- Helm overlays render for all clouds in scope.

### Governance
- CODEOWNERS approvals correct.
- CHANGELOG updated.
- ADR opened if architectural deviation.
- Tech spec updated.

## 3. Output format

Post a single review comment with this structure:

```
Summary: <one sentence>
Blocking findings:
  - [file:line] <issue> — <suggested fix>
Non-blocking suggestions:
  - …
Acknowledgements:
  - <good practice you noticed>
```

## 4. Hard rules

- Never approve a PR with an unresolved blocking finding.
- Never wave through "we'll fix it later" on security / privacy / audit invariants.
- If unsure, request a follow-up ADR before merging.

## 5. Worked example

See [`_examples/p16.md`](./_examples/p16.md) — a sample review comment, wrong-vs-right examples of common findings, and the executable acceptance commands you should run against the PR before approving.

## 6. Self-score

Before posting your review, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json`. **If your `review_readiness` axis < 8, do not approve.** Request changes instead and link the blockers.
