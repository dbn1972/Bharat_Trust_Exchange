# Contributing to BTX

> Rules for humans. Agents follow [`AGENTS.md`](AGENTS.md), which is stricter in places. If they conflict for a human contributor, follow this file.

## Before you start

1. Read [`docs/architecture/INDEX.md`](docs/architecture/INDEX.md).
2. Open or claim an issue. Don't start large work without an issue or RFC.
3. For architectural change, open an ADR first (template: `docs/adr/0000-template.md`).

## Branch and commit model

- Trunk-based development on `main`. Short-lived feature branches.
- Branch name: `feat/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`, `docs/<short-slug>`.
- Commit message: [Conventional Commits](https://www.conventionalcommits.org/).
  - `feat(member-registry): add suspension webhook`
  - `fix(trust-node): reject expired bundle`
  - `chore(deps): bump opa to v0.65`
  - Use `BREAKING CHANGE:` footer for any incompatible change.
- Sign commits (`git commit -S`). Unsigned commits fail CI.

## Pull-request rules

- One concern per PR. Small PRs review fast.
- PR template required. Include:
  - **What** changed
  - **Why** (link to issue / ADR)
  - **How tested** (commands, screenshots)
  - **Risks** and **Rollback** plan
  - Checklist (tests, docs, OpenAPI/AsyncAPI/Rego, CHANGELOG, secrets-clean)
- All CI checks must pass. Don't bypass with `--no-verify` or `[skip ci]`.
- Get the reviewers `CODEOWNERS` demands. Some paths need security + privacy approvals.

## Code quality gates (enforced in CI)

- `make lint` — formatters and linters across all languages
- `make test` — unit + integration tests
- `make policy-test` — `opa test`, `regal lint`
- `make contract-test` — OpenAPI/AsyncAPI lint + breaking-change diff
- `make security` — SAST (semgrep), dependency scan (Trivy/Grype), SBOM (Syft), image scan
- Coverage targets: unit ≥ 80% statements, policy ≥ 80% rules, critical paths ≥ 90%
- SLSA L3 attestation on every built image (in-toto + cosign)

## Definition of done

- Code + tests merged
- OpenAPI / AsyncAPI / Rego updated
- Docs updated: service `README.md`, ADR if needed, CHANGELOG entry
- Telemetry: metrics, traces, structured logs in place
- Audit events emitted for any new exchange path
- Rollback plan documented
- Conformance tests still pass (run `make certify` locally for affected CTs)

## Security & privacy

- Never commit secrets. Use Vault / SealedSecrets / External Secrets.
- No real PII in dev/test. Use synthetic fixtures in `tests/fixtures/`.
- Any change touching personal-data flow requires a DPIA update (`docs/templates/dpia-template.md`).
- Any new service or significant surface change requires a threat model (`docs/templates/threat-model-template.md`).

## Releasing

- SemVer per service.
- Release notes generated from Conventional Commits + curated by the service owner.
- Canary / blue-green for Trust Node and PDP; standard rolling for others.
- Production deploys require:
  - Green CI on `main`
  - Security review sign-off for any control change
  - Privacy review sign-off for any personal-data flow change

## Communication

- Daily standup in `#btx-platform` (or service-specific channel).
- RFCs in `docs/rfcs/` for cross-team or cross-service proposals.
- Decisions go into `docs/adr/`. Tickets are not decisions.

## Getting help

- Build / CI issues: `#btx-platform`
- Security: `#btx-sec` (or PagerDuty for live incidents)
- Privacy: `#btx-privacy`
- Architecture questions: `#btx-arch` or @chief-architect

---

*If you find this file out of date with reality, fix it in the same PR.*
