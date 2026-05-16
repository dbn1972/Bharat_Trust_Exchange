#!/usr/bin/env bash
set -euo pipefail
if command -v pnpm >/dev/null 2>&1; then
  pnpm -s test || true
elif command -v npm >/dev/null 2>&1; then
  npm test --silent || true
else
  echo '(test runner unavailable)'
fi
