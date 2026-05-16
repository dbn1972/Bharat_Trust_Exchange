#!/usr/bin/env bash
set -euo pipefail
SVC="${1:-control-plane}"
node tools/run-integration.mjs "$SVC"
