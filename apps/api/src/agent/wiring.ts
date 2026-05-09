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
// Vercel AI SDK provider adapter — bridges streamText to ProviderEvent.
// ---------------------------------------------------------------------------

function buildModel(provider: "openai" | "anthropic" | "google", model: string, apiKey: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
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
        const result = streamText({
          model,
          messages: toModelMessages(input.messages),
          tools: tools as never,
          abortSignal: input.signal,
        });

        async function* bridge(): AsyncGenerator<ProviderEvent> {
          for await (const part of result.fullStream) {
            if (input.signal.aborted) return;
            switch (part.type) {
              case "text-delta":
                yield { type: "text-delta", delta: part.text };
                break;
              case "tool-call":
                yield {
                  type: "tool-call",
                  callId: part.toolCallId,
                  name: part.toolName,
                  args: part.input as unknown,
                };
                break;
              case "finish-step":
                yield {
                  type: "step-finish",
                  finishReason:
                    part.finishReason === "stop" ||
                    part.finishReason === "length" ||
                    part.finishReason === "tool-calls" ||
                    part.finishReason === "error"
                      ? part.finishReason
                      : "stop",
                };
                break;
              case "error": {
                const err = part.error as { status?: number; message?: string };
                throw new ProviderError(err.status ?? 500, err.message);
              }
              default:
                // text-start / text-end / start-step / etc — ignored
                break;
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
  };

  return { endpoints: buildAgentEndpoints(deps), cancellation };
}
