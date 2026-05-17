# ADR-0025 — Data Residency and Cross-Border Transfer Controls

| Field | Value |
|---|---|
| ID | ADR-0025 |
| Date | 2026-05-17 |
| Status | **accepted** |
| Deciders | @chief-architect, @privacy-lead, @security-lead |
| BRD References | BRD §14 (Security), §24 (DPIA), §31 (Standards) |
| Arch References | Architecture §6 (Security), §8 (Policy), §9 (Audit) |
| Supersedes | — |
| Superseded By | — |

---

## Context and Problem Statement

BTX processes personal data of Indian citizens including consent decisions, citizen pseudonymous identifiers, and audit records. The Digital Personal Data Protection Act 2023 (DPDP) permits cross-border transfer of personal data to **notified countries** only; at the time of writing, the notified country list has not been finalised by the Central Government. RBI additionally mandates that financial and payment data must remain within India.

BTX operates three cloud adapters (AWS, GCP, Azure) that may persist data in any configured region. Without explicit controls, a misconfigured deployment could store personal data outside India.

Forces:
- DPDP 2023 §16 restricts cross-border personal data transfer to notified countries.
- RBI data localisation requires financial data on India-resident infrastructure.
- Cloud KMS and object store operations may default to a non-India region if misconfigured.
- Federation sync with external trust nodes will eventually cross international borders.
- ADR-0002 (cloud-agnostic) requires that residency controls are provider-agnostic.

---

## Decision

**We enforce data residency at three levels: configuration, policy, and audit.**

### Level 1 — Configuration Enforcement

All cloud adapter bootstrap (`pkg/bootstrap/src/cloud-adapters.ts`) must validate the `CLOUD_REGION` environment variable against a **residency allowlist** at startup. For Phase 1 (India-only), the allowlist is:

```
AWS:   ap-south-1 (Mumbai), ap-south-2 (Hyderabad)
GCP:   asia-south1 (Mumbai), asia-south2 (Delhi)
Azure: centralindia (Pune), southindia (Chennai)
```

If `CLOUD_REGION` is not in the allowlist, the bootstrap factory **must throw a `ResidencyViolationError`** and abort startup. The stub adapter is always allowed (local dev).

### Level 2 — Policy Enforcement (PDP)

The OPA/Rego policy bundle includes an obligation `OBL-RESIDENCY-CHECK` that:
- Blocks federation sync requests where the destination trust node's registered `endpoint_url` resolves to a non-India IP range (checked via geo IP lookup at consent grant time, cached per node).
- Blocks data access requests from principals whose registered jurisdiction is not India (unless explicit cross-border consent is present with a lawful basis of `DPDP-§16-APPROVED`).
- Emits a `residency.violation` audit event for any blocked request.

### Level 3 — Audit and Alerting

Every KMS and object store operation logs the `region` field to the audit event. A Prometheus alert `btx_residency_violation_total > 0` fires on any policy-blocked request and pages `#btx-privacy`.

### Cross-Border Transfer (Future)

When the Central Government notifies approved countries under DPDP §16:
1. Author a new ADR superseding this one.
2. Update the bootstrap allowlist to add cross-border regions.
3. Add a `cross_border_transfer_approved` field to the consent record.
4. Update OPA obligation `OBL-RESIDENCY-CHECK` to permit transfers where consent includes explicit cross-border approval.
5. Run DPIA update per P-09.

---

## Alternatives Considered

| Option | Why Not |
|---|---|
| **Application-level residency enforcement only** | Insufficient: misconfigured environment variables can bypass app logic; compliance requires infrastructure-level enforcement |
| **Enforce residency only for personal data stores** | KMS operations also involve personal data derivation (signing citizen consent events); KMS region must also comply |
| **Defer to cloud provider data residency SLA** | Cloud provider guarantees cover infrastructure, not application data flows across regions; we need explicit enforcement at the BTX application layer |
| **Single India-only cloud region, no multi-region** | Violates ADR-0002 (cloud-agnostic); also reduces resilience for a national-scale system |

---

## Consequences

**Positive**:
- Explicit DPDP compliance at startup; misconfiguration is detected before any data is processed.
- Policy enforcement gives a single, auditable control point.
- Future cross-border expansion is gated through a formal ADR + DPIA update cycle.

**Negative**:
- Developer experience: local dev must use stub adapter or India-region cloud accounts; non-India dev machines cannot use real cloud accounts.
- Adding new cloud regions requires updating the bootstrap allowlist and re-running CT suite.

**Operational Impact**:
- `CLOUD_REGION` must be set in all production Helm values.
- SRE must create Terraform/OpenTofu variable validation to enforce the allowlist at IaC level.
- On-call runbook must include "residency violation" as a SEV-2 trigger.

**Migration**:
- No migration for Phase 1 (India-only deployment).
- Cross-border migration requires DPIA update, ADR supersession, and legal approval.

---

## References

- Digital Personal Data Protection Act 2023 §16 (Cross-border transfers)
- RBI Master Direction on Digital Payment Security Controls
- ADR-0002 (Cloud-agnostic product core)
- ADR-0004 (Policy-as-code)
- ADR-0005 (Audit-as-trust-product)
- ADR-0008 (Certified cloud adapters)
- DPIA-001 (consent-service) — §7 (Cross-border assessment)
- BRD §14 (Security), §24 (DPIA)
