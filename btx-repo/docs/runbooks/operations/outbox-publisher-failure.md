# Runbook — OutboxPublisher Failure (outbox-publisher-failure)

| Field | Value |
|---|---|
| ID | RB-002 |
| Procedure | `outbox-publisher-failure` |
| Severity | SEV-2 |
| Owner | @sre-lead |
| GameDay ID | GD-02 |
| Alert | `btx_outbox_pending_total > 100` OR `btx_outbox_publisher_up == 0` |
| Related Runbook | [consent-revocation-cascade.md](./consent-revocation-cascade.md) |
| Last Drill | — (schedule: quarterly, see Annex B §B.16) |
| Version | 1.0.0 — 2026-05-17 |

---

## When to Use

Use this runbook when:
- Alert `btx_outbox_publisher_up == 0` fires (OutboxPublisher worker has stopped).
- Alert `btx_outbox_pending_total > 100` fires (backlog growing; audit events not flowing to Kafka).
- `audit_events` are being written to Postgres but NOT appearing in `btx.audit.events` Kafka topic.
- Downstream consumers (compliance dashboards, audit chain verifier) report stale data.

---

## Prerequisites

- `kubectl` access to `btx` namespace.
- `psql` read access to `control-plane-pg`.
- `kafka-cli` or Redpanda Console access.
- 4-eye approval for any `pg_terminate_backend` or forced Kafka produce.

---

## Pre-flight Checks

```bash
# 1. Check if publisher process is alive
kubectl get pod -n btx -l app=outbox-publisher -o wide
kubectl describe pod -n btx -l app=outbox-publisher | tail -20

# 2. Measure outbox backlog
psql $CONTROL_PLANE_DB_URL -c "
  SELECT status, count(*), min(created_at), max(created_at)
  FROM outbox GROUP BY status;
"

# 3. Check Kafka consumer lag
kafka-consumer-groups.sh --bootstrap-server redpanda:9092 \
  --describe --group btx-outbox-publisher

# 4. Confirm audit topic is writable
kafka-topics.sh --bootstrap-server redpanda:9092 \
  --describe --topic btx.audit.events
```

---

## Procedure

### Step 1 — Check publisher logs and crash reason

```bash
kubectl logs -n btx -l app=outbox-publisher --previous --tail=100
kubectl logs -n btx -l app=outbox-publisher --tail=100
```

Common crash reasons:
- `ECONNREFUSED` — Redpanda/Kafka broker unreachable
- `ETIMEDOUT` — Network partition between control-plane and Kafka
- `KafkaJSProtocolError: Broker Not Available` — Leader election in progress
- `OOMKilled` — Memory limit hit; see failure mode table

---

### Step 2 — Restart publisher (if crash is transient)

```bash
kubectl rollout restart -n btx deployment/control-plane-outbox
kubectl rollout status -n btx deployment/control-plane-outbox --timeout=120s

# Confirm draining resumes
kubectl logs -n btx -l app=outbox-publisher -f --tail=20
# Expected: "[outbox] drained N events" log lines
```

Wait 2 minutes. If backlog clears, incident resolved — go to Verification.

---

### Step 3 — Kafka broker unreachable

```bash
# Check Redpanda pod health
kubectl get pod -n btx -l app=redpanda
kubectl logs -n btx -l app=redpanda --tail=50

# Check Redpanda cluster health via admin API
kubectl exec -n btx deploy/redpanda -- rpk cluster health

# If broker is down and cannot be recovered within 30 min, escalate to infra team.
# Meanwhile, the outbox table is safe — it persists events until Kafka is restored.
```

---

### Step 4 — Clear stuck transactions / locks

```bash
# Check for long-running transactions on outbox table
psql $CONTROL_PLANE_DB_URL -c "
  SELECT pid, now() - xact_start AS tx_age, state, wait_event, query
  FROM pg_stat_activity
  WHERE query LIKE '%outbox%' AND state != 'idle'
  ORDER BY tx_age DESC;
"

# If a transaction > 5 min is blocking, terminate it after 4-eye approval
# ⚠️ DESTRUCTIVE — requires 4-eye approval
# psql $CONTROL_PLANE_DB_URL -c "SELECT pg_terminate_backend(<pid>);"
```

---

### Step 5 — Manual outbox flush (last resort)

Only if publisher cannot be restarted and Kafka is healthy.

```bash
# Dry run first — inspect what will be replayed
btx-cli outbox flush --dry-run

# ⚠️ DESTRUCTIVE — requires 4-eye approval
btx-cli outbox flush --limit 1000
```

The `outbox flush` command reads pending rows and produces them directly to Kafka using the idempotency key (outbox row ID). Safe to replay — Kafka deduplicates by key.

---

## Verification

```bash
# Confirm pending count is decreasing
psql $CONTROL_PLANE_DB_URL -c "SELECT count(*) FROM outbox WHERE status = 'pending';"

# Confirm Kafka lag is zero
kafka-consumer-groups.sh --bootstrap-server redpanda:9092 \
  --describe --group btx-outbox-publisher | grep LAG

# Confirm publisher metric is up
kubectl exec -n btx deploy/control-plane -- \
  curl -s localhost:9090/metrics | grep btx_outbox_publisher_up
# Expected: btx_outbox_publisher_up 1
```

---

## Rollback

No rollback is possible for the outbox drain (Kafka publish is append-only). If events were published in error:
1. Do NOT delete from Kafka topic (WORM policy).
2. Add a compensating `outbox.correction` event via `btx-cli outbox correct --event-id <id>`.
3. Notify compliance-lead.

---

## Failure Modes

| Failure | Symptom | Action |
|---|---|---|
| OOMKilled publisher | `OOMKilled` in pod describe | Increase `resources.limits.memory` from 256Mi to 512Mi in Helm; redeploy |
| Kafka leader re-election | `Broker Not Available` in logs | Wait 60s; leader election typically resolves; then restart publisher |
| DB password rotation | `pg_auth` error in logs | Update `control-plane-pg-secret` K8s secret; restart publisher |
| Outbox table bloat | `pending_total` growing; slow queries | Run `btx-cli outbox vacuum`; check auto-vacuum config on table |
| Publisher deadlock with consent writer | Both stalled | Terminate longer-running TX (4-eye); publisher will auto-restart |

---

## Communications Template

**SEV-2 Update (every 60 min)**:
> **[BTX Incident]** OutboxPublisher stalled. Outbox backlog: `N events`. Audit events NOT flowing to Kafka. Status: investigating. Compliance dashboard may show stale data. ETA: `[estimate]`. Escalation: `@sre-lead, @compliance-lead`.

---

## Evidence to Capture

- `kubectl logs -n btx -l app=outbox-publisher --previous`
- Outbox backlog count over time (Grafana screenshot)
- Kafka consumer lag screenshot
- `pg_stat_activity` output at time of incident

---

## Drill Cadence

- **Frequency**: Quarterly (see Annex B §B.16)
- **Environment**: Staging cluster
- **Drill**: Run GD-02 chaos scenario (`tests/chaos/GD-02/`)
- **Pass criteria**: Publisher recovered within 10 minutes; no audit events lost

---

## Linked Artefacts

- Chaos scenario: [tests/chaos/GD-02/](../../tests/chaos/GD-02/)
- Alert: `monitoring/alerts/outbox-publisher.yaml`
- Threat model T12: [threat-models/consent-service.md](../../threat-models/consent-service.md)
- ADR-0021: Outbox pattern
