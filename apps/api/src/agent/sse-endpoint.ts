/**
 * sse-endpoint.ts — HTTP entry points for agent run + cancel.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/streaming-channel/spec.md
 *
 * Endpoints:
 *   - POST /agent/canvas/:canvasId/run    → SSE stream (200 + text/event-stream)
 *   - POST /agent/run/:runId/cancel       → 204 (idempotent, ownership-checked)
 *
 * The handlers are returned by `buildAgentEndpoints(deps)` so the index
 * router wires them through one factory call. Per the streaming-channel
 * spec, the run endpoint is rate-limited via AGENT_RUN_RULE; the cancel
 * endpoint is NOT.
 */

import { z } from "zod";
import type { AgentErrorKey } from "@vellum/shared/agent-events";
import { AGENT_RUN_RULE as AGENT_RUN_RULE_SHARED } from "../lib/rate-limit-rules";
import { RateLimiter, type RateLimitRule } from "../lib/rate-limiter";
import { buildSseHeaders, SseWriter } from "./streaming";
import { runAgent, type AgentRuntimeDeps, type RunOutcome, type RunRequest } from "./runtime";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const AGENT_RUN_RULE: RateLimitRule = AGENT_RUN_RULE_SHARED;

export interface AgentEndpointDeps extends AgentRuntimeDeps {
  rateLimiter: RateLimiter;
  rateLimitRule: RateLimitRule;
  /** Hook for tests / instrumentation. Called once per accepted run. */
  onRunStart?(runId: string, userId: string): void;
}

export interface AgentEndpoints {
  /** Handle POST /agent/canvas/:canvasId/run. */
  runHandler(
    request: Request,
    canvasId: string,
    session: { userId: string } | null,
  ): Promise<Response>;
  /** Handle POST /agent/run/:runId/cancel. */
  cancelHandler(runId: string, session: { userId: string } | null): Promise<Response>;
}

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * M14 thread-driven run body. The legacy `messages` field is intentionally
 * absent from this schema; `.strict()` guarantees any client still sending
 * the old shape gets a 400 with `agent.error.invalidRequest` so divergent
 * clients fail loudly instead of silently dropping conversation context.
 */
const runBodySchema = z
  .object({
    runId: z.string().regex(uuidV4Regex).optional(),
    provider: z.enum(["openai", "anthropic", "google"]),
    model: z.string().min(1),
    threadId: z.string().min(1),
    userMessage: z.string().min(1),
  })
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  status: number,
  errorKey: AgentErrorKey,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ errorKey }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function rlKey(userId: string): string {
  return `api:agent.run:user:${userId}`;
}

// ---------------------------------------------------------------------------
// Run id ownership tracking
// ---------------------------------------------------------------------------

interface RunRecord {
  userId: string;
  /** Whether the run lifecycle ended (registry already released). */
  ended: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function buildAgentEndpoints(deps: AgentEndpointDeps): AgentEndpoints {
  const ownership = new Map<string, RunRecord>();

  function recordEnd(runId: string): void {
    const rec = ownership.get(runId);
    if (rec) rec.ended = true;
  }

  async function parseRunBody(
    request: Request,
  ): Promise<
    { ok: true; body: z.infer<typeof runBodySchema> } | { ok: false; response: Response }
  > {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return { ok: false, response: jsonError(400, "agent.error.invalidRequest") };
    }
    const parsed = runBodySchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, response: jsonError(400, "agent.error.invalidRequest") };
    }
    return { ok: true, body: parsed.data };
  }

  async function runHandler(
    request: Request,
    canvasId: string,
    session: { userId: string } | null,
  ): Promise<Response> {
    if (!session) {
      return jsonError(401, "agent.error.permissionDenied");
    }

    const parsed = await parseRunBody(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const runId = body.runId ?? crypto.randomUUID();

    // Reject reused runId.
    const existing = ownership.get(runId);
    if (existing) {
      return jsonError(409, "agent.error.runIdReused");
    }

    // Rate limit
    const rl = deps.rateLimiter.limit(rlKey(session.userId), deps.rateLimitRule);
    if (!rl.allowed) {
      return jsonError(429, "agent.error.rateLimited", {
        "Retry-After": String(rl.retryAfterSeconds),
      });
    }

    // Thread ownership: 400 + invalidRequest on missing OR cross-user (the
    // shape MUST match so the response does not leak whether the thread
    // exists at all). Per streaming-channel spec MODIFIED M14 scenario
    // "Thread ownership rejected".
    const thread = await deps.threadRepo.getThread(body.threadId);
    if (!thread || thread.userId !== session.userId) {
      return jsonError(400, "agent.error.invalidRequest");
    }

    ownership.set(runId, { userId: session.userId, ended: false });
    deps.onRunStart?.(runId, session.userId);

    const runRequest: RunRequest = {
      runId,
      canvasId,
      // sessionId remains useful for log correlation; reuse runId so callers
      // that tail logs by sessionId still find the run.
      sessionId: runId,
      userId: session.userId,
      provider: body.provider,
      model: body.model,
      threadId: body.threadId,
      userMessage: body.userMessage,
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const writer = new SseWriter(controller);
        // Activate heartbeat: writer emits `:hb` after 15 s of write
        // silence. The ticker drives the timing check; without it the
        // writer never re-evaluates whether a heartbeat is due. Required
        // so Bun.serve's idle timeout (255 s on this route) never trips
        // during long model deliberations.
        writer.startHeartbeat();
        const heartbeatTicker = setInterval(() => writer.tickHeartbeat(), 5_000);
        let outcome: RunOutcome | null = null;
        try {
          outcome = await runAgent(deps, runRequest, writer);
        } catch (err) {
          deps.logger.error(
            { err: { name: (err as Error)?.name ?? "Error" }, runId },
            "agent run handler threw",
          );
          if (writer.isOpen) {
            writer.writeEvent({
              type: "error",
              runId,
              errorKey: "agent.error.internal",
            });
          }
        } finally {
          clearInterval(heartbeatTicker);
          recordEnd(runId);
          writer.close();
        }
        // outcome is recorded for instrumentation — caller observes via SSE only.
        void outcome;
      },
      cancel() {
        // Client disconnected; abort the run if still in flight.
        deps.cancellation.abort(runId);
        recordEnd(runId);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: buildSseHeaders(),
    });
  }

  async function cancelHandler(
    runId: string,
    session: { userId: string } | null,
  ): Promise<Response> {
    if (!session) {
      return jsonError(401, "agent.error.permissionDenied");
    }
    const rec = ownership.get(runId);
    // Idempotent: unknown runId => 204 (no log spam either).
    if (!rec) {
      return new Response(null, { status: 204 });
    }
    if (rec.userId !== session.userId) {
      return jsonError(403, "agent.error.permissionDenied");
    }
    deps.cancellation.abort(runId);
    return new Response(null, { status: 204 });
  }

  return { runHandler, cancelHandler };
}
