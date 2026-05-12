## ADDED Requirements

### Requirement: Side Panel docks into Editor and is collapsible

The system SHALL render the AI Side Panel as a flex sibling to the tldraw canvas in `apps/web/src/canvas/Editor.tsx`. The panel SHALL be either expanded (384px wide) or fully collapsed (0px wide with the panel DOM unmounted). The panel state SHALL be controlled by a toggle button rendered in the TopBar adjacent to the existing Share button. The toggle button SHALL NOT be rendered when the caller's `effectiveRole` resolves to `viewer`.

#### Scenario: Viewer role hides toggle and panel

- **GIVEN** a user accessing canvas C via a view-mode public link such that `effectiveRole === "viewer"`
- **WHEN** the Editor renders
- **THEN** the AI Side Panel toggle button SHALL NOT be present in the DOM
- **AND** no panel mount point SHALL be rendered.

#### Scenario: Editor toggle expands and collapses panel

- **GIVEN** an editor user on canvas C with the panel currently collapsed
- **WHEN** the user clicks the AI Side Panel toggle button
- **THEN** the panel SHALL render with width 384px
- **AND** the canvas area SHALL shrink to fill the remaining horizontal space
- **WHEN** the user clicks the toggle button again
- **THEN** the panel SHALL unmount
- **AND** the canvas area SHALL reclaim full width.

### Requirement: Panel renders chat list with four message kinds

The chat list SHALL render messages from the active thread in chronological order. The list SHALL distinguish four visual variants by message role and content kind:

- `user`: right-aligned bubble with text content from `content.text`
- `assistant`: left-aligned bubble with text content; SHALL display a streaming caret indicator while the active run is in `running` state and this message is the most recent assistant row
- `tool_call` (role=`tool`, content kind=`call`): a collapsed accordion showing tool name and JSON args; expands on click
- `tool_result` (role=`tool`, content kind=`result`): a collapsed accordion showing either the success result or the translation of `content.errorKey`; expands on click

#### Scenario: Streaming caret on the last assistant message

- **GIVEN** thread T with messages `[user, assistant("partial...")]` and run R1 in `running` state
- **WHEN** the chat list renders
- **THEN** the last assistant bubble SHALL display a blinking caret indicator
- **WHEN** the run reaches a terminal state (done, error, cancelled, or timeout)
- **THEN** the caret SHALL disappear from that bubble.

### Requirement: Composer sends user message and switches to Cancel during run

The chat composer SHALL contain a textarea, an interactive provider/model picker, and an action button. The picker SHALL consist of two dropdowns rendered side by side: a **provider dropdown** listing every provider for which the user has saved a BYOK key (from the server-returned `BYOKProviderListItem[]`), and a **model dropdown** listing every model in `BYOK_PRICING` whose `providerId` matches the currently-selected provider. Both dropdowns SHALL be initialized from the server-returned `BYOKPreferencesMap` — the initially-selected provider SHALL be the first provider in `availableProviders` that has a non-empty preference entry (falling back to the first provider with a saved key when no preference exists), and the initially-selected model SHALL be that provider's preferred model (falling back to the first BYOK pricing row for that provider when no preference exists). Changing the provider dropdown SHALL reset the model dropdown to the new provider's preferred model (with the same fallback). The submitted run request SHALL carry whichever (provider, model) pair the user currently has selected in the dropdowns, not whatever was initially defaulted.

When the user has not configured any BYOK key (`availableProviders` is empty), the composer SHALL disable the textarea and the Send button, hide the picker dropdowns entirely, and render a hint message in their place pointing the user to Settings → API Keys to add a key (via the i18n key `agent.panel.noApiKeyHint`).

When no run is active, the action button SHALL render as Send and Cmd+Enter SHALL submit the textarea via POST to the run endpoint. While a run is in `running` state, the action button SHALL render as Cancel and SHALL POST to `/api/agent/run/:runId/cancel` when clicked. The Cancel action SHALL also be triggerable by the keyboard shortcut Cmd+. (period). While a run is `running`, additional submissions via Cmd+Enter SHALL be ignored.

#### Scenario: Provider dropdown lists every configured provider

- **GIVEN** the user has BYOK keys saved for `openai`, `anthropic`, and `google`
- **WHEN** the chat composer renders
- **THEN** the provider dropdown SHALL contain exactly three options whose values are `openai`, `anthropic`, and `google` (in any stable order).

#### Scenario: Model dropdown is filtered to the selected provider

- **GIVEN** the user has BYOK keys saved for `openai` and `anthropic`, with `openai` selected
- **WHEN** the chat composer renders
- **THEN** the model dropdown SHALL contain only models from `BYOK_PRICING` whose `providerId === "openai"`
- **AND** no model whose canonical id starts with `claude-` SHALL appear in the dropdown.

#### Scenario: Changing the provider resets the model to that provider's preference

- **GIVEN** preferences `{ openai: "gpt-4o-mini", anthropic: "claude-haiku-4-5" }` with `openai` currently selected
- **WHEN** the user changes the provider dropdown to `anthropic`
- **AND** the user submits the composer
- **THEN** the run request SHALL carry `provider: "anthropic"` and `model: "claude-haiku-4-5"`.

#### Scenario: Changing the model on the picker overrides the preference for this submission

- **GIVEN** `openai` selected with the default model `gpt-4o-mini`
- **WHEN** the user changes the model dropdown to a non-default openai model (e.g., `gpt-5`)
- **AND** the user submits the composer
- **THEN** the run request SHALL carry `provider: "openai"` and `model: "gpt-5"`.

#### Scenario: Composer fully disabled when no BYOK key is configured

- **GIVEN** the user has no BYOK keys saved (`availableProviders` is `[]`)
- **WHEN** the chat composer renders
- **THEN** the textarea SHALL be disabled
- **AND** the Send button SHALL be disabled
- **AND** neither the provider dropdown nor the model dropdown SHALL appear in the DOM
- **AND** a hint element using the i18n key `agent.panel.noApiKeyHint` SHALL be visible in the picker's slot.

#### Scenario: Send while a run is already running is ignored

- **GIVEN** thread T with run R1 in `running` state
- **WHEN** the user types a new prompt and presses Cmd+Enter
- **THEN** the composer SHALL NOT issue a new POST to `/api/agent/canvas/:canvasId/run`
- **AND** the composer SHALL keep the typed text in the textarea.

#### Scenario: Cancel ends the run cleanly

- **GIVEN** run R1 in `running` state with at least one tool call already completed
- **WHEN** the user clicks the Cancel button (or presses Cmd+.)
- **THEN** the client SHALL POST to `/api/agent/run/R1/cancel`
- **AND** the SSE channel for R1 SHALL emit `error` with `errorKey: "agent.error.cancelled"`
- **AND** the action button SHALL revert to Send
- **AND** any shapes already created during R1 SHALL remain on the canvas.

### Requirement: Token usage footer displays per-run and cumulative usage

The Side Panel footer SHALL display two rows:

- "This run" populated from the most recent SSE `done` event's `usage` payload, showing `input X / output Y tokens, $Z`
- "Total" populated from `GET /api/agent/threads/:threadId` `usage` aggregate, showing `input A / output B tokens, $C`

USD conversion SHALL be computed client-side using `pricePerMillion` values from `packages/shared/src/byok-pricing.ts`. The displayed cost SHALL be `((input / 1_000_000) * inputPricePerMillion) + ((output / 1_000_000) * outputPricePerMillion)`. Values SHALL render with 4 decimal places. Computed values that are strictly between `0` and `0.0001` SHALL render as the string `<$0.0001`. When the latest `done` event has `usage: null`, the per-run row SHALL show `—` for input, output, and cost.

##### Example: cost rendering boundary cases

| input tokens | output tokens | provider/model | rendered cost |
|--------------|---------------|----------------|---------------|
| 100 | 50 | openai/gpt-4o-mini | `$0.0001` |
| 1 | 1 | openai/gpt-4o-mini | `<$0.0001` |
| 0 | 0 | openai/gpt-4o-mini | `$0.0000` |
| null | null | openai/gpt-4o-mini | `—` |

#### Scenario: Done event populates this-run footer

- **GIVEN** the Side Panel is open with run R1 in `running` state
- **WHEN** the SSE channel emits `{type: "done", runId: "R1", usage: {input: 1500, output: 800, provider: "openai", model: "gpt-4o-mini"}}`
- **THEN** within 250ms the footer's "This run" row SHALL display `input 1500 / output 800 tokens` and a non-empty USD cost computed via the byok-pricing table.

### Requirement: Thread switcher allows multi-thread navigation

The Side Panel SHALL render a thread switcher dropdown above the chat list listing the user's threads on the current canvas in `updated_at DESC` order. The switcher SHALL include an action labeled `+ New chat` that POSTs to `/api/agent/threads/canvas/:canvasId`, sets the new thread as active, and clears the chat list. Each thread row SHALL display its title and a hover-revealed delete button bound to `DELETE /api/agent/threads/:threadId`.

#### Scenario: Create new thread reorders the switcher

- **GIVEN** canvas C with threads `[T1, T2]` and T1 currently active
- **WHEN** the user clicks `+ New chat`
- **THEN** a new thread T3 SHALL be created on the server
- **AND** T3 SHALL become active in the panel
- **AND** the chat list SHALL render empty
- **AND** the switcher dropdown SHALL list `[T3, T1, T2]` (newest first by `updated_at`).

#### Scenario: Delete the active thread falls back to next most-recent

- **GIVEN** canvas C with threads `[T3, T1, T2]` ordered by `updated_at DESC` and T3 currently active
- **WHEN** the user deletes T3 from the switcher
- **THEN** T3 SHALL be removed from the server (DELETE /api/agent/threads/T3 returns 204)
- **AND** T1 SHALL become active in the panel
- **AND** the switcher dropdown SHALL list `[T1, T2]`.

### Requirement: Cursor AI Badge surfaces aiActive presence flag

When a run dispatched from the local instance enters `running` state, the Side Panel SHALL set tldraw `instancePresence.userMeta.aiActive = true` on the local instance. When the run reaches any terminal state, the flag SHALL be reset to `false`. The CollaboratorAvatars chrome SHALL render an enhanced visual treatment (gradient golden border plus a sparkle SVG overlay) on any avatar whose presence row reports `aiActive === true`. The flag SHALL be the only AI-related field broadcast through the sync presence channel; thread message content SHALL NEVER traverse this channel.

#### Scenario: Multi-tab badge visibility

- **GIVEN** user U1 on canvas C in tab A and user U2 on canvas C in tab B
- **WHEN** U1 starts an agent run in tab A
- **THEN** within 500ms the avatar representing U1 in tab B's CollaboratorAvatars SHALL display the gradient border and sparkle overlay
- **WHEN** the run terminates in tab A (any terminal state)
- **THEN** within 500ms the overlay SHALL disappear from tab B.

#### Scenario: Disconnect clears badge implicitly

- **GIVEN** U1 has `aiActive=true` and is running an agent
- **WHEN** U1's WebSocket disconnects (network drop, browser close, server restart)
- **THEN** the sync presence row for U1 SHALL be removed from the collaborator list in all other tabs
- **AND** the overlay SHALL no longer appear for U1 in those tabs.

### Requirement: SSE consumer parses streaming-channel events

The system SHALL provide an SSE parser at `apps/web/src/agent/sse-parser.ts` that consumes `Uint8Array` chunks from `fetch(...).body.getReader()` and yields validated `AgentEvent` instances asynchronously. The parser SHALL:

- Buffer partial UTF-8 sequences across chunk boundaries via `TextDecoder({stream: true})`
- Buffer partial SSE lines until a newline arrives
- Dispatch a complete event at every blank-line boundary (per the SSE specification)
- Validate each `data:` JSON payload against the shared zod schema in `packages/shared/src/agent-events.ts` and discard payloads that fail validation while logging a console warning
- Discard SSE comment lines (lines beginning with `:`) silently without yielding events

#### Scenario: Heartbeat does not surface as event

- **GIVEN** an open SSE stream
- **WHEN** the parser receives the chunk `: hb\n\n`
- **THEN** the parser SHALL NOT yield an event
- **AND** the parser SHALL continue waiting for additional chunks.

#### Scenario: Multi-byte UTF-8 split across chunks

- **GIVEN** an SSE event payload `data: {"type":"text","runId":"r1","delta":"测试"}\n\n`
- **WHEN** the bytes for `测` are split across two chunks (e.g., 2 bytes in chunk 1, 1 byte in chunk 2)
- **THEN** the parser SHALL still yield exactly one event with `delta` equal to the string `"测试"` (correctly decoded).

### Requirement: Rate limit response shows toast with errorKey translation

When the run endpoint returns HTTP 429 with body `{errorKey: "agent.error.rateLimited"}` (or any other non-streaming error response with an `errorKey`), the Side Panel SHALL render a toast displaying the i18n translation of that key for the user's current locale, and SHALL NOT enter the streaming state. The toast SHALL be a transient inline element rendered inside the Side Panel container with a stable `data-testid="agent-error-toast"`, an `aria-role="alert"`, and a manual-dismiss control. The toast SHALL auto-dismiss after approximately six seconds so it does not linger when the user retries.

The composer SHALL remain in Send-button state with the typed prompt preserved in the textarea. Draft clearing SHALL only occur when a run reaches the `done` terminal — `error` and `cancelled` terminals SHALL preserve the typed text so the user can retry without retyping.

#### Scenario: Sixth request inside the 60-second window

- **GIVEN** the user has triggered 5 successful runs within the last 60 seconds
- **WHEN** the user submits a sixth prompt
- **THEN** the fetch to `/api/agent/canvas/:canvasId/run` SHALL receive HTTP 429
- **AND** the response body SHALL contain `errorKey: "agent.error.rateLimited"`
- **AND** a toast element with `data-testid="agent-error-toast"` SHALL become visible
- **AND** that toast SHALL contain the locale-appropriate translation (`"短時間內 AI 請求次數過多，請稍候再試。"` for zh-TW, `"Too many AI requests in a short window. Please wait and try again."` for en)
- **AND** the composer SHALL remain in Send-button state
- **AND** the typed prompt SHALL still be present in the textarea.

#### Scenario: Draft preserved on error terminal, cleared on done terminal

- **GIVEN** a run dispatched with draft text `"hi 6"` in the composer
- **WHEN** the run reaches the `done` terminal
- **THEN** the composer textarea SHALL be empty
- **WHEN** instead the run reaches the `error` or `cancelled` terminal (server 429, network failure, user cancel, etc.)
- **THEN** the composer textarea SHALL still contain `"hi 6"`.

### Requirement: Assistant bubbles render markdown; user bubbles render plain text

Agent providers commonly return responses formatted as Markdown (headings, bullet/ordered lists, bold/italic emphasis, inline `` `code` `` and fenced code blocks, links, GitHub-flavored tables and task lists). The chat list SHALL render assistant message bubbles — both persisted rows and the in-flight streaming bubble — through a Markdown renderer that supports GitHub Flavored Markdown, so these constructs appear as real DOM elements (`<strong>`, `<em>`, `<ul>`/`<ol>`/`<li>`, `<code>`, `<pre>`, `<a>`, `<table>`, etc.) styled inside the bubble.

User message bubbles SHALL render their text as plain text (no Markdown parsing). This avoids the prompt-injection-via-Markdown attack surface where a user prompt embedded in canvas history could craft a link or formatted payload that misleads another reader of the thread; agent output is rendered formatted because it is generated by the user's own BYOK provider and any side-effect (tool call) already went through the permission-guarded mutator path.

Tool call / tool result bubbles SHALL keep their JSON pretty-print rendering — Markdown parsing of tool args would distort technical content.

#### Scenario: Assistant Markdown bold renders as a strong element

- **GIVEN** an assistant message whose content text is `"this is **bold** text"`
- **WHEN** the chat list renders the message
- **THEN** the assistant bubble SHALL contain a `<strong>` DOM element whose text content is `"bold"`.

#### Scenario: Assistant Markdown list renders as a list element

- **GIVEN** an assistant message whose content text is `"Done:\n- created shape:a\n- created shape:b"`
- **WHEN** the chat list renders the message
- **THEN** the assistant bubble SHALL contain a `<ul>` DOM element
- **AND** that `<ul>` SHALL contain exactly two `<li>` children.

#### Scenario: Assistant inline code renders as a code element

- **GIVEN** an assistant message whose content text is ``"I called `createShape`."``
- **WHEN** the chat list renders the message
- **THEN** the assistant bubble SHALL contain a `<code>` DOM element whose text content is `"createShape"`.

#### Scenario: User bubble preserves Markdown syntax as plain text

- **GIVEN** a user message whose content text is `"show me **bold**"`
- **WHEN** the chat list renders the message
- **THEN** the user bubble's text content SHALL include the literal substring `"**bold**"`
- **AND** the user bubble SHALL NOT contain any `<strong>` DOM element.

#### Scenario: Streaming bubble renders Markdown progressively

- **GIVEN** a run in `running` state with partial streaming text `"Result: **success**"`
- **WHEN** the chat list renders the streaming bubble
- **THEN** the streaming bubble SHALL contain a `<strong>` DOM element whose text content is `"success"`
- **AND** the streaming caret indicator SHALL remain visible after the Markdown-rendered text.
