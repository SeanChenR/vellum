# ai-thread Specification

## Purpose

TBD - created by archiving change 'add-ai-side-panel-and-threads'. Update Purpose after archive.

## Requirements

### Requirement: Threads are persisted per user and canvas

The system SHALL persist AI conversation threads in a relational table named `ai_threads` keyed by `id` with required columns `user_id`, `canvas_id`, `title`, `created_at`, `updated_at`. Foreign keys SHALL cascade-delete from `users(id)` and `canvases(id)`. The composite index `(user_id, canvas_id, updated_at DESC)` SHALL exist to support latest-first ordering when listing threads for a user on a canvas. Multiple threads per `(user_id, canvas_id)` pair SHALL be allowed; no unique constraint SHALL be imposed on that pair.

#### Scenario: Cascade deletion when canvas is deleted

- **GIVEN** a canvas C owned by user U with two AI threads T1 and T2
- **WHEN** canvas C is deleted
- **THEN** rows for T1 and T2 in `ai_threads` SHALL be removed automatically by the foreign-key cascade
- **AND** rows in `ai_messages` referencing T1 or T2 SHALL also be removed automatically.

#### Scenario: Multiple threads per user-canvas pair coexist

- **GIVEN** user U on canvas C with thread T1
- **WHEN** the system creates a new thread T2 for user U on canvas C
- **THEN** both T1 and T2 SHALL persist with distinct ids
- **AND** SELECT queries against `ai_threads` filtered by `(user_id=U, canvas_id=C)` SHALL return both rows.


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
### Requirement: Thread messages are persisted in chronological order

The system SHALL persist agent run messages in a relational table named `ai_messages` keyed by `id` with required columns `thread_id` (FK cascading to `ai_threads(id)`), `role` (CHECK constraint allowing only `'user'`, `'assistant'`, `'tool'`), `content` (jsonb), and `created_at`. The table SHALL also include nullable columns `tool_name`, `tool_call_id`, `token_usage` (jsonb), `provider`, `model`, and `run_id`. The composite index `(thread_id, created_at)` SHALL exist to support ordered playback.

#### Scenario: Replay thread in original order

- **GIVEN** thread T with messages M1 (role=user), M2 (role=assistant), M3 (role=tool, tool_call), M4 (role=tool, tool_result), M5 (role=assistant) created in that sequence
- **WHEN** the system loads thread T's messages ordered by `created_at ASC`
- **THEN** the result array SHALL be `[M1, M2, M3, M4, M5]` in that exact order.


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
### Requirement: Thread CRUD endpoints for the active user

The system SHALL expose four HTTP endpoints under the `/api/agent/threads` prefix, each requiring an authenticated session cookie:

- `GET /api/agent/threads/canvas/:canvasId` SHALL return `{ data: { threads: AiThreadSummary[], activeThreadId: string } }`. The active thread SHALL be the most recent by `updated_at`. If no thread exists for the requesting user on the given canvas, the system SHALL lazy-create an empty thread (with fallback title `""`) and return it as active.
- `POST /api/agent/threads/canvas/:canvasId` SHALL create a new empty thread for the requesting user on the given canvas, set its title to the empty string, and return HTTP 201 with `{ data: AiThread }`.
- `POST /api/agent/threads/:threadId/clear` SHALL delete every row in `ai_messages` referencing the thread while preserving the thread row itself, and SHALL return HTTP 204.
- `DELETE /api/agent/threads/:threadId` SHALL delete the thread row (cascading to messages) and SHALL return HTTP 204.

All endpoints SHALL reject requests where the target thread is not owned by the authenticated user with HTTP 403 and `errorKey: "agent.error.permissionDenied"`. Unknown thread ids SHALL return HTTP 404 with `errorKey: "agent.error.threadNotFound"`.

#### Scenario: Lazy-create on first GET for a canvas

- **GIVEN** authenticated user U entering canvas C for the first time, with no rows in `ai_threads` for `(U, C)`
- **WHEN** U calls GET `/api/agent/threads/canvas/C`
- **THEN** the response status SHALL be 200
- **AND** the response body SHALL contain exactly one thread with empty messages
- **AND** the response field `activeThreadId` SHALL match that thread's id
- **AND** a row SHALL now exist in `ai_threads` with `(user_id=U, canvas_id=C)`.

#### Scenario: Clear preserves the thread row

- **GIVEN** thread T owned by user U with 5 rows in `ai_messages` referencing T
- **WHEN** U POSTs to `/api/agent/threads/T/clear`
- **THEN** the response status SHALL be 204
- **AND** the row T SHALL still exist in `ai_threads` with the same id
- **AND** the count of `ai_messages` rows where `thread_id=T` SHALL be 0.

#### Scenario: Cross-user access is rejected with 403

- **GIVEN** thread T owned by user U1
- **WHEN** user U2 sends GET `/api/agent/threads/T` (or any other endpoint targeting T)
- **THEN** the response status SHALL be 403
- **AND** the response body SHALL contain `errorKey: "agent.error.permissionDenied"`
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
### Requirement: Background title generation after first run

When a thread receives its first run terminal `done` event AND the thread's current `title` equals the fallback string computed from the first user message, the system SHALL trigger a fire-and-forget background task that generates a new title. The task SHALL:

1. Select the economy-tier model for the run's provider from the fixed mapping `openai → "gpt-4o-mini"`, `anthropic → "claude-haiku-4-5"`, `google → "gemini-2.5-flash-lite"`. The mapping SHALL be encoded as a constant `Record<ProviderName, ModelId>` in `apps/api/src/agent/title-gen.ts`.
2. Call the provider with the prompt `Summarize this user request in 5-10 words, no quotes, no period: <first user message>`.
3. UPDATE `ai_threads.title` with the trimmed result (leading/trailing whitespace and surrounding quote characters removed).
4. Log a structured Pino warning (`level=warn`, `event=ai_title_gen_failed`) on any failure and SHALL NOT propagate the failure to the SSE channel or to the user.

The fallback string SHALL be the first user message truncated to 30 characters at a word boundary, with `"…"` appended when truncation occurred. When the thread has no messages yet (empty thread), the fallback SHALL be the empty string.

The background task SHALL NOT consume the `AGENT_RUN_RULE` rate-limit budget. The background task SHALL use the user's BYOK key for the run's provider; if the BYOK key is missing or revoked between run start and title generation, the task SHALL fail silently and leave the fallback title in place.

#### Scenario: Title generation succeeds and updates the row

- **GIVEN** thread T owned by user U with title fallback `"create a markdown s…"` and run R1 used provider OpenAI
- **WHEN** R1 emits `done` with non-null usage
- **AND** the title-generation provider call returns the string `"Greeting Markdown Shape"`
- **THEN** within 5 seconds `ai_threads.title` for T SHALL be UPDATEd to `"Greeting Markdown Shape"`
- **AND** the next read of T's title SHALL return `"Greeting Markdown Shape"`.

#### Scenario: Title generation fails silently on provider error

- **GIVEN** thread T with title fallback `"help me draw…"` and run R1 used provider Anthropic
- **WHEN** R1 emits `done` and the title-generation provider call returns HTTP 500
- **THEN** the SSE done event for R1 SHALL still be emitted normally
- **AND** the next read of T's title SHALL return the fallback `"help me draw…"`
- **AND** a Pino log record with `level=warn` and `event=ai_title_gen_failed` SHALL be written.

#### Scenario: Subsequent run does not re-trigger title generation

- **GIVEN** thread T whose title has already been regenerated to `"Greeting Markdown Shape"` (no longer equal to the fallback)
- **WHEN** another run R2 against thread T emits `done`
- **THEN** no background title-generation task SHALL be enqueued
- **AND** thread T's title SHALL remain `"Greeting Markdown Shape"`.


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
### Requirement: Thread token usage aggregation endpoint

`GET /api/agent/threads/:threadId` SHALL return `{ data: { thread: AiThread, messages: AiMessage[], usage: { input: number, output: number } } }`, where the `usage` aggregate SHALL be computed by summing each non-null `token_usage.input` and `token_usage.output` value across `ai_messages` rows belonging to the thread. When no rows in the thread carry `token_usage`, both `usage.input` and `usage.output` SHALL be `0`.

#### Scenario: Aggregate two assistant rows

- **GIVEN** thread T with two assistant rows whose `token_usage` columns are `{input: 100, output: 50}` and `{input: 200, output: 75}` and one user row (no `token_usage`)
- **WHEN** the owner calls GET `/api/agent/threads/T`
- **THEN** the response field `usage` SHALL equal `{ input: 300, output: 125 }`.

#### Scenario: Empty thread aggregates to zero

- **GIVEN** thread T with zero rows in `ai_messages`
- **WHEN** the owner calls GET `/api/agent/threads/T`
- **THEN** the response field `usage` SHALL equal `{ input: 0, output: 0 }`.

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