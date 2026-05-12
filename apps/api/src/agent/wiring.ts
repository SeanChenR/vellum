/**
 * wiring.ts — production wiring for the agent endpoints.
 *
 * Constructs the live `AgentEndpointDeps` (BYOK Vault decrypt path,
 * Vercel AI SDK `ProviderAdapter`, real cancellation registry, real
 * Pino child logger with redaction, room registry hook for digest +
 * tool-registry deps) and returns the run + cancel handlers.
 *
 * Test wiring lives in apps/api/src/agent/sse-endpoint.test.ts and
 * apps/api/src/agent/runtime.test.ts which inject fakes; this module
 * is exclusively for index.ts dispatch.
 *
 * Spec ref: openspec/changes/add-agent-runtime-streaming/specs/*
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, type ModelMessage, type Tool } from "ai";
import { and, eq } from "drizzle-orm";
import type { Logger } from "pino";
import { z } from "zod";
import { getDb } from "../db";
import { apiKeys } from "../db/schema";
import { CancellationRegistry, type CancellationRegistryDeps } from "./cancel";
import { buildAgentEndpoints, type AgentEndpointDeps, type AgentEndpoints } from "./sse-endpoint";
import type { ThreadRepo } from "./threads/repo";
import {
  ProviderError,
  type AgentMessage,
  type ProviderAdapter,
  type ProviderEvent,
} from "./runtime";
import type { Vault } from "../byok/vault";
import type { PermissionGuardDeps } from "../lib/permission-guard";
import type { RateLimiter } from "../lib/rate-limiter";
import { AGENT_RUN_RULE } from "../lib/rate-limit-rules";
import type { MutatorReadersDeps } from "../sync/mutator-readers";
import type { ToolRegistryDeps } from "../sync/tool-registry";
import { canvases } from "../db/schema";

// ---------------------------------------------------------------------------
// BYOK key fetcher — pulls encrypted blob from DB and decrypts via Vault.
// ---------------------------------------------------------------------------

async function fetchEncryptedKey(userId: string, provider: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ encryptedKey: apiKeys.encryptedKey })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)));
  return row?.encryptedKey ?? null;
}

async function fetchCanvasTitle(canvasId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ title: canvases.title })
    .from(canvases)
    .where(eq(canvases.id, canvasId));
  return row?.title ?? "";
}

// ---------------------------------------------------------------------------
// Provider routing — explicit map (replaces M13's model.startsWith heuristic)
// ---------------------------------------------------------------------------

/**
 * Allowed model ids per provider. The runtime validates `(provider, model)`
 * pairs against this map before issuing a provider call so an unknown
 * model surfaces as `agent.error.invalidRequest` instead of a Vercel AI
 * SDK runtime error.
 *
 * Adding a model means updating BOTH `BYOK_PRICING` in @vellum/shared
 * (so the cost calculator works) AND this map. The wiring.test.ts
 * `cardinality` and `includes every modelId from BYOK_PRICING` asserts
 * catch drift in either direction.
 *
 * Title-generation economy models (gpt-4o-mini / gemini-2.5-flash-lite)
 * are also listed here — they are valid model ids the adapter must
 * accept, even though they are not user-selectable through BYOK.
 *
 * Spec ref: design "Provider routing 從 `model.startsWith()` 改成
 * explicit map" (M14).
 */
export const PROVIDER_MODELS: Record<"openai" | "anthropic" | "google", ReadonlySet<string>> = {
  openai: new Set([
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-4o-mini", // title-gen economy model (not user-selectable via BYOK)
  ]),
  anthropic: new Set(["claude-opus-4-5", "claude-sonnet-4-6", "claude-haiku-4-5"]),
  google: new Set(["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]),
};

/** Returns true iff the (provider, model) pair is in `PROVIDER_MODELS`. */
export function isModelKnown(provider: "openai" | "anthropic" | "google", model: string): boolean {
  return PROVIDER_MODELS[provider].has(model);
}

// ---------------------------------------------------------------------------
// Vercel AI SDK provider adapter — bridges streamText to ProviderEvent.
// ---------------------------------------------------------------------------

function buildModel(provider: "openai" | "anthropic" | "google", model: string, apiKey: string) {
  if (!isModelKnown(provider, model)) {
    // Fail-fast — see PROVIDER_MODELS docstring.
    throw new ProviderError(400, `unknown model id for provider ${provider}: ${model}`);
  }
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
}

/**
 * Split system messages out of the agent conversation. The AI SDK warns
 * (and may eventually throw) when role=system entries appear in the
 * `messages` array — they belong on `streamText({ system })` instead so
 * the SDK can route them through provider-specific system slots and so
 * prompt-injection risk surfaces are clearer. The runtime still produces
 * a single conversation array with a system message at index 0; this
 * helper is the wiring-side boundary that respects the SDK contract.
 */
function extractSystem(messages: AgentMessage[]): {
  system: string | undefined;
  rest: AgentMessage[];
} {
  const systemParts: string[] = [];
  const rest: AgentMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string" && m.content.length > 0) systemParts.push(m.content);
      continue;
    }
    rest.push(m);
  }
  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    rest,
  };
}

function toModelMessages(messages: AgentMessage[]): ModelMessage[] {
  return messages.map((m) => {
    switch (m.role) {
      case "system":
        return { role: "system", content: typeof m.content === "string" ? m.content : "" };
      case "user":
        return { role: "user", content: typeof m.content === "string" ? m.content : "" };
      case "assistant": {
        // Plain text assistant turn.
        if (typeof m.content === "string") {
          return { role: "assistant", content: m.content };
        }
        // Tool-calling assistant turn — runtime appends synthetic
        // {toolCall: {callId, name, args}} content so the LLM sees the
        // call it just made on the next round trip. Convert to AI SDK's
        // tool-call content part (otherwise the SDK + provider treats
        // the message as empty and OpenAI rejects the follow-up call).
        if (
          m.content &&
          typeof m.content === "object" &&
          "toolCall" in (m.content as Record<string, unknown>)
        ) {
          const tc = (m.content as { toolCall: { callId: string; name: string; args: unknown } })
            .toolCall;
          return {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: tc.callId,
                toolName: tc.name,
                input: tc.args,
              },
            ],
          };
        }
        return { role: "assistant", content: "" };
      }
      case "tool":
        return {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: m.toolCallId ?? "",
              // Carry the actual tool name through. OpenAI is lenient
              // with an empty string, but Google's Gemini API rejects
              // the request outright with "function_response.name: Name
              // cannot be empty." (M13 e2e finding, runId
              // 6666aaaa-2222-4222-8222-aaaaaaaaaaaa). Runtime now
              // populates `toolName` on every synthetic tool message.
              toolName: m.toolName ?? "",
              output: { type: "json", value: m.content as never },
            },
          ],
        };
    }
  });
}

/**
 * Translate one chunk from the Vercel AI SDK `streamText` fullStream
 * into zero or more ProviderEvents for the agent runtime.
 *
 * Important: this is where `finish-step.usage` gets extracted. Before
 * this helper existed, the bridge() generator silently dropped usage
 * information, leaving `runtime.ts:usageTotals` at `null` for every run
 * — the SSE done event always shipped `usage: null`, the `setUsageOn-
 * LastAssistant` write was skipped, and the thread total query
 * (COALESCE(SUM(...), 0)) returned 0 / 0 forever. M14 verification
 * surfaced this as "token footer is permanently 0".
 *
 * Each finish-step is mapped to TWO ProviderEvents: first `step-finish`
 * (carries finishReason for the runtime's exit logic), then `usage`
 * (when at least one of inputTokens / outputTokens is defined). When
 * neither is defined, the usage event is omitted — runtime keeps its
 * accumulator at `null` so the spec's "provider returned no usage
 * information" warning path still fires.
 *
 * Exported for unit testing the SDK→runtime mapping without standing
 * up a real model client.
 */
export function aiSdkPartToProviderEvents(part: unknown): ProviderEvent[] {
  const p = part as { type?: string } & Record<string, unknown>;
  if (!p.type) return [];

  if (p.type === "text-delta") {
    return [{ type: "text-delta", delta: String(p["text"] ?? "") }];
  }

  if (p.type === "tool-call") {
    return [
      {
        type: "tool-call",
        callId: String(p["toolCallId"] ?? ""),
        name: String(p["toolName"] ?? ""),
        args: p["input"] as unknown,
      },
    ];
  }

  if (p.type === "finish-step") {
    const raw = p["finishReason"];
    const finishReason: "stop" | "length" | "tool-calls" | "error" =
      raw === "stop" || raw === "length" || raw === "tool-calls" || raw === "error" ? raw : "stop";
    const events: ProviderEvent[] = [{ type: "step-finish", finishReason }];

    const usage = p["usage"] as
      | { inputTokens?: number | undefined; outputTokens?: number | undefined }
      | undefined;
    if (usage) {
      const inDefined = typeof usage.inputTokens === "number";
      const outDefined = typeof usage.outputTokens === "number";
      if (inDefined || outDefined) {
        events.push({
          type: "usage",
          usage: {
            input: inDefined ? (usage.inputTokens as number) : 0,
            output: outDefined ? (usage.outputTokens as number) : 0,
          },
        });
      }
    }
    return events;
  }

  // text-start / text-end / start-step / start / finish (aggregate) /
  // raw / abort / tool-output-* / etc — ignored at this layer.
  return [];
}

function buildVercelProviderAdapter(): ProviderAdapter {
  return {
    async run(input) {
      // Explicit provider routing — the runtime caller already knows
      // which provider to use (it looked up the BYOK key by provider).
      // Avoid inferring from `model.startsWith()`, which is fragile
      // against any model id renaming (gpt-5 / gemini-2.5-* / claude
      // names all change over time, and a future provider could ship a
      // model id that does not match the prefix heuristic).
      const model = buildModel(input.provider, input.model, input.apiKey);

      // Tool surface — pass Zod schemas directly via the `tool()` helper.
      // FlexibleSchema accepts ZodSchema natively, so the AI SDK does the
      // JSON-Schema conversion internally and produces the `properties`
      // field OpenAI's tool API requires (even for empty-args tools like
      // `getCanvasBounds` which uses `z.object({}).strict()`).
      const tools: Record<string, Tool> = {};
      for (const def of input.tools) {
        tools[def.name] = tool({
          description: def.description ?? `Vellum agent tool: ${def.name}`,
          inputSchema: def.parameters as z.ZodType,
        }) as Tool;
      }

      try {
        const { system, rest } = extractSystem(input.messages);
        const result = streamText({
          model,
          system,
          messages: toModelMessages(rest),
          tools: tools as never,
          abortSignal: input.signal,
        });

        async function* bridge(): AsyncGenerator<ProviderEvent> {
          for await (const part of result.fullStream) {
            if (input.signal.aborted) return;
            // `error` parts throw — they have no ProviderEvent mapping.
            // Everything else flows through the pure mapper so the same
            // logic is exercised by aiSdkPartToProviderEvents tests.
            if ((part as { type?: string }).type === "error") {
              const err = (part as { error?: { status?: number; message?: string } }).error;
              throw new ProviderError(err?.status ?? 500, err?.message);
            }
            for (const ev of aiSdkPartToProviderEvents(part as unknown)) {
              yield ev;
            }
          }
        }
        return { events: bridge() };
      } catch (err) {
        if (err instanceof ProviderError) throw err;
        const status =
          (err as { status?: number; statusCode?: number }).status ??
          (err as { statusCode?: number }).statusCode ??
          500;
        throw new ProviderError(status, (err as Error).message);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface AgentWiringInputs {
  vault: Vault;
  permissionGuard: PermissionGuardDeps;
  rateLimiter: RateLimiter;
  toolRegistryDeps: ToolRegistryDeps;
  digestDeps: MutatorReadersDeps;
  logger: Logger;
  threadRepo: ThreadRepo;
  /**
   * Title-generation hook fired after the first run completes per thread.
   * Production wires the drizzle-backed `generateTitleInBackground`; tests
   * may omit (default behavior: skip). Always fire-and-forget.
   */
  titleGen?: AgentEndpointDeps["titleGen"];
}

export function buildProductionAgentEndpoints(inputs: AgentWiringInputs): {
  endpoints: AgentEndpoints;
  cancellation: CancellationRegistryDeps;
} {
  const cancellation = new CancellationRegistry();
  const provider = buildVercelProviderAdapter();

  const child = inputs.logger.child(
    {
      component: "agent",
    },
    {
      // Defense-in-depth: redact common credential headers in case any leak
      // through nested objects passed to logger calls.
      redact: {
        paths: [
          "*.apiKey",
          "*.api_key",
          "*.authorization",
          "*.Authorization",
          "*.headers.authorization",
          "*.headers.Authorization",
          "*.headers.x-api-key",
        ],
        censor: "[REDACTED]",
      },
    },
  );

  const deps: AgentEndpointDeps = {
    cancellation,
    permission: inputs.permissionGuard,
    byok: {
      async fetchKey(userId, providerId) {
        const encrypted = await fetchEncryptedKey(userId, providerId);
        if (!encrypted) return null;
        return inputs.vault.decryptApiKey(encrypted);
      },
    },
    toolRegistryDeps: inputs.toolRegistryDeps,
    digestDeps: inputs.digestDeps,
    canvasTitle: fetchCanvasTitle,
    provider,
    clock: { now: () => Date.now() },
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    logger: {
      info: (obj, msg) => child.info(obj as object, msg ?? ""),
      warn: (obj, msg) => child.warn(obj as object, msg ?? ""),
      error: (obj, msg) => child.error(obj as object, msg ?? ""),
      debug: (obj, msg) => child.debug(obj as object, msg ?? ""),
    },
    rateLimiter: inputs.rateLimiter,
    rateLimitRule: AGENT_RUN_RULE,
    threadRepo: inputs.threadRepo,
    titleGen: inputs.titleGen,
  };

  return { endpoints: buildAgentEndpoints(deps), cancellation };
}
