# 0015 — Kafka (or NATS JetStream) for audit pipeline

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Platform, Audit
- **Tags:** platform, audit

## Context

AuditLedger needs durable, ordered, partitioned ingest at national scale, with cross-region mirroring for DR, and consumers for hash chain, indexing, reconciliation and SIEM export.

## Decision

Use **Apache Kafka** as the primary audit pipeline. Allow **NATS JetStream** as a certified alternative for smaller deployments. Partition `btx.audit.v1` by `provider_member_id` hash. Replicate cross-region for DR. Hash-chain digester runs as a consumer; periodic anchor signatures via KMS + RFC 3161.

## Consequences

**Positive**
- Mature ecosystem (MirrorMaker2, Cruise Control, SchemaRegistry-style tooling).
- Per-partition ordering matches the per-member hash chain.
- NATS option keeps small deployments lean.

**Negative / trade-offs**
- Operational complexity at scale; mitigated by Annex B §B.8.
- Two supported brokers means two adapter paths; mitigated by AsyncAPI-driven producer abstraction.

## Alternatives considered

| Option | Why not |
|---|---|
| Cloud-proprietary queue (SQS, EventHubs, Pub/Sub) | Lock-in (ADR-002, ADR-008) |
| Direct DB writes for audit | No backpressure; coupled |
| RabbitMQ | Weaker partition ordering at scale |

## References

- ADR-005, ADR-008
- Arch Doc §9
- Annex A §A.7, Annex B §B.8
