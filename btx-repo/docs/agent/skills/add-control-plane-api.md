# Skill — Add a new control-plane API

> Self-contained recipe an agent (or human) follows to add a REST endpoint to a control-plane service. Mirrors Golden Path §1 with more detail.

## Inputs needed

- Service name (`member-registry`, `service-catalogue`, …)
- Resource / verb (`POST /v1/grants`)
- Request / response shape (DTOs)
- Authorisation rules (which roles or PDP-evaluated)
- Audit event(s) to emit
- BRD reference (FR-…)

## Steps

1. **Open OpenAPI** `services/<svc>/api/openapi.yaml`. Add the path, components and security entry.
2. **Lint** `make contract-test`. Resolve issues.
3. **Generate or hand-write transport handler** in `internal/transport/http/`. Keep it thin — parse, call domain, serialise.
4. **Implement domain logic** in `internal/domain/`. Pure, deterministic, testable; no IO.
5. **Repository / adapter** in `internal/adapter/db/` for persistence. Use parameterised queries; write a migration in `migrations/`.
6. **AuthZ** call PDP `POST /v1/decisions` for data-bearing operations; for governance operations use OIDC role mapping. Fail-closed on PDP errors.
7. **Audit emission** publish a business event to the appropriate topic with schema validation.
8. **Tests**
   - Unit: domain happy + edge cases
   - Integration: handler + testcontainers PG
   - Contract: OpenAPI request/response match
9. **Telemetry** add counter + latency histogram metrics, OTel span, structured logs.
10. **Docs** update service `README.md`, `CHANGELOG.md`. If the change is architectural, open an ADR.

## Acceptance checklist

- [ ] OpenAPI updated and linted
- [ ] Unit + integration + contract tests added and passing
- [ ] PDP call wired (where applicable)
- [ ] Audit event emitted and schema-validated
- [ ] Metrics, traces, logs added
- [ ] Service `README.md` and `CHANGELOG.md` updated
- [ ] CODEOWNERS approvals obtained
- [ ] Conformance suite green

## Common pitfalls

- Authorisation logic in handler instead of Rego (see [anti-patterns §2](../anti-patterns.md))
- Returning raw DB error → use structured error model (Annex A §A.5.3)
- Forgetting audit emission — every data-bearing path emits
