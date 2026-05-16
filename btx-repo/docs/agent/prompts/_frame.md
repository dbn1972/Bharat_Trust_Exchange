# Prompt Frame (shared)

> Conventions, schema and self-score rubric that every BTX prompt in this folder honours. Read this once; each prompt then carries only its specific YAML + worked example + self-score block.

## 1. Front-matter schema (YAML at top of every prompt)

```yaml
---
id: P-NN                            # unique, immutable
version: x.y.z                      # semver; bump on any schema change
last_reviewed: YYYY-MM-DD
owner: "@github-handle"
model_compat:                       # tested compatibility
  - claude-sonnet-4.x
  - claude-opus-4.x
inputs:                             # required input keys (placeholders the user must fill)
  - name: SERVICE_NAME
    type: string
    required: true
forbidden_paths:                    # the agent MUST NOT touch these
  - ".github/CODEOWNERS"
  - "docs/adr/0000-template.md"
expected_outputs:                   # what a successful run produces
  - kind: pr
    title_pattern: "[svc] bootstrap service"
  - kind: files_created
    glob: "services/<SERVICE_NAME>/**"
context_budget:
  read_in_full: [AGENTS.md, CLAUDE.md]
  skim:        ["docs/architecture/INDEX.md"]
  grep_only:   ["services/**"]
executable_acceptance:              # commands the agent runs; CI re-runs them too
  - name: lint
    cmd: "make lint"
    pass_when: "exit_code == 0"
  - name: unit-coverage
    cmd: "make test"
    pass_when: "coverage_pct >= 80"
halt_conditions:                    # agent must STOP and escalate
  - "policy/btx/decisions.rego and services/trust-node/internal/signer/** touched in same PR"
  - "any forbidden_path modified"
escalation:
  to: "@chief-architect"
  channel: "#btx-arch"
graph:
  upstream: ["P-09", "P-10"]        # prompts that may need to run first
  downstream: ["P-08", "P-12"]      # prompts typically chained after
telemetry:                          # the agent emits this run-record at the end
  emit_file: ".btx/prompt-runs/<run_id>.json"
---
```

## 2. Required body sections (in order)

1. **Read first** — pointers to design sources (no copying; the agent fetches them).
2. **Inputs** — same fields as YAML but human-friendly table.
3. **Execute** — numbered steps; each step ends in a verifiable artefact.
4. **Hard rules** — non-negotiable invariants.
5. **Acceptance** — the same checks as `executable_acceptance` but human-readable.
6. **Worked example** — link to `_examples/<id>.md`.
7. **Self-score** — link to the rubric below; the agent **must** emit a score block.

## 3. Self-score rubric (the agent emits this before opening any PR)

Score each axis 0–10. **If any axis < 8, the agent must NOT open the PR**; instead it posts the scores, the blockers, and a remediation plan.

```yaml
self_score:
  prompt_id: P-NN
  run_id: <uuid>
  scores:
    architectural_conformance: 0-10   # respects ADRs / hexagonal / federation
    security_invariants:       0-10   # mTLS, signing, replay, PDP, audit
    privacy_invariants:        0-10   # DPIA, minimisation, retention, no PII in logs
    audit_completeness:        0-10   # schema-valid events on every path
    test_evidence:             0-10   # unit + integration + negative + contract
    performance_budget:        0-10   # within hop budgets / SLO
    operability:               0-10   # telemetry + runbook + helm
    documentation:             0-10   # spec, CHANGELOG, ADR if needed
    portability:               0-10   # no cloud SDK leakage
    review_readiness:          0-10   # diff size, atomic, codeowners
  overall: 0-10
  blockers: [ "..." ]                  # empty if all axes >= 8
  evidence_refs: [ "..." ]             # paths to logs, junit, opa cov, cosign etc.
```

## 4. Executable acceptance — common command catalogue

Use these where they apply. Agent substitutes paths.

| Check | Command | Pass when |
|---|---|---|
| Lint Go / Java / TS | `make lint` | exit 0 |
| Unit + coverage | `make test` then `tools/cov-gate <pct>` | `pct >= threshold` |
| OpenAPI lint | `spectral lint services/<svc>/api/openapi.yaml` | exit 0 |
| OpenAPI breaking change | `oasdiff breaking <base> <head>` | no `breaking` lines |
| Rego tests | `opa test policy/ -c -v` | exit 0, cov ≥ 80% |
| Rego lint | `regal lint policy/` | exit 0 |
| Contract tests | `make contract-test` | exit 0 |
| Integration | `make integration` | exit 0 |
| Conformance subset | `make certify CT=<id>` | exit 0 |
| SBOM | `syft packages dir:. -o spdx-json=sbom.json` | file exists |
| Image sign | `cosign sign --yes <image>` | exit 0 |
| Image verify | `cosign verify --certificate-identity=... <image>` | exit 0 |
| IaC scan | `tfsec infrastructure/` | 0 high |
| Secret scan | `gitleaks detect --redact` | 0 findings |
| Perf regression | `k6 run --thresholds tests/perf/<svc>.thresholds.json` | all green |

## 5. Halt conditions (apply to every prompt)

The agent must STOP and escalate if any of the following hold:

1. A `forbidden_paths` glob would be touched.
2. The change requires deviating from an accepted ADR with no superseding ADR drafted.
3. Personal data flow exists without an approved DPIA.
4. A security / privacy / audit invariant would regress.
5. The diff exceeds 1500 LOC across more than 8 files (split into atomic PRs).
6. CI cannot run hermetically (external network beyond testcontainers).
7. The agent cannot satisfy any axis of the self-score at ≥ 8 after two attempts.

On halt: post the scores, blockers, the smallest next decision needed, and `@`-mention the prompt's `escalation.to`.

## 6. Anti-patterns (always inlined as few-shot)

Every example file (`_examples/<id>.md`) includes at least one **wrong vs right** mini-diff. Generic ones common to many prompts:

**Auth in handler (wrong)**
```go
if user.Role != "admin" { return 403 }
```
**Right** — delegate to PurposeGuard (`POST /v1/decisions`) and use returned obligations.

**Time in domain (wrong)**
```go
expires := time.Now().Add(10 * time.Minute)
```
**Right** — inject `clock.Clock` and call `c.Now()`.

**Audit body leak (wrong)**
```go
audit.Emit(ev.WithPayload(req.Body))
```
**Right** — emit only `txn_id`, IDs, hashes (`sha256:…`), decision and obligations.

## 7. Prompt-runs (telemetry)

Every successful execution writes a JSON record under `.btx/prompt-runs/<run_id>.json`:

```json
{
  "run_id": "...",
  "prompt_id": "P-01",
  "version": "1.0.0",
  "started": "2026-05-16T09:12:00Z",
  "finished": "2026-05-16T09:48:00Z",
  "inputs": { "SERVICE_NAME": "consent-registry" },
  "pr_url": "https://...",
  "self_score": { ... },
  "evidence_refs": [ "evidence/.../junit.xml", "..." ]
}
```

These are scraped weekly to track prompt effectiveness (PR-revert rate, time-to-merge, blocker rate).

## 8. Versioning & deprecation

- Bump `version` (semver) on any schema change.
- Mark a prompt `status: deprecated` in the front-matter; keep the file; point to its successor.
- The linter (`tools/prompt-lint.py`) fails CI if a prompt references a deprecated successor or breaks the schema.
