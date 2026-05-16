# ADR-0023: Stubs-First Local Dev, LocalStack Optional

- Status: Accepted
- Date: 2026-05-17
- Deciders: BTX architecture group
- Related: ADR-0020, ADR-0008

## Context

Team velocity depends on deterministic local development without cloud account dependencies. Adapter contracts must be testable locally while keeping cloud parity paths available for certification jobs.

## Decision

Development workflow is stubs-first:

- Default local stack uses kms-stub + MinIO + Redis + Postgres/PgBouncer + Redpanda.
- LocalStack is optional and only activated via compose overlay for AWS adapter hardening.
- Production cloud SDK paths remain adapter-only and may be non-implemented until cloud certification.
- No service domain logic may depend on LocalStack-specific behavior.

## Consequences

Positive:
- Fast onboarding and reliable local CI.
- Decouples product development from cloud tenancy concerns.

Trade-offs:
- Stub parity drift risk if not continuously verified.
- Requires explicit cloud conformance suites.

## Verification

- docker-compose.yml must boot default stack without LocalStack.
- docker-compose.localstack.yml must be optional overlay.
- CT cloud jobs validate AWS/GCP/Azure adapter implementations before release.
