# Skill — Add a new Rego policy

> Recipe to add or update a PurposeGuard policy under `policy/btx/`.

## Inputs needed

- Decision intent (allow / deny / minimise / escalate)
- Inputs available from PDP request (`BTX_Architecture_Annex_A_Engineering.md` §A.6.1)
- Obligations to attach
- Test fixtures needed (member, service, purpose, grant)

## Steps

1. **Pick file**
   - `policy/btx/decisions.rego` — top-level decision combinator
   - `policy/btx/bola.rego` — object-level
   - `policy/btx/<domain>.rego` — domain-specific
2. **Write the rule** following the patterns in Annex A §A.6. Use `import future.keywords`. Prefer `contains` violations + a single `decision` consolidation rule.
3. **Add fixtures** under `policy/btx/testdata/` (members, services, purposes, grants) — extend, don't duplicate.
4. **Write tests** `policy/btx/<name>_test.rego`:
   - `test_allow_*` happy path
   - `test_deny_*` per violation
   - `test_obligation_*` per obligation
5. **Local commands**
   ```
   opa fmt -w policy/
   regal lint policy/
   opa test policy/ --bench --coverage --format=json > /tmp/cov.json
   ```
6. **Coverage** ensure ≥ 80% for the changed file.
7. **Open PR** title `[policy] <slug>`; CODEOWNERS = `@security-lead @privacy-lead`.
8. **Post-merge** CI builds the bundle (`opa build -b policy/`), signs it (`cosign`), publishes to the Signed Config Publisher. Sandbox canary at 5%, then promote.

## Acceptance checklist

- [ ] `opa fmt` clean, `regal lint` clean
- [ ] `opa test` 100% pass, coverage ≥ 80%
- [ ] Fixtures additive only (no destructive edit to existing)
- [ ] Conformance CT-007, CT-017 still pass
- [ ] Bundle signed and published in sandbox
- [ ] Documented in `CHANGELOG.md` of the policy module

## Common pitfalls

- Writing decisions that depend on inputs the PDP request doesn't carry — extend the DecisionRequest schema first
- Hard-coding member or service IDs — drive from fixtures / config
- Forgetting to test the obligation set; obligations are part of the contract
