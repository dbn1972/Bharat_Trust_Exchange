# 0020 — BTX hot-path stack v1 (Next.js / Fastify / Kafka / Postgres / Redis / Cloud KMS)

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** @chief-architect, @platform-lead, @security-lead, @product-lead
- **Tags:** architecture | platform | performance

## Context

BTX is a federated trust fabric whose hot paths are: consent issue/revoke, policy decision, audit append, cross-Trust-Node sync, registry read. Earlier ADRs (0011 OPA/Rego, 0013 Envoy+OPA sidecar, 0014 SPIFFE/SPIRE, 0015 Kafka *or* NATS) describe a sophisticated multi-runtime architecture. While defensible on paper, that surface area exceeds the operating team's current expertise and would slow delivery, increase incident MTTR, and raise the bar for partner Trust Nodes operated by state CIOs.

Forces:

- The product must ship beta within one calendar quarter.
- The on-call rotation today has strong skills in Node/TS, Postgres, Kafka, REST/JSON, and one cloud (AWS) plus moderate Azure/GCP.
- Partner Trust Nodes will be operated by mixed-skill state IT teams — every additional runtime is a real adoption cost.
- "Fastest exchange" is bounded by tail latency on consent and policy decisions, not by raw decision speed of any one component.

## Decision

The v1 BTX stack is locked to the following components. Any deviation requires a superseding ADR.

| Layer | Component | Notes |
|---|---|---|
| Web / admin / citizen UI | **Next.js 14+ (App Router, Node runtime)** | RSC + Server Actions; minimal client JS on citizen surfaces |
| API services (control-plane, trust-node, connectors, cloud-adapter, audit, registry) | **Fastify on Node 20 LTS, TypeScript** | Single language across services |
| Inter-service & public API style | **REST + JSON over HTTPS/2 (TLS, mTLS inside the mesh)** | OpenAPI 3.1 generated from JSON Schema |
| Request/response contracts | **JSON Schema** (Fastify-validated, OpenAPI-published, contract-tested with Schemathesis) | Single source of truth |
| Eventing / audit fan-out / cross-Trust-Node sync | **Apache Kafka** | Outbox pattern, idempotent producers, DLQ per consumer, `acks=all`, `min.insync.replicas=2` |
| Primary database | **PostgreSQL 16** | Partitioned audit table; BRIN+B-tree indexes; logical replication for cross-region |
| DB connection pooling | **PgBouncer in transaction mode** | Per-pod small Fastify pool → PgBouncer → Postgres |
| Cache / rate-limit / idempotency-key store | **Redis** (cloud-managed) | Single-flight cache fill; mandatory for hot reads |
| Crypto / signing / mTLS root | **Cloud KMS** (AWS KMS / GCP KMS / Azure Key Vault) via P-07 adapter | Envelope encryption; DEKs cached ≤ 5 min |
| Edge | **Cloud ALB / Nginx** | TLS termination, HTTP/2, rate limiting |
| Observability | **OpenTelemetry → Prometheus + Grafana + Loki** | `@fastify/otel`; trace-id propagated through Kafka headers |

### Policy & audit specifically

- **Policy** is implemented as a Fastify plugin (`@btx/policy`) that evaluates rules expressed as JSON. The rule bundle is signed by Cloud KMS and distributed via the object store. *We do not deploy OPA / Rego in v1.* This narrows ADR-0011.
- **Audit** is an append-only Postgres table (`audit_events`) with `INSERT`-only grants and monthly partitions. Each commit also writes an outbox row published to Kafka `audit.appended`. A daily job computes a per-partition Merkle root and signs it via Cloud KMS. *We do not introduce a separate audit datastore in v1.* This narrows ADR-0005.
- **Service identity** is short-lived mTLS certs minted by a Cloud-KMS-rooted internal CA (issued via the cloud adapter). *We do not deploy SPIFFE/SPIRE in v1.* This narrows ADR-0014.
- **Service mesh / sidecar** is not used in v1. Fastify services call each other directly over mTLS. This narrows ADR-0013.

### Non-negotiable disciplines on this stack

1. **Outbox pattern** for every Kafka publish that must be exactly-once with a DB write.
2. **Idempotency-Key** header on every state-changing REST endpoint; key stored in Redis 24 h.
3. **Single-flight** cache fill on every hot Redis key.
4. **PgBouncer transaction mode** — parameterised queries only; no `SET LOCAL`, no advisory locks spanning statements.
5. **JSON Schema everywhere** — Fastify validates request *and* response.
6. **Cloud KMS only via the P-07 adapter** — no direct AWS/GCP SDK calls in business code.
7. **OpenTelemetry on every entry point** (HTTP + Kafka consumer) with trace propagation.

### Latency budgets (v1 SLOs)

| Hot path | p95 | p99 |
|---|---|---|
| Policy decision (in-proc JS rules) | 5 ms | 15 ms |
| Consent allow / deny REST API | 30 ms | 80 ms |
| Audit append (DB tx + outbox row) | 20 ms | 60 ms |
| Cross-Trust-Node consent revoke propagation | 500 ms | 1 500 ms |
| Registry / policy read (cache hit) | 10 ms | 30 ms |
| Operator UI TTFB | 200 ms | 500 ms |

These are machine-checkable in [P-15](../agent/prompts/p15-perf-capacity.prompt.md) and enforced by [P-31](../agent/prompts/p31-scalability-audit.prompt.md).

## Consequences

- **Positive:** one language across services; one event bus; one DB; one secrets/keys mechanism; team can ship and operate from day 1; partner Trust Nodes inherit the same simplicity.
- **Negative / trade-offs:**
  - Node + JSON has a higher tail-latency floor than Rust + gRPC. We compensate with caching, prepared statements, and worker-threads for crypto.
  - Policy decisions in JS won't match OPA-WASM speed; budget is 5 ms p95, not 1 ms.
  - No PQ crypto, no BBS+/selective disclosure, no HTTP/3 in v1.
- **Operational impact:** runbooks updated to a single-stack footprint; chaos drills (P-11) target Kafka, Postgres, Redis, KMS failures only.
- **Revisit triggers:**
  - Sustained p95 budget breach on any hot path for two weeks.
  - Need to support a Trust Node operator who cannot run Node services.
  - Regulatory mandate for PQ crypto on the hot path.
  - More than 8 Fastify services or > 1 000 RPS sustained — re-evaluate sidecars / mesh.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| Rust + Go polyglot + OPA-WASM + NATS + Scylla (the "fastest possible" stack) | Best tail latency; PQ-ready | New runtimes; doubles the on-call surface; partner-node adoption tax | Out of scope for v1 team skills |
| Spring Boot / Java | Mature ecosystem | Slower delivery for this team; JVM footprint on partner nodes | Not a current team strength |
| Node + Express | Familiar | Slower than Fastify; weaker JSON-Schema integration | Fastify is a direct upgrade |
| Kafka **or** NATS (ADR-0015) | Choice | Two ops models; partner-node confusion | Lock to Kafka |
| OPA / Rego (ADR-0011) | Industry standard PDP | New language for the team; another runtime | Defer until policy complexity demands it |

## References

- BRD §13, §17, §22, §25
- Architecture Document §4, §8, §9, §11, §13, §16
- Prior ADRs narrowed by this decision: 0005 (audit), 0011 (OPA/Rego), 0013 (Envoy+OPA sidecar), 0014 (SPIFFE/SPIRE), 0015 (Kafka or NATS)
- P-01 bootstrap-service, P-05 build-connector, P-07 cloud-adapter, P-15 perf-capacity, P-31 scalability-audit

## Review notes

- Re-review by **2026-11-16** or sooner if any revisit trigger fires.
