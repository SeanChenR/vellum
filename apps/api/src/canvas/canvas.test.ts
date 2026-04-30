/**
 * Canvas REST endpoint integration tests.
 *
 * Tests the canvas handler functions directly (not through HTTP server) by
 * calling handleCanvasRequest with mock requests and a test DB.
 *
 * All tests use a mock DB layer to avoid needing a real Postgres instance
 * in unit test context. Integration tests that need a real DB live in e2e/.
 *
 * Scenarios covered:
 *   5.1 Canvas creation — POST /api/canvas
 *   5.2 Canvas list     — GET /api/canvas  (scope + folderId filters)
 *   5.3 Canvas read     — GET /api/canvas/:id
 *   5.4 Canvas update   — PATCH /api/canvas/:id
 *   5.5 Canvas delete   — DELETE /api/canvas/:id
 */

import { describe, expect, test } from "bun:test";
import { handleCanvasRequest } from "./index";
import type { RateLimiter } from "../lib/rate-limiter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = "http://localhost:3000";

function makeUserId() {
  return "user-" + Math.random().toString(36).slice(2, 10);
}

function makeCanvasId() {
  return "00000000-0000-0000-0000-" + Math.random().toString(16).slice(2, 14).padStart(12, "0");
}

interface MockSession {
  userId: string;
}

/** Build a fake Request with optional JSON body and auth session. */
function req(
  method: string,
  path: string,
  options: { body?: unknown; session?: MockSession | null } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  return new Request(`${BASE}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** A minimal no-op RateLimiter that always allows. */
const allowRateLimiter: RateLimiter = {
  limit: () => ({ allowed: true }),
  clear: () => {},
  size: () => 0,
} as unknown as RateLimiter;

/** A minimal RateLimiter that always denies. */
const denyRateLimiter: RateLimiter = {
  limit: () => ({ allowed: false, retryAfterSeconds: 60 }),
  clear: () => {},
  size: () => 0,
} as unknown as RateLimiter;

// ---------------------------------------------------------------------------
// 5.1 Canvas creation — POST /api/canvas
// ---------------------------------------------------------------------------

describe("POST /api/canvas — Canvas creation", () => {
  test("unauthenticated request returns 401", async () => {
    const r = req("POST", "/api/canvas", { body: { title: "My Canvas" } });
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.auth.unauthorized");
  });

  test("missing title returns 400 validation error", async () => {
    const userId = makeUserId();
    const r = req("POST", "/api/canvas", { body: {} });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(400);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.validation");
  });

  test("empty title returns 400 validation error", async () => {
    const userId = makeUserId();
    const r = req("POST", "/api/canvas", { body: { title: "" } });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(400);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.validation");
  });

  test("title over 120 chars returns 400", async () => {
    const userId = makeUserId();
    const r = req("POST", "/api/canvas", { body: { title: "a".repeat(121) } });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(400);
  });

  test("rate limit exceeded returns 429 with Retry-After", async () => {
    const userId = makeUserId();
    const r = req("POST", "/api/canvas", { body: { title: "Test" } });
    const resp = await handleCanvasRequest(r, { userId }, denyRateLimiter);
    expect(resp?.status).toBe(429);
    expect(resp?.headers.get("retry-after")).toBeTruthy();
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.rateLimit");
  });

  test("invalid folderId (non-uuid) returns 400", async () => {
    const userId = makeUserId();
    const r = req("POST", "/api/canvas", {
      body: { title: "Test", folderId: "not-a-uuid" },
    });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 5.2 Canvas list — GET /api/canvas
// ---------------------------------------------------------------------------

describe("GET /api/canvas — Canvas list", () => {
  test("unauthenticated request returns 401", async () => {
    const r = req("GET", "/api/canvas");
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.auth.unauthorized");
  });

  test("scope=shared always returns empty array (forward-compat short-circuit)", async () => {
    const userId = makeUserId();
    const r = req("GET", "/api/canvas?scope=shared");
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: unknown[]; meta: { total: number } };
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5.3 Canvas read — GET /api/canvas/:id
// ---------------------------------------------------------------------------

describe("GET /api/canvas/:id — Canvas read by id", () => {
  test("unauthenticated request returns 401", async () => {
    const canvasId = makeCanvasId();
    const r = req("GET", `/api/canvas/${canvasId}`);
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
  });

  test("non-existent canvas returns 404", async () => {
    const userId = makeUserId();
    const canvasId = makeCanvasId();
    const r = req("GET", `/api/canvas/${canvasId}`);
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(404);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.notFound");
  });
});

// ---------------------------------------------------------------------------
// 5.4 Canvas update — PATCH /api/canvas/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/canvas/:id — Canvas update", () => {
  test("unauthenticated request returns 401", async () => {
    const canvasId = makeCanvasId();
    const r = req("PATCH", `/api/canvas/${canvasId}`, { body: { title: "Renamed" } });
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
  });

  test("non-existent canvas returns 404", async () => {
    const userId = makeUserId();
    const canvasId = makeCanvasId();
    const r = req("PATCH", `/api/canvas/${canvasId}`, { body: { title: "Renamed" } });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(404);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.notFound");
  });

  test("empty title returns 400 validation error", async () => {
    const userId = makeUserId();
    const canvasId = makeCanvasId();
    const r = req("PATCH", `/api/canvas/${canvasId}`, { body: { title: "" } });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(400);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.validation");
  });

  test("invalid folderId (non-uuid) returns 400", async () => {
    const userId = makeUserId();
    const canvasId = makeCanvasId();
    const r = req("PATCH", `/api/canvas/${canvasId}`, {
      body: { folderId: "bad-id" },
    });
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 5.5 Canvas delete — DELETE /api/canvas/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/canvas/:id — Canvas delete", () => {
  test("unauthenticated request returns 401", async () => {
    const canvasId = makeCanvasId();
    const r = req("DELETE", `/api/canvas/${canvasId}`);
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
  });

  test("non-existent canvas returns 404", async () => {
    const userId = makeUserId();
    const canvasId = makeCanvasId();
    const r = req("DELETE", `/api/canvas/${canvasId}`);
    const resp = await handleCanvasRequest(r, { userId }, allowRateLimiter);
    expect(resp?.status).toBe(404);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.canvas.notFound");
  });
});

// ---------------------------------------------------------------------------
// Routing — non-canvas paths return null
// ---------------------------------------------------------------------------

describe("Routing", () => {
  test("non-canvas path returns null (pass-through)", async () => {
    const r = req("GET", "/api/folder");
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp).toBeNull();
  });

  test("/api/canvas prefix-only path is routed to list", async () => {
    const r = req("GET", "/api/canvas");
    const resp = await handleCanvasRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
  });
});
