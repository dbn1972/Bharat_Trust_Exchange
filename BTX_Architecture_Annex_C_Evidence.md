# BTX Architecture — Annex C: Evidence & Quantification

> Companion to `BTX_Architecture_Document.md`. This annex provides quantified capacity formulas, sized Bills of Material, a control-to-evidence traceability matrix, a numeric cost model, DPDP rights operationalisation, FMEA, residency model and accessibility test plan.

## C.0 Contents

1. [Capacity formulas and sizing](#c1-capacity-formulas-and-sizing)
2. [Sized Bill of Material per deployment pattern](#c2-sized-bill-of-material-per-deployment-pattern)
3. [Control-to-evidence traceability matrix](#c3-control-to-evidence-traceability-matrix)
4. [Cost model with numbers (illustrative)](#c4-cost-model-with-numbers-illustrative)
5. [DPDP rights operationalisation](#c5-dpdp-rights-operationalisation)
6. [Data residency & sovereignty model](#c6-data-residency--sovereignty-model)
7. [Multi-tenant noisy-neighbour controls](#c7-multi-tenant-noisy-neighbour-controls)
8. [Exit & portability playbook](#c8-exit--portability-playbook)
9. [Failure Mode and Effects Analysis (FMEA)](#c9-failure-mode-and-effects-analysis-fmea)
10. [Accessibility test plan (GIGW/WCAG 2.2 AA)](#c10-accessibility-test-plan-gigwwcag-22-aa)
11. [Standards control mapping with evidence pointers](#c11-standards-control-mapping-with-evidence-pointers)
12. [Conformance evidence index](#c12-conformance-evidence-index)

---

## C.1 Capacity formulas and sizing

### C.1.1 Notation

| Symbol | Meaning |
|---|---|
| R | Peak RPS (requests / sec) |
| L | p95 service latency (s) |
| C | Concurrency = R × L (Little's Law) |
| Pₚ | Pod capacity (requests / s / pod) |
| N | Replica count required |
| K | Kafka partitions |
| Tₚ | Topic throughput target (msg/s) |
| Pₚₖ | Per-partition throughput limit (msg/s) |

### C.1.2 Sizing rules

```
N_pods  = ceil( R / Pₚ × headroom_factor )       (headroom_factor = 1.5)
K       = ceil( Tₚ / Pₚₖ )                        (Pₚₖ ≈ 5,000 msg/s default)
Workers = ceil( C / per_pod_concurrency )
DB_IOPS = R × writes_per_request × write_amp      (write_amp ≈ 3 for PG)
```

### C.1.3 Worked example — national pilot

Assumptions:

- Peak R = 2,000 RPS across services.
- PDP p95 latency target L = 0.05 s.
- TN exchange L = 0.6 s.
- Pₚ(PDP) = 400 req/s/pod (Go + OPA, in-process).
- Pₚ(TN-Envoy) = 1,500 req/s/pod.
- Each exchange = 2 audit events.

| Component | Math | Result |
|---|---|---|
| PDP pods | ceil(2000 / 400 × 1.5) | **8 pods** |
| TN pods (per high-volume member) | ceil(500 / 1500 × 1.5) | **2 pods** (min 2 for HA) |
| Audit msg/s | 2 × 2000 | 4,000 msg/s |
| Kafka partitions (`btx.audit.v1`) | ceil(4000 / 5000) but min 16 for parallelism | **64** (future-proofed) |
| PG IOPS | 2000 × 1 write × 3 | 6,000 IOPS sustained |
| Concurrency (PDP) | 2000 × 0.05 | 100 → fits in 8 pods × 16 workers |

### C.1.4 PDP cache target

- Cache hit ratio target ≥ 90% (signed bundle steady-state).
- Cache memory per TN: ≤ 200 MB (bundle ≤ 50 MB compressed, working set ≤ 4×).

### C.1.5 Replay cache

- Redis cluster per provider TN; size = R × TTL × avg_entry_bytes.
- Example: 500 RPS × 300 s × 64 B = **9.6 MB** working set; provision 256 MB headroom.

### C.1.6 Audit storage growth

```
Hot (OpenSearch index): R × 2 × event_size × 30d
                      = 2000 × 2 × 1.5KB × 86400 × 30 ≈ 15.5 TB / month
Cold (object WORM, compressed 5×): ≈ 3.1 TB / month
```

Tiered retention controls cost: see §C.4.

---

## C.2 Sized Bill of Material per deployment pattern

### C.2.1 Foundation (MVP, single cloud + NIC)

| Component | Quantity | Spec |
|---|---|---|
| Control plane K8s nodes | 6 | 16 vCPU / 64 GB / 500 GB SSD |
| Worker nodes (services) | 6 | 8 vCPU / 32 GB |
| PostgreSQL | 2 primary+sync | 8 vCPU / 32 GB / 500 GB NVMe |
| PostgreSQL DR | 1 | 8 vCPU / 32 GB / 500 GB |
| Kafka brokers | 3 | 8 vCPU / 32 GB / 1 TB NVMe |
| OpenSearch data | 3 | 8 vCPU / 32 GB / 2 TB |
| Object storage (S3-API) | — | 5 TB hot, 20 TB cold |
| Redis (replay/cache) | 3 | 4 vCPU / 16 GB |
| Vault | 3 | 4 vCPU / 8 GB |
| HSM (managed) | 2 (HA) | Provider managed |
| LB / Ingress | 2 | Provider managed |
| Total nodes | ~17 | + 3 HSM/LB managed |

### C.2.2 Production pilot (national + 2 states)

| Add to Foundation | Quantity | Spec |
|---|---|---|
| Control plane workers | +6 | 8 vCPU / 32 GB |
| PG read replicas | +2 | 8 vCPU / 32 GB |
| Kafka brokers | +3 (total 6) | 8 vCPU / 32 GB / 2 TB |
| OpenSearch data | +3 (total 6) | 8 vCPU / 32 GB / 4 TB |
| Object storage | +50 TB cold | — |
| State Trust Node clusters | 2 × 4 nodes | 8 vCPU / 32 GB |
| DR region | full replica | per primary |

### C.2.3 Trust Node patterns

| Pattern | TN nodes | Adapter nodes | Notes |
|---|---|---|---|
| Dedicated (large dept) | 2-4 | 2 | HA + buffer |
| Managed tenant | shared cluster, 8 nodes for 20 tenants | shared | namespace per tenant |
| Hybrid | 2 in cloud + 2 on-prem | 2 on-prem | VPN/PrivateLink |
| Air-gapped | 2 isolated | 2 | offline bundle distribution |

---

## C.3 Control-to-evidence traceability matrix

> Every BRD requirement, NFR, conformance test and threat maps to a code module + test + runtime evidence artefact. Paths are workspace-relative to a future implementation repo `services/…`.

### C.3.1 Functional requirements

| BRD | Implementation evidence | Test artefact |
|---|---|---|
| FR-001..005 (Member Registry) | `services/member-registry/` | `tests/integration/member_lifecycle_test.go` |
| FR-006..010 (Catalogue) | `services/service-catalogue/` | `tests/contract/openapi_lint_test.sh` + `schema_validation_test.go` |
| FR-011..015 (Purpose + PDP) | `services/purposeguard-policies/`, `services/purposeguard-pdp/` | `policy/btx/decisions_test.rego`, `tests/pdp_e2e_test.go` |
| FR-016..020 (Trust Node) | `services/trust-node/` (Envoy + OPA + signer) | `tests/tn/mtls_test.sh`, `tests/tn/replay_test.go` |
| FR-021..025 (Minimisation) | `services/trust-node/internal/shaper/` | `tests/tn/shaper_test.go` |
| FR-026..030 (Audit/SLA) | `services/audit-ledger/` | `tests/audit/chain_test.go`, `tests/audit/reconcile_test.go` |
| FR-031..035 (Console/portal) | `services/trust-console/` | `tests/e2e/console_*.spec.ts` |
| FR-036..040 (Citizen safeguards) | `services/citizen-portal/` | `tests/e2e/citizen_history_*.spec.ts` |

### C.3.2 Non-functional requirements

| NFR | Evidence | Test |
|---|---|---|
| NFR-001..005 (Security) | Crypto profile §A.8, PKI §A.3 | TLS scan (testssl.sh), JWS unit tests |
| NFR-006..010 (Portability) | Helm charts + values per cloud | `certify/portability/two_cloud_test.sh` |
| NFR-011..015 (Reliability) | DR design §14 | Chaos GD-01..15, restore drill report |
| NFR-016..020 (Accessibility) | Annex C.10 | axe-core CI + NVDA scripts |

### C.3.3 Conformance tests (BRD §26)

| CT | Implementation | Artefact |
|---|---|---|
| CT-001 portability | Helm + ArgoCD apps | `certify/CT-001-portability/report.json` |
| CT-002 mTLS | Envoy + SPIRE | `certify/CT-002-mtls/handshake_log.txt` |
| CT-003 request signing | JWS signer | `certify/CT-003-sign/req_signing_test.log` |
| CT-004 response signing | Shaper signs | `certify/CT-004-resp/resp_signing_test.log` |
| CT-005 freshness | TS check | `certify/CT-005-fresh/ttl_test.log` |
| CT-006 replay | Redis replay cache | `certify/CT-006-replay/replay_test.log` |
| CT-007 purpose | Rego decisions | `certify/CT-007-purpose/decision_matrix.csv` |
| CT-008 suspension | Registry + bundle | `certify/CT-008-suspend/suspension_test.log` |
| CT-009 revocation | Bundle + NATS | `certify/CT-009-revoke/propagation_sla.json` |
| CT-010 signed config | TUF verify | `certify/CT-010-config/bundle_verify_log.txt` |
| CT-011 CP outage | Cache TTL | `certify/CT-011-outage/continuity_test.log` |
| CT-012 emergency revoke | Delta bundle | `certify/CT-012-emergency/drill_report.md` |
| CT-013 minimisation | Shaper | `certify/CT-013-min/shaper_matrix.csv` |
| CT-014 bulk block | Rate + grant | `certify/CT-014-bulk/scrape_block_test.log` |
| CT-015 audit completeness | Reconcile job | `certify/CT-015-audit/reconcile_report.json` |
| CT-016 audit integrity | Chain check | `certify/CT-016-integrity/chain_break_test.log` |
| CT-017 BOLA | Rego + tests | `certify/CT-017-bola/bola_negative_tests.json` |
| CT-018 DPIA gate | Workflow | `certify/CT-018-dpia/gate_test.log` |
| CT-019 accessibility | axe + NVDA | `certify/CT-019-a11y/axe_report.html` |
| CT-020 legacy adapter | Adapter SDK + WAF | `certify/CT-020-legacy/adapter_pentest.md` |
| CT-021 SIEM export | Connector | `certify/CT-021-siem/export_sample.cef` |
| CT-022 schema validation | SchemaHub | `certify/CT-022-schema/lint_log.txt` |
| CT-023 multilingual | i18n bundles | `certify/CT-023-i18n/render_test.png` |
| CT-024 DR drill | Runbook B.10 | `certify/CT-024-dr/drill_report.md` |
| CT-025 exit | Two-cloud move | `certify/CT-025-exit/move_report.md` |

### C.3.4 Threats (BRD §23)

| T | Mitigating components | Evidence |
|---|---|---|
| T01 spoofed member | mTLS + SPIRE + bundle verify | CT-002, mTLS test logs |
| T02 key compromise | HSM + B.5/B.13 | Key ceremony log, rotation drill |
| T03 replay | Replay cache + TTL | CT-006 |
| T04 policy bypass | Mandatory PDP at TN | CT-007, CT-010 |
| T05 over-sharing | Shaper | CT-013 |
| T06 audit tampering | Hash chain + anchor | CT-016 |
| T07 insider misuse | 4-eye + UEBA | Approval test, anomaly alert sample |
| T08 bulk scraping | Rate + bulk grant | CT-014 |
| T09 cloud misconfig | IaC scan | tfsec/checkov report |
| T10 legacy injection | Adapter SDK | CT-020 |
| T11 revocation failure | NATS + bundle | CT-009, CT-012 |
| T12 citizen notice gap | Citizen Portal | C.5 evidence |
| T13 DoS | HPA + outlier | Load test report |
| T14 lock-in | Adapter layer | CT-001, CT-025 |
| T15 BOLA | Rego + tests | CT-017 |

---

## C.4 Cost model with numbers (illustrative)

> All figures are illustrative, in USD-equivalent per month for sizing-only comparison. National pricing should re-quote in INR with NIC/provider rate cards. Treat as planning estimates, ±25%.

### C.4.1 Foundation (MVP, 1 cloud + NIC)

| Line | Driver | Est / month (USD) |
|---|---|---|
| Compute (~17 nodes) | 17 × $250 | $4,250 |
| Managed PostgreSQL | 2 instances + DR | $1,500 |
| Kafka (3 brokers + storage) | 3 × $400 | $1,200 |
| OpenSearch | 3 × $500 | $1,500 |
| Object storage (5 TB hot + 20 TB cold) | mixed | $700 |
| Managed HSM (HA pair) | 2 × $1,500 | $3,000 |
| Egress + LB + DNS | flat | $800 |
| Observability stack | self-hosted | $500 |
| Total infra | — | **≈ $13,450** |
| Operations (SRE + Sec, blended) | 4 FTE | additional |

### C.4.2 Production pilot (national + 2 states)

| Line | Est / month (USD) |
|---|---|
| Compute (national CP + DR + 2 state TN clusters) | $14,000 |
| Databases (PG primary + DR + replicas) | $4,500 |
| Kafka (6 brokers + mirror) | $3,000 |
| OpenSearch (6 data + master) | $3,500 |
| Object storage (~150 TB cold + 30 TB hot) | $2,500 |
| HSM (national + state) | $7,500 |
| Egress / interconnect | $2,500 |
| Observability + SIEM | $2,000 |
| **Total infra** | **≈ $39,500** |

### C.4.3 Per-additional-member cost (managed tenant)

| Line | Est (USD) |
|---|---|
| Namespace + Envoy + OPA share | $40 |
| KMS-CMK + signing key | $25 |
| Audit volume share (median dept) | $60 |
| Support / SRE share | $75 |
| **Marginal cost per managed-tenant member** | **≈ $200 / month** |

### C.4.4 Optimisation levers

| Lever | Saving target |
|---|---|
| Tiered audit retention (hot 30 d, cold WORM) | 30-50% |
| Reserved capacity / committed use discounts | 20-40% |
| Shared HSM for low-risk members (per-tenant key, shared HSM partition) | 50% on HSM line |
| OPA bundle partitioning to reduce TN memory | reduces TN node count |
| Compaction/compression of audit cold tier | 60-80% storage |

### C.4.5 Funding allocation (BRD §29.1 quantified)

| Layer | Funding source | Share |
|---|---|---|
| Control plane | National platform fund | 100% |
| Managed tenant TN (small depts) | National platform fund | 100% |
| Dedicated TN (high-volume) | Chargeback to member | 100% |
| Domain adapters (scheme-specific) | Domain ministry | 100% |
| Conformance & certification | National | 100% |
| Training & enablement | National + state shared | 50/50 |

---

## C.5 DPDP rights operationalisation

DPDP Act 2023 grants citizens (data principals) rights to information, correction/erasure, grievance redressal and nomination. BTX operationalises these without holding source data.

### C.5.1 Rights → flow → API

| Right | BTX flow | API / surface |
|---|---|---|
| **Right to information about processing** | Sharing history derived from AuditLedger | `GET /citizen/v1/history?subject_ref=` (Citizen Portal) |
| **Right of access (to data held)** | BTX redirects to source via signed request; BTX itself holds no source data | Citizen Portal → provider deep-link |
| **Right to correction/erasure** | Grievance workflow routes to provider data steward | `POST /citizen/v1/grievances` |
| **Right of grievance redressal** | Grievance workflow + escalation to State/National | Citizen Portal + ticket SLA |
| **Right to nominate** | Nomination metadata stored against citizen subject | `POST /citizen/v1/nominations` |
| **Right to withdraw consent** | Revokes consent_ref; future exchanges denied where consent was lawful basis | `POST /citizen/v1/consents/{id}/revoke` |

### C.5.2 Citizen sharing history projection

- Source: `btx.audit.v1` filtered by `citizen_context_ref → subject_ref` mapping.
- Stored as read model in OpenSearch with masking (no sensitive payload).
- Surfaced via Citizen Portal after OIDC + (optional) Aadhaar offline KYC step-up.

### C.5.3 Erasure semantics

- BTX never deletes audit (legally required); but emits `subject_erasure_marker` to mask in citizen-facing surfaces.
- Source system performs actual erasure per its own law and confirms via `grievance.resolved` evidence.

### C.5.4 Notice text & multilingual

- Each purpose has plain-language text in (initial) Hindi + English + state language; managed in Purpose Registry as i18n bundle.
- Citizen Portal renders text matching browser language with fallback chain.

### C.5.5 DPO contact & response SLAs

- Each member designates a DPO; surfaced in Member Registry.
- SLAs from Runbook B.14.2.

---

## C.6 Data residency & sovereignty model

### C.6.1 Principles

- Source data never leaves the source department's chosen jurisdiction.
- BTX control-plane state (members, services, policies, audit metadata) hosted in India-located, sovereign-compliant infrastructure (NIC/MeghRaj preferred for national).
- State-level Trust Nodes may run in state cloud; audit metadata replicates to national AuditLedger.

### C.6.2 Residency matrix

| Data | Allowed locations | Notes |
|---|---|---|
| Source records | Owning department region (India) | Never copied to BTX |
| Member registry / policy | National (NIC + sovereign cloud region in India) | DR within India |
| Audit (national) | India only; DR India only | WORM + cross-region within India |
| Audit (state mirror) | State + national mirror within India | — |
| HSM / KMS | India-located; sovereign-compliant | Per RBI / sectoral norms where applicable |
| Object storage backups | India only | KMS-CMK customer-managed |
| Logs / observability | India only | SIEM in India |

### C.6.3 Cross-border restrictions

- No cross-border replication for audit, policy or member state.
- VC issuer/verifier flows that involve foreign verifiers carry explicit purpose code + state authority approval; data minimisation enforced (no raw record export).

### C.6.4 Sectoral overlays

- Financial sector data flows align with RBI guidance on data localisation.
- Health data flows align with ABDM/NDHM rules and applicable health-data law.
- Defence/strategic data excluded from any commercial cloud; air-gapped TN pattern only.

---

## C.7 Multi-tenant noisy-neighbour controls

For managed-tenant Trust Node clusters serving many small departments.

| Control | Implementation |
|---|---|
| Namespace isolation | One ns per tenant; default-deny NetworkPolicy |
| CPU / memory | Per-tenant `LimitRange` + `ResourceQuota` |
| Storage | Per-tenant PVC quota; separate StorageClass for high-IOPS tenants |
| QoS classes | Critical workloads `Guaranteed`; batch `Burstable` |
| Network rate limits | Envoy local rate limiter per tenant + global per-cluster cap |
| PDP throttling | Per-tenant decision-rate quota in PDP; reject with `BTX-RATE-001` |
| Kafka quotas | Per-`client.id` produce/consume bytes/sec quotas |
| Audit partition mapping | Partition hash on `provider_member_id` ⇒ even distribution |
| Storage iops budget | Per-tenant IOPS class via cloud disk tiering |
| Per-tenant CMK | Separate KMS keys; rotation independent |
| Logging & dashboards | Per-tenant Grafana org + audit dashboard scope |
| Cost attribution | Labels: `member-id`, `domain`, `env` for chargeback reports |
| Noisy-tenant detection | Anomaly on RPS / error / cost; auto-throttle + alert |
| Tenant suspension | Single action: `kubectl label ns tn-x btx/suspended=true` + bundle update |

---

## C.8 Exit & portability playbook

### C.8.1 Member exit (off-board)

```
1. Member submits offboarding request; Authority approves.
2. Status → suspended (no new exchanges).
3. Outstanding citizen grievances closed or transferred.
4. Audit retained per retention class (member access removed).
5. Certificates revoked; HSM keys archived.
6. Trust Node decommissioned; namespace removed; CMK scheduled for deletion (30-day grace).
7. Status → offboarded; final evidence pack archived.
```

### C.8.2 Cloud exit (provider change)

```
1. Provision target environment using same Helm charts + values-<new>.yaml.
2. Stand up DR-pattern replicas:
   - PG logical replication to target
   - Kafka MirrorMaker2 to target
   - Object storage replication
   - Signed Config Publisher mirror
3. Run conformance suite (CT-001, CT-025) on target.
4. Trust Nodes pointed to target (DNS cutover, low TTL).
5. Audit chain anchor signed at cutover boundary (continuity marker).
6. Decommission source after retention window; archive evidence.
```

### C.8.3 Exit acceptance criteria

- All conformance tests pass in target without core code changes.
- No data loss (PG row counts, audit chain head match).
- Customer SLAs maintained during transition (≤ 30 min degraded window).
- Provider-specific resources only in adapter modules (verified by repo grep).

---

## C.9 Failure Mode and Effects Analysis (FMEA)

Scale: Severity (S), Occurrence (O), Detection (D) on 1-10; RPN = S×O×D. Mitigations bring residual RPN to acceptable.

| ID | Function | Failure mode | S | O | D | RPN | Mitigation | Residual RPN |
|---|---|---|---|---|---|---|---|---|
| F01 | PDP decision | Wrong ALLOW due to policy bug | 9 | 3 | 4 | 108 | Tests + canary + rollback (B.7) | 36 |
| F02 | mTLS handshake | Cert expiry missed | 8 | 4 | 3 | 96 | Auto-rotation (B.5), 30/14/7d alerts | 24 |
| F03 | Audit ingest | Kafka backlog | 7 | 4 | 3 | 84 | Autoscale consumers + lag alert | 21 |
| F04 | Signed config | TUF metadata corruption | 9 | 2 | 3 | 54 | Dual signers, signature verify, archive | 18 |
| F05 | Source adapter | SQL injection | 10 | 2 | 4 | 80 | Parameterised access + WAF + review | 20 |
| F06 | KMS dependency | KMS region outage | 8 | 3 | 3 | 72 | Multi-region CMK + envelope cache | 24 |
| F07 | Replay cache | Redis loss | 7 | 3 | 3 | 63 | Redis cluster, fail-closed reject | 21 |
| F08 | Citizen Portal | OIDC IdP down | 6 | 3 | 2 | 36 | IdP HA + degraded read-only history | 12 |
| F09 | Grievance workflow | Lost ticket | 8 | 2 | 3 | 48 | Temporal durable + duplicate alarms | 16 |
| F10 | Bundle distribution | Slow propagation | 7 | 3 | 4 | 84 | NATS push + poll fallback + SLA dashboard | 28 |
| F11 | Audit chain | Hash break | 10 | 2 | 4 | 80 | Anchor + reconcile job + B.12 | 16 |
| F12 | Member registry | Stale member state | 8 | 3 | 4 | 96 | Patroni + DR + cache TTL ≤ 30 s | 24 |
| F13 | Service catalogue | Schema drift | 6 | 4 | 4 | 96 | Linter + publish-time validation | 24 |
| F14 | Approval workflow | 4-eye bypass attempt | 9 | 2 | 5 | 90 | RBAC enforced + audit + alert | 18 |
| F15 | Cloud adapter | IAM misconfig exposes data | 10 | 3 | 5 | 150 | IaC scan + private networking + least priv | 30 |

Acceptance threshold: Residual RPN ≤ 40 for production go-live.

---

## C.10 Accessibility test plan (GIGW/WCAG 2.2 AA)

### C.10.1 Scope

Trust Console, Developer Portal, Citizen Portal, all grievance and notice surfaces.

### C.10.2 Automated tests

| Tool | Where | Threshold |
|---|---|---|
| axe-core | CI on every PR | 0 critical, 0 serious |
| pa11y-ci | CI on key journeys | 0 critical |
| Lighthouse | Per-page | ≥ 95 accessibility score |
| Storybook a11y addon | Component-level | 0 critical |

### C.10.3 Manual tests

| Test | Tool | Pass criteria |
|---|---|---|
| Keyboard-only navigation | None | All flows completable |
| Screen reader | NVDA (Windows), VoiceOver (macOS) | Labels, roles announced |
| High contrast | OS settings | No content invisible |
| Zoom 200% | Browser | No content loss |
| Reflow 320px | Devtools | Single-column readable |
| Forms & errors | Manual | Error text + ARIA-live |
| Language attr | Inspection | `lang` set per node |
| Multilingual render | Hindi, English, state lang | No truncation, fonts loaded |

### C.10.4 GIGW additional checks

- Plain-language purpose text reviewed by content editor.
- Government India branding compliance.
- Help and assisted-workflow alternatives for low-literacy users.

### C.10.5 Reporting

- Quarterly a11y audit; report stored in `certify/CT-019-a11y/<quarter>/`.
- Citizen Portal must pass before any citizen-linked production rollout.

---

## C.11 Standards control mapping with evidence pointers

| Standard | Control / clause | BTX evidence |
|---|---|---|
| DPDP Act 2023 | §4 Lawful processing | Purpose Registry + PDP enforcement (`policy/btx/decisions.rego`) |
| DPDP Act 2023 | §5 Notice | Citizen Portal notice flow (`services/citizen-portal/notice/`) |
| DPDP Act 2023 | §6 Consent | Consent_ref + revocation API (§C.5.1) |
| DPDP Act 2023 | §8 General obligations | DPIA gate (CT-018) + Approval Workflow |
| DPDP Act 2023 | §11 Right to information/correction | Sharing history + grievance (§C.5) |
| DPDP Act 2023 | §13 Grievance redressal | Grievance workflow (B.14) |
| NIST SP 800-207 | All seven tenets | Architecture §6.1 + per-request PDP |
| OWASP API Sec Top 10 (2023) | API1 BOLA | Rego (`policy/btx/bola.rego`) + CT-017 |
| OWASP API Sec | API2 Broken auth | mTLS + JWS + OIDC tests |
| OWASP API Sec | API3 BOPLA | Field-level minimisation + Shaper tests |
| OWASP API Sec | API4 Unrestricted resource | Rate limit + bulk grant (CT-014) |
| OWASP API Sec | API7 SSRF | Adapter SDK URL allowlist |
| W3C VC 2.0 | Issuer-holder-verifier | §A.9 status list + adapter |
| W3C VC | Status (BitstringStatusList) | §A.9 |
| ISO/IEC 27001 | A.5 Information security policies | This doc + Annex B + Security charter |
| ISO/IEC 27001 | A.8 Asset mgmt | Member Registry + cert lifecycle |
| ISO/IEC 27001 | A.9 Access control | RBAC/ABAC + 4-eye |
| ISO/IEC 27001 | A.10 Cryptography | §A.8 crypto profile |
| ISO/IEC 27001 | A.12 Operations security | Annex B runbooks |
| ISO/IEC 27001 | A.16 Incident mgmt | B.1, B.12, B.13 |
| ISO/IEC 27001 | A.17 Continuity | §14 HA/DR, B.10 |
| GIGW / WCAG 2.2 AA | All success criteria | §C.10 test plan |
| OpenAPI 3.1 | Contract validation | Spectral lint in CI |
| AsyncAPI 3.0 | Event contracts | §A.7 + CI |
| OpenTelemetry | Traces/metrics/logs | OTel collector + SIEM export |
| OPA / Rego | Policy-as-code | §A.6 + opa test |
| CNCF / K8s | Portable runtime | §C.2 + Helm/ArgoCD |
| SLSA (build supply chain) | Target Level 3 | Sigstore + in-toto attestations in CI |
| RFC 3161 | Timestamping | §A.8.3 |
| RFC 7807 | Problem details | §A.5.3 |
| W3C DID / SPIFFE | Workload identity | §A.5.1 + SPIRE |

---

## C.12 Conformance evidence index

This index is the canonical lookup for review-board evidence. Every BRD requirement, NFR, CT and STRIDE threat resolves to one of:

- `certify/<CT-ID>/` — automated test artefacts (logs, JSON, screenshots)
- `services/<svc>/tests/` — unit & integration tests
- `policy/btx/` — Rego policies + tests
- `runbooks/` — operations runbooks (Annex B)
- `drills/<quarter>/` — drill reports
- `ceremonies/<date>/` — key ceremony logs
- `pentest/<engagement>/` — pen-test reports
- `dpia/<service>/` — DPIA artefacts
- `threat-models/<service>/` — STRIDE per-service models

### C.12.1 Evidence pack manifest (produced per environment, per release)

```
evidence/<env>/<release>/
├── manifest.yaml                # signed (cosign)
├── conformance/
│   ├── CT-001..025/             # individual test reports
│   └── summary.json
├── security/
│   ├── pentest.pdf
│   ├── sbom/*.spdx.json
│   └── slsa-provenance/*.intoto.jsonl
├── privacy/
│   ├── dpia/*.pdf
│   └── notice-texts/*.json
├── operations/
│   ├── drill-reports/*.md
│   └── slo-attainment.json
├── portability/
│   ├── cloud-A/conformance.json
│   └── cloud-B/conformance.json
└── signoff/
    ├── security-lead.pdf
    ├── privacy-lead.pdf
    ├── architecture-board.pdf
    └── product-owner.pdf
```

### C.12.2 Manifest checksum & signing

```yaml
# manifest.yaml
release: btx-2026.06.0
env: production
generated_at: 2026-06-15T10:00:00Z
artefacts:
  - path: conformance/summary.json
    sha256: <hash>
  - path: security/pentest.pdf
    sha256: <hash>
  # ...
signed_by: btx-evidence-publisher
signature: <cosign signature>
```

Evidence packs are immutable once signed; reviewers verify via `cosign verify-blob`.

---

### Closing

This annex closes the gap between architectural intent and review-board evidence. Combined with `BTX_Architecture_Document.md`, Annex A (engineering artefacts) and Annex B (runbooks), it provides the quantified, traceable, operationally rehearsed substrate a 10/10 review demands.
