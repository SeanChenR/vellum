/**
 * handlers.ts — HTTP handlers for AI thread CRUD.
 *
 * Endpoints (mounted at /api/agent/threads in apps/api/src/index.ts):
 *
 *   GET    /canvas/:canvasId          → handleListByCanvas
 *   POST   /canvas/:canvasId          → handleCreate
 *   GET    /:threadId                 → handleRead   (thread + messages + usage)
 *   POST   /:threadId/clear           → handleClear  (drops messages, keeps row)
 *   DELETE /:threadId                 → handleDelete (cascades messages)
 *
 * Auth: every handler requires a session. Cross-user access returns 403 with
 * `agent.error.permissionDenied`; unknown threadId returns 404 with
 * `agent.error.threadNotFound`.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *   - "Thread CRUD endpoints for the active user"
 *   - "Threads are persisted per user and canvas" (lazy-create)
 *   - "Thread token usage aggregation endpoint"
 */

import {
  AGENT_THREAD_CLEAR_RULE,
  AGENT_THREAD_CREATE_RULE,
  AGENT_THREAD_DELETE_RULE,
  AGENT_THREAD_LIST_RULE,
  AGENT_THREAD_READ_RULE,
} from "../../lib/rate-limit-rules";
import { RateLimiter } from "../../lib/rate-limiter";
import type { ThreadRepo } from "./repo";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ThreadHandlerDeps {
  repo: ThreadRepo;
  rateLimiter: RateLimiter;
}

export interface SessionLike {
  userId: string;
}

export interface ThreadHandlers {
  handleListByCanvas(
    request: Request,
    canvasId: string,
    session: SessionLike | null,
  ): Promise<Response>;
  handleCreate(request: Request, canvasId: string, session: SessionLike | null): Promise<Response>;
  handleRead(threadId: string, session: SessionLike | null): Promise<Response>;
  handleClear(threadId: string, session: SessionLike | null): Promise<Response>;
  handleDelete(threadId: string, session: SessionLike | null): Promise<Response>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  status: number,
  errorKey: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ errorKey }), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function rateLimitResp(retryAfterSeconds: number): Response {
  return jsonError(429, "agent.error.rateLimited", {
    "retry-after": String(retryAfterSeconds),
  });
}

function rlKey(action: string, userId: string) {
  return `api:agent.threads.${action}:user:${userId}`;
}

function unauthorized(): Response {
  return jsonError(401, "agent.error.permissionDenied");
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function buildThreadHandlers(deps: ThreadHandlerDeps): ThreadHandlers {
  const { repo, rateLimiter } = deps;

  async function handleListByCanvas(
    _request: Request,
    canvasId: string,
    session: SessionLike | null,
  ): Promise<Response> {
    if (!session) return unauthorized();
    const rl = rateLimiter.limit(rlKey("list", session.userId), AGENT_THREAD_LIST_RULE);
    if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

    let threads = await repo.listThreads(session.userId, canvasId);
    if (threads.length === 0) {
      // Lazy-create one empty thread on first visit.
      const t = await repo.createThread({
        userId: session.userId,
        canvasId,
        title: "",
      });
      threads = [t];
    }

    const activeThreadId = threads[0]!.id;
    return Response.json(
      {
        data: {
          threads: threads.map(threadSummary),
          activeThreadId,
        },
      },
      { status: 200 },
    );
  }

  async function handleCreate(
    _request: Request,
    canvasId: string,
    session: SessionLike | null,
  ): Promise<Response> {
    if (!session) return unauthorized();
    const rl = rateLimiter.limit(rlKey("create", session.userId), AGENT_THREAD_CREATE_RULE);
    if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

    const t = await repo.createThread({
      userId: session.userId,
      canvasId,
      title: "",
    });
    return Response.json({ data: t }, { status: 201 });
  }

  async function handleRead(threadId: string, session: SessionLike | null): Promise<Response> {
    if (!session) return unauthorized();
    const rl = rateLimiter.limit(rlKey("read", session.userId), AGENT_THREAD_READ_RULE);
    if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

    const thread = await repo.getThread(threadId);
    if (!thread) {
      return jsonError(404, "agent.error.threadNotFound");
    }
    if (thread.userId !== session.userId) {
      return jsonError(403, "agent.error.permissionDenied");
    }

    const [messages, usage] = await Promise.all([
      repo.loadMessages(threadId),
      repo.aggregateUsage(threadId),
    ]);

    return Response.json(
      {
        data: { thread, messages, usage },
      },
      { status: 200 },
    );
  }

  async function handleClear(threadId: string, session: SessionLike | null): Promise<Response> {
    if (!session) return unauthorized();
    const rl = rateLimiter.limit(rlKey("clear", session.userId), AGENT_THREAD_CLEAR_RULE);
    if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

    const thread = await repo.getThread(threadId);
    if (!thread) {
      return jsonError(404, "agent.error.threadNotFound");
    }
    if (thread.userId !== session.userId) {
      return jsonError(403, "agent.error.permissionDenied");
    }

    await repo.clearMessages(threadId);
    return new Response(null, { status: 204 });
  }

  async function handleDelete(threadId: string, session: SessionLike | null): Promise<Response> {
    if (!session) return unauthorized();
    const rl = rateLimiter.limit(rlKey("delete", session.userId), AGENT_THREAD_DELETE_RULE);
    if (!rl.allowed) return rateLimitResp(rl.retryAfterSeconds);

    const thread = await repo.getThread(threadId);
    if (!thread) {
      return jsonError(404, "agent.error.threadNotFound");
    }
    if (thread.userId !== session.userId) {
      return jsonError(403, "agent.error.permissionDenied");
    }

    await repo.deleteThread(threadId);
    return new Response(null, { status: 204 });
  }

  return {
    handleListByCanvas,
    handleCreate,
    handleRead,
    handleClear,
    handleDelete,
  };
}

// ---------------------------------------------------------------------------
// DTO mappers
// ---------------------------------------------------------------------------

function threadSummary(t: { id: string; title: string; updatedAt: Date; createdAt: Date }): {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
} {
  return {
    id: t.id,
    title: t.title,
    updatedAt: t.updatedAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
  };
}
