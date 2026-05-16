# CLAUDE.md — Notes for Claude Code

> Claude-Code-specific addendum to [`AGENTS.md`](AGENTS.md). Read `AGENTS.md` first; this file only adds tool-specific guidance.

## Tone and behaviour

- Be brief. Skip preambles. No "Here's what I'll do" filler.
- Prefer doing the work over describing it.
- Don't ask for confirmation on routine, reversible changes (edits, tests, lint). The user auto-approves these.
- Ask before: destructive git operations, `force` pushes, dropping data, deleting unrelated files, calling external services with credentials.

## Use the tools well

- Read large file ranges in one go; don't peck.
- Prefer `grep_search` / `file_search` over `semantic_search` when you know the symbol or filename.
- Use the todo-list tool for ≥3 step tasks. Mark progress as you go.
- Run linters and tests after edits; treat their output as the spec.

## Repository entry points (read in this order)

1. [`AGENTS.md`](AGENTS.md) — non-negotiables and repo layout
2. [`docs/architecture/INDEX.md`](docs/architecture/INDEX.md) — pointers to all architecture docs
3. [`docs/agent/golden-paths.md`](docs/agent/golden-paths.md) — recipes for common tasks
4. [`docs/agent/anti-patterns.md`](docs/agent/anti-patterns.md) — what not to generate
5. The specific service's `README.md` (the tech spec)

## When generating code, default to:

- Tests next to code (`tests/unit`, `tests/integration`) — fail loudly first, then implement.
- Table-driven tests in Go; parameterised tests in Java; Vitest with arrange/act/assert in TS.
- Interfaces at the consumer side, kept small.
- Explicit context propagation (`ctx context.Context` first parameter in Go).
- Structured logging (`slog` / `logback-json` / `pino`) with `trace_id`, `txn_id`, `member_id`.
- Errors with codes from `services/<name>/internal/errcodes` mapped to the RFC 7807 model in Annex A §A.5.4.

## When generating Rego

- Always add a unit test in the same PR (`policy/btx/*_test.rego`).
- Use the patterns in `BTX_Architecture_Annex_A_Engineering.md` §A.6.
- Run `opa fmt`, `regal lint`, `opa test --bench`.

## When touching audit, policy, or crypto

- These are SEV-1 surfaces. Add tests first, change second.
- Schema-versioned events only. Bump `schema_version` and update consumers.
- No new signing algorithm without an entry in the crypto profile (§A.8) — propose an ADR.

## Memory and context discipline

- Don't re-read what you've already read in this conversation.
- Don't search broadly when you have a precise filename — open it directly.
- Don't enumerate the whole repo to answer a small question.

## Output discipline

- For file edits: edit; don't paste the file back to the user.
- For new code: produce the smallest correct change; resist scope creep.
- For documentation: structure first, prose second; tables and lists over paragraphs.

## Safety

- Do not generate or commit secrets, even test ones.
- Do not produce code that bypasses signing, mTLS, replay protection or policy decisions.
- Do not produce synthetic data that could be confused with real PII.
- Do not browse external URLs for "ideas" when a local doc has the answer.

---

*If a behaviour in this file is wrong for the current task, prefer the user's instruction and flag the conflict.*
