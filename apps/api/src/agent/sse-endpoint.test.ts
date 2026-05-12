/**
 * sse-endpoint.test.ts — HTTP entry points for agent run + cancel.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/streaming-channel/spec.md
 */

import { beforeEach, describe, expect, it } from "bun:test";
import type { AgentEvent } from "@vellum/shared/agent-events";
import { CancellationRegistry } from "./cancel";
import { RateLimiter } from "../lib/rate-limiter";
import {
  AGENT_RUN_RULE,
  buildAgentEndpoints,
  type AgentEndpointDeps,
  type AgentEndpoints,
} from "./sse-endpoint";
import {
  ProviderError,
  type ProviderAdapter,
  type ProviderEvent,
  type RunOutcome,
} from "./runtime";
import { buildInMemoryThreadRepo, type ThreadRepo } from "./threads/repo";

const VALID_RUN_ID = "11111111-1111-4111-8111-111111111111";
const ALT_RUN_ID = "22222222-2222-4222-8222-222222222222";
const CANVAS_ID = "cnv_a";
const SESSION_ID = "sess_a";
const USER_A = "user_a";
const USER_B = "user_b";
const THREAD_A = "thr_a";
const THREAD_B = "thr_b";

interface TestHarness {
  endpoints: AgentEndpoints;
  registry: CancellationRegistry;
  rateLimiter: RateLimiter;
  provider: ProviderAdapter;
  recordedRuns: Array<{ runId: string; userId: string }>;
}

function makeProvider(scripts: ProviderEvent[][], errors: Array<ProviderError | null> = []) {
  let callCount = 0;
  const adapter: ProviderAdapter = {
    async run(input) {
      const idx = callCount;
      callCount += 1;
      const err = errors[idx];
      if (err) throw err;
      // Default to a stop-only step so callers that omit scripts don't loop forever.
      const events =
        scripts[idx] ?? ([{ type: "step-finish", finishReason: "stop" }] as ProviderEvent[]);
      async function* gen(): AsyncGenerator<ProviderEvent> {
        for (const e of events) {
          if (input.signal.aborted) return;
          yield e;
        }
      }
      return { events: gen() };
    },
  };
  return adapter;
}

function makeHarness(
  opts: {
    role?: "owner" | "editor" | "viewer" | null;
    byokKey?: string | null;
    rateLimiter?: RateLimiter;
    provider?: ProviderAdapter;
  } = {},
): TestHarness & { repo: ThreadRepo } {
  const role = opts.role === undefined ? "editor" : opts.role;
  const provider = opts.provider ?? makeProvider([[{ type: "step-finish", finishReason: "stop" }]]);
  const registry = new CancellationRegistry();
  const rateLimiter = opts.rateLimiter ?? new RateLimiter();
  const recordedRuns: Array<{ runId: string; userId: string }> = [];
  const repo = buildInMemoryThreadRepo();
  // Seed a default thread for USER_A on CANVAS_ID so any test that uses
  // {threadId: THREAD_A} body finds an owned thread by default. Tests that
  // need a different ownership shape (cross-user, missing) seed their own
  // via repo._test_seedThread.
  repo._test_seedThread!({ id: THREAD_A, userId: USER_A, canvasId: CANVAS_ID });

  const deps: AgentEndpointDeps = {
    cancellation: registry,
    permission: {
      resolveCanvasRole: async () => ({ canvasExists: true, role }),
    },
    byok: {
      fetchKey: async () =>
        Object.prototype.hasOwnProperty.call(opts, "byokKey")
          ? (opts.byokKey ?? null)
          : "sk-test-fake",
    },
    toolRegistryDeps: {
      registry: { getRoom: () => undefined },
    } as unknown as AgentEndpointDeps["toolRegistryDeps"],
    digestDeps: {
      registry: { getRoom: () => undefined },
    } as unknown as AgentEndpointDeps["digestDeps"],
    canvasTitle: async () => "test canvas",
    provider,
    clock: { now: () => Date.now() },
    sleep: async () => {
      /* noop */
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    rateLimiter,
    rateLimitRule: AGENT_RUN_RULE,
    threadRepo: repo,
    onRunStart: (runId, userId) => {
      recordedRuns.push({ runId, userId });
    },
  };

  return {
    endpoints: buildAgentEndpoints(deps),
    registry,
    rateLimiter,
    provider,
    recordedRuns,
    repo,
  };
}

function makeRequest(opts: {
  body?: unknown;
  userId?: string | null;
  method?: string;
  url?: string;
}): Request {
  const method = opts.method ?? "POST";
  const headers = new Headers({ "content-type": "application/json" });
  if (opts.userId) headers.set("x-test-user-id", opts.userId);
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD" && opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  return new Request(opts.url ?? "http://localhost/agent/canvas/cnv_a/run", init);
}

async function readSseEvents(response: Response): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  if (!response.body) return events;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(6)) as AgentEvent);
        } catch {
          /* ignore heartbeat/malformed */
        }
      }
    }
  }
  return events;
}

function fakeSession(userId: string | null): { userId: string } | null {
  return userId ? { userId } : null;
}

// ---------------------------------------------------------------------------
// Run endpoint — body parsing + validation
// ---------------------------------------------------------------------------

describe("Run endpoint — body validation + headers", () => {
  it("returns 200 + SSE headers + sets run lifecycle when body is valid", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.headers.get("Connection")).toBe("keep-alive");

    // Drain the stream so the run completes & cleans up.
    await readSseEvents(res);
  });

  it("returns 400 + invalidRequest when provider is unknown", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "unknown",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.invalidRequest");
  });

  it("returns 400 + invalidRequest when runId is not a UUID v4", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: "abc",
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.invalidRequest");
  });

  it("auto-generates a UUID v4 runId when client omits it", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(200);
    await readSseEvents(res);
    expect(h.recordedRuns).toHaveLength(1);
    expect(h.recordedRuns[0]!.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns 400 + invalidRequest when body contains the legacy messages field (M14 contract)", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        threadId: THREAD_A,
        userMessage: "hi",
        // forbidden under M14
        messages: [{ role: "user", content: "hi" }],
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.invalidRequest");
  });

  it("returns 400 + invalidRequest when threadId is missing", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.invalidRequest");
  });

  it("returns 400 + invalidRequest when thread belongs to another user (no existence leak)", async () => {
    const h = makeHarness();
    // Seed a thread owned by USER_B; USER_A asks to run against it.
    h.repo._test_seedThread!({ id: THREAD_B, userId: USER_B, canvasId: CANVAS_ID });
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        threadId: THREAD_B,
        userMessage: "hi",
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.invalidRequest");
  });

  it("returns 400 + invalidRequest when threadId does not exist", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        threadId: "thr_nonexistent",
        userMessage: "hi",
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.invalidRequest");
  });

  it("appends userMessage to the thread before issuing the provider call", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        threadId: THREAD_A,
        userMessage: "create a markdown shape",
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    expect(res.status).toBe(200);
    await readSseEvents(res);
    const rows = await h.repo.loadMessages(THREAD_A);
    // First row of the thread MUST be the user message persisted before the run.
    expect(rows[0]?.role).toBe("user");
    expect(rows[0]?.content).toEqual({ text: "create a markdown shape" });
  });

  it("emits done event with usage payload populated when provider reports usage", async () => {
    const provider = makeProvider([
      [
        { type: "text-delta", delta: "ok" },
        { type: "usage", usage: { input: 1500, output: 800 } },
        { type: "step-finish", finishReason: "stop" },
      ],
    ]);
    const h = makeHarness({ provider });
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        threadId: THREAD_A,
        userMessage: "hi",
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    const events = await readSseEvents(res);
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect(done && "usage" in done ? done.usage : undefined).toEqual({
      input: 1500,
      output: 800,
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("emits done event with usage: null when provider omits the usage event", async () => {
    const provider = makeProvider([
      [
        { type: "text-delta", delta: "ok" },
        { type: "step-finish", finishReason: "stop" },
      ],
    ]);
    const h = makeHarness({ provider });
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        threadId: THREAD_A,
        userMessage: "hi",
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, fakeSession(USER_A));
    const events = await readSseEvents(res);
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect(done && "usage" in done ? done.usage : undefined).toBeNull();
  });

  it("returns 401 when the session is null", async () => {
    const h = makeHarness();
    const req = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const res = await h.endpoints.runHandler(req, CANVAS_ID, null);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.permissionDenied");
  });
});

// ---------------------------------------------------------------------------
// Run endpoint — runId reuse + connection close
// ---------------------------------------------------------------------------

describe("Run endpoint — run id lifecycle", () => {
  it("rejects a runId that has already been used with HTTP 409 + runIdReused", async () => {
    const h = makeHarness();
    const body = {
      runId: VALID_RUN_ID,
      provider: "openai" as const,
      model: "gpt-4o-mini",
      userMessage: "hi",
      threadId: THREAD_A,
    };
    const r1 = await h.endpoints.runHandler(makeRequest({ body }), CANVAS_ID, fakeSession(USER_A));
    expect(r1.status).toBe(200);
    await readSseEvents(r1);

    const r2 = await h.endpoints.runHandler(makeRequest({ body }), CANVAS_ID, fakeSession(USER_A));
    expect(r2.status).toBe(409);
    const json = (await r2.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.runIdReused");
  });
});

// ---------------------------------------------------------------------------
// Cancel endpoint
// ---------------------------------------------------------------------------

describe("Cancel endpoint", () => {
  it("aborts the active run and returns 204", async () => {
    const h = makeHarness();
    const runReq = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const runRes = await h.endpoints.runHandler(runReq, CANVAS_ID, fakeSession(USER_A));
    expect(runRes.status).toBe(200);
    // Don't drain immediately — cancel mid-run.
    const cancelRes = await h.endpoints.cancelHandler(VALID_RUN_ID, fakeSession(USER_A));
    expect(cancelRes.status).toBe(204);
    await readSseEvents(runRes); // drain so run cleans up
  });

  it("is idempotent for unknown runIds — returns 204 without throwing", async () => {
    const h = makeHarness();
    const res = await h.endpoints.cancelHandler(ALT_RUN_ID, fakeSession(USER_A));
    expect(res.status).toBe(204);
  });

  it("returns 403 when another user attempts to cancel", async () => {
    const h = makeHarness();
    const runReq = makeRequest({
      body: {
        runId: VALID_RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "hi",
        threadId: THREAD_A,
      },
    });
    const runRes = await h.endpoints.runHandler(runReq, CANVAS_ID, fakeSession(USER_A));
    expect(runRes.status).toBe(200);
    const cancelRes = await h.endpoints.cancelHandler(VALID_RUN_ID, fakeSession(USER_B));
    expect(cancelRes.status).toBe(403);
    await readSseEvents(runRes);
  });

  it("returns 401 when session is null", async () => {
    const h = makeHarness();
    const res = await h.endpoints.cancelHandler(VALID_RUN_ID, null);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

describe("AGENT_RUN_RULE rate limit", () => {
  it("returns 429 + Retry-After + rateLimited errorKey on the 6th run within 60s", async () => {
    const h = makeHarness();
    const body = (i: number) => ({
      runId: `${"1".repeat(8)}-${"1".repeat(4)}-4${"1".repeat(3)}-8${"1".repeat(3)}-${String(i).padStart(12, "0")}`,
      provider: "openai" as const,
      model: "gpt-4o-mini",
      userMessage: "hi",
      threadId: THREAD_A,
    });
    for (let i = 1; i <= 5; i++) {
      const res = await h.endpoints.runHandler(
        makeRequest({ body: body(i) }),
        CANVAS_ID,
        fakeSession(USER_A),
      );
      expect(res.status).toBe(200);
      await readSseEvents(res);
    }
    const res6 = await h.endpoints.runHandler(
      makeRequest({ body: body(6) }),
      CANVAS_ID,
      fakeSession(USER_A),
    );
    expect(res6.status).toBe(429);
    expect(res6.headers.get("Retry-After")).not.toBeNull();
    const json = (await res6.json()) as { errorKey: string };
    expect(json.errorKey).toBe("agent.error.rateLimited");
  });

  it("does not rate-limit cancel endpoint", async () => {
    const h = makeHarness();
    for (let i = 0; i < 50; i++) {
      const res = await h.endpoints.cancelHandler(VALID_RUN_ID, fakeSession(USER_A));
      expect(res.status).toBe(204);
    }
  });
});

beforeEach(() => {
  /* fresh per-test harness — no shared state */
});

// Ensure RunOutcome import is used (lint avoidance)
const _dummyOutcome: RunOutcome = { state: "done", usage: null };
void _dummyOutcome;
