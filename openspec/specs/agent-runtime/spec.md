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

---
### Requirement: Runtime loads conversation history from thread storage

The agent runtime SHALL receive a `ThreadRepo` dependency exposing `loadMessages(threadId)` (returning ordered `ai_messages` rows for the thread), `appendMessage(threadId, message)` (inserting a new row), and `setUsageOnLastAssistant(threadId, runId, usage)` (writing token usage to the most recent assistant row for the run). The runtime SHALL refuse to accept a client-supplied `messages` array; conversation history SHALL come exclusively from `ThreadRepo.loadMessages`.

At the start of each run, the runtime SHALL load the thread's full message history, append the new user message provided in the run request as an `ai_messages` row with `role='user'`, and pass the combined sequence to the provider as the conversation context.

#### Scenario: Multi-turn thread continuation

- **GIVEN** thread T with prior `ai_messages` rows `[user("hi"), assistant("hello")]`
- **WHEN** a run is dispatched with `userMessage: "draw a square"` against thread T
- **THEN** before invoking the provider, the runtime SHALL append a row `user("draw a square")` to T
- **AND** the provider SHALL be invoked with the full message sequence `[user("hi"), assistant("hello"), user("draw a square")]`
- **AND** the runtime SHALL NOT read any `messages` field from the inbound HTTP body.


<!-- @trace
source: add-ai-side-panel-and-threads
updated: 2026-05-13
code:
  - .agents/skills/mcp-builder/scripts/requirements.txt
  - docs/PHASE2_MILESTONES.md
  - scripts/dev-proxy.ts
  - skills-lock.json
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/agent/threads/handlers.ts
  - apps/web/src/agent/useAgentThread.ts
  - .agents/skills/mcp-builder/reference/python_mcp_server.md
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/agent/ChatList.tsx
  - .agents/skills/mcp-builder/reference/evaluation.md
  - apps/api/src/agent/threads/repo.ts
  - apps/api/drizzle/meta/0006_snapshot.json
  - apps/api/src/index.ts
  - apps/web/package.json
  - apps/api/src/agent/sse-endpoint.ts
  - apps/web/src/agent/sse-parser.ts
  - .agents/skills/mcp-builder/reference/node_mcp_server.md
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/agent/runtime.ts
  - .agents/skills/mcp-builder/reference/mcp_best_practices.md
  - apps/api/src/sync/mutator.ts
  - apps/api/src/sync/geo-defaults.ts
  - packages/shared/src/agent-events.ts
  - e2e/helpers/agent-setup.ts
  - apps/api/drizzle/0006_ai_threads.sql
  - apps/web/src/agent/ThreadSwitcher.tsx
  - apps/web/src/agent/cursor-ai-badge.ts
  - .agents/skills/mcp-builder/scripts/evaluation.py
  - packages/shared/src/locales/en.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/db/schema.ts
  - apps/web/src/agent/ChatComposer.tsx
  - apps/web/src/canvas/Editor.tsx
  - .agents/skills/mcp-builder/scripts/connections.py
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/wiring.ts
  - .agents/skills/mcp-builder/scripts/example_evaluation.xml
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - apps/api/src/agent/system-prompt.ts
  - apps/web/src/agent/store.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/agent/useAgentRun.ts
  - apps/api/src/agent/title-gen.ts
  - .agents/skills/mcp-builder/SKILL.md
  - apps/web/src/agent/TokenUsageFooter.tsx
  - bun.lock
  - .agents/skills/mcp-builder/LICENSE.txt
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/web/src/agent/TokenUsageFooter.test.tsx
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
  - e2e/agent-rate-limit-toast.spec.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/agent/threads/handlers.test.ts
  - apps/api/src/sync/geo-defaults.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - e2e/agent-multi-tab-badge.spec.ts
  - apps/web/src/agent/store.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/web/src/agent/ChatList.test.tsx
  - apps/api/src/agent/threads/repo.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/web/src/agent/AiSidePanel.test.tsx
  - apps/api/src/agent/title-gen.test.ts
  - apps/api/src/db/schema.test.ts
  - e2e/agent-cancel.spec.ts
  - apps/web/src/agent/useAgentThread.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/web/src/agent/ChatComposer.test.tsx
  - apps/web/src/agent/cursor-ai-badge.test.ts
  - apps/web/src/agent/ThreadSwitcher.test.tsx
  - e2e/agent-viewer-no-panel.spec.ts
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/agent/wiring.test.ts
  - apps/web/src/agent/useAgentRun.test.ts
  - apps/web/src/agent/sse-parser.test.ts
  - apps/api/src/agent/streaming.test.ts
  - apps/api/src/agent/system-prompt.test.ts
-->

---
### Requirement: Runtime persists every emitted message to the thread

The runtime SHALL persist every assistant text segment, tool call, and tool result emitted during a run as a new row in `ai_messages` for the same thread, preserving emission order via the `created_at` timestamp. Each persisted row SHALL carry the `provider`, `model`, and `run_id` columns matching the run that produced it. Token usage from the run's terminal `done` event SHALL be written to the most recent assistant row's `token_usage` column via `ThreadRepo.setUsageOnLastAssistant`.

#### Scenario: Cancel preserves the persisted prefix

- **GIVEN** run R1 against thread T (initially empty) emitted in this order: 1 user message, 2 assistant text rows, 1 tool_call row, 1 tool_result row, then was cancelled by the user before any further emission
- **WHEN** the cancel terminal event fires
- **THEN** thread T's `ai_messages` rows SHALL contain exactly those 5 rows
- **AND** no further rows SHALL be appended for run R1
- **AND** the rows already created SHALL NOT be deleted or mutated.

#### Scenario: Done event writes usage to last assistant row

- **GIVEN** run R1 against thread T that emitted assistant rows `A1, A2` (in that order) before terminating naturally
- **WHEN** the `done` event fires with `usage: {input: 1000, output: 500, provider: "openai", model: "gpt-4o-mini"}`
- **THEN** assistant row `A2` (the most recent) SHALL have its `token_usage` column UPDATEd to `{"input": 1000, "output": 500}`
- **AND** assistant row `A1` SHALL retain its existing `token_usage` value (NULL on first turn, or its own per-turn usage if recorded earlier).


<!-- @trace
source: add-ai-side-panel-and-threads
updated: 2026-05-13
code:
  - .agents/skills/mcp-builder/scripts/requirements.txt
  - docs/PHASE2_MILESTONES.md
  - scripts/dev-proxy.ts
  - skills-lock.json
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/agent/threads/handlers.ts
  - apps/web/src/agent/useAgentThread.ts
  - .agents/skills/mcp-builder/reference/python_mcp_server.md
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/agent/ChatList.tsx
  - .agents/skills/mcp-builder/reference/evaluation.md
  - apps/api/src/agent/threads/repo.ts
  - apps/api/drizzle/meta/0006_snapshot.json
  - apps/api/src/index.ts
  - apps/web/package.json
  - apps/api/src/agent/sse-endpoint.ts
  - apps/web/src/agent/sse-parser.ts
  - .agents/skills/mcp-builder/reference/node_mcp_server.md
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/agent/runtime.ts
  - .agents/skills/mcp-builder/reference/mcp_best_practices.md
  - apps/api/src/sync/mutator.ts
  - apps/api/src/sync/geo-defaults.ts
  - packages/shared/src/agent-events.ts
  - e2e/helpers/agent-setup.ts
  - apps/api/drizzle/0006_ai_threads.sql
  - apps/web/src/agent/ThreadSwitcher.tsx
  - apps/web/src/agent/cursor-ai-badge.ts
  - .agents/skills/mcp-builder/scripts/evaluation.py
  - packages/shared/src/locales/en.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/db/schema.ts
  - apps/web/src/agent/ChatComposer.tsx
  - apps/web/src/canvas/Editor.tsx
  - .agents/skills/mcp-builder/scripts/connections.py
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/wiring.ts
  - .agents/skills/mcp-builder/scripts/example_evaluation.xml
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - apps/api/src/agent/system-prompt.ts
  - apps/web/src/agent/store.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/agent/useAgentRun.ts
  - apps/api/src/agent/title-gen.ts
  - .agents/skills/mcp-builder/SKILL.md
  - apps/web/src/agent/TokenUsageFooter.tsx
  - bun.lock
  - .agents/skills/mcp-builder/LICENSE.txt
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/web/src/agent/TokenUsageFooter.test.tsx
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
  - e2e/agent-rate-limit-toast.spec.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/agent/threads/handlers.test.ts
  - apps/api/src/sync/geo-defaults.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - e2e/agent-multi-tab-badge.spec.ts
  - apps/web/src/agent/store.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/web/src/agent/ChatList.test.tsx
  - apps/api/src/agent/threads/repo.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/web/src/agent/AiSidePanel.test.tsx
  - apps/api/src/agent/title-gen.test.ts
  - apps/api/src/db/schema.test.ts
  - e2e/agent-cancel.spec.ts
  - apps/web/src/agent/useAgentThread.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/web/src/agent/ChatComposer.test.tsx
  - apps/web/src/agent/cursor-ai-badge.test.ts
  - apps/web/src/agent/ThreadSwitcher.test.tsx
  - e2e/agent-viewer-no-panel.spec.ts
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/agent/wiring.test.ts
  - apps/web/src/agent/useAgentRun.test.ts
  - apps/web/src/agent/sse-parser.test.ts
  - apps/api/src/agent/streaming.test.ts
  - apps/api/src/agent/system-prompt.test.ts
-->

---
### Requirement: First-run completion triggers background title generation

When the runtime emits a `done` terminal event for a thread whose current title equals the fallback string (the string computed from the first user message at thread creation), the runtime SHALL enqueue a fire-and-forget background task that generates a new title using the provider's economy-tier model. The background task SHALL run asynchronously after the SSE `done` event has been written to the client, SHALL NOT block the SSE response, SHALL NOT consume the `AGENT_RUN_RULE` rate-limit budget, and SHALL log structured Pino warnings on failure rather than surface them to the client.

The fallback string SHALL be computed once at thread creation: the first user message truncated to 30 characters at a word boundary, with `"…"` appended when truncation occurred. When the thread has zero messages, the fallback SHALL be the empty string.

#### Scenario: Successful first run triggers title task

- **GIVEN** thread T with title equal to the fallback (e.g., `"create a markdown s…"`) and run R1 used provider `openai`
- **WHEN** R1 emits `done` with non-null usage
- **THEN** the runtime SHALL emit the SSE `done` event immediately (before the title task completes)
- **AND** within 5 seconds the runtime SHALL invoke the economy-tier title-generation provider call once with the model `gpt-4o-mini`
- **AND** the resulting title SHALL be UPDATEd into `ai_threads.title` for T.

#### Scenario: Subsequent run does not re-trigger title task

- **GIVEN** thread T whose title is already non-fallback (i.e., a previous run already regenerated it to `"Greeting Markdown Shape"`)
- **WHEN** another run R2 against thread T emits `done`
- **THEN** the runtime SHALL NOT enqueue a title-generation task
- **AND** thread T's title SHALL remain unchanged.


<!-- @trace
source: add-ai-side-panel-and-threads
updated: 2026-05-13
code:
  - .agents/skills/mcp-builder/scripts/requirements.txt
  - docs/PHASE2_MILESTONES.md
  - scripts/dev-proxy.ts
  - skills-lock.json
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/agent/threads/handlers.ts
  - apps/web/src/agent/useAgentThread.ts
  - .agents/skills/mcp-builder/reference/python_mcp_server.md
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/agent/ChatList.tsx
  - .agents/skills/mcp-builder/reference/evaluation.md
  - apps/api/src/agent/threads/repo.ts
  - apps/api/drizzle/meta/0006_snapshot.json
  - apps/api/src/index.ts
  - apps/web/package.json
  - apps/api/src/agent/sse-endpoint.ts
  - apps/web/src/agent/sse-parser.ts
  - .agents/skills/mcp-builder/reference/node_mcp_server.md
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/agent/runtime.ts
  - .agents/skills/mcp-builder/reference/mcp_best_practices.md
  - apps/api/src/sync/mutator.ts
  - apps/api/src/sync/geo-defaults.ts
  - packages/shared/src/agent-events.ts
  - e2e/helpers/agent-setup.ts
  - apps/api/drizzle/0006_ai_threads.sql
  - apps/web/src/agent/ThreadSwitcher.tsx
  - apps/web/src/agent/cursor-ai-badge.ts
  - .agents/skills/mcp-builder/scripts/evaluation.py
  - packages/shared/src/locales/en.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/db/schema.ts
  - apps/web/src/agent/ChatComposer.tsx
  - apps/web/src/canvas/Editor.tsx
  - .agents/skills/mcp-builder/scripts/connections.py
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/wiring.ts
  - .agents/skills/mcp-builder/scripts/example_evaluation.xml
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - apps/api/src/agent/system-prompt.ts
  - apps/web/src/agent/store.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/agent/useAgentRun.ts
  - apps/api/src/agent/title-gen.ts
  - .agents/skills/mcp-builder/SKILL.md
  - apps/web/src/agent/TokenUsageFooter.tsx
  - bun.lock
  - .agents/skills/mcp-builder/LICENSE.txt
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/web/src/agent/TokenUsageFooter.test.tsx
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
  - e2e/agent-rate-limit-toast.spec.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/agent/threads/handlers.test.ts
  - apps/api/src/sync/geo-defaults.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - e2e/agent-multi-tab-badge.spec.ts
  - apps/web/src/agent/store.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/web/src/agent/ChatList.test.tsx
  - apps/api/src/agent/threads/repo.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/web/src/agent/AiSidePanel.test.tsx
  - apps/api/src/agent/title-gen.test.ts
  - apps/api/src/db/schema.test.ts
  - e2e/agent-cancel.spec.ts
  - apps/web/src/agent/useAgentThread.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/web/src/agent/ChatComposer.test.tsx
  - apps/web/src/agent/cursor-ai-badge.test.ts
  - apps/web/src/agent/ThreadSwitcher.test.tsx
  - e2e/agent-viewer-no-panel.spec.ts
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/agent/wiring.test.ts
  - apps/web/src/agent/useAgentRun.test.ts
  - apps/web/src/agent/sse-parser.test.ts
  - apps/api/src/agent/streaming.test.ts
  - apps/api/src/agent/system-prompt.test.ts
-->

---
### Requirement: Runtime prepends a system prompt with canvas digest at run start

At the start of each run, the runtime SHALL build a system prompt from a `buildSystemPrompt` helper and prepend it as `conversation[0]` with `role: "system"` before the persisted thread history. The system prompt SHALL NOT be persisted to `ai_messages` — it is rebuilt fresh per run because the canvas snapshot moves between runs.

The system prompt SHALL contain two sections:

1. **Behavioural discipline** (static text): instructs the model to consult the embedded canvas state before placing two or more new shapes, to call `getCanvasBounds` / `listShapesInViewport` for fresher information mid-run, to keep meaningful empty space between adjacent shapes, to avoid overlapping existing shapes unless the user explicitly asks for overlap, to call `getShape` before `updateShape` unless the shape was just created this turn, and to summarise each run concretely (which shape ids were created or moved, and to what coordinates) without claiming changes that were not actually performed.
2. **Canvas digest** (dynamic): a snapshot derived from the live room registry containing (a) overall canvas bounds when the canvas is non-empty, and (b) a per-shape summary listing each shape's id, type, `(x, y)` position, and `w × h` dimensions. When the canvas is empty, the digest SHALL state this explicitly. When the canvas snapshot read fails (the room registry returns no entry for the canvas), the digest SHALL state that the canvas state is unavailable so the model knows to call read tools first.

When the digest contains more shapes than a fixed cap (40), the digest SHALL list the first cap-worth of shapes and SHALL note the remainder count plus a suggestion to call `listShapesInViewport` for region-specific inspection.

The runtime SHALL source the per-shape data from an internal `listAllShapes(deps, canvasId)` reader and the overall bounds from `getCanvasBounds(deps, canvasId)`. `listAllShapes` SHALL be exported by `mutator-readers` for runtime use but SHALL NOT appear in the LLM-facing tool registry.

#### Scenario: System prompt prepended to every provider call

- **WHEN** the runtime issues any provider call during a run
- **THEN** the messages passed to the provider SHALL have `role: "system"` at index 0
- **AND** that system message's content SHALL be a non-empty string identifying the runtime as the Vellum canvas-native co-pilot.

#### Scenario: System prompt flags state as unavailable when the room is missing

- **GIVEN** a run against a canvas whose room registry entry is absent (e.g., dev fixture with no active room)
- **WHEN** the runtime builds the system prompt
- **THEN** the prompt's canvas-state section SHALL contain wording that signals state is unavailable (such as "unavailable" or "not available")
- **AND** the prompt SHALL still instruct the model to consult read tools before placing new shapes.

#### Scenario: Canvas digest lists existing shapes with id, type, and geometry

- **GIVEN** a canvas with three shapes: `shape:a` (markdown, (100, 100), 200×100), `shape:b` (callout, (400, 100), 200×100), `shape:c` (code, (100, 250), 200×100)
- **WHEN** the runtime builds the system prompt
- **THEN** the prompt SHALL contain the substrings `shape:a`, `shape:b`, `shape:c`
- **AND** each shape's type, x, y, w, h SHALL be present in the digest.

#### Scenario: System prompt is not persisted to the thread

- **GIVEN** a run against thread T
- **WHEN** the run completes (terminal `done` event)
- **THEN** `ai_messages` rows for T SHALL NOT contain any row with `role='system'` produced by this prompt
- **AND** the next run against T SHALL rebuild the system prompt from the live canvas snapshot, not load it from storage.


<!-- @trace
source: add-ai-side-panel-and-threads
updated: 2026-05-13
code:
  - .agents/skills/mcp-builder/scripts/requirements.txt
  - docs/PHASE2_MILESTONES.md
  - scripts/dev-proxy.ts
  - skills-lock.json
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/agent/threads/handlers.ts
  - apps/web/src/agent/useAgentThread.ts
  - .agents/skills/mcp-builder/reference/python_mcp_server.md
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/agent/ChatList.tsx
  - .agents/skills/mcp-builder/reference/evaluation.md
  - apps/api/src/agent/threads/repo.ts
  - apps/api/drizzle/meta/0006_snapshot.json
  - apps/api/src/index.ts
  - apps/web/package.json
  - apps/api/src/agent/sse-endpoint.ts
  - apps/web/src/agent/sse-parser.ts
  - .agents/skills/mcp-builder/reference/node_mcp_server.md
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/agent/runtime.ts
  - .agents/skills/mcp-builder/reference/mcp_best_practices.md
  - apps/api/src/sync/mutator.ts
  - apps/api/src/sync/geo-defaults.ts
  - packages/shared/src/agent-events.ts
  - e2e/helpers/agent-setup.ts
  - apps/api/drizzle/0006_ai_threads.sql
  - apps/web/src/agent/ThreadSwitcher.tsx
  - apps/web/src/agent/cursor-ai-badge.ts
  - .agents/skills/mcp-builder/scripts/evaluation.py
  - packages/shared/src/locales/en.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/db/schema.ts
  - apps/web/src/agent/ChatComposer.tsx
  - apps/web/src/canvas/Editor.tsx
  - .agents/skills/mcp-builder/scripts/connections.py
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/wiring.ts
  - .agents/skills/mcp-builder/scripts/example_evaluation.xml
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - apps/api/src/agent/system-prompt.ts
  - apps/web/src/agent/store.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/agent/useAgentRun.ts
  - apps/api/src/agent/title-gen.ts
  - .agents/skills/mcp-builder/SKILL.md
  - apps/web/src/agent/TokenUsageFooter.tsx
  - bun.lock
  - .agents/skills/mcp-builder/LICENSE.txt
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/web/src/agent/TokenUsageFooter.test.tsx
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
  - e2e/agent-rate-limit-toast.spec.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/agent/threads/handlers.test.ts
  - apps/api/src/sync/geo-defaults.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - e2e/agent-multi-tab-badge.spec.ts
  - apps/web/src/agent/store.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/web/src/agent/ChatList.test.tsx
  - apps/api/src/agent/threads/repo.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/web/src/agent/AiSidePanel.test.tsx
  - apps/api/src/agent/title-gen.test.ts
  - apps/api/src/db/schema.test.ts
  - e2e/agent-cancel.spec.ts
  - apps/web/src/agent/useAgentThread.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/web/src/agent/ChatComposer.test.tsx
  - apps/web/src/agent/cursor-ai-badge.test.ts
  - apps/web/src/agent/ThreadSwitcher.test.tsx
  - e2e/agent-viewer-no-panel.spec.ts
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/agent/wiring.test.ts
  - apps/web/src/agent/useAgentRun.test.ts
  - apps/web/src/agent/sse-parser.test.ts
  - apps/api/src/agent/streaming.test.ts
  - apps/api/src/agent/system-prompt.test.ts
-->

---
### Requirement: Provider adapter extracts token usage from finish-step events

The Vercel AI SDK `streamText` `fullStream` emits a `finish-step` part once per multi-turn step, carrying a `usage` object whose `inputTokens` / `outputTokens` fields are `number | undefined`. The provider adapter (`buildVercelProviderAdapter`) SHALL translate each AI SDK `finish-step` part into TWO consecutive `ProviderEvent`s on the bridge generator:

1. `{ type: "step-finish", finishReason }` — carries the finish reason so the runtime's exit logic can branch.
2. `{ type: "usage", usage: { input, output } }` — emitted **only when at least one of** `inputTokens` / `outputTokens` is a defined number. When both are undefined, the adapter SHALL omit the `usage` event so the runtime's `usageTotals` accumulator stays `null` and the "provider returned no usage information" warning path remains the source of truth for that diagnostic.

When exactly one of `inputTokens` / `outputTokens` is defined, the missing side SHALL be filled with `0` in the emitted ProviderEvent so the runtime always sees both fields as `number`.

The bridge translation SHALL be exposed as a pure helper (`aiSdkPartToProviderEvents(part)`) so the mapping is unit-testable without standing up a real model client.

#### Scenario: finish-step with both token counts emits step-finish then usage

- **GIVEN** an AI SDK `finish-step` part with `usage: { inputTokens: 1500, outputTokens: 800 }` and `finishReason: "stop"`
- **WHEN** `aiSdkPartToProviderEvents` runs against the part
- **THEN** the returned array SHALL be exactly `[{ type: "step-finish", finishReason: "stop" }, { type: "usage", usage: { input: 1500, output: 800 } }]` (in that order).

#### Scenario: finish-step without a usage object emits step-finish only

- **GIVEN** an AI SDK `finish-step` part with no `usage` key
- **WHEN** `aiSdkPartToProviderEvents` runs against the part
- **THEN** the returned array SHALL contain exactly one entry, `{ type: "step-finish", finishReason: ... }`.

#### Scenario: finish-step with both token counts undefined omits the usage event

- **GIVEN** an AI SDK `finish-step` part with `usage: { inputTokens: undefined, outputTokens: undefined }`
- **WHEN** `aiSdkPartToProviderEvents` runs against the part
- **THEN** the returned array SHALL NOT contain any `{ type: "usage", ... }` entry.

#### Scenario: finish-step with partial usage fills the missing side with zero

- **GIVEN** an AI SDK `finish-step` part with `usage: { inputTokens: 100, outputTokens: undefined }`
- **WHEN** `aiSdkPartToProviderEvents` runs against the part
- **THEN** the returned array SHALL contain `{ type: "usage", usage: { input: 100, output: 0 } }`.

<!-- @trace
source: add-ai-side-panel-and-threads
updated: 2026-05-13
code:
  - .agents/skills/mcp-builder/scripts/requirements.txt
  - docs/PHASE2_MILESTONES.md
  - scripts/dev-proxy.ts
  - skills-lock.json
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/agent/threads/handlers.ts
  - apps/web/src/agent/useAgentThread.ts
  - .agents/skills/mcp-builder/reference/python_mcp_server.md
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/agent/ChatList.tsx
  - .agents/skills/mcp-builder/reference/evaluation.md
  - apps/api/src/agent/threads/repo.ts
  - apps/api/drizzle/meta/0006_snapshot.json
  - apps/api/src/index.ts
  - apps/web/package.json
  - apps/api/src/agent/sse-endpoint.ts
  - apps/web/src/agent/sse-parser.ts
  - .agents/skills/mcp-builder/reference/node_mcp_server.md
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/src/agent/runtime.ts
  - .agents/skills/mcp-builder/reference/mcp_best_practices.md
  - apps/api/src/sync/mutator.ts
  - apps/api/src/sync/geo-defaults.ts
  - packages/shared/src/agent-events.ts
  - e2e/helpers/agent-setup.ts
  - apps/api/drizzle/0006_ai_threads.sql
  - apps/web/src/agent/ThreadSwitcher.tsx
  - apps/web/src/agent/cursor-ai-badge.ts
  - .agents/skills/mcp-builder/scripts/evaluation.py
  - packages/shared/src/locales/en.json
  - apps/api/drizzle/meta/_journal.json
  - apps/api/src/db/schema.ts
  - apps/web/src/agent/ChatComposer.tsx
  - apps/web/src/canvas/Editor.tsx
  - .agents/skills/mcp-builder/scripts/connections.py
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/agent/wiring.ts
  - .agents/skills/mcp-builder/scripts/example_evaluation.xml
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - apps/api/src/agent/system-prompt.ts
  - apps/web/src/agent/store.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/agent/useAgentRun.ts
  - apps/api/src/agent/title-gen.ts
  - .agents/skills/mcp-builder/SKILL.md
  - apps/web/src/agent/TokenUsageFooter.tsx
  - bun.lock
  - .agents/skills/mcp-builder/LICENSE.txt
tests:
  - apps/api/src/sync/mutator.test.ts
  - apps/web/src/agent/TokenUsageFooter.test.tsx
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
  - e2e/agent-rate-limit-toast.spec.ts
  - packages/shared/src/agent-events.test.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/agent/threads/handlers.test.ts
  - apps/api/src/sync/geo-defaults.test.ts
  - apps/api/src/sync/tool-registry.test.ts
  - e2e/agent-multi-tab-badge.spec.ts
  - apps/web/src/agent/store.test.ts
  - apps/api/src/agent/integration.test.ts
  - apps/web/src/agent/ChatList.test.tsx
  - apps/api/src/agent/threads/repo.test.ts
  - apps/api/src/agent/runtime.test.ts
  - apps/web/src/agent/AiSidePanel.test.tsx
  - apps/api/src/agent/title-gen.test.ts
  - apps/api/src/db/schema.test.ts
  - e2e/agent-cancel.spec.ts
  - apps/web/src/agent/useAgentThread.test.ts
  - apps/api/src/agent/sse-endpoint.test.ts
  - apps/web/src/agent/ChatComposer.test.tsx
  - apps/web/src/agent/cursor-ai-badge.test.ts
  - apps/web/src/agent/ThreadSwitcher.test.tsx
  - e2e/agent-viewer-no-panel.spec.ts
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/agent/wiring.test.ts
  - apps/web/src/agent/useAgentRun.test.ts
  - apps/web/src/agent/sse-parser.test.ts
  - apps/api/src/agent/streaming.test.ts
  - apps/api/src/agent/system-prompt.test.ts
-->