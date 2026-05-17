# Portability Migration Report — control-plane

| Field | Value |
|---|---|
| Module | `services/control-plane` |
| Prompt | P-14 |
| Date | 2026-05-17 |
| Author | @sre-lead (agent) |
| Status | **Complete — no remediation required** |

---

## Summary

The `control-plane` service contains zero direct cloud SDK imports. All cloud-specific operations are delegated to adapter interfaces in `pkg/adapter/`. This analysis confirms the portability posture is healthy as of v0.1.0.

---

## SDK Leakage Scan

```
Scan target: services/control-plane/src/**/*.ts
Cloud SDK patterns: @aws-sdk, @google-cloud, @azure, aws-sdk
```

| File | Import | Leakage? | Action |
|---|---|---|---|
| All `.ts` files | (none found) | ✅ Clean | None |

No direct cloud SDK imports were found in the control-plane service.

---

## Adapter Usage Map

| Concern | Interface | Adapter Files | Notes |
|---|---|---|---|
| PostgreSQL (consents, audit, outbox) | `ConsentsRepository`, `AuditRepository`, `OutboxRepository` | `src/adapter/db/repository.ts` | Hexagonal adapter; DB driver injected via pool |
| Kafka (outbox drain) | `OutboxPublisher` | `src/adapter/kafka/outbox-publisher.ts` | Adapter wraps KafkaJS; no vendor leak in domain |
| KMS (DEK, signing) | `KmsAdapter` interface | `pkg/adapter/kms/` (stub/aws/gcp/azure) | Injected via `pkg/bootstrap/cloud-adapters.ts` |
| Object store (audit archival) | `ObjectStoreAdapter` interface | `pkg/adapter/objectstore/` | Injected at startup; not yet wired in v0.1.0 (backlog) |
| Redis (idempotency) | Direct `ioredis` client in server.ts | `src/server.ts:~idempotency` | **Note**: Redis client is direct; wrapped by idempotency middleware. Redis is not a cloud-specific SDK — acceptable per ADR-0020. No action. |

---

## Before / After Diagram

```
BEFORE (hypothetical direct SDK usage):
┌──────────────────────────────┐
│  consent-service domain      │
│  ┌──────────────────────────┐│
│  │ AWS.KMS.generateDataKey()││  ← direct SDK call
│  │ S3.putObject()           ││  ← direct SDK call
│  └──────────────────────────┘│
└──────────────────────────────┘

AFTER (current state — adapter pattern per ADR-0002, ADR-0008):
┌──────────────────────────────┐     ┌────────────────────────────────┐
│  consent-service domain      │     │  pkg/adapter/                  │
│  ┌──────────────────────────┐│     │  ┌──────────────────────────┐  │
│  │ kmsAdapter.generateDek() ││────▶│  │ stub / aws / gcp / azure │  │
│  │ objectStore.put()        ││────▶│  │  per CLOUD_PROVIDER env   │  │
│  └──────────────────────────┘│     │  └──────────────────────────┘  │
└──────────────────────────────┘     └────────────────────────────────┘
         Domain never imports cloud SDK — factory selects at startup
```

---

## Residual Items

| Item | Status | Owner | Target |
|---|---|---|---|
| `ObjectStoreAdapter` not yet wired into `ConsentService` (audit archival) | Backlog | @sre-lead | v0.2.0 |
| Redis idempotency client: wrap in interface for testability (not a portability issue, but improves mockability) | Backlog | @sre-lead | v0.2.0 |

---

## Conformance

- ADR-0002 (cloud-agnostic): ✅ Compliant
- ADR-0008 (certified cloud adapters): ✅ Adapter interfaces implemented for all three clouds
- ADR-0023 (stubs-first): ✅ `CLOUD_PROVIDER=stub` is the default; all tests run against stub
