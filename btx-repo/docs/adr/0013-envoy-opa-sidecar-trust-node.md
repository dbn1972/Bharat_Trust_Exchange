# 0013 — Envoy + OPA sidecar as Trust Node enforcement substrate

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Platform, Security
- **Tags:** platform, security

## Context

The Trust Node must enforce mTLS, signing, replay protection, policy and minimisation uniformly across many members and clouds. Building a bespoke proxy at this layer is high-risk.

## Decision

Implement the Trust Node enforcement plane on **Envoy** (proxy) with an **OPA** sidecar (policy). Envoy provides mTLS, ratelimit, ext_authz, observability and Wasm extensibility. OPA evaluates bundles signed via ADR-012. Cryptographic signing uses a separate signer process backed by KMS/HSM. Business adapters connect via Envoy upstream clusters.

## Consequences

**Positive**
- Mature, audited foundations; large community.
- ext_authz cleanly separates policy from transport.
- Same substrate works on every certified cloud.

**Negative / trade-offs**
- Two processes to operate (Envoy + OPA); mitigated by Helm chart and operator.
- Envoy config sprawl risk; mitigated by a generated TN config from signed bundles.

## Alternatives considered

| Option | Why not |
|---|---|
| Custom Go proxy | Reinvent mTLS/ratelimit; long-tail bugs |
| NGINX + Lua | Weaker ext_authz ergonomics; less observable |
| Service mesh data plane only (no TN) | No member-level identity boundary |

## References

- ADR-003, ADR-011, ADR-014
- Arch Doc §4.1
- Annex A §A.5
