---
id: P-01
version: 1.0.0
last_reviewed: 2026-05-16
owner: "@chief-architect"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SERVICE_NAME, type: kebab-case, required: true }
  - { name: RESPONSIBILITY, type: sentence, required: true }
  - { name: DOMAIN, type: "enum[control-plane|data-plane|platform]", required: true }
  - { name: LANGUAGE, type: "enum[ts]", required: true }   # locked to TypeScript+Fastify per ADR-0020; deviation requires a superseding ADR
  - { name: FR_IDS, type: list, required: true }
  - { name: ADR_IDS, type: list, required: false }
  - { name: DATA_CLASS, type: "enum[open|operational|citizen_portable|restricted|non_shareable]", required: true }
  - { name: PII, type: bool, required: true }
forbidden_paths: [".github/CODEOWNERS", "docs/adr/0000-template.md", "policy/btx/decisions.rego"]
expected_outputs:
  - { kind: pr, title_pattern: "[<SERVICE_NAME>] bootstrap service" }
  - { kind: files_created, glob: "services/<SERVICE_NAME>/**" }
  - { kind: files_created, glob: "deploy/helm/<SERVICE_NAME>/**" }
context_budget:
  read_in_full: [AGENTS.md, CLAUDE.md, "docs/agent/golden-paths.md", "docs/agent/anti-patterns.md", "docs/templates/tech-spec-template.md"]
  skim: ["docs/architecture/INDEX.md", "BTX_Architecture_Document.md"]
executable_acceptance:
  - { name: lint, cmd: "make lint", pass_when: "exit 0" }
  - { name: unit-cov, cmd: "make test && tools/cov-gate 80", pass_when: "exit 0" }
  - { name: openapi-lint, cmd: "spectral lint services/<SERVICE_NAME>/api/openapi.yaml", pass_when: "exit 0" }
  - { name: schema-validation, cmd: "tools/check-fastify-schemas services/<SERVICE_NAME>", pass_when: "every route has request+response JSON Schema; OpenAPI generated from schemas" }
  - { name: outbox-present, cmd: "tools/check-outbox services/<SERVICE_NAME>", pass_when: "every Kafka publish paired with an outbox row in the same DB tx" }
  - { name: pgbouncer-compat, cmd: "tools/check-pgbouncer-compat services/<SERVICE_NAME>", pass_when: "no SET LOCAL spanning statements; no session-mode-only features; parameterised queries only" }
  - { name: idempotency-key, cmd: "tools/check-idempotency services/<SERVICE_NAME>", pass_when: "every state-changing endpoint reads Idempotency-Key and stores it in Redis" }
  - { name: otel-wired, cmd: "tools/check-otel services/<SERVICE_NAME>", pass_when: "@fastify/otel registered; Kafka producer/consumer propagate trace headers" }
  - { name: kms-via-adapter, cmd: "tools/check-kms-adapter services/<SERVICE_NAME>", pass_when: "no direct cloud-SDK crypto calls; KMS used via pkg/adapter/kms only" }
  - { name: integration, cmd: "make integration SVC=<SERVICE_NAME>", pass_when: "exit 0" }
  - { name: helm-render, cmd: "for c in aws azure gcp onprem; do helm template deploy/helm/<SERVICE_NAME> -f deploy/values-$c.yaml > /dev/null; done", pass_when: "exit 0" }
  - { name: sbom, cmd: "syft dir:services/<SERVICE_NAME> -o spdx-json=sbom.json", pass_when: "file:sbom.json" }
halt_conditions:
  - "PII=true and dpia/<SERVICE_NAME>.md missing or not approved"
  - "DOMAIN=data-plane (use P-03)"
  - "diff > 1500 LOC or > 8 files"
escalation: { to: "@chief-architect", channel: "#btx-arch" }
graph: { upstream: [P-09, P-10], downstream: [P-02, P-06, P-07, P-08, P-12, P-19] }
---

# P-01 — Bootstrap a new BTX service

> Use when creating a brand-new service under `services/<svc>/`.

---

You are Claude Code working in the **Bharat Trust Exchange (BTX)** repository. Your job is to scaffold a new service named `<<SERVICE_NAME>>` exactly as the BTX architecture mandates. **Do not invent architecture.** If you are tempted to deviate, stop and open an ADR using [`docs/templates/adr-template.md`](../../templates/adr-template.md) first.

## 0. Read these before writing any code

- [`AGENTS.md`](../../../AGENTS.md) (non-negotiables, repo layout, language rules)
- [`CLAUDE.md`](../../../CLAUDE.md) (Claude-specific addendum)
- [`docs/agent/golden-paths.md`](../golden-paths.md) §1 (new service path)
- [`docs/agent/anti-patterns.md`](../anti-patterns.md) (the things you must not do)
- [`docs/architecture/INDEX.md`](../../architecture/INDEX.md) (links to the architecture corpus)
- The Architecture Document: §4 (Components), §5 (Data classes), §6 (Security), §8 (Policy), §9 (Audit), §13 (Performance)
- Annex A §A.4 (ERD/DDL), §A.5 (wire contract + errors), §A.6 (policy rules), §A.7 (audit topics)
- [ADR-0020 — BTX hot-path stack v1](../../adr/0020-btx-hot-path-stack-v1.md) (locked stack)
- `docs/templates/tech-spec-template.md`

## 1. Inputs

| Input | Value |
|---|---|
| Service name (kebab) | `<<SERVICE_NAME>>` |
| Service responsibility (1 sentence) | `<<RESPONSIBILITY>>` |
| Domain | control-plane \| data-plane \| platform |
| Primary language | **TypeScript 20 + Fastify** (locked v1 per ADR-0020) |
| BRD requirements | `<<FR_IDS>>` |
| ADRs that apply | `<<ADR_IDS>>` (default: 002, 003, 004, 005, 008, 011, 013, 014, 016, 017) |
| Data class touched | `open | operational | citizen_portable | restricted | non_shareable` |
| Personal data? | yes / no (if yes, DPIA required) |

## 2. Plan, then execute

Produce a short numbered plan first. After human/agent approval, execute the steps in this order:

1. Create `services/<<SERVICE_NAME>>/` with the **hexagonal** layout (`src/domain/`, `src/adapter/{http,db,kafka,kms,redis,...}`, `src/transport/`, `src/server.ts`, `api/`, `migrations/`, `Dockerfile`, `Makefile`, `package.json`, `tsconfig.json`). TypeScript + Fastify per ADR-0020.
2. Write the **tech spec** at `services/<<SERVICE_NAME>>/README.md` using `docs/templates/tech-spec-template.md`. Fill every field; mark unknowns as `TBD`.
3. Define **JSON Schemas** for every request and response under `services/<<SERVICE_NAME>>/api/schemas/` and attach them to Fastify routes via `schema:`. Generate `api/openapi.yaml` from the schemas; run `spectral lint`. If the service emits/consumes events, define event schemas under `api/schemas/events/` and publish them in `api/asyncapi.yaml`.
4. Stand up the **domain layer** with pure functions, an injected `Clock`/`IdGen`, and a typed error model that maps to `BTX-…` codes (Annex A §A.5.4).
5. Stand up the **HTTP transport** (Fastify route handlers + DTOs validated by JSON Schema). Handlers are thin: parse → call domain → serialise. Every state-changing route reads `Idempotency-Key` (stored in Redis 24 h).
6. Add **persistence**: PostgreSQL 16 reached **via PgBouncer (transaction mode)**. Parameterised queries only. Flyway/node-pg-migrate migrations in `migrations/`. No `SET LOCAL` spanning statements; no session-mode-only features.
7. Add the **outbox**: every Kafka publish writes an `outbox` row in the same DB transaction; a relay polls and publishes to Kafka with `acks=all`, idempotent producer, and a DLQ topic. Trace headers propagate.
8. Wire **identity**: mTLS via Cloud-KMS-rooted internal CA (issued via `pkg/adapter/kms`). No long-lived service tokens.
9. Wire **policy**: register `@btx/policy` Fastify plugin; every data-bearing route declares its rule id; fail closed on policy errors. Rule bundle signed by Cloud KMS and loaded from object storage.
10. Wire **audit emission** to `btx.audit.v1`: append-only row in `audit_events` + outbox row in the same tx. Schema-validate the event.
11. Wire **telemetry**: register `@fastify/otel`; Prometheus metrics (`btx_<svc>_…`); structured JSON logs with `trace_id`/`txn_id`/`member_id`. No PII in logs/metrics/attributes. Trace headers propagate through Kafka producer + consumer.
12. Wire **cache**: Redis client with single-flight on every hot key; negative caching where appropriate; cache invalidation tied to writes.
13. Add **tests**: unit (≥ 80% statements), integration with testcontainers (Postgres + PgBouncer + Kafka + Redis), contract (OpenAPI/AsyncAPI via Schemathesis), at least one negative test per error code, and a fail-closed test for the policy plugin.

14. Add **Helm chart** under `deploy/helm/<<SERVICE_NAME>>/` with values per cloud (`values-aws.yaml`, `values-azure.yaml`, `values-gcp.yaml`, `values-onprem.yaml`). PgBouncer, Redis and Kafka coordinates parameterised per cloud.
15. Add **CODEOWNERS** entry for the new path.
16. Update [`docs/architecture/INDEX.md`](../../architecture/INDEX.md) to list the new service.
17. If the service is the first of its kind or changes a contract, **open an ADR** using the template.
18. Run the local CI bundle: `make lint test contract-test policy-test sbom image-scan`.

## 3. Hard rules

- **Stack is locked** per [ADR-0020](../../adr/0020-btx-hot-path-stack-v1.md): TypeScript + Fastify + Postgres (via PgBouncer) + Kafka + Redis + Cloud KMS + REST/JSON. Any deviation requires a superseding ADR.
- No direct cloud SDK calls in `src/domain/` or `src/transport/`. All cloud-specific access goes through `pkg/adapter/` (KMS, objectstore, secret, log).
- No authorisation logic in handlers. Call the `@btx/policy` plugin. Fail closed.
- No `Date.now()`, `Math.random()` or `os.hostname()` in domain code. Inject `Clock` / `IdGen` / `Hostname`.
- No PII in logs, metrics, traces, error messages.
- No string concatenation for SQL / shell / URLs. Parameterised queries only.
- No Kafka publish without an outbox row in the same DB transaction.
- No state-changing endpoint without an `Idempotency-Key` contract.
- No new dependency without updating `docs/security/dependency-policy.md` (or referencing an existing entry).
- No second runtime (no Go / Java / Rust / Python services) in v1.

## 4. Outputs

- A single PR, atomic, with the title `[<<SERVICE_NAME>>] bootstrap service`.
- PR description must include:
  - BRD/FR/ADR references
  - List of new endpoints / topics
  - Test summary (counts, coverage)
  - Risks (and mitigations)
  - Manual verification steps
- CHANGELOG entry under `services/<<SERVICE_NAME>>/CHANGELOG.md`.

## 5. Acceptance (self-check before opening the PR)

- [ ] Layout matches hexagonal pattern; no business logic in `src/server.ts` or `src/transport/`.
- [ ] Tech spec complete (`README.md`) with all template sections.
- [ ] OpenAPI generated from JSON Schemas; `spectral` and `oasdiff` clean.
- [ ] Fastify routes all carry `schema:` (request + response); `tools/check-fastify-schemas` exit 0.
- [ ] Policy plugin wired for every data-bearing endpoint; fail-closed verified by a test.
- [ ] Audit event emitted on every state change; schema-validated; outbox row paired in same tx.
- [ ] `tools/check-outbox`, `tools/check-pgbouncer-compat`, `tools/check-idempotency`, `tools/check-otel`, `tools/check-kms-adapter` all exit 0.
- [ ] mTLS via Cloud-KMS-rooted internal CA; no static service tokens.
- [ ] Telemetry present; dashboards stub added in `observability/`.
- [ ] Unit coverage ≥ 80% statements (≥ 90% on policy/crypto/audit code paths).
- [ ] Integration tests run hermetically with testcontainers (Postgres + PgBouncer + Kafka + Redis).
- [ ] Helm chart renders for all 4 cloud overlays.
- [ ] SBOM generated; image signed (cosign) in CI.
- [ ] CODEOWNERS updated; doc index updated.
- [ ] No anti-patterns from `docs/agent/anti-patterns.md` introduced.
- [ ] No new runtime introduced (TypeScript only). If any architectural deviation from ADR-0020: ADR drafted and linked in PR.

## 5. Worked example

See [`_examples/p01.md`](./_examples/p01.md) — fully filled invocation, wrong-vs-right diffs, and executable acceptance commands with thresholds.

## 6. Self-score

Before opening the PR, emit a `self_score` block per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json` and post it as the first PR comment. **Refuse to open the PR if any axis < 8.** Halt and escalate per the front-matter `halt_conditions` and `escalation`.
