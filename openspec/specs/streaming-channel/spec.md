# streaming-channel Specification

## Purpose

TBD - created by archiving change 'add-agent-runtime-streaming'. Update Purpose after archive.

## Requirements

### Requirement: Run endpoint accepts POST with model selection

The streaming channel SHALL expose `POST /agent/canvas/:canvasId/run` accepting a JSON body containing `provider` (`"openai" | "anthropic" | "google"`), `model` (string matching the BYOK pricing catalog), `threadId` (string referencing an `ai_threads.id` owned by the authenticated user on the addressed canvas), `userMessage` (non-empty string content of the new prompt to append before running), and optional `runId` (UUID v4 string; if omitted, the server SHALL generate one with `crypto.randomUUID()`). The server SHALL reject any body containing the legacy `messages` field with HTTP 400 and `errorKey: "agent.error.invalidRequest"`. The server SHALL also reject any body whose `threadId` does not reference a thread owned by the authenticated user with HTTP 400 and `errorKey: "agent.error.invalidRequest"` (this response SHALL NOT distinguish between non-existent thread and thread owned by another user, to avoid leaking thread existence). The endpoint SHALL respond with HTTP 200 and `Content-Type: text/event-stream` once permission, thread ownership, and rate-limit checks pass, and SHALL stream agent events until the run reaches a terminal state. Server-side, the runtime SHALL load the thread's existing `ai_messages` (ordered by `created_at`), append the supplied `userMessage` as a new row, and then run the agent loop persisting each emitted assistant text / tool_call / tool_result message as additional rows.

#### Scenario: Successful run start

- **WHEN** an editor session POSTs `{provider: "openai", model: "gpt-4o-mini", threadId: "thr_abc", userMessage: "create a markdown shape"}`
- **THEN** the server SHALL respond with HTTP 200, `Content-Type: text/event-stream`, headers `Cache-Control: no-cache` and `X-Accel-Buffering: no`
- **AND** the body SHALL begin streaming SSE events while the run progresses
- **AND** the server SHALL append the supplied `userMessage` to thread `thr_abc` as a new row in `ai_messages` before the first provider call.

#### Scenario: Body validation failure on missing threadId

- **WHEN** the request body is `{provider: "openai", model: "gpt-4o-mini", userMessage: "hi"}` (no `threadId`)
- **THEN** the server SHALL respond with HTTP 400 and `errorKey: "agent.error.invalidRequest"` without entering the run lifecycle.

#### Scenario: Body validation rejects legacy messages field

- **WHEN** the request body contains a `messages` field (e.g., `{provider, model, threadId, userMessage, messages: [...]}`)
- **THEN** the server SHALL respond with HTTP 400 and `errorKey: "agent.error.invalidRequest"` without entering the run lifecycle.

#### Scenario: Thread ownership rejected

- **GIVEN** thread `thr_abc` belongs to user U1
- **WHEN** user U2 POSTs `{provider, model, threadId: "thr_abc", userMessage: "..."}`
- **THEN** the server SHALL respond with HTTP 400 and `errorKey: "agent.error.invalidRequest"`
- **AND** the response SHALL NOT distinguish between "thread does not exist" and "thread exists but is not yours" so as not to leak existence.


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

- `text`: `{ type: "text", runId, delta: string }` — partial assistant text token(s)
- `tool_call`: `{ type: "tool_call", runId, callId: string, name: string, args: object }` — emitted before the corresponding tool execution begins
- `tool_result`: `{ type: "tool_result", runId, callId: string, result: object | { errorKey: string } }` — emitted after the tool call returns
- `error`: `{ type: "error", runId, errorKey: string, detail?: string }` — emitted exactly once at any non-`done` terminal state
- `done`: `{ type: "done", runId, usage: { input: number, output: number, provider: "openai" | "anthropic" | "google", model: string } | null }` — emitted exactly once when the run completes successfully. The `usage` field SHALL contain the run-aggregated token totals from the provider summed across every turn of the multi-turn tool loop. The `usage` field SHALL be `null` only when the provider's response did not include usage information.

A single run SHALL emit exactly one terminal event (either `done` or `error`) and SHALL close the underlying ReadableStream immediately after.

#### Scenario: Successful run with one tool call

- **GIVEN** an LLM that calls `createShape` once and then emits text
- **WHEN** the run executes
- **THEN** the SSE event sequence SHALL be (in order): one or more `text` events, then one `tool_call`, then one `tool_result`, then optionally more `text` events, then exactly one `done` event with non-null `usage`, then stream close.

##### Example: event ordering with usage payload

| Step | Event | Payload sketch |
| ---- | ----- | -------------- |
| 1 | text | `{type: "text", runId: "r1", delta: "I will create a shape."}` |
| 2 | tool_call | `{type: "tool_call", runId: "r1", callId: "c1", name: "createShape", args: {...}}` |
| 3 | tool_result | `{type: "tool_result", runId: "r1", callId: "c1", result: {ok: true, shapeId: "..."}}` |
| 4 | text | `{type: "text", runId: "r1", delta: " Done."}` |
| 5 | done | `{type: "done", runId: "r1", usage: {input: 1500, output: 800, provider: "openai", model: "gpt-4o-mini"}}` |
| 6 | (stream close) | n/a |

#### Scenario: Provider returns no usage information

- **WHEN** the provider's terminal response omits the usage object (or returns it with all-zero values that fail the runtime's plausibility check)
- **THEN** the runtime SHALL still emit the `done` event with `usage: null`
- **AND** the runtime SHALL log a structured Pino warning record with `level=warn` and `event=ai_provider_missing_usage`.


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

---
### Requirement: SSE connection survives gaps between events

The streaming channel SHALL keep the SSE connection open for the full duration of an agent run even when there is no application-level event for tens of seconds (for example while the model deliberates between tool calls). The default `Bun.serve` per-request idle timeout (10 s) is incompatible with this contract.

The server SHALL override the per-request idle timeout on the run route to the maximum value `Bun.serve` accepts (255 s). In addition, the SSE writer SHALL emit a heartbeat comment frame (`:hb\n\n`) at intervals strictly less than the configured idle timeout (target: every 15 s of write silence) so that no real downstream sees an idle gap larger than the heartbeat interval. The heartbeat SHALL be activated in the production run path, not only in unit tests.

Any in-process development proxy that forwards the SSE route SHALL apply an equivalent idle-timeout override so the proxy hop does not cut the stream before the upstream does.

#### Scenario: Model deliberation longer than 30 seconds does not close the stream

- **GIVEN** a run where the model takes 30 seconds of silence before emitting the next event
- **WHEN** the SSE stream is observed by the client
- **THEN** the connection SHALL remain open the entire time
- **AND** at least one heartbeat comment frame (`:hb`) SHALL have been written within the silent window.

#### Scenario: Heartbeat ticker is wired into the production run handler

- **WHEN** the production run handler starts a new SSE stream
- **THEN** the handler SHALL call `SseWriter.startHeartbeat()` once
- **AND** the handler SHALL schedule a periodic call to `SseWriter.tickHeartbeat()` at an interval less than the 15 s heartbeat target
- **AND** the periodic ticker SHALL be cleared when the run reaches a terminal state.

#### Scenario: Dev proxy preserves the idle-timeout override on the run route

- **GIVEN** the dev proxy at `:3002` forwarding requests to the upstream API at `:3000`
- **WHEN** a request to `POST /api/agent/canvas/:canvasId/run` is forwarded
- **THEN** the proxy SHALL apply the same per-request idle-timeout override as the upstream so the proxy-side `Bun.serve` does not terminate the request before the upstream does.

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