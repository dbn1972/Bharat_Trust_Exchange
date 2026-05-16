# 0001 — Federated exchange over central database

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture Review Board
- **Tags:** architecture, governance

## Context

India's interoperability bottleneck is governed reuse of data that already exists in authoritative source systems. The naive answer — build one central database of citizen records — concentrates risk, breaks departmental accountability, and is incompatible with Centre–State realities and DPDP minimisation. The BRD (§1, §5.3) and the leadership thesis explicitly reject central consolidation.

## Decision

BTX exchanges data via a **federated** model. Each provider department retains the source of truth in its own system. BTX centralises **only**: trust (identity, certificates), standards (schemas, purposes), policy decisions, observability and audit. Federation is enforced at runtime through per-member **Trust Nodes**.

## Consequences

**Positive**
- Source ownership and accountability preserved.
- Concentration risk minimised; blast radius bounded to a member.
- Aligns with DPDP minimisation and lawful-processing duties.
- Compatible with diverse hosting (NIC, state cloud, public cloud).

**Negative / trade-offs**
- More moving parts (one TN per member) → operational overhead; mitigated by managed-tenant TN pattern for small members.
- Cross-member latency higher than a single database lookup; mitigated by service-class SLOs (Annex C §C.1).
- Per-member key/cert hygiene becomes platform-critical (see ADR-014, ADR-017).

**Operational impact**
- New runbooks: member onboarding (B.4), revocation (B.6), bundle distribution (B.7).
- Federation requires emergency-revocation channel (ADR-009).

## Alternatives considered

| Option | Why not |
|---|---|
| Central master database of citizen records | Violates BRD principles; concentration risk; DPDP burden |
| Pure point-to-point integrations (status quo) | Inconsistent purpose, audit, minimisation; non-scalable |
| Data warehouse with replication | Defeats source ownership; duplicate truth |

## References

- BRD §1, §5.3, §22 (ADR-001), §23 (T01, T05)
- Arch Doc §1.1, §3, §11
- Annex C §C.6 (residency)
