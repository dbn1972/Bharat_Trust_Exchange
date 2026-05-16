# 0012 — TUF-style signing for config bundles

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security
- **Tags:** security, supply-chain

## Context

Trust Nodes pull configuration (members, services, policies, certs, revocations) from a central publisher. The distribution channel is a high-value target; an attacker controlling it could approve themselves and disable revocation.

## Decision

Use **TUF-style** (The Update Framework) signing for the Signed Config Publisher:

- Role separation: `root`, `targets`, `snapshot`, `timestamp`.
- HSM-backed signing for `root` and `targets`.
- Short-lived `timestamp` signatures to bound rollback windows.
- Trust Nodes verify the full role chain before applying any bundle.

## Consequences

**Positive**
- Resilience against publisher compromise (no single key compromises the chain).
- Bounded rollback / mix-and-match attacks.
- Auditable role rotations.

**Negative / trade-offs**
- More complex than naive `cosign`; mitigated by reusable tooling.
- Operational discipline required (HSM ceremonies — Annex B §B.3).

## Alternatives considered

| Option | Why not |
|---|---|
| Single-key `cosign` signing | Single point of compromise |
| In-band signed JSON | No role separation; rollback risk |
| Sigstore Fulcio with OIDC issuance | Excellent but online-only chain of trust; we want offline root |

## References

- ADR-009
- Arch Doc §4.4
- Annex A §A.11 (bundle layout), Annex B §B.3 (ceremony), §B.6 (revocation)
