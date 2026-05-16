# Anti-patterns — What NOT to generate

> Hard-stop rules. Every item below has caused real incidents in similar platforms. Don't propose code that violates them. If a user asks for one, explain the risk and offer the correct alternative.

## 1. Trust and identity

| ❌ Anti-pattern | ✅ Do instead |
|---|---|
| Calling another Trust Node over plain TLS | mTLS only, certificate pinned to member identity |
| Verifying JWS with a key fetched from an arbitrary URL | Use the keyset from the signed config bundle for that member |
| Sharing a signing key across members or services | Per-member, per-node keys; never shared |
| Disabling certificate verification "for local dev" | Use a local CA and certificates; never `InsecureSkipVerify` |
| Hard-coding `kid` or algorithm | Always look up via the bundle; algorithm-agile |
| Long-lived static service accounts | SPIFFE/SPIRE workload identity with short TTL |
| Skipping `replay-cache` check because it's "rare" | Replay protection is mandatory on every provider TN |

## 2. Policy and authorisation

| ❌ | ✅ |
|---|---|
| `if user.role == "admin" { allow }` in Go/Java | Call PDP (`POST /v1/decisions`) — policy is in Rego |
| Reading bundle and parsing rules in application code | Use OPA — never reimplement the engine |
| Caching a decision longer than the obligation TTL | Respect `retention.requester_cache_ttl` exactly |
| Treating `ESCALATE` as `DENY` silently | Route to Approval Workflow per BRD §16.3 |
| Returning a record when PDP says `ALLOW_WITH_MINIMISATION` and ignoring obligations | Pass through the response shaper |
| Skipping object-level check (BOLA) | Always bind `citizen_context_ref` and verify via Rego |
| Ignoring `policy_version` in audit | Always record the bundle version that decided |

## 3. Data handling

| ❌ | ✅ |
|---|---|
| Caching source records in BTX (Redis, PG, even temporarily beyond a single request) | No source data persistence — period |
| Logging response bodies that contain personal data | Log structured metadata only; no payloads |
| Storing raw citizen identifiers across requests | Use opaque `citizen_context_ref` with binding |
| Returning a full record because "the consumer asked nicely" | Shape per obligations: full / masked / yes-no / signed claim |
| Bulk export through normal API | Bulk lane only with explicit `bulk_grant` and rate limits |
| Mixing test data with production indices | Hard separation; synthetic data only in non-prod |
| Putting PII in metrics labels or trace attributes | Use IDs / hashes; never values |

## 4. Cloud and portability

| ❌ | ✅ |
|---|---|
| `s3.New(...)` directly in domain code | Implement against `ObjectStoreAdapter` interface |
| `lambda` or vendor-only serverless for core flows | Containerised workloads on K8s/OpenShift |
| Using a managed proprietary DB with vendor-only features | PostgreSQL-compatible features only; abstract behind repository |
| Hard-coding region or provider names in business code | Configuration only |
| Picking cipher suites supported by only one cloud's KMS | Stick to the cross-cloud profile (Annex A §A.8) |
| Provider-specific IAM role logic inline | `IamAdapter` interface |
| Using a single cloud's secret manager API in service code | Vault / External Secrets abstraction |

## 5. Audit and observability

| ❌ | ✅ |
|---|---|
| Logging `success` without emitting an audit event | Audit on every exchange path (requester + provider) |
| Editing or deleting audit events | Append-only; corrections go into new events |
| Logging in unstructured strings | JSON logs with `trace_id`, `txn_id`, `member_id`, `service_id` |
| Including secrets / tokens / payloads in logs | Redact at the logger; structured fields only |
| Sampling traces on policy-deny paths | Sample errors at 100% |
| Dashboards without an owner | Every dashboard has a service owner |
| New metric name that collides or is too generic | Follow `btx_<svc>_<noun>_<unit>` convention |

## 6. Errors and resilience

| ❌ | ✅ |
|---|---|
| Returning 500 with stack trace to the caller | RFC 7807 problem details with a BTX error code |
| Swallowing errors (`_ = err`) | Wrap with context and return; log at the boundary |
| Retrying on idempotent-unsafe operations without a key | Use idempotency keys (txn_id) |
| Infinite retry without circuit breaker | Bounded retry + circuit breaker + DLQ |
| Timeout = forever | Every external call has a context deadline |
| Catching `Throwable` / `panic`-recover that masks bugs | Catch specific, recover at the boundary |
| Failing open on policy errors | Fail closed; DENY on any PDP error |

## 7. Concurrency

| ❌ | ✅ |
|---|---|
| Shared mutable maps without sync | `sync.Map`, channels, or copy-on-write |
| Goroutine leaks (no cancellation) | Pass and check `ctx.Done()` |
| Unbounded queues / channels | Backpressure or bounded buffers |
| Sleep-based "timing" in tests | Use a fake clock |
| Time-based primary keys with collisions | UUIDv7 / ULID |

## 8. Build and supply chain

| ❌ | ✅ |
|---|---|
| `image: postgres:latest` | Pinned digest or specific version |
| Adding a new dep without license + vuln check | Update SBOM, run `make security` |
| Disabling SAST or dep-scan to merge | Fix the finding or open a tracked exception with expiry |
| `--no-verify` git commit | Sign commits; fix the failing hook |
| Vendoring secrets into the repo | Vault / SealedSecrets, even for tests |
| Building images locally and pushing to prod | Build in CI; sign with cosign; SLSA provenance |
| Skipping image scan to ship a hotfix | Hotfixes still pass scan; emergency exception is documented |

## 9. Testing

| ❌ | ✅ |
|---|---|
| Mocking your own code into existence (`mock.On("ReturnWhatever")`) | Use fakes / contract tests against real schema |
| Tests that depend on external sandboxes only | Use testcontainers for hermetic runs |
| `time.Sleep` in tests | Fake clock |
| Flaky tests left skipped | Fix or remove; no permanent `t.Skip` |
| Conformance tests that don't fail on regression | Assert specific evidence, not just "ran" |
| Generating personal data to test PII handling | Synthetic fixtures only |

## 10. UI / accessibility

| ❌ | ✅ |
|---|---|
| `<div>` as a button | `<button>` with proper aria |
| Colour-only error signals | Icon + text + colour |
| Auto-playing media | No autoplay; user-initiated |
| Modal that traps focus indefinitely | Trap with escape route |
| Untranslated strings | i18n bundle entries; no hardcoded English |
| Fixed pixel widths on text containers | Reflow at 320 px and 200% zoom |

## 11. Documentation

| ❌ | ✅ |
|---|---|
| New service without `README.md` (tech spec) | Use the template; no merge without it |
| OpenAPI changes without docs updates | Generated docs in developer portal must regenerate |
| Architecture change without ADR | ADR first, code second |
| `# TODO` left undefined | `// TODO(BTX-1234): …` |
| Stale runbook | Owner reviews each quarter; date in header |

## 12. Process

| ❌ | ✅ |
|---|---|
| Bypassing CODEOWNERS with a "small" change | All ownership rules apply; ask, don't bypass |
| `[skip ci]` on production-affecting changes | CI is the contract |
| Force-push to shared branches | Never |
| Editing released audit data to "fix" a customer issue | Audit immutable; correction via new events + grievance flow |
| Merging on red because "tests are flaky" | Fix or quarantine, then merge |

---

## If you must propose an exception

1. Open an ADR with **Context** and **Risk**.
2. Get @security-lead + @chief-architect approval.
3. Add the exception to a register (`docs/security/exceptions.md`) with expiry date.
4. Add a follow-up issue to retire the exception.

There are very few cases where this is the right move. Default is: don't.
