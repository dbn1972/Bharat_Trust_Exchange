# ADR-0022: Idempotency-Key Contract

- Status: Accepted
- Date: 2026-05-17
- Deciders: BTX architecture group
- Related: ADR-0020

## Context

Client retries are expected under network failures and timeout races. Without idempotency semantics, duplicate consent grants/revocations and duplicate share requests can occur.

## Decision

Mutating HTTP endpoints MUST implement Idempotency-Key semantics:

- Header: Idempotency-Key (case-insensitive).
- Scope key: method + normalized route + idempotency key value.
- Storage: Redis with TTL 24 hours.
- Behavior:
  - First request executes handler and stores status/headers/body.
  - Replays return stored response and set x-idempotency-replayed: true.
  - Missing Idempotency-Key on mutating endpoints is allowed in v1 but treated as non-idempotent path.

## Consequences

Positive:
- Prevents duplicate side effects from client retries.
- Makes retries safe by contract for clients.

Trade-offs:
- Response payload storage overhead in Redis.
- Replay caches may require size management.

## Verification

- check-idempotency acceptance script must pass.
- Integration tests must prove same key replay returns same response and no duplicate DB mutations.
