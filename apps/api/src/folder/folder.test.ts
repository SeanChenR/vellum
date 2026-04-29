/**
 * Folder REST endpoint integration tests.
 *
 * Tests the folder handler functions directly (not through HTTP server).
 *
 * Scenarios covered:
 *   7.1 Folder creation — POST /api/folder
 *   7.2 Folder list     — GET /api/folder
 *   7.3 Folder rename   — PATCH /api/folder/:id
 *   7.4 Folder delete with non-empty guard — DELETE /api/folder/:id
 */

import { describe, expect, test } from "bun:test";
import { handleFolderRequest } from "./index";
import type { RateLimiter } from "../lib/rate-limiter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE = "http://localhost:3000";

function req(
  method: string,
  path: string,
  options: { body?: unknown } = {},
): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

const allowRateLimiter: RateLimiter = {
  limit: () => ({ allowed: true }),
  clear: () => {},
  size: () => 0,
} as unknown as RateLimiter;

const denyRateLimiter: RateLimiter = {
  limit: () => ({ allowed: false, retryAfterSeconds: 60 }),
  clear: () => {},
  size: () => 0,
} as unknown as RateLimiter;

function makeFolderId() {
  return "22222222-2222-2222-2222-" + Math.random().toString(16).slice(2, 14).padStart(12, "0");
}

// ---------------------------------------------------------------------------
// 7.1 Folder creation — POST /api/folder
// ---------------------------------------------------------------------------

describe("POST /api/folder — Folder creation", () => {
  test("unauthenticated request returns 401", async () => {
    const r = req("POST", "/api/folder", { body: { name: "Sketches" } });
    const resp = await handleFolderRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.auth.unauthorized");
  });

  test("missing name returns 400 validation error", async () => {
    const r = req("POST", "/api/folder", { body: {} });
    const resp = await handleFolderRequest(r, { userId: "u1" }, allowRateLimiter);
    expect(resp?.status).toBe(400);
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.validation");
  });

  test("empty name returns 400 validation error", async () => {
    const r = req("POST", "/api/folder", { body: { name: "" } });
    const resp = await handleFolderRequest(r, { userId: "u1" }, allowRateLimiter);
    expect(resp?.status).toBe(400);
  });

  test("name over 80 chars returns 400", async () => {
    const r = req("POST", "/api/folder", { body: { name: "a".repeat(81) } });
    const resp = await handleFolderRequest(r, { userId: "u1" }, allowRateLimiter);
    expect(resp?.status).toBe(400);
  });

  test("rate limit exceeded returns 429 with Retry-After", async () => {
    const r = req("POST", "/api/folder", { body: { name: "Test" } });
    const resp = await handleFolderRequest(r, { userId: "u1" }, denyRateLimiter);
    expect(resp?.status).toBe(429);
    expect(resp?.headers.get("retry-after")).toBeTruthy();
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.rateLimit");
  });
});

// ---------------------------------------------------------------------------
// 7.2 Folder list — GET /api/folder
// ---------------------------------------------------------------------------

describe("GET /api/folder — Folder list", () => {
  test("unauthenticated request returns 401", async () => {
    const r = req("GET", "/api/folder");
    const resp = await handleFolderRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.auth.unauthorized");
  });
});

// ---------------------------------------------------------------------------
// 7.3 Folder rename — PATCH /api/folder/:id
// ---------------------------------------------------------------------------

describe("PATCH /api/folder/:id — Folder rename", () => {
  test("unauthenticated request returns 401", async () => {
    const folderId = makeFolderId();
    const r = req("PATCH", `/api/folder/${folderId}`, { body: { name: "New" } });
    const resp = await handleFolderRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
  });

  test("non-existent folder returns 404", async () => {
    const folderId = makeFolderId();
    const r = req("PATCH", `/api/folder/${folderId}`, { body: { name: "New" } });
    const resp = await handleFolderRequest(r, { userId: "u1" }, allowRateLimiter);
    expect(resp?.status).toBe(404);
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.folder.notFound");
  });

  test("empty name returns 400 validation error", async () => {
    const folderId = makeFolderId();
    const r = req("PATCH", `/api/folder/${folderId}`, { body: { name: "" } });
    const resp = await handleFolderRequest(r, { userId: "u1" }, allowRateLimiter);
    expect(resp?.status).toBe(400);
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.validation");
  });
});

// ---------------------------------------------------------------------------
// 7.4 Folder delete with non-empty guard — DELETE /api/folder/:id
// ---------------------------------------------------------------------------

describe("DELETE /api/folder/:id — Folder delete", () => {
  test("unauthenticated request returns 401", async () => {
    const folderId = makeFolderId();
    const r = req("DELETE", `/api/folder/${folderId}`);
    const resp = await handleFolderRequest(r, null, allowRateLimiter);
    expect(resp?.status).toBe(401);
  });

  test("non-existent folder returns 404", async () => {
    const folderId = makeFolderId();
    const r = req("DELETE", `/api/folder/${folderId}`);
    const resp = await handleFolderRequest(r, { userId: "u1" }, allowRateLimiter);
    expect(resp?.status).toBe(404);
    const body = await resp!.json() as { error: string };
    expect(body.error).toBe("errors.folder.notFound");
  });
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe("Routing", () => {
  test("non-folder path returns null (pass-through)", async () => {
    const r = req("GET", "/api/canvas");
    const resp = await handleFolderRequest(r, null, allowRateLimiter);
    expect(resp).toBeNull();
  });
});
