# Runbooks CHANGELOG

All runbook additions, updates, and retirements are logged here.

## Unreleased

## 2026-05-17

### Added
- **RB-001** `docs/runbooks/operations/consent-revocation-cascade.md` — SEV-2 runbook for consent revocation cascade failure. Covers OutboxPublisher restart, manual outbox drain, and peer node verification. Paired with GD-01 chaos scenario.
- **RB-002** `docs/runbooks/operations/outbox-publisher-failure.md` — SEV-2 runbook for OutboxPublisher stall/crash. Covers Kafka broker unreachable, stuck transactions, and manual outbox flush. Paired with GD-02 chaos scenario.
- **GD-01** `tests/chaos/GD-01/run.mjs` — Chaos scenario: kill OutboxPublisher mid-cascade to validate RB-001.
- **GD-02** `tests/chaos/GD-02/run.mjs` — Chaos scenario: isolate Kafka from control-plane to validate RB-002.
