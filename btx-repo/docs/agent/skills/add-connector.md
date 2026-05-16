# Skill — Add a new connector / source-system adapter

> Recipe to add an adapter under `connectors/<system>/` that exposes a department source system to a Trust Node.

## Inputs needed

- System name and protocol (REST, SOAP, DB, file)
- Endpoints / queries to call
- Data class of the response
- Service ID(s) this adapter backs
- Authentication to source (mTLS, OAuth, API key, DB user)
- Schema mapping (source → canonical)

## Steps

1. **Scaffold** copy `connectors/_template/` to `connectors/<system>/`.
2. **Manifest** fill `connectors/<system>/manifest.yaml`: owner, service IDs, data class, protocol, endpoints, auth method, SLA.
3. **Implement** against the SDK in `connectors/sdk/`. Required methods:
   - `Init(ctx, config)` — open connections, load schema
   - `Handle(ctx, req) (resp, error)` — single-request semantics
   - `HealthCheck(ctx)` — liveness + dependency check
4. **Input validation** validate every request against the published JSON Schema (SchemaHub) before calling the source. Reject with `BTX-SCHEMA-001` on failure.
5. **Backend call** parameterised only — no string concatenation. For SOAP, use a typed client; for SQL, prepared statements; for REST, validated URL templates; for files, allowlisted paths.
6. **Response shape** return raw source response to the Trust Node Shaper. Adapter does not minimise — Shaper does (ADR-007).
7. **Error mapping** map source errors to BTX codes (Annex A §A.5.4):
   - 4xx from source → `BTX-AVAIL-001` or specific code
   - timeouts → `BTX-AVAIL-001` with retry-after
8. **Secrets** consume from Vault path documented in manifest; never embed.
9. **Tests**
   - Unit with a fake backend (in-memory / mock server)
   - Integration against the system's sandbox / mock
   - Negative tests: BOLA (CT-017), injection (CT-020), schema validation
10. **Threat model** fill `threat-models/<system>.md` using the template.
11. **DPIA** if personal data flows.
12. **Docs** `connectors/<system>/README.md` covering manifest, ops notes, dependencies, SLA, on-call.

## Acceptance checklist

- [ ] Manifest complete
- [ ] Implements all SDK methods
- [ ] Input validation against schema
- [ ] Parameterised backend access only
- [ ] Error model mapped
- [ ] Secrets via Vault
- [ ] Unit + integration + negative tests pass
- [ ] Threat model approved
- [ ] DPIA approved (if applicable)
- [ ] CT-020 (legacy adapter security) passes

## Common pitfalls

- Doing minimisation inside the adapter — that's the Shaper's job
- Allowing arbitrary URL / SQL templates from request
- Caching responses inside the adapter — caching is governed by obligations, not the adapter
- Storing secrets in manifest or env
