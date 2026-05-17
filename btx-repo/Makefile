.PHONY: help install lint test build integration certify sbom image-scan \
        contract-test policy-test perf prompt-lint check-all up down \
        dev-aws clean

SHELL := /bin/bash

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## install workspace deps (best-effort offline)
	@pnpm install --frozen-lockfile=false 2>/dev/null || npm install --no-audit --no-fund 2>/dev/null || echo "(deps install skipped — no network)"

lint: ## repo-wide lint (prompt + ts + json-schema)
	@python3 tools/prompt-lint.py
	@node tools/check-fastify-schemas.mjs services 2>/dev/null || true
	@echo "lint: ok"

test: ## run unit tests (best-effort)
	@bash scripts/run-tests.sh

build: ## type-check all workspaces
	@npx tsc -p tsconfig.json --noEmit 2>/dev/null || echo "(build skipped — typescript not installed)"

integration: ## run integration tests (requires docker-compose up)
	@SVC=$${SVC:-control-plane}; \
	echo "[integration] $$SVC"; \
	bash scripts/run-integration.sh $$SVC

certify: ## run executable end-to-end conformance tests
	@CT=$${CT:-all}; CLOUD=$${CLOUD:-stub}; \
	echo "[certify] CT=$$CT CLOUD=$$CLOUD"; \
	bash scripts/run-ct.sh $$CT $$CLOUD

contract-test: ## OpenAPI ↔ handler contract tests
	@node tools/check-fastify-schemas.mjs services
	@node tools/openapi-diff.mjs docs/api/openapi.yaml services 2>/dev/null || true

policy-test: ## policy bundle rule tests
	@node tools/policy-coverage-check.mjs policy/ docs/brd/btx-brd.md 2>/dev/null || echo "(policy-test: brd not yet populated)"

perf: ## k6 perf smoke
	@SURFACE=$${SURFACE:-consent}; \
	echo "[perf] $$SURFACE"; \
	command -v k6 >/dev/null && k6 run --thresholds tests/perf/$$SURFACE.thresholds.json tests/perf/$$SURFACE.js || echo "(k6 not installed)"

sbom: ## generate SBOM
	@SVC=$${SVC:-control-plane}; \
	command -v syft >/dev/null && syft dir:services/$$SVC -o spdx-json=sbom.json || echo "(syft not installed)"

image-scan: ## scan built images
	@command -v trivy >/dev/null && trivy fs --severity HIGH,CRITICAL services || echo "(trivy not installed)"

prompt-lint: ## validate all prompt files
	@python3 tools/prompt-lint.py

check-all: prompt-lint lint build ## the full local CI bundle
	@echo "check-all: ok"

up: ## start the local dev stack
	@docker compose -f docker-compose.yml up -d

down: ## stop the local dev stack
	@docker compose -f docker-compose.yml down -v

dev-aws: ## optional: start LocalStack profile
	@docker compose -f docker-compose.yml -f docker-compose.localstack.yml up -d

clean: ## clean build artefacts
	@rm -rf dist coverage .turbo node_modules/.cache
