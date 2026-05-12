/**
 * runtime.ts — agent runtime tool loop with cancel, retry, and dual cap.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/agent-runtime/spec.md
 *
 * Design ref:
 *   openspec/changes/add-agent-runtime-streaming/design.md
 *     "Run lifecycle states", "Tool surface mapping: zod schema reuse",
 *     "Cancel semantics: 不主動 rollback", "Timeout: 雙層 cap",
 *     "Cancellation registry: in-memory per-process", "Error contract"
 *
 * Provider interaction is abstracted through `ProviderAdapter` so tests
 * inject scripted streams. The production adapter (M13.8 wiring) wraps
 * Vercel AI SDK `streamText` against the BYOK-decrypted key.
 */

import type { AgentEvent, AgentErrorKey } from "@vellum/shared/agent-events";
import type { CancellationRegistryDeps } from "./cancel";
import type { SseWriter } from "./streaming";
import type { ThreadRepo } from "./threads/repo";
import { toolRegistry, type ToolEntry, type ToolRegistryDeps } from "../sync/tool-registry";
import { requireRole, type PermissionGuardDeps } from "../lib/permission-guard";
import { getCanvasBounds, listAllShapes, type MutatorReadersDeps } from "../sync/mutator-readers";
import { buildSystemPrompt } from "./system-prompt";
import type { ToolName } from "@vellum/shared/tool-types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ProviderId = "openai" | "anthropic" | "google";

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | unknown;
  /**
   * For role="tool": the call id this result corresponds to. Required by
   * every provider (it's how the LLM threads tool result back to its
   * original call).
   */
  toolCallId?: string;
  /**
   * For role="tool": the tool name the result is for. OpenAI is lenient
   * with empty toolName; Google's Gemini API rejects with
   * "function_response.name: Name cannot be empty.". Always carry the
   * tool name so all three providers accept the message.
   */
  toolName?: string;
}

export interface RunRequest {
  runId: string;
  canvasId: string;
  sessionId: string;
  userId: string;
  provider: ProviderId;
  model: string;
  /**
   * The thread to run against. The runtime SHALL load the existing
   * `ai_messages` rows ordered by `created_at` and use them as the
   * conversation context for the provider call. The legacy `messages`
   * field has been removed — see streaming-channel spec MODIFIED
   * "Run endpoint accepts POST with model selection" (M14).
   */
  threadId: string;
  /**
   * The new user prompt to append to the thread before the run starts.
   * Persisted as a role=user `ai_messages` row before the first provider
   * request is issued.
   */
  userMessage: string;
}

export interface RunUsageTotals {
  input: number;
  output: number;
}

export type RunOutcome =
  | { state: "done"; usage: RunUsageTotals | null }
  | { state: "error"; errorKey: AgentErrorKey; detail?: string }
  | { state: "cancelled" }
  | { state: "timeout"; errorKey: AgentErrorKey };

export type ProviderEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; callId: string; name: string; args: unknown }
  | { type: "step-finish"; finishReason: "stop" | "tool-calls" | "length" | "error" }
  /**
   * Per-step usage report, emitted at most once per step by the adapter.
   * The runtime sums these across all turns of the multi-turn tool loop
   * and forwards the total on the SSE `done` event.
   */
  | { type: "usage"; usage: RunUsageTotals };

export interface ProviderToolDef {
  name: string;
  description?: string;
  parameters: unknown; // zod schema or json-schema; adapter decides
}

export interface ProviderRunInput {
  /**
   * Explicit provider id. The wiring layer dispatches the AI SDK call
   * by this field (NOT by `model.startsWith()`), so renaming a model
   * (e.g. OpenAI shipping a model whose id does not start with "gpt"
   * or Anthropic shipping one not starting with "claude") cannot
   * silently route to the wrong provider. The agent runtime knows the
   * provider already because it just looked up the BYOK key for it.
   */
  provider: ProviderId;
  apiKey: string;
  model: string;
  messages: AgentMessage[];
  tools: ProviderToolDef[];
  signal: AbortSignal;
}

export interface ProviderRunResult {
  events: AsyncIterable<ProviderEvent>;
}

export interface ProviderAdapter {
  run(input: ProviderRunInput): Promise<ProviderRunResult>;
}

export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `provider returned ${status}`);
    this.name = "ProviderError";
  }
}

export interface ByokFetcher {
  /** Returns the decrypted plaintext key, or null when the user has no key for that provider. */
  fetchKey(userId: string, provider: ProviderId): Promise<string | null>;
}

export interface AgentClock {
  now(): number;
  /** Optional helper used by tests to advance the clock. */
  advance?(ms: number): void;
}

export interface PinoLikeLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
}

export interface AgentRuntimeDeps {
  cancellation: CancellationRegistryDeps;
  permission: PermissionGuardDeps;
  byok: ByokFetcher;
  toolRegistryDeps: ToolRegistryDeps;
  digestDeps: MutatorReadersDeps;
  /** Resolves the canvas title for the digest. */
  canvasTitle(canvasId: string): Promise<string>;
  provider: ProviderAdapter;
  clock: AgentClock;
  /** Awaitable sleep, parameterised so tests can fake it. */
  sleep(ms: number): Promise<void>;
  logger: PinoLikeLogger;
  wallTimeoutMs?: number;
  maxToolCalls?: number;
  retryDelaysMs?: number[];
  /**
   * Thread persistence layer. The runtime owns the contract:
   *   - load thread history at run start
   *   - append the supplied userMessage as the first row of this run
   *   - append assistant text segments / tool_calls / tool_results
   *     as they are emitted
   *   - setUsageOnLastAssistant on terminal `done`
   * See agent-runtime spec ADDED "Runtime loads conversation history
   * from thread storage" + "Runtime persists every emitted message to
   * the thread" (M14).
   */
  threadRepo: ThreadRepo;
  /**
   * Background title-generation hook fired once after the first run
   * completes successfully. Implementations SHALL be fire-and-forget
   * (no await on the SSE done event); see ai-thread spec
   * "Background title generation after first run".
   */
  titleGen?: {
    triggerIfFirstRun(args: {
      threadId: string;
      userId: string;
      provider: ProviderId;
      firstUserMessage: string;
    }): Promise<void>;
  };
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_WALL_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOOL_CALLS = 20;
const DEFAULT_RETRY_DELAYS_MS = [250, 1_000];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip potentially sensitive fields off an error before logging. We
 * keep `name` (e.g., "ProviderError", "ZodError") for diagnostics and
 * drop the message + stack which may carry user prompts, BYOK keys, or
 * raw provider response bodies. Defense in depth on top of structural
 * guarantees in the runtime (apiKey never reaches log call sites).
 */
function scrubErr(err: unknown): { name: string } {
  return { name: (err as Error)?.name ?? "Error" };
}

/**
 * Build a Pino child logger with redaction paths for any field whose
 * key suggests credentials. Production wiring (apps/api/src/agent/
 * wiring.ts) is the only caller — tests use a fake logger that records
 * call args and asserts no key leakage.
 */
export function createAgentLoggerRedactPaths(): readonly string[] {
  return [
    "*.apiKey",
    "*.api_key",
    "*.authorization",
    "*.Authorization",
    "*.x-api-key",
    "*.headers.authorization",
    "*.headers.Authorization",
    "*.headers.x-api-key",
  ] as const;
}

function classifyProviderError(status: number): {
  errorKey: AgentErrorKey;
  retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return { errorKey: "agent.error.providerAuth", retryable: false };
  }
  if (status === 429) {
    return { errorKey: "agent.error.providerRateLimit", retryable: false };
  }
  if (status >= 500 && status < 600) {
    return { errorKey: "agent.error.providerServer", retryable: true };
  }
  return { errorKey: "agent.error.providerServer", retryable: false };
}

function buildToolDefs(): ProviderToolDef[] {
  return Object.values(toolRegistry).map((entry) => ({
    name: entry.name,
    description: entry.description,
    parameters: entry.schema,
  }));
}

async function executeTool(
  deps: AgentRuntimeDeps,
  request: RunRequest,
  callId: string,
  name: string,
  rawArgs: unknown,
): Promise<{ ok: true; result: unknown } | { ok: false; errorKey: string }> {
  const entry = (toolRegistry as Record<string, ToolEntry | undefined>)[name];
  if (!entry) {
    return { ok: false, errorKey: "agent.tool.unknown" };
  }
  const parsed = entry.schema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, errorKey: "agent.tool.invalidArgs" };
  }
  try {
    const result = await (
      entry.execute as (
        deps: ToolRegistryDeps,
        canvasId: string,
        input: unknown,
      ) => Promise<unknown>
    )(deps.toolRegistryDeps, request.canvasId, parsed.data);
    return { ok: true, result };
  } catch (err) {
    deps.logger.error(
      { err: scrubErr(err), runId: request.runId, tool: name, callId },
      "tool execution threw",
    );
    return { ok: false, errorKey: "agent.tool.executionFailed" };
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

interface RunState {
  toolCallCount: number;
  startedAt: number;
  /** Set true once the AbortController has fired (cancel). */
  cancelled: boolean;
}

function isWallTimeout(state: RunState, deps: AgentRuntimeDeps): boolean {
  const budget = deps.wallTimeoutMs ?? DEFAULT_WALL_TIMEOUT_MS;
  return deps.clock.now() - state.startedAt >= budget;
}

async function runProviderWithRetry(
  deps: AgentRuntimeDeps,
  request: RunRequest,
  apiKey: string,
  messages: AgentMessage[],
  signal: AbortSignal,
): Promise<{ ok: true; result: ProviderRunResult } | { ok: false; outcome: RunOutcome }> {
  const delays = deps.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let attempt = 0;
  while (true) {
    try {
      const result = await deps.provider.run({
        provider: request.provider,
        apiKey,
        model: request.model,
        messages,
        tools: buildToolDefs(),
        signal,
      });
      return { ok: true, result };
    } catch (err) {
      if (signal.aborted) {
        return { ok: false, outcome: { state: "cancelled" } };
      }
      if (!(err instanceof ProviderError)) {
        deps.logger.error(
          { err: { name: (err as Error).name }, runId: request.runId },
          "provider threw a non-ProviderError",
        );
        return {
          ok: false,
          outcome: { state: "error", errorKey: "agent.error.internal" },
        };
      }
      const classified = classifyProviderError(err.status);
      if (!classified.retryable || attempt >= delays.length) {
        return {
          ok: false,
          outcome: { state: "error", errorKey: classified.errorKey },
        };
      }
      await deps.sleep(delays[attempt]!);
      attempt += 1;
    }
  }
}

export async function runAgent(
  deps: AgentRuntimeDeps,
  request: RunRequest,
  writer: SseWriter,
): Promise<RunOutcome> {
  const controller = deps.cancellation.register(request.runId);
  const signal = controller.signal;
  const cleanup = () => deps.cancellation.release(request.runId);

  const writeError = (errorKey: AgentErrorKey): void => {
    writer.writeEvent({ type: "error", runId: request.runId, errorKey });
  };

  // 1. Permission gate
  const session = { userId: request.userId };
  const perm = await requireRole(deps.permission, session, request.canvasId, ["owner", "editor"]);
  if (!perm.ok) {
    writeError("agent.error.permissionDenied");
    cleanup();
    return { state: "error", errorKey: "agent.error.permissionDenied" };
  }

  // 2. Fetch BYOK key
  let apiKey: string | null = null;
  try {
    apiKey = await deps.byok.fetchKey(request.userId, request.provider);
  } catch (err) {
    deps.logger.error({ err: scrubErr(err), runId: request.runId }, "byok fetch threw");
    writeError("agent.error.internal");
    cleanup();
    return { state: "error", errorKey: "agent.error.internal" };
  }
  if (!apiKey) {
    writeError("agent.error.byokMissing");
    cleanup();
    return { state: "error", errorKey: "agent.error.byokMissing" };
  }

  const state: RunState = {
    toolCallCount: 0,
    startedAt: deps.clock.now(),
    cancelled: false,
  };

  // Load thread history + append the supplied userMessage. The thread is
  // the only source of truth for conversation context; the inbound HTTP
  // body never carries a messages array (M14 contract).
  const history = await deps.threadRepo.loadMessages(request.threadId);
  await deps.threadRepo.appendMessage(request.threadId, {
    role: "user",
    content: { text: request.userMessage },
  });
  const wasFirstRunOfThread = history.length === 0;

  // Build the system prompt from the live canvas snapshot. The system
  // message is prepended fresh per run and NOT persisted to the thread —
  // canvas state moves, the persisted prompt would go stale.
  const shapesRes = await listAllShapes(deps.digestDeps, request.canvasId);
  const boundsRes = await getCanvasBounds(deps.digestDeps, request.canvasId);
  const stateAvailable = shapesRes.ok;
  const systemPrompt = buildSystemPrompt({
    shapes: shapesRes.ok ? shapesRes.data : [],
    canvasBounds: boundsRes.ok ? boundsRes.data : null,
    stateAvailable,
  });

  let conversation: AgentMessage[] = [
    { role: "system" as const, content: systemPrompt },
    ...history.map(persistedToAgentMessage),
    { role: "user" as const, content: request.userMessage },
  ];
  let outcome: RunOutcome | null = null;
  /** Accumulator for assistant text within a single step — flushed to the
   * thread as one row when the step ends with at least one delta. */
  let pendingAssistantText = "";
  // Per-run usage accumulator; null means the provider never emitted a usage
  // event for this run (forwarded as `usage: null` on the SSE done event so
  // the client can surface "—" in the footer).
  let usageTotals: RunUsageTotals | null = null;

  try {
    while (true) {
      if (signal.aborted) {
        outcome = { state: "cancelled" };
        break;
      }
      if (isWallTimeout(state, deps)) {
        outcome = { state: "timeout", errorKey: "agent.error.wallTimeout" };
        break;
      }

      const providerResult = await runProviderWithRetry(
        deps,
        request,
        apiKey,
        conversation,
        signal,
      );
      if (!providerResult.ok) {
        outcome = providerResult.outcome;
        break;
      }

      const queuedToolCalls: { callId: string; name: string; args: unknown }[] = [];
      let stepFinishReason: Extract<ProviderEvent, { type: "step-finish" }>["finishReason"] | null =
        null;

      for await (const evRaw of providerResult.result.events) {
        if (signal.aborted) break;
        const ev: ProviderEvent = evRaw;
        if (ev.type === "text-delta") {
          writer.writeEvent({ type: "text", runId: request.runId, delta: ev.delta });
          pendingAssistantText += ev.delta;
        } else if (ev.type === "tool-call") {
          queuedToolCalls.push({ callId: ev.callId, name: ev.name, args: ev.args });
        } else if (ev.type === "step-finish") {
          stepFinishReason = ev.finishReason;
        } else if (ev.type === "usage") {
          const inc: RunUsageTotals = ev.usage;
          if (usageTotals === null) {
            usageTotals = { input: inc.input, output: inc.output };
          } else {
            usageTotals = {
              input: usageTotals.input + inc.input,
              output: usageTotals.output + inc.output,
            };
          }
        }
      }

      if (signal.aborted) {
        outcome = { state: "cancelled" };
        break;
      }

      // Flush this step's accumulated assistant text as one persisted row.
      // Persisting per-delta would create token-noise in the thread; per-step
      // matches how the LLM logically segments its turn.
      if (pendingAssistantText.length > 0) {
        await deps.threadRepo.appendMessage(request.threadId, {
          role: "assistant",
          content: { text: pendingAssistantText },
          provider: request.provider,
          model: request.model,
          runId: request.runId,
        });
        pendingAssistantText = "";
      }

      // Dispatch queued tool calls serially
      const cap = deps.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS;
      for (const call of queuedToolCalls) {
        if (signal.aborted) {
          outcome = { state: "cancelled" };
          break;
        }
        if (state.toolCallCount >= cap) {
          outcome = { state: "timeout", errorKey: "agent.error.toolCallCap" };
          break;
        }
        state.toolCallCount += 1;
        writer.writeEvent({
          type: "tool_call",
          runId: request.runId,
          callId: call.callId,
          name: call.name,
          args: (call.args ?? {}) as Record<string, unknown>,
        });
        await deps.threadRepo.appendMessage(request.threadId, {
          role: "tool",
          content: {
            kind: "call",
            name: call.name,
            args: (call.args ?? {}) as Record<string, unknown>,
          },
          toolName: call.name,
          toolCallId: call.callId,
          runId: request.runId,
        });
        const exec = await executeTool(deps, request, call.callId, call.name, call.args);
        const resultPayload = exec.ok
          ? (exec.result as Record<string, unknown>)
          : { errorKey: exec.errorKey };
        writer.writeEvent({
          type: "tool_result",
          runId: request.runId,
          callId: call.callId,
          result: resultPayload,
        });
        await deps.threadRepo.appendMessage(request.threadId, {
          role: "tool",
          content: { kind: "result", result: resultPayload },
          toolName: call.name,
          toolCallId: call.callId,
          runId: request.runId,
        });
        // Append synthetic assistant + tool messages to drive the next step.
        conversation = [
          ...conversation,
          {
            role: "assistant",
            content: { toolCall: { callId: call.callId, name: call.name, args: call.args } },
          },
          {
            role: "tool",
            toolCallId: call.callId,
            toolName: call.name,
            content: resultPayload,
          },
        ];
      }
      if (outcome) break;

      if (stepFinishReason === "stop" || stepFinishReason === "length") {
        outcome = { state: "done", usage: usageTotals };
        break;
      }
      if (stepFinishReason === "error") {
        outcome = { state: "error", errorKey: "agent.error.providerServer" };
        break;
      }
      // step-finish was tool-calls — loop and continue.
    }
  } catch (err) {
    deps.logger.error(
      { err: { name: (err as Error).name }, runId: request.runId },
      "agent runtime threw",
    );
    outcome = { state: "error", errorKey: "agent.error.internal" };
  } finally {
    // Zeroise apiKey reference so it does not survive in the closure.
    apiKey = null;
  }

  if (!outcome) {
    outcome = { state: "error", errorKey: "agent.error.internal" };
  }

  // Emit terminal event
  if (outcome.state === "done") {
    if (outcome.usage) {
      // Best-effort write to the most recent assistant row of this run.
      // If the run produced only tool calls (no assistant text), there's
      // no row to attach usage to — that's a noop in the repo.
      try {
        await deps.threadRepo.setUsageOnLastAssistant(
          request.threadId,
          request.runId,
          outcome.usage,
        );
      } catch (err) {
        deps.logger.warn(
          { runId: request.runId, err: scrubErr(err) },
          "setUsageOnLastAssistant failed; SSE done usage still emitted",
        );
      }
    }
    writer.writeEvent({
      type: "done",
      runId: request.runId,
      usage: outcome.usage
        ? {
            input: outcome.usage.input,
            output: outcome.usage.output,
            provider: request.provider,
            model: request.model,
          }
        : null,
    });
    if (!outcome.usage) {
      deps.logger.warn(
        { event: "ai_provider_missing_usage", runId: request.runId, provider: request.provider },
        "provider returned no usage information",
      );
    }
    // Fire-and-forget: only when this run was the thread's first one.
    // We do NOT await — title-gen MUST NOT block the caller's done event.
    if (wasFirstRunOfThread && deps.titleGen) {
      const tg = deps.titleGen;
      void tg
        .triggerIfFirstRun({
          threadId: request.threadId,
          userId: request.userId,
          provider: request.provider,
          firstUserMessage: request.userMessage,
        })
        .catch(() => {
          /* errors are already Pino-logged inside title-gen; swallow here */
        });
    }
  } else if (outcome.state === "cancelled") {
    writeError("agent.error.cancelled");
  } else if (outcome.state === "timeout") {
    writeError(outcome.errorKey);
  } else {
    writeError(outcome.errorKey);
  }

  cleanup();
  return outcome;
}

// ---------------------------------------------------------------------------
// Helpers — persisted message ↔ AgentMessage conversion
// ---------------------------------------------------------------------------

/**
 * Convert a persisted `ai_messages` row to the AgentMessage shape the
 * runtime/provider adapter expects. Tool rows carry a structured content
 * envelope (kind="call" or kind="result"); we map both back to the same
 * `assistant`/`tool` synthetic messages the runtime would have generated
 * if those events had just been emitted.
 *
 * Persisted user/assistant text rows use `{text: string}` content.
 */
function persistedToAgentMessage(row: {
  role: "user" | "assistant" | "tool";
  content: unknown;
  toolName: string | null;
  toolCallId: string | null;
}): AgentMessage {
  const content = row.content as Record<string, unknown> | undefined;
  if (row.role === "user") {
    const text = (content?.["text"] as string | undefined) ?? "";
    return { role: "user", content: text };
  }
  if (row.role === "assistant") {
    // Tool-call assistant turn (structured content) — preserve toolCall envelope.
    if (content && "toolCall" in content) {
      return {
        role: "assistant",
        content: content as Record<string, unknown>,
      };
    }
    // Tool-call assistant turn that was persisted as the `tool` kind=call row?
    // Persisted assistants are always plain text in M14 — fall through.
    const text = (content?.["text"] as string | undefined) ?? "";
    return { role: "assistant", content: text };
  }
  // role === "tool"
  if (content && content["kind"] === "call") {
    return {
      role: "assistant",
      content: {
        toolCall: {
          callId: row.toolCallId ?? "",
          name: row.toolName ?? content["name"] ?? "",
          args: content["args"] ?? {},
        },
      },
    };
  }
  // kind = "result"
  const result = (content?.["result"] as Record<string, unknown> | undefined) ?? {};
  return {
    role: "tool",
    toolCallId: row.toolCallId ?? "",
    toolName: row.toolName ?? "",
    content: result,
  };
}
