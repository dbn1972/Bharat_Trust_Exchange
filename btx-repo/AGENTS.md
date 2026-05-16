# AGENTS.md — How AI coding agents should work in this repo

> Single source of truth for any AI coding agent (Claude Code, GitHub Copilot, Cursor, etc.) operating on the Bharat Trust Exchange (BTX) codebase. Read this before generating, editing, or refactoring code. If anything here conflicts with `CONTRIBUTING.md`, this file wins for agent behaviour; `CONTRIBUTING.md` wins for humans.

## 1. Project intent (one screen)

BTX is a **federated, cloud-agnostic trust fabric** for lawful, auditable government data exchange. The product is described by three documents you must consult before non-trivial work:

- [`../BTX_Architecture_Document.md`](../BTX_Architecture_Document.md) — system architecture
- [`../BTX_Architecture_Annex_A_Engineering.md`](../BTX_Architecture_Annex_A_Engineering.md) — sequence diagrams, ERD, OpenAPI, Rego, crypto profile
- [`../BTX_Architecture_Annex_B_Runbooks.md`](../BTX_Architecture_Annex_B_Runbooks.md), [`Annex C`](../BTX_Architecture_Annex_C_Evidence.md)

Authoritative requirements are in `Bharat_Trust_Exchange_BTX_10_of_10_Review_BRD.docx`. If something contradicts the BRD, raise it as an ADR rather than silently coding around it.

**Non-negotiable invariants (never violate without a new ADR):**

1. **No source citizen data stored in BTX.** BTX holds metadata, audit, references, signed assertions — never raw records.
2. **No cloud-specific business logic.** Cloud APIs (KMS, IAM, S3, etc.) appear only behind adapter interfaces in `services/*/internal/adapter/`.
3. **Every exchange is signed, timestamped, replay-protected, mTLS-authenticated, policy-decided and audited.** No exception paths.
4. **Provider-side minimisation by policy.** No service returns more than the obligations say.
5. **Policy-as-code, not policy-in-code.** Authorisation rules live in `policy/btx/*.rego`, never hardcoded in Go/Java.
6. **Audit is append-only and tamper-evident.** Never edit audit events; chain breaks are SEV-1.

## 2. Repository layout

```
btx-repo/
├── AGENTS.md                    # this file
├── CLAUDE.md                    # Claude-Code-specific notes (subset)
├── CONTRIBUTING.md              # human contributor rules
├── .github/
│   ├── CODEOWNERS
│   └── workflows/               # CI pipelines
├── docs/
│   ├── architecture/INDEX.md    # map of all architecture docs
│   ├── adr/                     # architecture decision records
│   ├── agent/                   # agent skills, prompts, anti-patterns
│   ├── templates/               # tech-spec, DPIA, threat-model, runbook, RFC
│   ├── test-strategy.md
│   └── security/secure-sdlc.md
├── services/                    # one directory per microservice
│   ├── member-registry/
│   ├── service-catalogue/
│   ├── purpose-registry/
│   ├── purposeguard-pdp/
│   ├── schemahub/
│   ├── approval-workflow/
│   ├── signed-config-publisher/
│   ├── audit-ledger/
│   ├── trust-node/
│   ├── trust-console/
│   ├── citizen-portal/
│   └── developer-portal/
├── policy/btx/                  # Rego policies + tests
├── connectors/                  # legacy / source-system adapters
├── platform/                    # K8s base, mesh, OPA, OTel, Vault
├── infrastructure/              # OpenTofu modules per cloud
├── certify/                     # conformance suite (CT-001..025)
└── deploy/                      # ArgoCD app-of-apps, env values
```

Per-service layout:

```
services/<name>/
├── README.md                    # tech spec for this service
├── api/openapi.yaml             # or asyncapi.yaml
├── cmd/                         # entrypoints
├── internal/
│   ├── domain/                  # business logic (pure)
│   ├── adapter/                 # cloud / db / external IO
│   └── transport/               # HTTP, gRPC, Kafka handlers
├── tests/
│   ├── unit/
│   ├── integration/
│   └── contract/
├── deploy/                      # Helm chart
└── CHANGELOG.md
```

## 3. Language and style rules

| Language | Use | Style |
|---|---|---|
| Go 1.22+ | Data-plane services (Trust Node, PDP, audit), connectors | `gofmt`, `golangci-lint` (config in repo), small interfaces at consumer side |
| Java 21 / Spring Boot 3 | Control-plane services (registry, catalogue, approval) | `google-java-format`, Spotless |
| TypeScript / React | Portals | `eslint`, `prettier`, strict mode on |
| Rego | Policies | `opa fmt`, `regal` |
| Python | Build/utility scripts only | `ruff` |

**Universal rules**

- No `panic`, `os.Exit`, `System.exit` outside `main`.
- No `TODO` without a tracking ticket reference (`// TODO(BTX-1234): …`).
- No `time.Now()` directly in domain code — inject a clock.
- No randomness without a seeded source you can test.
- No silent errors; wrap with context (`fmt.Errorf("…: %w", err)`).
- No new dependency without updating `docs/security/dependency-policy.md` and the SBOM in CI.
- Files ≤ 500 lines; functions ≤ 60 lines (guidance, not absolute).
- One package = one responsibility.

## 4. What agents should do by default

When asked to perform a task, follow this loop:

1. **Read first.** Open `docs/architecture/INDEX.md` and the relevant service `README.md`. If an ADR governs the area, read it.
2. **Plan briefly.** State the change, files touched, tests added/changed. Use the todo list tool for ≥3-step work.
3. **Implement.** Smallest correct change. Prefer editing over creating.
4. **Test.** Add or update tests. Run them locally where possible.
5. **Update docs.** If you change a contract (OpenAPI/AsyncAPI/Rego), update the corresponding doc and CHANGELOG.
6. **Open a focused PR.** One concern per PR. Title prefix `[svc-name]`. Link the issue / ADR.
7. **Self-review.** Run linters; check for invariants in §1; check error paths and tests.

## 5. What agents must never do

- ❌ Add cloud-specific SDK calls outside `internal/adapter/`.
- ❌ Generate code that persists source-system records inside BTX.
- ❌ Add a new endpoint without OpenAPI + auth + audit emission.
- ❌ Write policy logic in Go/Java that should be in Rego.
- ❌ Skip mTLS, signing, timestamping or replay protection on a Trust Node path.
- ❌ Edit `policy/btx/*.rego` without adding a unit test.
- ❌ Touch audit-event schemas without bumping `schema_version` and proposing an ADR.
- ❌ Add `--no-verify`, disable signature checks, or weaken TLS to "make it work".
- ❌ Use `latest` image tags or unpinned dependency versions.
- ❌ Commit secrets, even test secrets (use Vault / SealedSecrets).
- ❌ Generate fake or extrapolated citizen data; always use the synthetic test fixtures in `tests/fixtures/`.

See [`docs/agent/anti-patterns.md`](docs/agent/anti-patterns.md) for the full list with examples.

## 6. Commands the agent can run

```bash
# bootstrap
make setup                    # install toolchain, pre-commit, opa, etc.

# day-to-day
make lint                     # all linters
make test                     # unit + integration
make policy-test              # opa test policy/...
make contract-test            # OpenAPI/AsyncAPI linting + schema diff
make security                 # SAST, dep-scan, sbom, image-scan
make build                    # build all services
make local-up                 # docker-compose / kind cluster

# per-service
cd services/<name> && make test
```

CI mirrors these targets. Do not bypass CI gates; if a gate is broken, fix the gate.

## 7. Golden paths

Common recipes live in [`docs/agent/golden-paths.md`](docs/agent/golden-paths.md). When asked to do one of these, follow the recipe verbatim:

- Add a new control-plane API
- Add a new Rego policy
- Add a new connector / adapter
- Add a new audit event field (with schema versioning)
- Add a new conformance test
- Author or update an ADR
- Author or update a tech spec
- File a DPIA / Threat model for a new service

## 8. Reviewers and ownership

`CODEOWNERS` is enforced. Examples:

- `policy/` → @security-lead @privacy-lead (2 approvals)
- `services/audit-ledger/` → @security-lead
- `services/trust-node/` → @platform-lead @security-lead
- `docs/adr/` → @chief-architect
- `infrastructure/` and `platform/` → @platform-lead @security-lead

If your PR touches multiple owned areas, expect multiple required reviewers.

## 9. PR etiquette for agents

- Title: `[svc] short imperative summary`
- Body sections: **What**, **Why**, **How tested**, **Risks**, **Rollback**, **Linked issue/ADR**.
- Include a checklist: tests added, docs updated, OpenAPI/AsyncAPI/Rego updated, CHANGELOG entry, secrets-clean.
- If you altered architecture, link or create the ADR.
- If you generated significant code, say so in the PR body — humans will review it more carefully.

## 10. When to stop and ask

Stop and ask the user (or open an issue) when:

- The change requires a new external dependency, cloud service, or open port.
- The change touches a core invariant in §1.
- A test asks you to disable a security control.
- You cannot make a test pass without changing audit / policy / crypto behaviour.
- Acceptance criteria are ambiguous and the BRD/Arch docs don't clarify.

Do not "make it green" by lowering the bar. Raise the question.

---

*This file is read first by every agent on every task. Keep it short, opinionated and authoritative.*
