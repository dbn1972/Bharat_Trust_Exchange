---
id: P-31
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@platform"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: AUDIT_ID,  type: "pattern[SCL-\\d{4}-\\d{2}-\\d{2}]", required: true }
  - { name: SCOPE,     type: "enum[control-plane|trust-node|connector|federation|all]", required: true }
  - { name: TARGET,    type: "object", required: true }   # { users, tps, p95_ms, regions }
forbidden_paths: []
expected_outputs:
  - { kind: file_created, path: "audits/<AUDIT_ID>/scalability.md" }
  - { kind: file_created, path: "audits/<AUDIT_ID>/violations.yaml" }
  - { kind: file_created, path: "audits/<AUDIT_ID>/load-test-plan.md" }
  - { kind: file_created, path: "evidence/audits/<AUDIT_ID>.tar.gz" }
context_budget:
  read_in_full: ["docs/architecture/overview.md", "docs/runbooks/capacity.md", "docs/agent/prompts/p15-perf-capacity.prompt.md"]
  skim: ["services/**", "infra/**", "observability/**"]
executable_acceptance:
  - { name: cache-first-reads,  cmd: "tools/cache-first-check services/", pass_when: "every read path: cache-hit → fallback DB → repopulate; stampede protection; negative caching where applicable" }
  - { name: queue-first-writes, cmd: "tools/queue-first-check services/", pass_when: "every write path durable-queue-first; idempotent; DLQ + backoff defined" }
  - { name: observability,      cmd: "tools/observability-check observability/", pass_when: "cache hit/miss/latency, queue depth/lag, DLQ count, p50/p95/p99 API latency, saturation, error-budget — all wired" }
  - { name: backpressure,       cmd: "tools/backpressure-check services/", pass_when: "rate limits + circuit breakers + graceful degradation paths exist for every external dependency" }
  - { name: multi-region,       cmd: "tools/multi-region-check infra/", pass_when: "stateless services replicate; stateful services have documented RPO/RTO; cross-region failover playbook" }
  - { name: load-plan-shape,    cmd: "tools/load-plan-check audits/<AUDIT_ID>/load-test-plan.md", pass_when: "ramp + steady + spike + soak phases; target TPS = TARGET.tps; SLO assertions" }
  - { name: violations-shape,   cmd: "tools/violations-yaml-check audits/<AUDIT_ID>/violations.yaml", pass_when: "each: pattern, file, severity, fix_plan, owner, eta" }
  - { name: evidence-pack,      cmd: "cosign verify-blob --signature evidence/audits/<AUDIT_ID>.tar.gz.sig evidence/audits/<AUDIT_ID>.tar.gz", pass_when: "exit 0" }
halt_conditions:
  - "direct-to-DB write on a hot path with no queue (unless ADR-justified)"
  - "cache miss path that can stampede the DB"
  - "no DLQ / no idempotency on a money / consent / audit path"
  - "missing observability for a hot path"
escalation: { to: "@platform, @architect, @sre-lead", channel: "#btx-platform" }
graph: { upstream: [P-27], downstream: [P-28, P-15] }
---

# P-31 — Scalability fitness audit

> Audits the codebase, infra, and admin surface for **cache-first reads, queue-first writes, observability, and graceful degradation**. Output: violations register + load-test plan + verdict against TARGET.

## 0. Read first

- [docs/architecture/overview.md](../../architecture/overview.md)
- [P-15 perf & capacity](./p15-perf-capacity.prompt.md)
- [docs/runbooks/capacity.md](../../runbooks/capacity.md)

## 1. Inputs

```yaml
AUDIT_ID: SCL-2026-05-16
SCOPE: control-plane
TARGET:
  users: 10_000_000
  tps:   1_000
  p95_ms: 250
  regions: 2
```

## 2. Plan, then execute

1. **Read scalability** — every read path must consult cache first; cache miss falls back to DB **safely** (rate-limited, single-flight to prevent stampede), then repopulates; negative caching where appropriate; graceful degradation on cache outage; hot-key handling. Direct DB reads are scalability violations unless ADR-justified.
2. **Write scalability** — every write path goes through a **durable** queue; messages idempotent; DLQ + backoff + poison handling; ordering documented; consumers horizontally scalable; cache invalidation tied to write.
3. **Cache observability** — hit / miss / latency / error / eviction / hot-keys / fallback-to-DB count / repopulation failures.
4. **Queue observability** — depth / lag / oldest-message-age / consumer rate / error / retry / DLQ count / dup / poison / backpressure.
5. **API observability** — p50/p95/p99 latency, error rate, saturation, error-budget burn (per P-15).
6. **Backpressure + degradation** — rate limits, circuit breakers, graceful fallback for every external dep (cloud adapter, connector, registry, signer).
7. **Multi-region** — stateless replicated; stateful with documented RPO/RTO; failover playbook in `docs/runbooks/`.
8. **Admin surface** — operators can view cache/queue health, pause/resume consumers, view DLQ, retry DLQ, tune TTL (with warnings before dangerous changes).
9. **Load-test plan** — ramp + steady + spike + soak phases; assert SLOs from TARGET.
10. **Violations register** — every direct-DB write/read, missing DLQ, missing observability — `violations.yaml`.
11. **Verdict** — meets-target / partial / not-ready; sign evidence pack.

## 3. Hard rules

- **Direct DB writes on hot paths are violations** unless ADR-justified (e.g., strong-consistency requirement).
- **Cache miss must never stampede the DB.** Single-flight, request coalescing, negative caching where appropriate.
- **Consent / audit / money paths require idempotency + DLQ.** Non-negotiable.
- **No observability ⇒ scalability claim is unfounded.** A hot path with no metrics is automatically a violation.
- **Multi-region without documented RPO/RTO is a violation** for TARGET.regions ≥ 2.

## 4. Acceptance

- [ ] All `tools/*-check` exit 0.
- [ ] Load-test plan executed; results attached to evidence pack; SLOs from TARGET met.
- [ ] Violations register has owner + ETA per row.
- [ ] Admin surface gaps listed.
- [ ] Verdict recorded.
- [ ] CODEOWNERS: `@platform`, `@architect`, `@sre-lead`.

## 5. Worked example

See [`_examples/p31.md`](./_examples/p31.md).

## 6. Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and attach to the evidence pack. **Do not close the audit if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
