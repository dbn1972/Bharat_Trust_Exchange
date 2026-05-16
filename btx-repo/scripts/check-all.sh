#!/usr/bin/env bash
set -euo pipefail
python3 tools/prompt-lint.py
node tools/check-fastify-schemas.mjs services
node tools/check-kms-adapter.mjs
node tools/check-idempotency.mjs
node tools/check-otel.mjs
echo '{"check":"check-all","status":"PASS"}'
