# ADR-0024 — API Versioning Strategy for BTX Public and Internal APIs

| Field | Value |
|---|---|
| ID | ADR-0024 |
| Date | 2026-05-17 |
| Status | **accepted** |
| Deciders | @chief-architect, @sre-lead |
| BRD References | BRD §12 (API Design), §22 (ADR list), §31 (Standards) |
| Arch References | Architecture §4 (APIs), §20.3 (standards) |
| Supersedes | — |
| Superseded By | — |

---

## Context and Problem Statement

BTX exposes three categories of APIs:
1. **Public Trust-Node APIs** — peer-to-peer federation sync endpoints consumed by external trust nodes.
2. **Citizen-facing APIs** — consent grant/revoke/query exposed via the citizen portal.
3. **Internal service APIs** — cross-service communication (registry lookups, audit queries) within the BTX mesh.

As the system evolves, backward-incompatible changes (new required fields, removed endpoints, changed auth schemes) will be necessary. Without a versioning strategy, operators and external trust nodes will break on every release. BTX must support at least **one prior major version** concurrently to allow rolling upgrades across federated nodes.

Forces:
- External trust nodes run different release versions and cannot upgrade atomically.
- Citizen-facing APIs must provide stable URLs that portal clients (web, mobile) depend on.
- Internal APIs change more frequently but all services within a cluster are updated together.
- ADR-0010 (conformance-before-production) requires that any version break is gated by a conformance test.

---

## Decision

**We version all BTX APIs using URL path versioning (`/v{N}/...`) with the following rules:**

1. **URL path prefix** — all routes are prefixed `/v1/`, `/v2/`, etc. No header-based versioning for public APIs (header versioning is permitted as an **alias** for internal service discovery only).
2. **Semantic versioning for API contracts** — Major version bump (`/v1/` → `/v2/`) for any breaking change (removed field, changed auth method, changed HTTP method). Minor and patch changes are backward-compatible and do not require a version bump.
3. **Minimum two-version concurrency window** — both `v(N)` and `v(N-1)` are served simultaneously for a minimum of **90 days** or until all registered trust nodes (per registry) have upgraded, whichever is later.
4. **Deprecation headers** — responses from deprecated versions include `Sunset` and `Deprecation` HTTP headers per RFC 8594.
5. **Internal mesh APIs** — use URL versioning for the `/v{N}/` prefix; additionally support `Accept: application/vnd.btx.v{N}+json` as a content-negotiation fallback.
6. **Versioning gate** — any PR introducing a new `/v{N}/` path requires an updated OpenAPI spec, updated conformance tests (P-08), and a migration guide in `docs/api/migration-v{N-1}-to-v{N}.md`.

---

## Alternatives Considered

| Option | Why Not |
|---|---|
| **Header-based versioning** (`Accept: application/vnd.btx.v2+json`) | Less discoverable; incompatible with most gateway routing rules; operators and federation partners prefer URL-based routing; URL versioning is simpler to implement in Envoy |
| **Query-param versioning** (`?api-version=2`) | Non-idiomatic; not cacheable by CDN; discouraged by OpenAPI tooling |
| **No versioning (semver only on releases)** | Breaks external trust nodes on every major BTX release; incompatible with federated, independently-operated nodes |
| **GraphQL with field deprecation** | Not applicable — BTX uses REST/JSON APIs for compatibility with constrained edge nodes; GraphQL overhead unacceptable for hot-path policy decisions |

---

## Consequences

**Positive**:
- External trust nodes can upgrade at their own pace within the 90-day window.
- Clear breakpoints for clients; no guessing about compatibility.
- Envoy routing rules can be written per-version prefix.
- Conformance tests are version-scoped; old-version CT-suite kept active until sunset.

**Negative**:
- Server must serve two code paths for the duration of the concurrency window.
- OpenAPI specs multiply per version; requires versioned spec storage.
- Release process complexity increases (see P-12 / release runbook).

**Operational Impact**:
- `docs/api/` directory must contain a versioned OpenAPI spec per major version.
- Registry service must track the `api_version` field per trust node to determine safe deprecation.
- SRE must add `Sunset` date monitoring to alert when a deprecated version is still receiving > 1% traffic.

**Migration**:
- Existing `/v1/` endpoints remain at `/v1/`; no migration needed now.
- When `/v2/` is introduced, a `docs/api/migration-v1-to-v2.md` guide is mandatory.

---

## References

- BRD §12 (API Design Standards)
- BRD §22 (ADR-0024)
- Architecture Doc §4 (API Layer)
- RFC 8594 (Sunset HTTP Header)
- ADR-0010 (Conformance before production)
- ADR-0013 (Envoy + OPA sidecar)
- OpenAPI Specification v3.1
