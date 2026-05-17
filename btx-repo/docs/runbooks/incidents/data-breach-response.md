# Incident Response Playbook — Potential Personal Data Breach

| Field | Value |
|---|---|
| ID | IR-001 |
| Trigger | Unauthorised access to citizen consent records; exfiltration of citizen_id or purpose data; CT-017/CT-011 conformance failure in production |
| Severity | SEV-1 |
| Owner | @security-lead |
| Comms Lead | @privacy-lead (external); @sre-lead (internal) |
| Escalation | `#btx-security`, `#btx-privacy` |
| DPDP Notification Deadline | 72 hours to DPB (Digital Personal Data Protection Board) per DPDP §8 |
| Version | 1.0.0 — 2026-05-17 |

---

## Trigger Criteria

Invoke this playbook if **any** of the following is true:
- Anomalous data access volume: `btx_consent_query_rate_5m > 10x baseline` from a single principal.
- Authorisation bypass: principal receives consent record they are not authorised for (HTTP 200 where 403 expected).
- PII observed in log output (Loki full-text search for `citizen_id` pattern hit in application logs).
- External report from a citizen that their data was accessed without consent.
- KMS key used outside of expected service identity (SPIFFE SVID mismatch in KMS audit trail).
- Any CT-011 (authorisation) or CT-017 (PII log scrub) conformance test failure in production.

---

## P1 — Confirm (0–15 min)

```bash
# 1. Capture incident start timestamp
export INCIDENT_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Incident started: $INCIDENT_START"

# 2. Snapshot current Grafana dashboards (consent query rate, error rate)
# Take screenshots manually from https://grafana.btx.internal/d/btx-consent

# 3. Identify the transaction IDs involved
# From alert or report: consentId, principalId, txn_id
export CONSENT_ID="<from-alert>"
export PRINCIPAL_ID="<from-alert>"

# 4. Pull audit trail for the consent
btx-cli consent audit $CONSENT_ID | jq .

# 5. Check if the access was authorised or bypassed
# Expected: every query event has caller_id matching the granting principal
# Unexpected: caller_id != expected — confirms bypass
```

**Decision gate**: If access was authorised and expected → downgrade to SEV-2/false positive, close with note.  
If bypass confirmed → continue to Contain.

---

## P2 — Contain (15–45 min)

⚠️ **All containment actions require 4-eye approval. Document every action in `#btx-security`.**

### Option A — Revoke the affected principal's access
```bash
# ⚠️ DESTRUCTIVE — requires 4-eye approval
btx-cli principal revoke --principal-id $PRINCIPAL_ID --reason "IR-001 containment"

# Verify all consents for this principal are now revoked
btx-cli consent list --principal-id $PRINCIPAL_ID | jq '.[] | .status'
```

### Option B — Emergency policy bundle update (block principal in PDP)
```bash
# Update OPA bundle to block principal_id via emergency deny rule
# ⚠️ DESTRUCTIVE — requires chief-architect + security-lead approval
# Edit policy/emergency/block-principal.rego, push, sign, deploy
make policy-bundle-emergency BLOCK_PRINCIPAL=$PRINCIPAL_ID
```

### Option C — Drain the affected trust node
```bash
# If breach is via a compromised trust node
# ⚠️ DESTRUCTIVE — requires 4-eye approval
btx-cli registry update-status --node-id <nodeId> --status suspended
```

### Preserve evidence
```bash
# Do NOT delete logs. Snapshot WORM Kafka offsets.
kafka-consumer-groups.sh --bootstrap-server redpanda:9092 \
  --describe --group btx-audit-archiver > kafka-offsets-snapshot.txt

# Capture K8s state
kubectl get all -n btx -o yaml > k8s-state-snapshot.yaml

# Capture current policy bundle hash
sha256sum bundle.tar.gz > policy-bundle-hash.txt
```

---

## P3 — Communicate (within 30 min of confirmation)

**Internal (every 30 min for SEV-1)**:
> **[BTX SEV-1 Incident IR-001]** Potential personal data breach confirmed at `[timestamp]`. Affected: consent records for principal `[id]`. Containment status: `[option taken]`. Privacy lead notified. DPDP 72h clock started. Next update: `[T+30min]`. War room: `#btx-security`.

**External — DPB Notification (within 72h)**:  
Draft notification per DPDP §8 template. Requires DPO sign-off before sending. Do NOT send without DPO approval.

**Citizen notification**: If citizen data was accessed without authorisation, citizen must be notified per DPDP §8(7). Notification via portal + email. Draft to be reviewed by legal.

---

## P4 — Investigate (0–4h)

```bash
# 1. Full audit trail for the breach window
btx-cli consent audit $CONSENT_ID \
  --from "$INCIDENT_START" \
  --to "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 2. Kafka audit topic replay for the time window
kafka-console-consumer.sh --bootstrap-server redpanda:9092 \
  --topic btx.audit.events \
  --from-beginning | \
  jq "select(.timestamp >= \"$INCIDENT_START\")"

# 3. Check Merkle root chain integrity
btx-cli audit verify-chain --from-date "${INCIDENT_START:0:10}"

# 4. Check KMS audit trail for unexpected key usage
# (Cloud KMS: AWS CloudTrail / GCP Cloud Audit Logs / Azure Monitor)

# 5. Check SPIFFE SVID issuance for the offending service identity
# kubectl exec spire-agent -- spire-agent api fetch x509 --socketPath /tmp/spire-agent/public/api.sock
```

---

## P5 — Recover (4–24h)

```bash
# After containment confirmed, restore service if it was drained/suspended
btx-cli registry update-status --node-id <nodeId> --status active

# Verify SLOs are restored
kubectl exec -n btx deploy/control-plane -- \
  curl -s localhost:9090/metrics | grep btx_slo_

# Verify audit chain integrity is intact
btx-cli audit verify-chain --full

# Verify policy bundle is the intended version (check against evidence pack)
cosign verify-blob bundle.tar.gz \
  --bundle bundle.tar.gz.sig \
  --certificate-identity-regexp="https://github.com/btx/.*" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com"
```

---

## P6 — Close

Declare resolved when:
- [ ] Containment confirmed (breach vector closed)
- [ ] Audit chain integrity verified
- [ ] Policy bundle verified to be the intended version
- [ ] Internal communications completed (final status update)
- [ ] DPB notification filed (if required)
- [ ] Citizen notification sent (if required)
- [ ] PIR ticket opened

---

## P7 — Post-Incident Review (PIR)

Due: within 5 business days (SEV-1).

PIR must cover:
- Timeline: detection → confirmation → containment → resolution
- Root cause (which control failed)
- What worked (detections that fired correctly)
- What failed (delayed detection or missed alert)
- Action items: runbook updates, new detection rules, new chaos scenario, ADR if architecture changed

---

## Linked Artefacts

- DPIA: [dpia/consent-service.md](../../dpia/consent-service.md)
- Threat model: [threat-models/consent-service.md](../../threat-models/consent-service.md) — T08 (info disclosure)
- Runbook RB-001: [docs/runbooks/operations/consent-revocation-cascade.md](../operations/consent-revocation-cascade.md)
- Alert: `monitoring/alerts/consent-authorisation.yaml`
- ADR-0005: Audit as trust product
- ADR-0014: SPIFFE/SPIRE workload identity
