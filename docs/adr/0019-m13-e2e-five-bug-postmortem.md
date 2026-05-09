# ADR-0019: M13 Agent Runtime e2e — Five-Bug Postmortem

**Status:** Accepted
**Date:** 2026-05-09
**Decider:** project owner
**Context change:** [`add-agent-runtime-streaming`](../../openspec/changes/) (M13)

## Context

M13 added the agent runtime + SSE streaming endpoint. Unit + integration
tests passed (200/200), but the first end-to-end attempt — real BYOK key,
real provider, real `/agent/canvas/:id/run` HTTP call — surfaced five
distinct bugs that the test suite had not caught. All five were fixed
within the same Spectra change (§11–§14 of the tasks file). This ADR
records the bugs, why the tests missed them, and what we changed.

The postmortem matters because each bug sits at a different layer of the
stack (provider validation, dev-only infra, AI SDK contract, LLM tool
surface, cross-provider message format), and a future change is likely
to re-trip the same class of issue in a different guise.

## Goals / Non-Goals

**Goals:**

- Record the bugs and their fixes so future changes can spot the same
  class of issue earlier.
- Document the gap each bug exposed in our test strategy, so we can
  decide what to add to the contract test surface.

**Non-Goals:**

- Reopen the M13 design — every fix is already merged into the change
  artifacts.
- Backfill all gaps now. Some are deferred (BYOK contract tests, M14
  follow-ups) and recorded in `openspec/changes/.../tasks.md` §15.

## The Five Bugs

### Bug 1 — OpenAI validator ping incompatible with reasoning models

**Symptom:** Saving a valid OpenAI key in Settings → API Keys returned
"無法連到供應商" (`errors.byok.unreachable`).

**Root cause:** M11 picked `gpt-5-nano` as the cheapest validation model
and sent `POST /v1/chat/completions` with `max_tokens: 1`. `gpt-5-nano`
is a reasoning-style model that reserves internal thinking-token budget
BEFORE emitting any response token. With cap=1 OpenAI returns HTTP 400
(`unsupported_parameter` for the legacy field name, then once we renamed
to `max_completion_tokens`, "max_tokens reached"). The status mapper
flattens any non-401/402/429 4xx to `unreachable`.

**Fix:** Switched validator to GET `/v1/models` — token-free, payload-
free, no model id at all. Matches the Google adapter's pattern.

**Why tests missed it:** `openai.test.ts` mocked `fetch` and asserted
exact body shape. The mocked fetch never saw the real OpenAI 400 because
the test never hit a real endpoint. The mock-driven test was stable but
hollow against the real provider contract.

**Lesson:** Provider validators are by definition contract integrations.
A dev-only smoke test that hits the real endpoint at least once per
provider would have caught this. Recorded as deferred work in the
risk register (15.4).

### Bug 2 — Dev proxy did not forward `/agent/*`

**Symptom:** `curl localhost:3002/agent/canvas/:id/run` returned the SPA
index.html with HTTP 200, instead of the API's 401/400.

**Root cause:** `scripts/dev-proxy.ts` forwarded `/api/*` `/dev/*`
`/health` to the API on :3000 and otherwise served static files. M13
added a new top-level prefix `/agent/*` but never updated the proxy
allow-list.

**Fix:** Added `/agent/` to the proxy forwarding rule. Also flipped the
proxy to `bun --hot` in `scripts/dev.ts` so future dev-proxy.ts edits
hot-reload instead of needing a full restart.

**Why tests missed it:** Unit tests hit handlers directly (no proxy).
Integration test runs Bun.serve in-process (also no proxy). The dev
proxy is only exercised by the human or by `bun run dev`, which the
test suite does not invoke.

**Lesson:** New top-level URL prefixes need a proxy allow-list update
checklist item. This is dev infra plumbing — easy to forget, easy to
hot-fix, but should ship with the route.

### Bug 3 — Vercel AI SDK rejected our tool JSON schema

**Symptom:** Agent runtime emitted `agent.error.internal`. Server log:
`AI_APICallError: Invalid schema for function 'createShape': In
context=(), object schema missing properties.` (HTTP 400 from OpenAI).

**Root cause:** `wiring.ts` constructed tool definitions like:
`inputSchema: jsonSchema((parameters as ZodType)._def as never)`. The
`jsonSchema()` helper expects a JSON Schema object; passing Zod's
internal `_def` produces a malformed JSON schema with no `properties`
field. OpenAI's tool API rejects schemas missing `properties` even when
the params object is empty (e.g. `getCanvasBounds`).

**Fix:** Use AI SDK's `tool({ inputSchema: zodSchema })` helper, which
accepts Zod schemas natively (`FlexibleSchema<T> = ZodSchema<T> | ...`)
and handles the JSON Schema conversion internally with the right shape.

**Why tests missed it:** Runtime tests injected a fake `ProviderAdapter`
and never exercised the real Vercel AI SDK. The fake adapter accepts any
ProviderToolDef[] without inspecting the parameter schema. Test stayed
green while the SDK contract drifted.

**Lesson:** Adapter glue between domain types and 3rd-party SDKs is a
classic test gap. The integration test (`integration.test.ts`) wires the
real RoomRegistry but still uses a fake ProviderAdapter — the AI SDK
itself is never tested. Could add a "wiring smoke" that calls
`buildVercelProviderAdapter` against a fake fetch and asserts the SDK
accepts the tool defs we produced. Deferred (15.4 generalized).

### Bug 4 — LLM dropped `props` because schema marked it optional

**Symptom:** Agent emitted `tool_call createShape({id, type, x, y})`
with no `props`. Mutator returned `errors.devMutate.mutationFailed`
because tldraw's TLSocketRoom rejected a markdown shape without
`content / w / h`.

**Root cause:** Two compounding factors:
1. `createShapePayloadSchema` declared `props` as
   `z.record(z.string(), z.unknown()).optional()`. OpenAI strict tool
   calling treats optional fields as "fine to omit", and gpt-4o-mini
   skipped the field when it had no obvious reason to include it.
2. Tool entries had no LLM-facing `description` — the SDK saw "Vellum
   agent tool: createShape" and the LLM had no idea what props each
   shape type required.

**Fix:**
- Made `props` required in `createShapePayloadSchema` (callers genuinely
  with no props now pass `props: {}` explicitly — explicit consent).
- Added `description: string` field to every `ToolEntry`. createShape's
  description enumerates the four custom shape types and their required
  prop keys (markdown / code / callout / link-card).

**Why tests missed it:** Unit tests faked the LLM (provider adapter
returned scripted `tool-call` events with hand-coded args). The args in
test fixtures already had the correct `props`, so the schema permissive-
ness was never exercised. The test wasn't testing what the LLM would
actually emit, only what we told it to emit.

**Lesson:** Tool descriptions are part of the agent surface contract.
"Default description = empty string" is a silent footgun — the runtime
should have refused to project a tool without a description. Going
forward, `ToolEntry.description` is `string` (not `string | undefined`)
so the type system enforces it.

### Bug 5 — Gemini rejected tool result with empty toolName

**Symptom:** OpenAI flow worked, Gemini flow died on the second round
trip with `agent.error.internal`. Server log:
`AI_APICallError: GenerateContentRequest.contents[2].parts[0].
function_response.name: Name cannot be empty.`

**Root cause:** When the runtime appended a synthetic tool message to
the conversation, `wiring.ts` mapped it to AI SDK's tool-result content
part with `toolName: ""`. OpenAI's chat-completions API tolerates empty
names because tool results are threaded by `toolCallId`. Google's Gemini
API enforces `function_response.name` as non-empty.

**Fix:** Added optional `toolName?: string` to `AgentMessage`. Runtime
populates it on every synthetic tool message (`toolName: call.name`).
Wiring threads `m.toolName ?? ""` through to the SDK part — empty only
if upstream code forgot, in which case OpenAI still passes but Gemini
will fail loudly.

**Why tests missed it:** Runtime unit tests assert `tool_result` events
in our SSE stream, not the AI SDK's downstream provider request body.
The tests had no provider-specific differentiation. Cross-provider
contract differences (OpenAI lenient vs Gemini strict) only manifest
against real APIs.

**Lesson:** "OpenAI works" ≠ "All providers work". Each provider has
quirks; testing against one is necessary but not sufficient. Live-verify
against all enabled providers (now §14.4 for Anthropic) is the cheapest
remedy.

## Common Threads

Three patterns recur across the five bugs:

1. **Tests with mocked external surfaces are necessary but not
   sufficient.** Bugs 1, 3, 4, 5 all involved real-provider contracts
   that mock-driven tests could not see. The unit suite stayed at 100%
   green throughout.

2. **Optional fields are LLM footguns.** Bug 4's `props.optional()` is
   structural — once the LLM was told "skipping is fine", it skipped.
   The system should make required things required.

3. **Cross-provider portability needs explicit verification.** Bugs 1
   and 5 are provider-specific edge cases. Our M13 specs say "supports
   OpenAI / Anthropic / Google" but the unit tests only proved we wire
   them; they didn't prove the wire was correctly shaped per provider.

## Decisions

### Add live-verify per provider as a §14 task block

Every BYOK provider gets a live-verify task (§14.3 Gemini ✓, §14.4
Anthropic pending, OpenAI implicitly via §13.5). This becomes the
template for future provider additions: the unit + integration suite is
not enough, a real-key smoke against each is required before archive.

### Tool descriptions become a typed contract

`ToolEntry.description: string` (required). The TypeScript compiler now
prevents adding a tool without one. Future tool additions cannot
silently regress to "Vellum agent tool: <name>" generic descriptions.

### Provider dispatch by explicit `provider` field, not `model.startsWith()`

Bug 5's symptom would have hit Anthropic in a different shape, and
`wiring.ts buildModel(provider, ...)` previously inferred provider from
`input.model.startsWith("claude" | "gemini" | else openai)`. That's
fragile against future model id changes. Threading `provider` explicitly
through `ProviderRunInput` removes the inference and lets the runtime's
caller (which already knows the provider, having looked up the BYOK key
for it) be the source of truth. (See ADR-0019 follow-up §15.2.)

### Defer to the deploy checklist: BYOK contract tests + canvas test DB isolation

These are real but not blocking M13. Recorded in
`project_deploy_checklist` memory.

## Risks / Trade-offs

- The lesson "tests with mocked externals are insufficient" applies
  beyond M13 — every adapter in the codebase (auth, email, OG scrape,
  ASR providers in other projects, etc.) has the same shape.
  Counter-action would be expensive contract test infra. Current ADR
  says: do live-verify case-by-case for now.

- Making `props` required breaks any caller of `createShapePayloadSchema`
  that genuinely had no props. We checked — no production caller does
  (mutator-integration test, dev mutate test, agent runtime tests all
  carry props). If a future shape type genuinely accepts no props,
  callers must pass `props: {}` explicitly.

- Gemini's strict `function_response.name` requirement means the
  AgentMessage `toolName` field MUST be populated by every runtime path
  that produces synthetic tool messages. The current code populates it
  on the only such path (post tool dispatch in `runAgent`); future
  conversation-injection paths must do the same.

## Migration Plan

Already merged into the same change. No deploy migration needed.

## Open Questions

- Should the BYOK contract test surface include all three providers and
  run as an opt-in `bun run smoke:byok` against real keys? Pending §15.4
  decision.
- When M14 lands tool descriptions probably need to grow further (read
  tools, group/connect operations) — should descriptions live in the
  registry forever, or move to a separate "tool docs" module that the
  registry imports from? Defer to M14.
