# agent-runtime Specification

## Purpose

TBD - created by archiving change 'add-agent-runtime-streaming'. Update Purpose after archive.

## Requirements

### Requirement: Agent run lifecycle states

The agent runtime SHALL track every run through one of five terminal lifecycle states: `pending`, `running`, `done`, `cancelled`, `timeout`, or `error`. A run starts in `pending` while permission and rate-limit checks execute, transitions to `running` once the first provider request is issued, and ends in exactly one terminal state. Each terminal state SHALL emit a corresponding final event on the streaming channel before the underlying resources are released.

#### Scenario: Run completes naturally

- **WHEN** the LLM emits a final assistant message with no further tool calls
- **THEN** the runtime SHALL transition the run to `done`, emit a `done` event, and release the AbortController and any provider connection.

#### Scenario: User cancels mid-run

- **WHEN** a cancel request arrives while the run is in `running`
- **THEN** the runtime SHALL transition the run to `cancelled`, abort the in-flight provider request, refrain from dispatching further tool calls, and emit an `error` event with `errorKey: "agent.error.cancelled"`.

##### Example: lifecycle transitions

| Trigger | From → To | Final event |
| ------- | --------- | ----------- |
| HTTP request validated | (none) → pending | none |
| Permission OK + rate limit OK | pending → running | none |
| LLM ends with no tool call | running → done | `done` |
| User POSTs to cancel endpoint | running → cancelled | `error` (errorKey: `agent.error.cancelled`) |
| Wall clock 60s exceeded | running → timeout | `error` (errorKey: `agent.error.wallTimeout`) |
| Tool call count exceeds 20 | running → timeout | `error` (errorKey: `agent.error.toolCallCap`) |
| Provider returns 5xx after retries | running → error | `error` (errorKey: `agent.error.providerServer`) |


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Permission gate requires editor or owner role

The agent runtime SHALL invoke the existing `requireRole` permission guard with allowed roles `["owner", "editor"]` before any provider request is issued. A run requested by a viewer SHALL NOT enter `running` and SHALL NOT consume rate-limit tokens.

#### Scenario: Viewer attempts to start a run

- **WHEN** a session whose canvas role is `viewer` POSTs to the run endpoint
- **THEN** the runtime SHALL return HTTP 403 with `errorKey: "agent.error.permissionDenied"` and SHALL NOT call any provider or tool.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Tool surface dispatch via M12.2 tool-registry

The agent runtime SHALL expose to the LLM exactly the tools enumerated in the M12.2 `tool-registry`. Each tool's `parameters` field SHALL be the registry entry's `payloadSchema` (reused, not redeclared). Write tools SHALL execute through `applyMutation`; read tools SHALL execute through their corresponding reader function. Tool calls within a single LLM step SHALL execute serially in the order returned by the LLM.

#### Scenario: LLM calls a write tool

- **WHEN** the LLM emits a tool call for `createShape` with a valid payload
- **THEN** the runtime SHALL dispatch the payload through `applyMutation`, broadcast the resulting mutation to the tldraw sync room, and return the mutation result to the LLM as the tool result.

#### Scenario: LLM calls multiple parallel tools in one step

- **WHEN** the LLM emits two tool calls (`getViewport` + `listShapesInViewport`) in the same step
- **THEN** the runtime SHALL execute them serially in emit order and return both results before re-prompting the LLM.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Wall-clock timeout 60 seconds

The agent runtime SHALL terminate any run whose wall-clock duration from `pending → running` transition exceeds 60,000 milliseconds. The terminating event SHALL be `error` with `errorKey: "agent.error.wallTimeout"`. The wall-clock counter SHALL NOT pause during tool execution.

#### Scenario: Slow provider exceeds wall-clock budget

- **WHEN** a provider request is still pending after 60 seconds from the run's `running` transition
- **THEN** the runtime SHALL abort the provider request, emit an `error` event with `errorKey: "agent.error.wallTimeout"`, and transition the run to `timeout`.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Tool-call count cap 20 per run

The agent runtime SHALL terminate any run whose accumulated tool-call count within the same run reaches 20. The terminating event SHALL be `error` with `errorKey: "agent.error.toolCallCap"`. Read and write tool calls SHALL count equally toward the cap.

#### Scenario: LLM enters a tool-call loop

- **WHEN** the LLM has emitted 20 tool calls in the same run and emits a 21st tool call
- **THEN** the runtime SHALL refuse to dispatch the 21st call, emit an `error` event with `errorKey: "agent.error.toolCallCap"`, and transition the run to `timeout`.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Cancel does not roll back in-flight mutation

When a run is cancelled, the runtime SHALL NOT issue any reverse mutation for tool calls already dispatched. Any tool call already passed to `applyMutation` SHALL run to completion and broadcast normally to the tldraw sync room. The runtime SHALL stop the LLM stream and SHALL refuse to dispatch any further tool call from that run.

#### Scenario: Cancel arrives while a write tool is mid-flight

- **GIVEN** the runtime has already invoked `applyMutation` for tool call N
- **WHEN** a cancel request arrives before tool call N completes
- **THEN** the runtime SHALL allow tool call N to finish and broadcast its mutation, SHALL emit no `tool_result` event for the cancelled run after the `error` event, and SHALL NOT issue a reverse mutation for tool call N.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Provider request via BYOK Vault

The agent runtime SHALL fetch the API key for the requested provider through the existing BYOK Vault decrypt path. The decrypted key SHALL only be passed to the Vercel AI SDK provider adapter as a function argument and SHALL NOT be persisted to logs, error events, or other sinks. The runtime SHALL emit `errorKey: "agent.error.byokMissing"` when the user has no key registered for the requested provider.

#### Scenario: User has no key for requested provider

- **WHEN** a run requests model `openai/gpt-4` but the user has no OpenAI key in BYOK Vault
- **THEN** the runtime SHALL refuse to start the run, emit an `error` event with `errorKey: "agent.error.byokMissing"`, and transition the run to `error`.

#### Scenario: BYOK key is decrypted

- **WHEN** the runtime starts a run that requires a registered provider key
- **THEN** the runtime SHALL fetch the key through the BYOK Vault decrypt API, pass it directly to the provider adapter, and SHALL NOT include the key in any log line, error event, or telemetry record.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Provider 5xx retry with bounded backoff

The agent runtime SHALL retry provider responses with HTTP status codes 500, 502, 503, or 504 up to 2 times with exponential backoff (250 ms, then 1000 ms). After the second retry fails, the runtime SHALL emit `errorKey: "agent.error.providerServer"` and transition the run to `error`. Provider responses with 4xx status SHALL NOT be retried.

#### Scenario: Provider returns 503 then succeeds

- **WHEN** the first provider request returns HTTP 503 and the first retry returns HTTP 200
- **THEN** the runtime SHALL continue the run normally and SHALL NOT emit an error event for the transient 503.

#### Scenario: Provider returns 401

- **WHEN** the first provider request returns HTTP 401
- **THEN** the runtime SHALL NOT retry, SHALL emit `errorKey: "agent.error.providerAuth"`, and SHALL transition the run to `error`.

##### Example: retry decision matrix

| Provider response | Retry behaviour | Final errorKey on failure |
| ----------------- | --------------- | ------------------------- |
| 200 | n/a (success) | n/a |
| 401 | no retry | `agent.error.providerAuth` |
| 429 | no retry | `agent.error.providerRateLimit` |
| 500/502/503/504 | up to 2 retries (250 ms, 1000 ms) | `agent.error.providerServer` |


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Error events emit i18n errorKey only

The agent runtime SHALL include only an `errorKey` and an optional non-sensitive `detail` string in any `error` event. The runtime SHALL NOT include raw provider error bodies, BYOK key material, stack traces, or internal identifiers other than the `runId` in `error` events. Server-side Pino logs SHALL be the sole sink for full diagnostic detail.

#### Scenario: Provider returns a verbose error body

- **GIVEN** the provider returns HTTP 400 with a body containing the original prompt
- **WHEN** the runtime emits the corresponding `error` event
- **THEN** the event payload SHALL contain only `{ type: "error", runId, errorKey: "agent.error.providerAuth" }` and SHALL NOT contain the prompt or any provider-supplied error string.


<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->

---
### Requirement: Cancellation registry releases resources on terminal state

The agent runtime SHALL maintain an in-memory `Map<runId, AbortController>` for the lifetime of every `pending` and `running` run. On every terminal transition (`done`, `error`, `cancelled`, `timeout`), the runtime SHALL remove the entry from the registry. The registry SHALL NOT persist across server restarts.

#### Scenario: Run completes and registry is cleaned

- **WHEN** a run transitions to `done`
- **THEN** the runtime SHALL remove the runId entry from the cancellation registry before returning from the run handler.

#### Scenario: Server restart drops in-flight runs

- **GIVEN** N runs are in `running` state when the server process restarts
- **WHEN** the server restarts
- **THEN** all SSE connections SHALL close (server-initiated), the in-memory registry SHALL be empty in the new process, and clients SHALL observe the SSE close as run termination.

<!-- @trace
source: add-agent-runtime-streaming
updated: 2026-05-09
code:
  - apps/api/src/agent/runtime.ts
  - apps/api/src/agent/streaming.ts
  - apps/api/src/agent/wiring.ts
  - packages/shared/src/agent-digest.ts
  - apps/api/src/agent/digest.ts
  - packages/shared/src/agent-events.ts
  - bun.lock
  - packages/shared/src/locales/en.json
  - scripts/agent-smoke.sh
  - packages/shared/src/index.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/sse-endpoint.ts
  - apps/api/src/byok/providers/openai.ts
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/mutation-types.ts
  - scripts/dev-proxy.ts
  - apps/api/src/agent/cancel.ts
  - packages/shared/src/locales/zh-TW.json
  - scripts/dev.ts
  - docs/adr/0019-m13-e2e-five-bug-postmortem.md
  - apps/api/src/index.ts
  - docs/PHASE2_MILESTONES.md
  - apps/api/package.json
tests:
  - apps/api/src/agent/digest.test.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - apps/api/src/agent/cancel.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/api/src/byok/providers/openai.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/api/src/agent/streaming.test.ts
-->