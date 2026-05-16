# 0010 — Conformance before production

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security, QA
- **Tags:** governance, quality

## Context

Production onboarding without testable evidence is the most common cause of post-launch incidents in similar platforms.

## Decision

No member, service, cloud or runtime moves to production without a passing **conformance evidence pack** for CT-001..025 (BRD §26, Annex C §C.3.3). The pack is signed (cosign) and archived in `evidence/<env>/<release>/`.

## Consequences

**Positive**
- Predictable production quality bar.
- Reviewers see evidence, not assertions.
- Regressions surface in CI before production.

**Negative / trade-offs**
- Slower path to production initially; mitigated by automation.
- Test infrastructure investment up front.

**Operational impact**
- Quarterly drill calendar (Annex B §B.16).
- Conformance manifest signing service.

## Alternatives considered

| Option | Why not |
|---|---|
| Self-attestation by members | No evidence; trust theatre |
| Pen-test only | Misses functional/policy regressions |

## References

- BRD §22 (ADR-010), §26, §30.3
- Arch Doc §21
- Annex C §C.3, §C.12
