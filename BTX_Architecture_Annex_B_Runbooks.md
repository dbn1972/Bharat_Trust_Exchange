# BTX Architecture — Annex B: Operations & Security Runbooks

> Companion to `BTX_Architecture_Document.md`. This annex defines the operational runbooks, on-call model, chaos/GameDay scenarios and key-ceremony procedures required to operate BTX safely at scale.

## B.0 Contents

1. [On-call model, severities and comms](#b1-on-call-model-severities-and-comms)
2. [SLO error budgets and burn-rate alerts](#b2-slo-error-budgets-and-burn-rate-alerts)
3. [Runbook: PKI root & sub-CA key ceremony](#b3-runbook-pki-root--sub-ca-key-ceremony)
4. [Runbook: Member onboarding + Trust Node bootstrap](#b4-runbook-member-onboarding--trust-node-bootstrap)
5. [Runbook: Certificate rotation](#b5-runbook-certificate-rotation)
6. [Runbook: Emergency revocation](#b6-runbook-emergency-revocation)
7. [Runbook: Policy bundle publish & rollback](#b7-runbook-policy-bundle-publish--rollback)
8. [Runbook: Kafka rebalance & topic management](#b8-runbook-kafka-rebalance--topic-management)
9. [Runbook: PostgreSQL failover](#b9-runbook-postgresql-failover)
10. [Runbook: DR failover (region loss)](#b10-runbook-dr-failover-region-loss)
11. [Runbook: Backup, restore and verification drill](#b11-runbook-backup-restore-and-verification-drill)
12. [Runbook: Audit chain anomaly investigation](#b12-runbook-audit-chain-anomaly-investigation)
13. [Runbook: Key compromise response](#b13-runbook-key-compromise-response)
14. [Runbook: Citizen grievance triage](#b14-runbook-citizen-grievance-triage)
15. [Chaos / GameDay scenarios](#b15-chaos--gameday-scenarios)
16. [Quarterly drill calendar](#b16-quarterly-drill-calendar)

---

## B.1 On-call model, severities and comms

### B.1.1 Roles

| Role | Coverage | Primary scope |
|---|---|---|
| Platform SRE on-call | 24×7, 1 primary + 1 secondary | Control plane, K8s, mesh, observability |
| Security on-call | 24×7 | mTLS, certs, HSM, SIEM alerts |
| Trust Node SRE | Business hours + escalation | Per-member nodes |
| Privacy duty officer | Business hours + escalation | DPDP incidents, citizen complaints |
| Product owner | Business hours | Triage decisions, customer comms |
| Incident Commander (IC) | Activated per sev | Coordinates response |

### B.1.2 Severity matrix

| Sev | Definition | Response | Comms cadence |
|---|---|---|---|
| **SEV-1** | Production outage; data exposure; widespread denial | 15 min ack, war-room | Every 30 min, exec briefed |
| **SEV-2** | Major degradation; single member down; audit gap | 30 min ack | Hourly |
| **SEV-3** | Minor degradation; non-blocking errors | Next business day | Daily standup |
| **SEV-4** | Cosmetic / informational | Backlog | Weekly |

### B.1.3 Comms templates

**SEV-1 initial:**
> `[SEV-1][BTX] <one-line impact>` — start: `<ts>`, IC: `<name>`, bridge: `<link>`, customer impact: `<scope>`, next update: `<ts+30m>`.

**SEV-1 resolution:**
> Cause, mitigation, restoration time, customer notification, RCA owner, RCA due date (5 business days).

### B.1.4 Escalation paths

- Platform SRE → SRE Lead → Head of Platform → CTO
- Security → Security Lead → CISO → National Authority
- Privacy → Privacy Lead → DPO → National Authority

---

## B.2 SLO error budgets and burn-rate alerts

### B.2.1 SLOs (production)

| Service | SLI | SLO | 28-day budget |
|---|---|---|---|
| PDP (`/v1/decisions`) | success rate (200 within 50 ms) | 99.95% | 1,209 s |
| Trust Node exchange | success rate (e2e p95 ≤ 600 ms) | 99.9% | 2,419 s |
| Yes/no verification | p95 ≤ 300 ms | 99.9% | 2,419 s |
| Audit ingest | event commit ≤ 100 ms | 99.99% | 242 s |
| Control plane API | success | 99.9% | 2,419 s |

### B.2.2 Multi-window burn-rate alerts (Google SRE pattern)

| Alert | Burn rate | Long window | Short window | Action |
|---|---|---|---|---|
| Fast burn | 14.4× | 1 h | 5 min | Page primary |
| Medium burn | 6× | 6 h | 30 min | Page primary |
| Slow burn | 3× | 24 h | 2 h | Ticket + investigate |
| Budget exhausted | — | 28 d | — | Freeze risky changes |

**Change freeze rule:** when budget > 90% consumed, only SEV-fix and security patches deploy until budget recovers.

---

## B.3 Runbook: PKI root & sub-CA key ceremony

### B.3.1 Prerequisites

- HSM (FIPS 140-2 L3) operational; firmware verified.
- Ceremony script approved by Security Board.
- ≥ 5 trusted officers (Shamir m-of-n: 3-of-5 for root).
- Recorded ceremony room, two independent witnesses, video archived to WORM.

### B.3.2 Steps (root CA)

1. Power on HSM in offline ceremony room; verify firmware hash against signed manifest.
2. Initialise partition; configure 3-of-5 quorum officers.
3. Generate root key pair inside HSM (ECDSA P-384 or RSA-4096; algorithm per current Crypto Profile).
4. Produce self-signed root certificate (10-year validity, CRL distribution + OCSP URIs).
5. Export public root cert (NOT private key) to two USB media, hashed and signed.
6. Distribute root cert to: Trust Console root store, Trust Node bootstrap image, public trust list.
7. Seal HSM in tamper bag; transport to dual-control safe.
8. Sign ceremony log; archive to WORM; record in `pki.ceremony.v1` audit topic.

### B.3.3 Sub-CA issuance

Repeat steps 1-8 with sub-CA quorum (2-of-3); sub-CA cert signed by online root ceremony only when required, otherwise via intermediate signing key. Sub-CA TTL = 5 years.

### B.3.4 Recovery

- Quorum loss: trigger key-replacement ceremony; re-issue sub-CAs; rotate all member certs.
- HSM failure: restore from HSM backup using N-of-M domain backup keys (separate ceremony).

---

## B.4 Runbook: Member onboarding + Trust Node bootstrap

### B.4.1 Pre-flight

- Legal entity verified; data steward and security officer named.
- Target environment selected (sandbox first, mandatory).
- DPIA and threat-model templates filed for any in-scope service.

### B.4.2 Steps

```
1. Console → POST /v1/members  (status=pending)
2. Authority approves → status=sandbox_active
3. SRE pipeline (ArgoCD app-of-apps) generates:
   - namespace tn-<member>
   - SPIRE registration entry
   - KMS-CMK and Vault path
   - Helm values (cluster, region, adapter set)
4. CSR generated inside HSM (or KMS) on the TN node
5. CA issues short-TTL cert (90 d), OCSP must-staple, SAN=spiffe://btx/<member>/<node>
6. TN starts; pulls signed config bundle; verifies signature
7. Conformance suite runs (CT-001..025); evidence pack archived
8. Sandbox traffic exercised for ≥ 5 business days
9. Promotion review:
   - Security officer sign-off
   - Privacy officer sign-off (citizen-linked flows)
   - Performance baseline within SLO
10. Patch member → status=production_active; bundle re-publishes
```

### B.4.3 Acceptance evidence

- Cert chain validation log, SPIRE attestation log, conformance test report, performance baseline screenshot, sign-off PDF, ArgoCD diff.

---

## B.5 Runbook: Certificate rotation

### B.5.1 Trigger

- Scheduled: 30 d before expiry (auto).
- Unscheduled: compromise, algorithm migration, member request.

### B.5.2 Automated rotation (default)

```
T-30d: cert-manager issues replacement cert from sub-CA
T-29d: secondary cert added to Envoy (dual-cert)
T-29d→T-1d: traffic gradually validated on new cert (canary metric: handshake success)
T-1d: primary swaps to new cert; old cert moved to standby
T+1d: old cert removed
```

### B.5.3 Manual fallback

1. Identify TN; freeze grants temporarily (status=suspended).
2. Issue new CSR; CA signs; deploy via sealed-secret/Vault.
3. Validate handshake via test peer (`curl --cacert ... --cert ... --key ...`).
4. Resume grants; emit `certificate.rotated`.

### B.5.4 Failure modes

| Symptom | Action |
|---|---|
| Handshake errors > 0.1% post-swap | Rollback to standby cert; raise SEV-2 |
| Expiry notification missed | Force rotation; audit cert-manager alerting |
| OCSP responder down | Fall back to CRL; cap window 24 h; raise SEV-3 |

---

## B.6 Runbook: Emergency revocation

### B.6.1 Triggers

- Key compromise (suspected/confirmed)
- Member legal change (delisting, criminal action)
- Service security flaw, DPIA-blocking finding
- Court order / regulator directive

### B.6.2 Steps

```
1. Authorised actor (Security Officer + IC) signs revocation request:
   { kind: member|certificate|grant|service, id, reason_code, requested_by, ts }
2. Two-person approval enforced by Approval Workflow (4-eye).
3. Signed Config Publisher builds DELTA bundle (revocation list only).
4. Bundle signed via HSM (publisher key).
5. Push to btx.revoke.v1 NATS topic AND object store.
6. All Trust Nodes:
   - subscribe to NATS topic (push)
   - poll fallback every 30 s
7. TN verifies signature, applies revoke immediately, emits revocation.applied.
8. SCP collects ack from TNs.
   - SLA: 95% of nodes ack within 60 s; 100% within 5 min.
   - Missing nodes → page SEV-2.
9. Member Registry updated (status=revoked / suspended).
10. Post-incident review within 5 business days.
```

### B.6.3 Drill cadence

- Quarterly emergency-revocation drill in staging.
- Annual production drill against a synthetic member.

---

## B.7 Runbook: Policy bundle publish & rollback

### B.7.1 Publish flow

```
1. PR opened against purposeguard-policies/ with Rego + tests + impact notes.
2. CI runs: opa fmt, regal lint, opa test, coverage ≥ 80%.
3. CODEOWNERS approve (security + privacy).
4. Merge → opa build → cosign sign → publish to SCP.
5. SCP increments bundle_version; signs TUF metadata.
6. TNs pull on next poll (30 s) or push (NATS notify).
7. Canary: 5% of TNs first; observe deny-rate anomaly for 30 min.
8. Promote to 100% if no anomaly; otherwise rollback.
```

### B.7.2 Rollback flow

```
1. IC declares rollback (SEV-2 or above).
2. Republish previous signed bundle (immutable archive).
3. SCP increments version; TNs pull and activate.
4. Audit emits policy.bundle.rolled_back.
5. Root cause captured in ADR addendum.
```

### B.7.3 Acceptance test

Synthetic transactions: representative ALLOW, DENY, MINIMISED cases must pass before promoting.

---

## B.8 Runbook: Kafka rebalance & topic management

### B.8.1 Topic governance

| Topic | Partitions | Replication | Retention | Compaction |
|---|---|---|---|---|
| `btx.audit.v1` | 64 (per `provider_member_id` hash) | 3 | 30 d hot + WORM cold | No |
| `btx.revoke.v1` | 8 | 3 | 7 d | No |
| `btx.policy.v1` | 4 | 3 | 30 d | No |
| `btx.member.v1` | 8 | 3 | 90 d | No |

### B.8.2 Rebalance

- Use Cruise Control or equivalent; no manual partition moves in production.
- Throttle: ≤ 50 MB/s replication; observe consumer lag.
- Halt rebalance if PDP latency p95 > 60 ms.

### B.8.3 Lag handling

- Alert: consumer lag > 5 min (audit pipeline).
- Action: scale consumer; check downstream (OpenSearch/object store back-pressure).

---

## B.9 Runbook: PostgreSQL failover

### B.9.1 Topology

- Primary + sync standby (same AZ pair).
- Async replica (cross-region).
- Patroni or Stolon for orchestration.

### B.9.2 Planned switchover

```
1. Pause writes (read-only banner in Console).
2. patronictl switchover --master <primary> --candidate <sync_standby>
3. Verify replication lag = 0.
4. Apply DNS change (low-TTL) or VIP swap.
5. Resume writes; smoke tests.
```

### B.9.3 Unplanned failover

- Patroni promotes sync standby automatically when primary fails health check.
- Alert SEV-1; verify no split-brain (check generation IDs).
- Re-create old primary as standby once region recovers.

### B.9.4 RPO/RTO

- RPO ≤ 5 min (sync standby = 0; async replica ≤ 5 min).
- RTO ≤ 30 min including app reconnect.

---

## B.10 Runbook: DR failover (region loss)

### B.10.1 Activation criteria

- Primary region API failure rate > 50% for 10 min, OR
- Cloud provider declares region outage.

### B.10.2 Steps

```
1. IC declares DR activation (SEV-1).
2. Verify DR pre-conditions:
   - PG async replica lag ≤ 5 min
   - Kafka mirror lag ≤ 5 min
   - Signed Config mirror in sync
   - HSM/KMS available in DR region (replicated CMK)
3. Promote PG DR replica → primary.
4. Activate Kafka DR cluster; cut consumer subs to DR brokers.
5. Switch DNS (control.btx, audit.btx) to DR LB (TTL 60 s).
6. ArgoCD pivots to DR cluster manifests.
7. Trust Nodes auto-reconnect (pull bundle from DR).
8. Smoke tests: PDP decision, sample exchange, audit ingest, dashboards.
9. Customer comms: SEV-1 update with DR confirmation.
```

### B.10.3 Fallback to primary

After primary region recovers:
- Reverse-replicate DR → primary.
- Schedule planned switchback in maintenance window.

---

## B.11 Runbook: Backup, restore and verification drill

### B.11.1 Backup catalogue

| Item | Method | Frequency | Encryption | Retention |
|---|---|---|---|---|
| PG (control plane) | WAL streaming + base backup | base daily, WAL 5-min | KMS-CMK | 35 days hot, 7 yr cold |
| Object storage (signed bundles) | Versioned + cross-region | continuous | KMS-CMK | indefinite |
| Audit cold tier | Immutable WORM | continuous | KMS + chain | per retention class |
| HSM backup | HSM domain backup | quarterly + after ceremony | HSM-wrapped | indefinite |
| ArgoCD / Git | Mirrored repos | continuous | Provider | indefinite |

### B.11.2 Quarterly restore drill

```
1. Provision isolated restore environment.
2. Restore latest PG base + WAL to a target time.
3. Verify schema migrations applied.
4. Restore audit WORM sample; recompute hash chain; verify anchor signature.
5. Restore Kafka topic from object archive (replay).
6. Run smoke tests; produce evidence pack; sign off.
```

### B.11.3 Verification gates

- Restore RTO < 1 h for PG; < 4 h for Kafka.
- Audit chain integrity = 100% (no broken hashes).

---

## B.12 Runbook: Audit chain anomaly investigation

### B.12.1 Triggers

- Reconciliation job flags requester/provider event mismatch.
- Chain hash break detected.
- Anchor signature invalid.

### B.12.2 Investigation

```
1. Quarantine affected partition (read-only).
2. Identify chain break index N.
3. Pull raw events N-10..N+10 from WORM.
4. Recompute SHA-256 chain locally.
5. Compare with stored chain_event_hash.
6. If break confirmed:
   - Snapshot evidence (signed by IC).
   - File security incident (suspected tamper).
   - Check WORM access logs for write attempts.
   - Notify auditor + CISO.
7. Repair: write a "chain_repair" anchor event referencing the break,
   sign with KMS, continue new chain from N+1.
8. Post-incident: rotate keys involved; review WORM permissions.
```

### B.12.3 Acceptance for closure

- Cause identified (bug vs malicious).
- Affected exchanges enumerated with txn_ids.
- Citizens notified if personal data implicated (DPDP grievance route).

---

## B.13 Runbook: Key compromise response

### B.13.1 Detection sources

- HSM audit anomaly
- SIEM signature alerts (unusual `kid` usage)
- External report
- Threat-intel feed

### B.13.2 Actions (in order)

```
1. Page Security on-call (SEV-1).
2. Activate Emergency Revocation runbook (B.6) for affected key/cert/member.
3. Force cert rotation for related TNs (B.5).
4. Pause grants for member (suspended) until investigation closes.
5. Forensic capture: HSM audit logs, NATS revoke channel logs,
   TN logs (signed), audit chain near event.
6. Determine scope: what was signed by compromised key, in what window.
7. Selective re-issuance of audit anchors; mark exchanges in window as
   "integrity_review_pending" in dashboard.
8. Public/customer comms per CISO; DPDP notification if applicable.
9. RCA + control changes within 10 business days.
```

---

## B.14 Runbook: Citizen grievance triage

### B.14.1 Intake channels

- Citizen Portal (OIDC login + Aadhaar/DigiLocker binding optional)
- Provider department helpdesk → API
- Regulator referral

### B.14.2 SLA

| Severity | Acknowledge | Resolve target |
|---|---|---|
| High (sensitive data exposure, unlawful disclosure) | 24 h | 7 days |
| Medium (correction, missing notice) | 3 days | 15 days |
| Low (general query) | 5 days | 30 days |

### B.14.3 Workflow

```
1. Citizen submits grievance with txn_id (optional).
2. System pre-fills sharing history.
3. Workflow assigns to provider data steward.
4. Steward verifies record, performs correction in source system.
5. Privacy officer reviews if data exposure suspected.
6. Resolution emitted as grievance.resolved event.
7. Citizen notified with resolution + appeal route.
8. Appeals escalate to State / National grievance authority.
```

---

## B.15 Chaos / GameDay scenarios

| ID | Scenario | Inject | Expected behaviour | Pass criteria |
|---|---|---|---|---|
| GD-01 | Control plane region loss | Stop CP cluster | TNs continue with signed cache; new approvals queue | Audit shows continuity; no data leak |
| GD-02 | PDP unavailable | Kill PDP pods | TNs use local OPA cache | Decision latency stays ≤ 80 ms p95 |
| GD-03 | Signed Config Publisher down | Stop SCP | TNs cache continues until TTL; emergency channel still works | TTL behaviour as designed |
| GD-04 | Member cert revoked mid-traffic | Trigger revoke during load | Subsequent requests rejected within 60 s | 95% rejection within SLA |
| GD-05 | Kafka partition leader loss | Kill broker | Audit ingest continues; lag recovers | < 5 min lag spike |
| GD-06 | PG primary loss | Kill primary | Patroni promotes standby | RTO ≤ 30 min, no data loss |
| GD-07 | Bulk scrape attempt | Synthetic high-volume requester | Provider denies + alerts | 100% deny + SOC alert |
| GD-08 | BOLA tampered request | Send mismatched citizen_context_ref | Denied, audited | Denial + alert |
| GD-09 | Replay attack | Replay captured request after 60 s | Rejected | Audit shows BTX-FRESH-002 |
| GD-10 | mTLS downgrade attempt | Offer TLS 1.2 | Rejected at handshake | No TLS 1.2 negotiated |
| GD-11 | Policy rollback under load | Rollback bundle during traffic | Decisions converge to old policy | No deny-rate cliff |
| GD-12 | HSM cluster failover | Failover HSM | Signing pauses ≤ 30 s, then resumes | RTO ≤ 30 s; no audit gap |
| GD-13 | DR failover full | Activate Runbook B.10 | All flows resume in DR | RTO ≤ 30 min |
| GD-14 | Audit chain break | Inject corrupt event | Detected and quarantined | Alert + repair anchor created |
| GD-15 | Cloud adapter outage (KMS) | Block KMS | Signer falls to cached envelope, alerts | Graceful degradation |

Each scenario maps to a recorded GameDay report + ADR addendum if behaviour deviates.

---

## B.16 Quarterly drill calendar

| Quarter | Drill | Owner |
|---|---|---|
| Q1 | Emergency revocation (B.6) + GD-04 | Security |
| Q1 | Backup restore (B.11) | Platform SRE |
| Q2 | DR failover (B.10) + GD-13 | Platform SRE + Security |
| Q2 | Policy rollback (B.7) + GD-11 | Security + Product |
| Q3 | Key ceremony rehearsal (B.3) | Security |
| Q3 | Audit chain anomaly (B.12) + GD-14 | Audit + Security |
| Q4 | Multi-cloud portability test (CT-001, CT-025) | Platform SRE |
| Q4 | Full SEV-1 tabletop with execs | IC + Comms |
| Continuous | Chaos suite (GD-01..15) in staging | Platform SRE |

Drill evidence stored in `certify/drills/<quarter>/`; reviewed at quarterly architecture review board.
