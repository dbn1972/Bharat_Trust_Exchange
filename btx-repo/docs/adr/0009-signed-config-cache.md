# 0009 — Signed config cache (continuity during control-plane outage)

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, SRE, Security
- **Tags:** resilience, security

## Context

A central PDP / control plane is a tempting design but creates a single point of failure for every exchange. We need outage continuity without compromising trust.

## Decision

Trust Nodes cache the most recent **signed** configuration bundle (members, services, policies, certs, revocations). During control-plane degradation:

- Pre-approved exchanges continue using the cached bundle until its TTL.
- New approvals pause (queued or denied with `BTX-AVAIL-002`).
- Emergency revocation channel (separate NATS topic + delta bundle) remains consumable.

Bundle integrity is enforced by TUF-style signing (ADR-012). TNs refuse expired or unsigned bundles.

## Consequences

**Positive**
- Bounded outage continuity; no silent trust degradation.
- Emergency revocation remains effective during partial outages.

**Negative / trade-offs**
- TTL tuning is a security/availability trade-off (default 30 min, configurable).
- Authors must reason about cache invalidation explicitly.

**Operational impact**
- CT-011 outage drill; Annex B §B.7 publish/rollback; B.10 DR.

## Alternatives considered

| Option | Why not |
|---|---|
| Always-online PDP only | Outage = total stop |
| Permanent local cache without expiry | Stale trust risk |
| Distributed consensus PDP | Heavier; doesn't solve emergency revoke alone |

## References

- BRD §22 (ADR-009), FR-019, CT-011, CT-012
- Arch Doc §4.4, §14
- Annex B §B.6, §B.7
