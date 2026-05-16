# 0005 — Audit as a trust product

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Security, Audit
- **Tags:** audit, security

## Context

Searchable logs are necessary but not sufficient. To be a trust fabric, BTX must produce audit that is tamper-evident, reconciled across requester and provider, and queryable by citizens, stewards and oversight bodies.

## Decision

AuditLedger is treated as a first-class product: canonical event schema (`btx.audit.v1`), per-event hash chain, periodic anchor signature via KMS + RFC 3161 timestamping, immutable WORM storage and reconciliation jobs that pair requester/provider events by `txn_id`.

## Consequences

**Positive**
- Tamper attempts are detectable (CT-016).
- Citizen-visible sharing history is derivable safely.
- Investigations have deterministic evidence.

**Negative / trade-offs**
- Storage cost and complexity; mitigated by tiered retention (Annex C §C.1.6).
- Operating immutable WORM disciplines is non-trivial.

**Operational impact**
- Annex B §B.12 audit anomaly runbook.
- CT-015, CT-016 mandatory.

## Alternatives considered

| Option | Why not |
|---|---|
| Plain log aggregation (ELK only) | No tamper evidence, no canonical event |
| Blockchain ledger | Operational overhead, no functional gain over signed hash chain + WORM |
| Provider-only audit | Asymmetric trust; can't reconcile |

## References

- BRD §22 (ADR-005), §14.3, FR-026..030
- Arch Doc §9
- Annex A §A.7, Annex C §C.5.2
