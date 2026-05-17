# AR-001 — Scalability Fitness Audit

| Field | Value |
|---|---|
| Audit ID | AR-001 |
| Document | scalability.md |
| Date | 2026-05-17 |
| Auditor | @agent (autonomous) |
| Related | [violations.yaml](./violations.yaml) |
| Baseline | [docs/capacity/sizing-v0.1.0.md](../../docs/capacity/sizing-v0.1.0.md) |

---

## 1. Target SLOs (from ADR-0020 + capacity plan)

| Metric | Target |
|---|---|
| Consent grant p99 latency | < 80ms |
| Consent grant p95 latency | < 60ms |
| Federation sync p99 latency | < 1500ms |
| Error rate | < 5% under 3× peak |
| Throughput (peak) | 3 TPS consent grant |
| Scale-out trigger | CPU > 60% for 2m |
| Data volume (day 1) | 50K grants/day, 100K DAU |

---

## 2. Fitness Checks

### SC-01 — Stateless Services ✅

All three services are stateless HTTP servers. State lives in:
- PostgreSQL (primary persistence)
- Redis (idempotency keys — TTL-based, auto-evicting)
- Kafka outbox (consumed and deleted by OutboxPublisher)

Horizontal scaling: add pods without coordination. ✅

---

### SC-02 — Database Connection Management ✅

PgBouncer in transaction mode is declared in the capacity plan. Each Fastify server connects to PgBouncer, not directly to Postgres. Max connections per pod bounded by PgBouncer pool size (50). At 3 pods per service = 150 max DB connections well within Postgres connection limit of 200. ✅

**Potential concern**: `OutboxPublisher` opens a long-running connection. If pod count scales to 10+, total connections may approach limit. Mitigation: OutboxPublisher should be a singleton (1 instance per service deployment, not per pod). Not enforced in code. Logged as SV-01.

---

### SC-03 — Partitioned Audit Table ✅

`audit_events` table is partitioned monthly (`PARTITION BY RANGE (created_at)`). Hot partition (current month) bounded in size; old partitions can be archived independently. ✅

---

### SC-04 — Redis Idempotency Key TTL ✅

Idempotency keys use `EX 3600` (1-hour TTL). Key space bounded. Under 3 TPS = 10800 keys/hour — negligible for Redis. ✅

**Gap**: Redis not behind an interface (G-04). If Redis is unavailable, the current code path is unknown (unclear if it fails-open or fails-closed). Logged as SV-02.

---

### SC-05 — Kafka Outbox Back-Pressure

**Finding**: `OutboxPublisher.start()` polls the outbox table every N seconds. The polling interval is hardcoded (or defaulted). Under sustained high throughput, outbox rows may accumulate faster than the publisher drains them.

**Severity**: 🟡 Medium

**Recommendation**: Implement exponential back-off with configurable batch size. Set a Prometheus alert when outbox lag > 1000 rows. Logged as SV-03.

---

### SC-06 — Single-Node Kafka Partition

**Finding**: The capacity plan does not specify Kafka partition count. Default (1 partition per topic) limits Kafka throughput to ~50K messages/second per partition (well above v0.1.0 needs). However, at 1 partition, consumer parallelism is limited to 1 consumer group member per partition.

**Severity**: 🟢 Low for v0.1.0

**Recommendation**: Define partition count > 1 before reaching 10K grants/day to allow parallel consumption. Logged as SV-04.

---

### SC-07 — HPA Trigger

**Finding**: The capacity plan specifies `cpu > 60%` as the HPA trigger. For I/O-bound services (which consent API is), CPU is a poor proxy for load. External queue depth or request rate is a better signal.

**Severity**: 🟡 Medium

**Recommendation**: Add KEDA-based HPA scaling on Kafka consumer lag and/or Prometheus request rate as secondary triggers alongside CPU. Logged as SV-05.

---

### SC-08 — Cascading Revocation Fan-Out

**Finding**: When a consent is revoked, the system publishes one outbox event. Downstream consumers (identified in DPIA) must react to this event to enforce revocation. The fan-out cardinality depends on the number of downstream consumers. If a single consent has been shared to 100 dependent services, each must receive the revocation event.

**Analysis**: At v0.1.0 scale (50K grants/day, each grant to 1–3 principals), fan-out is bounded. At v1.0 scale (millions of grants), revocation could trigger millions of messages.

**Severity**: 🟢 Low for v0.1.0, 🔴 High for v1.0

**Recommendation**: Design a revocation fan-out budget limit (e.g., max 1000 downstream events per revocation) before v1.0. Document in CHANGELOG known issues section.

---

## 3. Fitness Summary

| Check | Verdict | Violations |
|---|---|---|
| SC-01 Stateless services | ✅ Pass | — |
| SC-02 DB connection management | 🟡 Conditional | SV-01 |
| SC-03 Partitioned audit table | ✅ Pass | — |
| SC-04 Redis TTL bounded | 🟡 Conditional | SV-02 |
| SC-05 Outbox back-pressure | 🟡 Medium risk | SV-03 |
| SC-06 Kafka partition count | 🟢 Low risk | SV-04 |
| SC-07 HPA trigger | 🟡 Medium risk | SV-05 |
| SC-08 Revocation fan-out | 🟢 Low for v0.1.0 | SV-06 (future) |

**v0.1.0 scalability verdict: FIT for target load (100K DAU, 3 TPS peak).** Violations SV-01..SV-05 are improvements recommended before v1.0 scale-out.
