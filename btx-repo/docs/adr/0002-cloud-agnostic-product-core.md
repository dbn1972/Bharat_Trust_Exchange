# 0002 — Cloud-agnostic product core

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture Review Board, Procurement
- **Tags:** architecture, platform, procurement

## Context

Different states, ministries and ecosystems will host on NIC/MeghRaj, state cloud, AWS, Azure, GCP, private/on-prem. A single-cloud architecture would block adoption and create lock-in (BRD §1.1, §5.3, R02).

## Decision

The BTX product core is cloud-agnostic by construction. The core runtime runs on Kubernetes/OpenShift or equivalent certified container platform. All cloud-specific concerns (IAM, KMS/HSM, network, DNS, LB, storage, logging, backup, DR) live behind adapter interfaces in `services/*/internal/adapter/` and `infrastructure/<cloud>/` modules.

## Consequences

**Positive**
- Portability evidence becomes a deliverable (CT-001, CT-025).
- Procurement neutrality and exit architecture become defensible (BRD §21).
- Cross-cloud DR feasible.

**Negative / trade-offs**
- Slower to leverage proprietary managed features; we choose the lowest common denominator behind adapters with opt-in escape hatches.
- Adapter test matrix grows linearly with certified clouds.

**Operational impact**
- Conformance pack must run on every certified cloud (Annex C §C.3.3).
- IaC modules per cloud (`infrastructure/<cloud>/`).

## Alternatives considered

| Option | Why not |
|---|---|
| Single mandated cloud | Blocks state adoption; lock-in |
| "Best of breed" managed services per cloud | Lock-in in business logic; ADR-008 closes this |
| Pure on-prem | Limits elasticity and cost optimisation |

## References

- BRD §22 (ADR-002), §25 (cloud blueprints), R02
- Arch Doc §12, NFR-006..010
- Annex C §C.8 (exit playbook)
