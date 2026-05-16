# 0016 — OpenTofu + Helm + ArgoCD for declarative multi-cloud deployment

- **Status:** accepted
- **Date:** 2026-05-16
- **Deciders:** Architecture, Platform
- **Tags:** platform, deployment

## Context

Multi-cloud, multi-environment deployment must be declarative, auditable and reproducible. We need both infrastructure provisioning and Kubernetes application delivery.

## Decision

- **OpenTofu** (Terraform-compatible, open) for cloud infrastructure provisioning (`infrastructure/<cloud>/`).
- **Helm** charts for application packaging; **Kustomize** overlays where appropriate.
- **ArgoCD** for GitOps continuous delivery via an app-of-apps pattern (`deploy/`).

Per-cloud values live in `deploy/values-<cloud>.yaml`; the application chart is unchanged.

## Consequences

**Positive**
- Reproducible deployments; diff visible in Git.
- Promotion = PR + ArgoCD sync.
- Same chart runs across clouds; portability is provable.

**Negative / trade-offs**
- OpenTofu / Terraform skill required; standard for this domain.
- ArgoCD operability needed; documented in Annex B.

## Alternatives considered

| Option | Why not |
|---|---|
| Pulumi | Language coupling; smaller community for IaC modules |
| FluxCD | Acceptable alternative; pick one for consistency |
| Manual `kubectl apply` | No declarative source of truth |

## References

- ADR-002, ADR-008
- Arch Doc §16
- Annex B §B.10 (DR)
