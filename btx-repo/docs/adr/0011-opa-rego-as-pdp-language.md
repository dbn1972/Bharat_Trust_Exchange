# 0011 — OPA + Rego as the PDP language

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security
- **Tags:** policy, security

## Context

Policy-as-code (ADR-004) requires a concrete engine and language. The choice affects authoring ergonomics, performance, ecosystem and cross-cloud portability.

## Decision

Use **Open Policy Agent (OPA)** with **Rego** as the policy language. Distribute as signed bundles. Embed OPA as a sidecar at Trust Nodes for local enforcement, with the central PurposeGuard service as the authoritative PDP for non-cached paths. Provide an XACML-compatible adapter for legacy integration only — XACML is not a first-class language.

## Consequences

**Positive**
- Mature CNCF project; strong tooling (`opa test`, `regal`, conftest, bundle API).
- Sidecar pattern scales horizontally with TNs.
- Rego fits ABAC well; expressive for purpose/minimisation/object-binding (BOLA).

**Negative / trade-offs**
- Rego has a learning curve; mitigated by templates and a domain helper library.
- Bundle growth needs partitioning at scale; addressed in Annex C §C.7.

## Alternatives considered

| Option | Why not |
|---|---|
| Cedar (AWS) | Cloud-proprietary; against ADR-002 |
| XACML | Verbose, weak tooling, low community |
| Custom DSL | Build cost; no ecosystem |

## References

- ADR-004, ADR-013
- Arch Doc §8, §15
- Annex A §A.6
