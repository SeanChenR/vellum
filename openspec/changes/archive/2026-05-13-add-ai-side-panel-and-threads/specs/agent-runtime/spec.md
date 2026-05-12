## ADDED Requirements

### Requirement: Runtime loads conversation history from thread storage

The agent runtime SHALL receive a `ThreadRepo` dependency exposing `loadMessages(threadId)` (returning ordered `ai_messages` rows for the thread), `appendMessage(threadId, message)` (inserting a new row), and `setUsageOnLastAssistant(threadId, runId, usage)` (writing token usage to the most recent assistant row for the run). The runtime SHALL refuse to accept a client-supplied `messages` array; conversation history SHALL come exclusively from `ThreadRepo.loadMessages`.

At the start of each run, the runtime SHALL load the thread's full message history, append the new user message provided in the run request as an `ai_messages` row with `role='user'`, and pass the combined sequence to the provider as the conversation context.

#### Scenario: Multi-turn thread continuation

- **GIVEN** thread T with prior `ai_messages` rows `[user("hi"), assistant("hello")]`
- **WHEN** a run is dispatched with `userMessage: "draw a square"` against thread T
- **THEN** before invoking the provider, the runtime SHALL append a row `user("draw a square")` to T
- **AND** the provider SHALL be invoked with the full message sequence `[user("hi"), assistant("hello"), user("draw a square")]`
- **AND** the runtime SHALL NOT read any `messages` field from the inbound HTTP body.

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
