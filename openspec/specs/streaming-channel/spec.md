# streaming-channel Specification

## Purpose

TBD - created by archiving change 'add-agent-runtime-streaming'. Update Purpose after archive.

## Requirements

### Requirement: Run endpoint accepts POST with model selection

The streaming channel SHALL expose `POST /agent/canvas/:canvasId/run` accepting a JSON body containing `provider` (`"openai" | "anthropic" | "google"`), `model` (string matching the BYOK pricing catalog), `messages` (array of role+content objects), and optional `runId` (UUID v4 string; if omitted, the server SHALL generate one with `crypto.randomUUID()`). The endpoint SHALL respond with HTTP 200 and `Content-Type: text/event-stream` once permission and rate-limit checks pass, and SHALL stream agent events until the run reaches a terminal state.

#### Scenario: Successful run start

- **WHEN** an editor session POSTs `{provider: "openai", model: "gpt-4o-mini", messages: [{role: "user", content: "..."}]}`
- **THEN** the server SHALL respond with HTTP 200, `Content-Type: text/event-stream`, headers `Cache-Control: no-cache` and `X-Accel-Buffering: no`, and the body SHALL begin streaming SSE events while the run progresses.

#### Scenario: Body validation failure

- **WHEN** the request body has `provider: "unknown"`
- **THEN** the server SHALL respond with HTTP 400 and `errorKey: "agent.error.invalidRequest"` without entering the run lifecycle.


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
### Requirement: Cancel endpoint accepts POST by runId

The streaming channel SHALL expose `POST /agent/run/:runId/cancel` requiring no request body. The endpoint SHALL look up the runId in the cancellation registry, invoke `AbortController.abort()` if present, and respond with HTTP 204 regardless of whether the run was actually running (idempotent). The cancel endpoint SHALL be subject to permission gate (only the originating user SHALL cancel their own run).

#### Scenario: Cancel an active run

- **GIVEN** runId `r1` is in `running` state owned by user `u1`
- **WHEN** user `u1` POSTs to `/agent/run/r1/cancel`
- **THEN** the server SHALL abort the run's AbortController, return HTTP 204, and the SSE channel for `r1` SHALL emit `error` with `errorKey: "agent.error.cancelled"` followed by stream close.

#### Scenario: Cancel for unknown runId is idempotent

- **WHEN** any user POSTs to `/agent/run/unknown-id/cancel`
- **THEN** the server SHALL respond with HTTP 204 and SHALL NOT log an error.

#### Scenario: User attempts to cancel another user's run

- **GIVEN** runId `r1` belongs to user `u1`
- **WHEN** user `u2` POSTs to `/agent/run/r1/cancel`
- **THEN** the server SHALL respond with HTTP 403 and SHALL NOT abort the run.


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
### Requirement: SSE event types are a closed discriminated union

The streaming channel SHALL emit only the following event types, each as a single SSE `event:` frame with a JSON `data:` payload validated against a shared zod schema in `packages/shared/src/agent-events.ts`:

- `text`: `{ type: "text", runId, delta: string }` — partial assistant text token(s).
- `tool_call`: `{ type: "tool_call", runId, callId: string, name: string, args: object }` — emitted before the corresponding tool execution begins.
- `tool_result`: `{ type: "tool_result", runId, callId: string, result: object | { errorKey: string } }` — emitted after the tool call returns.
- `error`: `{ type: "error", runId, errorKey: string, detail?: string }` — emitted exactly once at any non-`done` terminal state.
- `done`: `{ type: "done", runId }` — emitted exactly once when the run completes successfully.

A single run SHALL emit exactly one terminal event (`done` or `error`) and SHALL close the underlying ReadableStream immediately after.

#### Scenario: Successful run with one tool call

- **GIVEN** an LLM that calls `createShape` once and then emits text
- **WHEN** the run executes
- **THEN** the SSE event sequence SHALL be (in order): one or more `text` events, then one `tool_call`, then one `tool_result`, then optionally more `text` events, then exactly one `done` event, then stream close.

##### Example: event ordering

| Step | Event | Payload sketch |
| ---- | ----- | -------------- |
| 1 | text | `{type: "text", runId: "r1", delta: "I will create a shape."}` |
| 2 | tool_call | `{type: "tool_call", runId: "r1", callId: "c1", name: "createShape", args: {...}}` |
| 3 | tool_result | `{type: "tool_result", runId: "r1", callId: "c1", result: {ok: true, shapeId: "..."}}` |
| 4 | text | `{type: "text", runId: "r1", delta: " Done."}` |
| 5 | done | `{type: "done", runId: "r1"}` |
| 6 | (stream close) | n/a |


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
### Requirement: Heartbeat every 15 seconds while streaming

The streaming channel SHALL emit an SSE comment line (`:hb\n\n`) every 15 seconds while the run is in `running` state and there has been no other event in the past 15 seconds. The heartbeat SHALL NOT be emitted before the run enters `running`, and SHALL NOT be emitted after the terminal event.

#### Scenario: Long provider call without text

- **GIVEN** a provider call has been pending for 30 seconds with no tokens emitted
- **WHEN** the wall-clock timeout has not yet been reached
- **THEN** the SSE channel SHALL have emitted at least one `:hb\n\n` comment line at t≈15s and another at t≈30s relative to run start.


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
### Requirement: SSE response sets buffering-defeating headers

The run endpoint SHALL set `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`, and `Content-Type: text/event-stream; charset=utf-8` on the HTTP response. These headers SHALL be set before any event is written.

#### Scenario: Response headers on a successful run

- **WHEN** the server responds to a valid run request
- **THEN** the response SHALL contain (case-insensitive) headers `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`, and `Content-Type: text/event-stream; charset=utf-8`.


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
### Requirement: Run endpoint enforces AGENT_RUN_RULE rate limit

The run endpoint SHALL be protected by a rate-limit rule keyed on `session.userId` permitting 5 requests per 60-second sliding window. Requests exceeding the limit SHALL receive HTTP 429 with a `Retry-After` header and `errorKey: "agent.error.rateLimited"`. The cancel endpoint SHALL NOT be rate-limited.

#### Scenario: Sixth run request within 60 seconds

- **GIVEN** a user has issued 5 successful run requests within the past 60 seconds
- **WHEN** the user issues a sixth run request
- **THEN** the server SHALL respond with HTTP 429, a `Retry-After` header of at most 60, and `errorKey: "agent.error.rateLimited"`, and SHALL NOT enter the run lifecycle.


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
### Requirement: Run id format

The runtime SHALL accept only UUID v4 strings as `runId`. When the run endpoint generates a runId server-side (because the request omits it), it SHALL use `crypto.randomUUID()`. RunIds SHALL appear in every event of that run and in the cancel endpoint path.

#### Scenario: Client-provided runId is non-UUID

- **WHEN** the run request body contains `runId: "abc"`
- **THEN** the server SHALL respond with HTTP 400 and `errorKey: "agent.error.invalidRequest"`.


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
### Requirement: Connection close on terminal state

The streaming channel SHALL close the underlying ReadableStream within 100 milliseconds of writing the terminal event (`done` or `error`). After stream close, no further events SHALL be written for that runId. A subsequent client request reusing the same runId SHALL be rejected with HTTP 409 and `errorKey: "agent.error.runIdReused"`.

#### Scenario: Client reuses a completed runId

- **GIVEN** runId `r1` has already reached `done`
- **WHEN** any client POSTs to `/agent/canvas/:canvasId/run` with `runId: "r1"`
- **THEN** the server SHALL respond with HTTP 409 and `errorKey: "agent.error.runIdReused"`.

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