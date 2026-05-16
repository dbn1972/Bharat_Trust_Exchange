# 0008 — Certified cloud adapters

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Platform, Procurement
- **Tags:** platform, portability, procurement

## Context

Cloud neutrality (ADR-002) is meaningless without testable evidence. Theoretical portability via "we use Kubernetes" is a frequent failure pattern when proprietary services creep into business logic.

## Decision

Every cloud-specific concern is implemented behind a defined adapter interface (`IamAdapter`, `KmsAdapter`, `HsmAdapter`, `ObjectStoreAdapter`, `DnsAdapter`, `LoadBalancerAdapter`, `LogAdapter`, `BackupAdapter`, `SecretAdapter`). Each adapter implementation is certified by running the conformance suite (CT-001..025), with a signed evidence pack per cloud.

## Consequences

**Positive**
- Portability is demonstrable, not promised.
- Exit playbook (Annex C §C.8) becomes executable.
- Procurement guardrails are enforceable.

**Negative / trade-offs**
- Adapter test matrix scales with certified clouds.
- Some advanced cloud features remain opt-in only.

## Alternatives considered

| Option | Why not |
|---|---|
| Direct cloud SDK in services | Lock-in; ADR-002 violation |
| Service mesh-only abstraction | Insufficient for KMS/HSM/IAM semantics |

## References

- BRD §22 (ADR-008), §25
- Arch Doc §12
- Annex C §C.3.3, §C.8
