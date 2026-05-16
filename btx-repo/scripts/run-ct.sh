#!/usr/bin/env bash
set -euo pipefail
CT="${1:-all}"
CLOUD="${2:-stub}"
node tools/contract-tests.mjs "$CT" "$CLOUD"
