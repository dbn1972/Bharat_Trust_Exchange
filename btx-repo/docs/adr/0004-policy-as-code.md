# 0004 — Policy-as-code

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security, Privacy
- **Tags:** policy, security, governance

## Context

Governance rules — who can request what, for which purpose, with what minimisation — must be machine-enforced uniformly. Encoding them in scattered application code makes them invisible to reviewers and untestable.

## Decision

All authorisation, purpose-binding and minimisation rules are expressed as **policy-as-code** in `policy/btx/` (Rego). The PurposeGuard PDP evaluates these policies. Application code MUST NOT contain authorisation logic.

## Consequences

**Positive**
- Versioned, testable, reviewable policies (CODEOWNERS = security + privacy).
- Centrally measurable: which policy version decided which transaction.
- Rapid rollback by republishing prior signed bundle.

**Negative / trade-offs**
- Policy authors need Rego fluency; mitigated by templates and a domain DSL layer.
- One more runtime dependency at every TN; mitigated by local OPA cache.

**Operational impact**
- Annex B §B.7 publish/rollback runbook.
- ADR-011 selects Rego as the language.

## Alternatives considered

| Option | Why not |
|---|---|
| Hardcoded authorisation in Go/Java | Invisible, untestable, brittle |
| XACML | Heavier, less ergonomic; supported only via adapter |
| Database-backed RBAC | No expressiveness for ABAC / purpose / minimisation |

## References

- BRD §22 (ADR-004), FR-011..015, §27.1/§27.2
- Arch Doc §8
- Annex A §A.6 worked Rego + tests
