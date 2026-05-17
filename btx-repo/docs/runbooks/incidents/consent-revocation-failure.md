# Incident Response Playbook — Consent Revocation Not Honoured (SEV-2)

| Field | Value |
|---|---|
| ID | IR-002 |
| Trigger | Citizen reports consent was revoked but data provider still accessing data; `btx_consent_cascade_lag_seconds > 60` sustained > 5 min |
| Severity | SEV-2 |
| Owner | @sre-lead |
| Escalation | `#btx-sre`, escalate to `#btx-security` if breach suspected |
| Related Runbook | [RB-001 consent-revocation-cascade.md](../operations/consent-revocation-cascade.md) |
| Version | 1.0.0 — 2026-05-17 |

---

## Trigger Criteria

- `POST /v1/consents/:id/revoke` returned 200 but data provider continues accessing data.
- `btx_consent_cascade_lag_seconds` > 60 seconds sustained for > 5 min.
- Peer trust node federation state shows `status = pending` or `status = error` > 10 min after revoke.
- Citizen portal shows consent status = `revoked` but data provider reports `active`.

---

## P1 — Confirm (0–15 min)

```bash
export CONSENT_ID="<from-report-or-alert>"

# 1. Confirm revocation in audit trail
btx-cli consent audit $CONSENT_ID | \
  jq '.[] | select(.event_type == "consent.revoked")'
# Expected: at least one consent.revoked event with timestamp

# 2. Check consent status in DB
psql $CONTROL_PLANE_DB_URL -c \
  "SELECT id, status, revoked_at FROM consents WHERE id = '$CONSENT_ID';"
# Expected: status = 'revoked', revoked_at is populated

# 3. Check federation state for each peer node
curl -sf http://localhost:3003/v1/federation/pending | \
  jq --arg cid "$CONSENT_ID" '.[] | select(.consent_id == $cid)'

# 4. If cascade is stalled → invoke RB-001 (consent-revocation-cascade.md)
```

**Decision gate**: If consent is NOT revoked in DB → this is a different incident (revoke API failure); skip to P3 with SEV-1 escalation.

---

## P2 — Contain (15–30 min)

If cascade is confirmed stalled and data provider is actively querying:

```bash
# Option A — Emergency deny at PDP level (immediate effect, no cascade needed)
# ⚠️ DESTRUCTIVE — requires 4-eye approval
btx-cli policy emergency-deny \
  --consent-id $CONSENT_ID \
  --principal-id $PRINCIPAL_ID \
  --ttl 3600 \
  --reason "IR-002 containment pending cascade fix"
# This pushes an emergency bundle update that makes PDP deny all requests for this consent

# Verify deny is active
curl -sf -X GET http://localhost:3002/v1/consents/$CONSENT_ID \
  -H "x-caller-principal: $PRINCIPAL_ID"
# Expected: 403 Forbidden
```

---

## P3 — Execute Cascade Recovery (30–60 min)

See runbook [RB-001](../operations/consent-revocation-cascade.md) for full steps.

Summary:
1. Check and restart OutboxPublisher if stalled.
2. Verify peer sync queue clears.
3. Confirm peer node federation state transitions to `verified`.

---

## P4 — Verify Full Resolution

```bash
# Confirm cascade complete
curl -sf http://localhost:3003/v1/federation/pending | \
  jq "length"
# Expected: 0

# Confirm data provider can no longer access the consent (returns 403)
curl -sf http://localhost:3002/v1/consents/$CONSENT_ID \
  -H "x-caller-principal: $PRINCIPAL_ID"
# Expected: 403

# Remove emergency deny if it was applied (now that cascade is complete)
btx-cli policy emergency-deny-remove --consent-id $CONSENT_ID

# Final audit check
btx-cli consent audit $CONSENT_ID | jq 'length'
# Expected: audit events show grant + revoke + cascade + emergency_deny + emergency_deny_removed
```

---

## P5 — Communicate (every 60 min for SEV-2)

**Internal update template**:
> **[BTX SEV-2 IR-002]** Consent revocation cascade stall for consent `[id]`. Emergency deny applied at T+`[min]`. Root cause: OutboxPublisher `[reason]`. Cascade recovery in progress. ETA: `[estimate]`. Escalated: `@sre-lead`.

**Citizen notification**: If cascade was delayed > 60 min after revoke, notify citizen via portal: "Your revocation request was received. We encountered a delay propagating it to connected services. The revocation is now fully effective. We apologise for the delay."

---

## P6 — Close

- [ ] Consent status = `revoked` in all peer node federation states
- [ ] Data provider returns 403 on access attempt
- [ ] Emergency deny removed (if applied)
- [ ] Audit chain integrity verified
- [ ] PIR ticket opened if cascade delay > 30 min

---

## PIR Triggers

Open a PIR (within 10 business days for SEV-2) if:
- Cascade delay > 30 min (SLA breach)
- Emergency deny was required
- Citizen was impacted (data accessed post-revoke)

---

## Linked Artefacts

- Runbook RB-001: [docs/runbooks/operations/consent-revocation-cascade.md](../operations/consent-revocation-cascade.md)
- Chaos scenario GD-01: [tests/chaos/GD-01/run.mjs](../../../tests/chaos/GD-01/run.mjs)
- Threat model T06: [threat-models/consent-service.md](../../threat-models/consent-service.md)
- ADR-0021: Outbox pattern
