# BTX Capacity Planning — v0.1.0 Baseline

> P-15 deliverable. Updated whenever SLO targets or throughput requirements change.
> Annex C §C.1 reference document.

| Field | Value |
|---|---|
| Version | v0.1.0 |
| Date | 2026-05-17 |
| Owner | @sre-lead |
| Next Review | v0.2.0 or when peak load changes > 50% |

---

## 1. Traffic Assumptions (Phase 1 — India Launch)

| Metric | Assumption | Basis |
|---|---|---|
| Registered data principals | 500 | Phase 1 pilot partners |
| Active citizens (daily) | 100,000 | BRD §1 (pilot estimate) |
| Consent grants / day | 50,000 | 50% of active citizens grant ≥1 consent/day |
| Consent queries / day | 500,000 | ~10 queries per active grant per day |
| Consent revocations / day | 5,000 | 10% of grants revoked same day |
| Federation sync events / day | 25,000 | ~5 peer nodes × 5,000 revocations |
| Peak multiplier | 5× daily average | BRD §31 (peak load factor) |

### Peak TPS estimates

| Operation | Daily | Peak TPS (5×/86400s) |
|---|---|---|
| Consent grant | 50,000 | **~3 TPS** |
| Consent query | 500,000 | **~29 TPS** |
| Consent revoke | 5,000 | **~0.3 TPS** |
| Federation sync | 25,000 | **~1.5 TPS** |
| Audit append (in-TX) | 55,000 | **~3.2 TPS** (co-incident with grant+revoke) |

---

## 2. ADR-0020 Latency Budgets vs Current Baselines

| Operation | ADR Target | ADR Budget | k6 p99 (local) | Gap | Action |
|---|---|---|---|---|---|
| Policy decision | 5ms | 15ms | <5ms (stub) | ✅ | None — measure on real cloud |
| Consent allow/deny | 30ms | 80ms | <50ms (local stack) | ✅ | Validate on staging |
| Audit append | 20ms | 60ms | In-TX with consent | ✅ | Separate metric in v0.2.0 |
| Cross-node revoke | 500ms | 1500ms | <500ms (same machine) | ✅ | Validate with real peer nodes |
| Registry lookup | N/A | 30ms | <10ms (local) | ✅ | None |

---

## 3. Resource Sizing (per service, single pod)

### control-plane (consent-service)
| Resource | Current Config | Recommended Prod | Notes |
|---|---|---|---|
| CPU | 0.25 vCPU (request) / 1 vCPU (limit) | 0.5 vCPU / 2 vCPU | Headroom for OPA eval |
| Memory | 128Mi / 512Mi | 256Mi / 1Gi | KafkaJS producer + pg pool |
| Replicas | 1 (local) | 3 (prod) | Active-active; no sticky sessions |
| DB connections (per pod) | PgBouncer pool 10 | 10 per pod × 3 = 30 | PgBouncer max_client_conn = 100 |
| Redis connections | 5 (idempotency) | 5 per pod × 3 = 15 | |

### registry
| Resource | Current | Recommended Prod |
|---|---|---|
| CPU | 0.1 vCPU / 0.5 vCPU | 0.25 vCPU / 1 vCPU |
| Memory | 64Mi / 256Mi | 128Mi / 512Mi |
| Replicas | 1 | 2 |

### trust-node
| Resource | Current | Recommended Prod |
|---|---|---|
| CPU | 0.25 vCPU / 1 vCPU | 0.5 vCPU / 2 vCPU |
| Memory | 128Mi / 512Mi | 256Mi / 1Gi |
| Replicas | 1 | 3 |

---

## 4. Database Sizing

### PostgreSQL 16 (control-plane)
| Table | Rows/year | Row size (est.) | Annual growth |
|---|---|---|---|
| `consents` | 18M | 512 bytes | ~9 GB/year |
| `audit_events` (partitioned) | 110M | 256 bytes | ~28 GB/year |
| `outbox` | Rolling; < 10K active | 256 bytes | Negligible |
| `merkle_roots` | 365/year | 256 bytes | Negligible |

**Partition strategy**: Monthly partitions on `audit_events.created_at`. Archive cold partitions (> 90 days) to object store. Keep 3 months hot.

**Connection pool**: PgBouncer in transaction mode. Max 100 connections to Postgres; pool size per service = 10.

---

## 5. Kafka / Redpanda Sizing

| Metric | Value |
|---|---|
| Topic | `btx.audit.events` |
| Partition count | 6 (allows 6× parallelism) |
| Retention | 10 years (WORM per compliance) |
| Throughput (peak) | ~5 MB/s (3.2 TPS × avg 1.5 KB/event) |
| Broker storage (10y × 28 GB/year) | ~280 GB |
| Recommended broker count | 3 (replication factor 3) |

---

## 6. Redis Sizing

| Key space | Count | TTL | Memory est. |
|---|---|---|---|
| Idempotency keys | ~50K active (24h window) | 24h | ~50 MB |
| Rate limit counters | ~500 principals × 2 | 60s | < 1 MB |

Single Redis 7 instance with AOF persistence. Sentinel HA for prod.

---

## 7. Horizontal Scale-Out Trigger Points

| Metric | Scale-out threshold | Action |
|---|---|---|
| `consent_grant_latency p99 > 60ms` (sustained 5 min) | Add 1 pod | HPA trigger |
| `http_req_failed rate > 2%` (sustained 2 min) | Add 1 pod | HPA trigger |
| `pg pool utilisation > 80%` | Increase pool size or add read replica | Manual |
| `outbox_pending > 500` (sustained 10 min) | Add OutboxPublisher replica | HPA trigger |
| `kafka consumer lag > 10K messages` | Add Kafka partition + consumer | Manual |

---

## 8. k6 Perf Regression Test Mapping

| k6 Script | Threshold | ADR Reference | CI Gate |
|---|---|---|---|
| `perf-consent-lifecycle.k6.js` | `consent_grant_latency p99 < 80ms` | ADR-0020 | ✅ Yes |
| `perf-consent-lifecycle.k6.js` | `consent_query_latency p99 < 80ms` | ADR-0020 | ✅ Yes |
| `perf-consent-lifecycle.k6.js` | `error_rate < 5%` | ADR-0020 | ✅ Yes |
| `perf-federation-sync.k6.js` | `federation_sync_latency p99 < 1500ms` | ADR-0020 | ✅ Yes |
| `perf-federation-sync.k6.js` | `federation_state_latency p99 < 80ms` | ADR-0020 | ✅ Yes |

---

## 9. Next Sizing Review Triggers

- Traffic exceeds Phase 1 assumptions by > 50%
- New service added to the mesh
- Cross-border federation enabled (ADR-0025 gate)
- KMS integration switched from stub to real cloud (latency profile changes)
