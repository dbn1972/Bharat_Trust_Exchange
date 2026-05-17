---
id: P-35
version: 1.0.0
last_reviewed: 2026-05-17
owner: "@frontend-lead"
status: active
model_compat: [claude-sonnet-4.x, claude-opus-4.x]
inputs:
  - { name: SURFACE, type: "enum[admin-plugins|member-admin|operations-console]", required: true }
  - { name: API_BASE_URL, type: string, required: true }
  - { name: AUTH_STRATEGY, type: "enum[bearer-session|api-key-proxy|mock-dev]", required: true }
forbidden_paths: []
expected_outputs:
  - { kind: pr, title_pattern: "[portal] mount <SURFACE> as runnable admin route" }
  - { kind: files_created, glob: "apps/portal/**" }
  - { kind: files_modified, glob: "apps/portal/**" }
  - { kind: evidence, path: "evidence/portal/**" }
context_budget:
  read_in_full: ["docs/agent/prompts/p24-design-to-code.prompt.md", "apps/portal/src/features/admin/AdminPluginSettingsPage.tsx"]
  skim: ["apps/portal/**", "services/control-plane/src/server.ts", "docs/design/**"]
executable_acceptance:
  - { name: portal-build, cmd: "cd apps/portal && pnpm test || pnpm build", pass_when: "runnable app surface exists" }
  - { name: admin-route, cmd: "grep -RIn \"AdminPluginSettingsPage\" apps/portal", pass_when: "component is mounted from a real route or app entry" }
  - { name: broker-save-flow, cmd: "node tools/consistency-probe.mjs admin-plugin-save", pass_when: "UI save updates backend and reflects new provider" }
  - { name: a11y-smoke, cmd: "node tools/audit-stage-check.mjs portal-admin-a11y", pass_when: "basic keyboard and error states validated" }
halt_conditions:
  - "apps/portal remains component-library-only with no runnable entrypoint"
  - "admin surface cannot authenticate to backend configuration endpoints"
  - "saving plugin settings would expose BTX_API_KEY in browser source"
escalation: { to: "@frontend-lead, @security-lead", channel: "#btx-frontend" }
graph: { upstream: [P-24, P-27], downstream: [P-19, P-28] }
---

# P-35 — Turn the admin plugin UI into a runnable portal surface

## Read first

- [P-24 design-to-code handoff](./p24-design-to-code.prompt.md)
- `apps/portal/src/features/admin/AdminPluginSettingsPage.tsx`
- `apps/portal/src/features/admin/MessageBrokerPluginPanel.tsx`
- `services/control-plane/src/server.ts`

## Inputs

| Name | Meaning |
|---|---|
| `SURFACE` | Which portal surface to mount |
| `API_BASE_URL` | Backend base URL used by the portal |
| `AUTH_STRATEGY` | How the portal securely authenticates admin requests |

## Execute

1. Create a real runnable portal app shell under `apps/portal/` with package manifest, build tooling, and app entrypoint.
2. Mount `AdminPluginSettingsPage` on a real route or top-level page.
3. Add secure backend communication for admin plugin configuration, avoiding raw secret exposure in browser code.
4. Add loading, error, and success states for the broker plugin flow.
5. Add tests for:
   - initial load of broker config
   - provider switch between Redpanda and Kafka
   - invalid broker input
   - auth failure path
6. Add evidence artifacts (screenshots or test logs) under `evidence/portal/`.
7. Update docs so operators know where the admin plugin surface lives and how it is secured.

## Hard rules

- Do not ship admin-only API keys directly to browser bundles.
- Do not leave the admin UI as an unmounted component.
- Do not add a portal surface without at least one runnable build or test command.
- The save path must reflect backend truth after write.
- Error states must be accessible and keyboard reachable.

## Acceptance

- [ ] `apps/portal/` contains a runnable app shell.
- [ ] `AdminPluginSettingsPage` is mounted from a real entrypoint.
- [ ] Save flow updates backend config and refreshes UI state.
- [ ] Auth strategy is documented and does not expose raw secrets.
- [ ] Portal build/test command exists and passes.
- [ ] Evidence emitted under `evidence/portal/`.

## Worked example

See [`_examples/p35.md`](./_examples/p35.md).

## Self-score

Emit `self_score` per [`_frame.md`](./_frame.md) §3 to `.btx/prompt-runs/<run_id>.json`. Do not merge if operability, security, or documentation score below 8.
