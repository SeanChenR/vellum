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
import { toolRegistry, type ToolEntry, type ToolRegistryDeps } from "../sync/tool-registry";
import { requireRole, type PermissionGuardDeps } from "../lib/permission-guard";
import type { MutatorReadersDeps } from "../sync/mutator-readers";
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
  messages: AgentMessage[];
}

export type RunOutcome =
  | { state: "done" }
  | { state: "error"; errorKey: AgentErrorKey; detail?: string }
  | { state: "cancelled" }
  | { state: "timeout"; errorKey: AgentErrorKey };

export type ProviderEvent =
  | { type: "text-delta"; delta: string }
  | { type: "tool-call"; callId: string; name: string; args: unknown }
  | { type: "step-finish"; finishReason: "stop" | "tool-calls" | "length" | "error" };

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

  let conversation: AgentMessage[] = [...request.messages];
  let outcome: RunOutcome | null = null;

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

      for await (const ev of providerResult.result.events) {
        if (signal.aborted) break;
        switch (ev.type) {
          case "text-delta":
            writer.writeEvent({ type: "text", runId: request.runId, delta: ev.delta });
            break;
          case "tool-call":
            queuedToolCalls.push({ callId: ev.callId, name: ev.name, args: ev.args });
            break;
          case "step-finish":
            stepFinishReason = ev.finishReason;
            break;
        }
      }

      if (signal.aborted) {
        outcome = { state: "cancelled" };
        break;
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
        outcome = { state: "done" };
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
    writer.writeEvent({ type: "done", runId: request.runId });
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
