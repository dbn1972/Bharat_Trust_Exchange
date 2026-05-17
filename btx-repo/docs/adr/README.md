# Architecture Decision Records — Index

> Numbered, immutable history of significant architectural decisions. Use [`0000-template.md`](0000-template.md) for new ADRs. Once accepted, ADRs are amended only by superseding, never by silent edit.

## How to file

1. Pick the next number (highest existing + 1).
2. Copy `0000-template.md` to `NNNN-short-slug.md`.
3. Status `proposed` → open PR → on approval, change to `accepted`.
4. Add a row to the index below.
5. Superseding: mark old `superseded by NNNN`; link both ways.

## Index

| ADR | Title | Status | Date | Source |
|---|---|---|---|---|
| [001](0001-federated-exchange-over-central-database.md) | Federated exchange over central database | accepted | 2026-05-16 | BRD §22 |
| [002](0002-cloud-agnostic-product-core.md) | Cloud-agnostic product core | accepted | 2026-05-16 | BRD §22 |
| [003](0003-trust-node-as-data-plane-boundary.md) | Trust Node as data-plane boundary | accepted | 2026-05-16 | BRD §22 |
| [004](0004-policy-as-code.md) | Policy-as-code | accepted | 2026-05-16 | BRD §22 |
| [005](0005-audit-as-trust-product.md) | Audit as a trust product | accepted | 2026-05-16 | BRD §22 |
| [006](0006-apisetu-digilocker-complementary-rails.md) | API Setu / DigiLocker as complementary rails | accepted | 2026-05-16 | BRD §22 |
| [007](0007-provider-side-minimisation.md) | Provider-side minimisation | accepted | 2026-05-16 | BRD §22 |
| [008](0008-certified-cloud-adapters.md) | Certified cloud adapters | accepted | 2026-05-16 | BRD §22 |
| [009](0009-signed-config-cache.md) | Signed config cache | accepted | 2026-05-16 | BRD §22 |
| [010](0010-conformance-before-production.md) | Conformance before production | accepted | 2026-05-16 | BRD §22 |
| [011](0011-opa-rego-as-pdp-language.md) | OPA + Rego as the PDP language | accepted | 2026-05-16 | Arch §20.3 |
| [012](0012-tuf-style-bundle-signing.md) | TUF-style signing for config bundles | accepted | 2026-05-16 | Arch §20.3 |
| [013](0013-envoy-opa-sidecar-trust-node.md) | Envoy + OPA sidecar as Trust Node substrate | accepted | 2026-05-16 | Arch §20.3 |
| [014](0014-spiffe-spire-workload-identity.md) | SPIFFE/SPIRE workload identity | accepted | 2026-05-16 | Arch §20.3 |
| [015](0015-kafka-or-nats-for-audit-pipeline.md) | Kafka (or NATS JetStream) for audit pipeline | accepted | 2026-05-16 | Arch §20.3 |
| [016](0016-opentofu-helm-argocd-deployment.md) | OpenTofu + Helm + ArgoCD for declarative multi-cloud | accepted | 2026-05-16 | Arch §20.3 |
| [017](0017-ed25519-default-signing.md) | Ed25519 default for signing; ECDSA-P256 fallback | accepted | 2026-05-16 | Arch §20.3 |
| [020](0020-btx-hot-path-stack-v1.md) | BTX hot-path stack v1 | accepted | 2026-05-16 | ADR-0020 |
| [021](0021-outbox-only-db-to-kafka-contract.md) | Outbox-only DB-to-Kafka contract | accepted | 2026-05-16 | Phase 1 |
| [022](0022-idempotency-key-contract.md) | Idempotency-Key contract | accepted | 2026-05-16 | Phase 1 |
| [023](0023-stubs-first-localstack-optional.md) | Stubs-first; LocalStack optional | accepted | 2026-05-16 | Phase 1 |
| [024](0024-api-versioning-strategy.md) | API versioning strategy (URL path, 2-version window) | accepted | 2026-05-17 | BRD §12, ADR-0010 |
| [025](0025-data-residency-cross-border.md) | Data residency and cross-border transfer controls | accepted | 2026-05-17 | DPDP 2023 §16, BRD §14 |
