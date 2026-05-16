# 0014 — SPIFFE/SPIRE workload identity inside clusters

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security, Platform
- **Tags:** identity, security

## Context

We need short-lived, automatic workload identity for services within and across BTX clusters. Long-lived service-account tokens and shared certs are unsafe and unportable.

## Decision

Adopt **SPIFFE/SPIRE** for workload identity. Workload SVIDs (X.509) are issued by an in-cluster SPIRE server, with ≤ 24 h TTL. Trust Node identity uses X.509 SAN `spiffe://btx/<member>/<node>`. Federation between clusters uses SPIRE federation with explicit trust domain mappings.

## Consequences

**Positive**
- Identity is portable; not tied to a cloud IAM provider.
- Short TTL reduces credential-theft impact.
- Mesh-level mTLS integrates naturally.

**Negative / trade-offs**
- SPIRE operational learning; mitigated by Helm + runbooks.
- Federation setup needs care; documented in Annex B §B.4.

## Alternatives considered

| Option | Why not |
|---|---|
| Static X.509 with long TTLs | Cred theft risk; rotation burden |
| Cloud IAM workload identity only | Lock-in (ADR-002) |
| Vault-issued certs only | Weaker attestation than SPIRE node + workload attestors |

## References

- ADR-002, ADR-003, ADR-013
- Arch Doc §7
- Annex A §A.8
