/**
 * handlers.test.ts — Tests for thread CRUD HTTP handlers.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *
 * Tests use the in-memory ThreadRepo (same contract as the drizzle-backed
 * impl in production) plus a token-bucket RateLimiter so the rate-limit
 * branches are exercised without touching real Postgres.
 */

import { describe, expect, test } from "bun:test";
import { buildInMemoryThreadRepo } from "./repo";
import { buildThreadHandlers, type ThreadHandlerDeps } from "./handlers";
import { RateLimiter } from "../../lib/rate-limiter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = "http://localhost:3000";

function makeDeps(): ThreadHandlerDeps {
  return {
    repo: buildInMemoryThreadRepo(),
    rateLimiter: new RateLimiter({ now: () => Date.now() }),
  };
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Thread CRUD endpoints: GET /canvas/:canvasId — lazy create", () => {
  test("first GET on empty canvas lazy-creates one thread + activeThreadId points to it", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);

    const res = await handlers.handleListByCanvas(
      req("GET", "/api/agent/threads/canvas/c1"),
      "c1",
      { userId: "u1" },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { threads: Array<{ id: string }>; activeThreadId: string };
    };
    expect(body.data.threads.length).toBe(1);
    expect(body.data.activeThreadId).toBe(body.data.threads[0]!.id);
  });

  test("subsequent GETs return existing threads in updated_at DESC order", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    // create three threads via repo directly
    const t1 = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    deps.repo._test_advanceClock!(10);
    const t2 = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    deps.repo._test_advanceClock!(10);
    const t3 = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });

    const res = await handlers.handleListByCanvas(
      req("GET", "/api/agent/threads/canvas/c1"),
      "c1",
      { userId: "u1" },
    );
    const body = (await res.json()) as {
      data: { threads: Array<{ id: string }>; activeThreadId: string };
    };
    expect(body.data.threads.map((r) => r.id)).toEqual([t3.id, t2.id, t1.id]);
    expect(body.data.activeThreadId).toBe(t3.id);
  });

  test("returns 401 when session is null", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const res = await handlers.handleListByCanvas(
      req("GET", "/api/agent/threads/canvas/c1"),
      "c1",
      null,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { errorKey: string };
    expect(body.errorKey).toBe("agent.error.permissionDenied");
  });
});

describe("Thread CRUD endpoints: POST /canvas/:canvasId — create new", () => {
  test("creates an empty thread and returns 201 with the row", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const res = await handlers.handleCreate(req("POST", "/api/agent/threads/canvas/c1"), "c1", {
      userId: "u1",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { id: string; title: string; userId: string; canvasId: string };
    };
    expect(body.data.id).toBeDefined();
    expect(body.data.title).toBe("");
    expect(body.data.userId).toBe("u1");
    expect(body.data.canvasId).toBe("c1");
  });
});

describe("Thread CRUD endpoints: POST /:threadId/clear — clear messages preserve row", () => {
  test("clear preserves the thread row and returns 204", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "kept" });
    await deps.repo.appendMessage(t.id, { role: "user", content: { text: "1" } });

    const res = await handlers.handleClear(t.id, { userId: "u1" });
    expect(res.status).toBe(204);
    expect((await deps.repo.loadMessages(t.id)).length).toBe(0);
    expect((await deps.repo.getThread(t.id))?.id).toBe(t.id);
  });
});

describe("Thread CRUD endpoints: DELETE /:threadId — cascade", () => {
  test("delete removes the row and returns 204", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });

    const res = await handlers.handleDelete(t.id, { userId: "u1" });
    expect(res.status).toBe(204);
    expect(await deps.repo.getThread(t.id)).toBeNull();
  });
});

describe("Thread CRUD endpoints: cross-user isolation (no leak of existence)", () => {
  test("U2 GET on U1's thread returns 403 with permissionDenied (does not distinguish 404)", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "private" });

    const res = await handlers.handleRead(t.id, { userId: "u2" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { errorKey: string };
    expect(body.errorKey).toBe("agent.error.permissionDenied");
  });

  test("U2 cannot clear U1's thread — 403", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    const res = await handlers.handleClear(t.id, { userId: "u2" });
    expect(res.status).toBe(403);
  });

  test("U2 cannot delete U1's thread — 403", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    const res = await handlers.handleDelete(t.id, { userId: "u2" });
    expect(res.status).toBe(403);
    expect(await deps.repo.getThread(t.id)).not.toBeNull();
  });

  test("Unknown threadId returns 404 with threadNotFound", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const res = await handlers.handleRead("nope", { userId: "u1" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { errorKey: string };
    expect(body.errorKey).toBe("agent.error.threadNotFound");
  });
});

describe("Thread CRUD endpoints: GET /:threadId — usage aggregation", () => {
  test("returns thread + messages + usage aggregate", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "test" });
    await deps.repo.appendMessage(t.id, { role: "user", content: { text: "hi" } });
    deps.repo._test_advanceClock!(1);
    await deps.repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "A1" },
      provider: "openai",
      model: "gpt-4o-mini",
      runId: "r1",
    });
    await deps.repo.setUsageOnLastAssistant(t.id, "r1", { input: 100, output: 50 });
    deps.repo._test_advanceClock!(1);
    await deps.repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "A2" },
      provider: "openai",
      model: "gpt-4o-mini",
      runId: "r2",
    });
    await deps.repo.setUsageOnLastAssistant(t.id, "r2", { input: 200, output: 75 });

    const res = await handlers.handleRead(t.id, { userId: "u1" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        thread: { id: string; title: string };
        messages: Array<{ id: string }>;
        usage: { input: number; output: number };
      };
    };
    expect(body.data.thread.id).toBe(t.id);
    expect(body.data.messages.length).toBe(3);
    expect(body.data.usage).toEqual({ input: 300, output: 125 });
  });

  test("empty thread aggregates to 0/0", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    const t = await deps.repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    const res = await handlers.handleRead(t.id, { userId: "u1" });
    const body = (await res.json()) as { data: { usage: { input: number; output: number } } };
    expect(body.data.usage).toEqual({ input: 0, output: 0 });
  });
});

describe("Thread CRUD endpoints: rate limit", () => {
  test("repeated create requests eventually 429", async () => {
    const deps = makeDeps();
    const handlers = buildThreadHandlers(deps);
    // AGENT_THREAD_CREATE_RULE: 10/60s. Send 11 — last one must be 429.
    for (let i = 0; i < 10; i++) {
      const r = await handlers.handleCreate(req("POST", "/api/agent/threads/canvas/c1"), "c1", {
        userId: "u1",
      });
      expect(r.status).toBe(201);
    }
    const res = await handlers.handleCreate(req("POST", "/api/agent/threads/canvas/c1"), "c1", {
      userId: "u1",
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    const body = (await res.json()) as { errorKey: string };
    expect(body.errorKey).toBe("agent.error.rateLimited");
  });
});
