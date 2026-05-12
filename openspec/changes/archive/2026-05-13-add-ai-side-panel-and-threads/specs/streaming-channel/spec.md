## MODIFIED Requirements

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

## ADDED Requirements

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
