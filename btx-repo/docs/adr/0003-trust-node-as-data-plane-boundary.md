# 0003 — Trust Node as data-plane boundary

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture Review Board, Security
- **Tags:** architecture, security

## Context

We need a per-member enforcement point that authenticates members, signs/verifies exchanges, enforces policy, applies minimisation and emits audit — without requiring every department to own physical infrastructure.

## Decision

Each BTX member (department, state, tenant) is fronted by a **Trust Node** — a containerised runtime composed of an ingress/egress proxy (Envoy), an OPA sidecar, a signer (KMS/HSM), a replay cache, and per-system adapter modules. The Trust Node is the only sanctioned ingress/egress path for BTX exchanges.

## Consequences

**Positive**
- Uniform enforcement (mTLS, signing, timestamping, replay, policy, minimisation, audit).
- Per-member identity boundary; blast radius is one TN.
- Managed-tenant and dedicated patterns supported with the same runtime.

**Negative / trade-offs**
- Additional hop in the request path (≤ 25 ms target budget in Annex A §A.1.1).
- TN operability (cert rotation, bundle pull, replay cache) becomes critical.

**Operational impact**
- Annex B §B.4 onboarding, §B.5 cert rotation, §B.7 bundle publishing all assume the TN.

## Alternatives considered

| Option | Why not |
|---|---|
| Central API gateway only | No per-member identity; centralisation drift |
| Per-service sidecars only (no TN) | No member-level identity; harder governance |
| Member-managed bespoke gateways | Non-uniform enforcement; conformance impossible |

## References

- BRD §22 (ADR-003), §9.3 runtime flow, FR-016..020
- Arch Doc §4.1, §11.2
- Annex A §A.5 wire contract
