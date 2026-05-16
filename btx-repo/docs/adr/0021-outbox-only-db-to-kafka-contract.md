# ADR-0021: Outbox Is The Only DB to Kafka Contract

- Status: Accepted
- Date: 2026-05-17
- Deciders: BTX architecture group
- Supersedes: none
- Related: ADR-0020, ADR-0005

## Context

BTX services emit business events and audit events to Kafka. Any dual-write pattern (DB insert plus Kafka publish outside the same transaction boundary) creates loss/reordering risks that break audit integrity and replay behavior.

## Decision

All service-side DB to Kafka publication MUST use a transactional outbox table written in the same database transaction as state changes.

Rules:
- No direct publish from request handlers after DB commit.
- Outbox row and domain/audit write occur in the same SQL transaction.
- Dedicated publisher workers read outbox, publish to Kafka with idempotent producer enabled, then mark dispatched.
- Failures go to DLQ with reason and retry metadata.

## Consequences

Positive:
- Eliminates dual-write inconsistency class.
- Makes retry deterministic and auditable.
- Supports backpressure and replay.

Trade-offs:
- Adds publisher worker complexity.
- Requires outbox table maintenance and pruning.

## Verification

- check-outbox acceptance script must pass.
- Integration tests must prove DB commit implies eventual Kafka publication.
- No service may merge code that publishes Kafka without outbox reference.
