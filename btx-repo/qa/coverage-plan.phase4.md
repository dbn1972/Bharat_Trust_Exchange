# Phase 4 Coverage Backfill Plan (P-19)

Targets:
- statements >= 80%
- policy/crypto/audit paths >= 90%

Backfill order:
1. pkg/policy rule matching branches
2. pkg/adapter/kms stub sign/verify/dek paths
3. pkg/audit appendInTx + merkle routines
4. service route schema edge cases

Current status:
- scaffold baseline only
- full coverage execution pending dependency install and CI run
