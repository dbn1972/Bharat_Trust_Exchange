# Runbook — Consent Revocation Cascade Failure (consent-revocation-cascade)

| Field | Value |
|---|---|
| ID | RB-001 |
| Procedure | `consent-revocation-cascade` |
| Severity | SEV-2 |
| Owner | @sre-lead |
| GameDay ID | GD-01 |
| Alert | `btx_consent_cascade_lag_seconds > 30` |
| Related Runbook | [outbox-publisher-failure.md](./outbox-publisher-failure.md) |
| Last Drill | — (schedule: quarterly, see Annex B §B.16) |
| Version | 1.0.0 — 2026-05-17 |

---

## When to Use

Use this runbook when:
- Alert `btx_consent_cascade_lag_seconds > 30` fires (cascade lag exceeds SLA of 1500ms cross-node, sustained > 30s).
- Citizens report that a revoked consent is still being honoured by a data provider.
- `POST /v1/consents/:id/revoke` returns 200 but downstream trust nodes still return consent-active.
- On-call engineer observes a spike in `btx_federation_sync_error_total`.

---

## Prerequisites

- `kubectl` access to the `btx` namespace (prod cluster).
- `psql` access to `control-plane-pg` (read-only replica for diagnosis, primary for write operations).
- `kafka-cli` or Redpanda Console access to `btx.audit.events` topic.
- `btx-cli` tool installed locally (see `tools/btx-cli/README.md`).
- 4-eye approval from a second on-call engineer for any destructive step (marked ⚠️ DESTRUCTIVE).

---

## Pre-flight Checks

```bash
# 1. Check cascade lag metric
kubectl exec -n btx deploy/control-plane -- curl -s localhost:9090/metrics | grep btx_consent_cascade_lag

# 2. Confirm the specific consent ID from the alert
# Typically provided in the PagerDuty alert body as consentId=<uuid>

# 3. Check outbox table size (large backlog = publisher stalled)
psql $CONTROL_PLANE_DB_URL -c "SELECT count(*) FROM outbox WHERE status = 'pending';"

# 4. Check OutboxPublisher pod health
kubectl get pod -n btx -l app=control-plane-outbox -o wide
kubectl logs -n btx -l app=control-plane-outbox --tail=50
```

---

## Procedure

### Step 1 — Identify the affected consent and peer nodes

```bash
# Get the revocation event from audit trail
btx-cli consent audit <consentId>

# Check federation state for each peer node
btx-cli federation state <nodeId>

# List peer syncs in error state
curl -s https://control-plane.btx.internal/v1/federation/pending | jq '.[] | select(.status == "error")'
```

**Verify**: If `peer_syncs` shows `status = error` for one or more nodes, proceed to Step 2. If no peer syncs are pending, skip to Step 5 (stale cache).

---

### Step 2 — Check the OutboxPublisher worker

```bash
# Check if publisher is running
kubectl get pod -n btx -l app=outbox-publisher

# Check publisher logs for errors
kubectl logs -n btx -l app=outbox-publisher --tail=100 | grep -E "ERROR|WARN|kafka"

# Check Kafka lag on the audit topic
kafka-consumer-groups.sh --bootstrap-server redpanda:9092 --describe --group btx-outbox-publisher
```

**If publisher is stopped/crashed**, proceed to Step 3. If running but lagged, proceed to Step 4.

---

### Step 3 — Restart the OutboxPublisher

```bash
# Restart the outbox publisher deployment
kubectl rollout restart -n btx deployment/control-plane-outbox

# Watch the rollout
kubectl rollout status -n btx deployment/control-plane-outbox --timeout=120s

# Verify publisher resumes draining
kubectl logs -n btx -l app=outbox-publisher -f --tail=30
```

**Expected**: Publisher logs show `[outbox] drained N events` within 30 seconds.

---

### Step 4 — Manual outbox drain (if publisher is running but stalled)

```bash
# Check for lock contention on outbox table
psql $CONTROL_PLANE_DB_URL -c "SELECT pid, wait_event_type, wait_event, query FROM pg_stat_activity WHERE wait_event_type = 'Lock';"

# If locks found, identify and optionally terminate the blocking PID
# ⚠️ DESTRUCTIVE — requires 4-eye approval
# psql $CONTROL_PLANE_DB_URL -c "SELECT pg_terminate_backend(<blocking_pid>);"

# Force publish specific outbox events using btx-cli
btx-cli outbox replay --consent-id <consentId> --dry-run
# Verify output, then run without --dry-run after 4-eye approval
# ⚠️ DESTRUCTIVE — requires 4-eye approval
btx-cli outbox replay --consent-id <consentId>
```

---

### Step 5 — Verify peer node received the revocation

```bash
# Check the peer node's federation state directly
curl -s https://<peer-node-endpoint>/v1/federation/state/<nodeId> | jq .

# If peer node is unreachable, check registry for correct endpoint
btx-cli registry lookup <nodeId>

# Manually trigger a sync push to a specific peer
# ⚠️ DESTRUCTIVE — sends a federation sync message; requires 4-eye approval
btx-cli federation push-revoke --consent-id <consentId> --peer-node <nodeId>
```

---

### Step 6 — Verification

```bash
# Confirm cascade lag metric has dropped
kubectl exec -n btx deploy/control-plane -- curl -s localhost:9090/metrics | grep btx_consent_cascade_lag
# Expected: value < 5 (5 seconds)

# Confirm peer sync status
curl -s https://control-plane.btx.internal/v1/federation/pending | jq 'length'
# Expected: 0 or decreasing

# Confirm audit trail shows revoke + sync events
btx-cli consent audit <consentId> | jq '.[] | select(.event_type | contains("revoke"))'
```

---

## Rollback

There is no rollback for a consent revocation (revocation is final by design). If the cascade pushed an incorrect revocation:
1. Grant a new consent (P-01 consent grant flow).
2. Open an incident ticket to investigate the root cause.
3. Notify the citizen via the portal.

---

## Failure Modes

| Failure | Symptom | Action |
|---|---|---|
| OutboxPublisher pod OOMKilled | Pod in `OOMKilled` state; Kafka lag rising | Increase `resources.limits.memory` in Helm values; roll out |
| Redpanda/Kafka broker down | Publisher logs `ECONNREFUSED` | Escalate to infra team; check Redpanda cluster health |
| Peer node unreachable | `peer_syncs.status = error`; endpoint timeout | Check registry endpoint; escalate to peer node operator |
| DB connection pool exhausted | `pg_stat_activity` shows pool full | Check PgBouncer stats; reduce pool contention |
| Merkle root mismatch on peer | Peer rejects sync with `merkle_mismatch` | Run `btx-cli federation verify-chain <nodeId>`; escalate to compliance-lead |

---

## Communications Template

**SEV-2 Update (every 60 min)**:
> **[BTX Incident]** Consent revocation cascade lag elevated. Affected consent IDs: `[list]`. Peer nodes impacted: `[list]`. Status: investigating. ETA for resolution: `[estimate]`. Escalation: `@sre-lead`.

---

## Evidence to Capture

During the incident, capture:
- Screenshot of `btx_consent_cascade_lag_seconds` dashboard
- `kubectl logs` output from OutboxPublisher
- Output of `btx-cli consent audit <consentId>`
- Output of `btx-cli federation state <nodeId>` for each affected peer
- PagerDuty incident timeline

---

## Drill Cadence

- **Frequency**: Quarterly (see Annex B §B.16)
- **Environment**: Staging cluster
- **Drill**: Run GD-01 chaos scenario (`tests/chaos/GD-01/`)
- **Pass criteria**: Cascade restored within 5 minutes; all steps executable without additional guidance

---

## Linked Artefacts

- Chaos scenario: [tests/chaos/GD-01/](../../tests/chaos/GD-01/)
- Alert definition: `monitoring/alerts/consent-cascade.yaml`
- Threat model: [threat-models/consent-service.md](../../threat-models/consent-service.md)
- ADR-0021: Outbox pattern
