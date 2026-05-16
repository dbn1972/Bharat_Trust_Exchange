# Bharat Trust Exchange (BTX)

Federated trust fabric scaffold using locked stack from ADR-0020.

## Local stack

- Postgres 16 + PgBouncer (transaction mode)
- Redpanda (Kafka API)
- Redis 7
- MinIO
- KMS stub

## Quickstart

1. make up
2. make lint
3. make test

## Notes

- Cloud SDK integrations are adapter-only and remain not-implemented until cloud certification.
- Policy decisions fail closed when bundle/signature verification fails.
- Audit writes must use outbox in the same DB transaction.
