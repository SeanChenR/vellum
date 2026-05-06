/**
 * byok-routes.test.ts — integration tests for /api/account/byok/*.
 *
 * These tests exercise the route handler via injected dependencies
 * (in-memory repo + mocked provider adapter + real Vault) — fast, no
 * DB required. The DB-side wiring is exercised by Drizzle's own tests
 * and the manual smoke check in task 14.3.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { RateLimiter } from "../lib/rate-limiter";
import { initVault } from "./vault";
import { handleByokRequest, type ByokDeps, type ByokRepo, type StoredApiKey } from "./routes";
import type { ProviderAdapter } from "./providers/types";

const USER_ID = "user-test-1";
const OTHER_USER_ID = "user-test-2";
const BASE = "http://localhost:3000";
const VALID_KEY_BODY = { apiKey: "sk-ant-valid-12345678" };

// ---------------------------------------------------------------------------
// In-memory repo
// ---------------------------------------------------------------------------

function makeMemoryRepo(): ByokRepo & { rows: StoredApiKey[] } {
  const rows: StoredApiKey[] = [];
  return {
    rows,
    async list(userId) {
      return rows
        .filter((r) => r.userId === userId)
        .map((r) => ({
          provider: r.provider,
          createdAt: r.createdAt,
          lastUsedAt: r.lastUsedAt,
        }));
    },
    async upsert(userId, provider, encryptedKey) {
      const now = new Date();
      const existing = rows.find((r) => r.userId === userId && r.provider === provider);
      if (existing) {
        existing.encryptedKey = encryptedKey;
        existing.createdAt = now;
        return {
          provider,
          createdAt: now,
          lastUsedAt: existing.lastUsedAt,
        };
      }
      rows.push({ userId, provider, encryptedKey, createdAt: now, lastUsedAt: null });
      return { provider, createdAt: now, lastUsedAt: null };
    },
    async delete(userId, provider) {
      const idx = rows.findIndex((r) => r.userId === userId && r.provider === provider);
      if (idx >= 0) rows.splice(idx, 1);
    },
  };
}

function makeAdapter(result: { ok: true } | { ok: false; errorKey: string }): {
  adapter: ProviderAdapter;
  validateKey: ReturnType<typeof mock>;
} {
  const validateKey = mock(async () => result);
  return {
    validateKey,
    adapter: { validateKey: validateKey as unknown as ProviderAdapter["validateKey"] },
  };
}

const VAULT = initVault(randomBytes(32).toString("hex"));

interface SessionLike {
  userId: string;
}

let repo: ReturnType<typeof makeMemoryRepo>;
let rateLimiter: RateLimiter;

beforeEach(() => {
  repo = makeMemoryRepo();
  rateLimiter = new RateLimiter({ capacity: 1000 });
});

afterEach(() => {
  rateLimiter.clear();
});

function depsFor(adapter: ProviderAdapter): ByokDeps {
  return {
    repo,
    vault: VAULT,
    adapters: { anthropic: adapter },
    rateLimiter,
  };
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function call(
  method: string,
  path: string,
  session: SessionLike | null,
  body: unknown,
  adapter: ProviderAdapter = makeAdapter({ ok: true }).adapter,
): Promise<Response> {
  const r = req(method, path, body);
  const resp = await handleByokRequest(r, session, depsFor(adapter));
  if (!resp) throw new Error(`handleByokRequest returned undefined for ${method} ${path}`);
  return resp;
}

// ---------------------------------------------------------------------------
// 7.2 GET unauthenticated
// ---------------------------------------------------------------------------

describe("GET /api/account/byok — auth", () => {
  test("unauthenticated → 401 + errors.byok.notAuthenticated", async () => {
    const resp = await call("GET", "/api/account/byok", null, undefined);
    expect(resp.status).toBe(401);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.notAuthenticated");
  });
});

// ---------------------------------------------------------------------------
// 7.3 GET happy paths
// ---------------------------------------------------------------------------

describe("GET /api/account/byok — list", () => {
  test("authenticated, no rows → 200 with data: []", async () => {
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  test("authenticated, one anthropic row → 200 with one entry, no encryptedKey field", async () => {
    repo.rows.push({
      userId: USER_ID,
      provider: "anthropic",
      encryptedKey: "ciphertext-blob",
      createdAt: new Date("2026-05-06T10:00:00.000Z"),
      lastUsedAt: null,
    });
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      data: Array<{ provider: string; createdAt: string; lastUsedAt: string | null }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.provider).toBe("anthropic");
    expect(body.data[0]?.lastUsedAt).toBeNull();
    expect("encryptedKey" in (body.data[0] as object)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7.4 POST validate-fails-don't-persist
// ---------------------------------------------------------------------------

describe("POST /api/account/byok/:provider — validate-before-persist", () => {
  test("adapter ok=false → 400 + errorKey, no DB row created", async () => {
    const { adapter } = makeAdapter({ ok: false, errorKey: "errors.byok.invalidKey" });
    const resp = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      VALID_KEY_BODY,
      adapter,
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.invalidKey");
    expect(repo.rows).toHaveLength(0);
  });

  test("adapter ok=true → 200, row persisted, encryptedKey != plaintext", async () => {
    const { adapter } = makeAdapter({ ok: true });
    const resp = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      VALID_KEY_BODY,
      adapter,
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      data: { provider: string; createdAt: string; lastUsedAt: string | null };
    };
    expect(body.data.provider).toBe("anthropic");
    expect(repo.rows).toHaveLength(1);
    const row = repo.rows[0]!;
    expect(row.userId).toBe(USER_ID);
    expect(row.provider).toBe("anthropic");
    expect(row.encryptedKey).not.toBe(VALID_KEY_BODY.apiKey);
    expect(VAULT.decryptApiKey(row.encryptedKey)).toBe(VALID_KEY_BODY.apiKey);
  });

  test("POST same (user, provider) twice → 1 row, encryptedKey replaced, createdAt updated", async () => {
    const { adapter } = makeAdapter({ ok: true });

    const r1 = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      VALID_KEY_BODY,
      adapter,
    );
    expect(r1.status).toBe(200);
    expect(repo.rows).toHaveLength(1);
    const firstCipher = repo.rows[0]!.encryptedKey;
    const firstCreatedAt = repo.rows[0]!.createdAt.getTime();

    // small wait so createdAt timestamp moves forward
    await new Promise((r) => setTimeout(r, 5));

    const r2 = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      { apiKey: "sk-ant-different-12345678" },
      adapter,
    );
    expect(r2.status).toBe(200);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]!.encryptedKey).not.toBe(firstCipher);
    expect(repo.rows[0]!.createdAt.getTime()).toBeGreaterThan(firstCreatedAt);
  });

  test("POST malformed body (apiKey too short) → 400, adapter never called", async () => {
    const { adapter, validateKey } = makeAdapter({ ok: true });
    const resp = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      { apiKey: "abc" }, // < 8 chars
      adapter,
    );
    expect(resp.status).toBe(400);
    expect(validateKey).not.toHaveBeenCalled();
    expect(repo.rows).toHaveLength(0);
  });

  test("POST missing apiKey → 400, adapter never called", async () => {
    const { adapter, validateKey } = makeAdapter({ ok: true });
    const resp = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      {},
      adapter,
    );
    expect(resp.status).toBe(400);
    expect(validateKey).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7.8 / 7.9 DELETE flows
// ---------------------------------------------------------------------------

describe("DELETE /api/account/byok/:provider", () => {
  test("DELETE existing row → 204, row removed", async () => {
    repo.rows.push({
      userId: USER_ID,
      provider: "anthropic",
      encryptedKey: "blob",
      createdAt: new Date(),
      lastUsedAt: null,
    });
    const resp = await call(
      "DELETE",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      undefined,
    );
    expect(resp.status).toBe(204);
    expect(repo.rows).toHaveLength(0);
  });

  test("DELETE no row → still 204 (idempotent)", async () => {
    const resp = await call(
      "DELETE",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      undefined,
    );
    expect(resp.status).toBe(204);
  });

  test("DELETE is per-user — user-A's delete does not touch user-B's row", async () => {
    repo.rows.push({
      userId: OTHER_USER_ID,
      provider: "anthropic",
      encryptedKey: "blob-B",
      createdAt: new Date(),
      lastUsedAt: null,
    });
    const resp = await call(
      "DELETE",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      undefined,
    );
    expect(resp.status).toBe(204);
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0]?.userId).toBe(OTHER_USER_ID);
  });
});

// ---------------------------------------------------------------------------
// 7.10 unknown provider
// ---------------------------------------------------------------------------

describe("Unknown provider", () => {
  test("POST /api/account/byok/openai → 400 + errors.byok.providerUnknown, adapter never looked up", async () => {
    // pass an adapter for anthropic only; openai path must reject before hitting it
    const { adapter, validateKey } = makeAdapter({ ok: true });
    const resp = await call(
      "POST",
      "/api/account/byok/openai",
      { userId: USER_ID },
      VALID_KEY_BODY,
      adapter,
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.providerUnknown");
    expect(validateKey).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 9.4 rate-limit gating (per-user, per-action)
// ---------------------------------------------------------------------------

describe("Rate limits — Section 9.4", () => {
  test("11th POST in a 60s window → 429 + Retry-After, adapter never called", async () => {
    const { adapter, validateKey } = makeAdapter({ ok: true });
    // Burn through the bucket (10/min for SAVE).
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await call(
        "POST",
        "/api/account/byok/anthropic",
        { userId: USER_ID },
        { apiKey: `sk-ant-key-${i}-XXXXXX` },
        adapter,
      );
      expect(resp.status).toBe(200);
    }
    const callsBefore = validateKey.mock.calls.length;

    const resp = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      VALID_KEY_BODY,
      adapter,
    );
    expect(resp.status).toBe(429);
    expect(resp.headers.get("retry-after")).toBeTruthy();
    const body = (await resp.json()) as { error: string; retryAfter: number };
    expect(body.error).toBe("errors.rateLimit");
    expect(body.retryAfter).toBeGreaterThan(0);
    // Crucially: rate-limit triggered BEFORE the adapter was consulted.
    expect(validateKey.mock.calls.length).toBe(callsBefore);
  });

  test("61st GET → 429", async () => {
    for (let i = 0; i < 60; i++) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
      expect(resp.status).toBe(200);
    }
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    expect(resp.status).toBe(429);
  });

  test("31st DELETE → 429", async () => {
    for (let i = 0; i < 30; i++) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await call(
        "DELETE",
        "/api/account/byok/anthropic",
        { userId: USER_ID },
        undefined,
      );
      expect(resp.status).toBe(204);
    }
    const resp = await call(
      "DELETE",
      "/api/account/byok/anthropic",
      { userId: USER_ID },
      undefined,
    );
    expect(resp.status).toBe(429);
  });

  test("Limits are scoped per user — user-A burning the SAVE bucket does not block user-B", async () => {
    const { adapter } = makeAdapter({ ok: true });
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await call(
        "POST",
        "/api/account/byok/anthropic",
        { userId: "user-A" },
        { apiKey: `sk-ant-${i}-XXXXXX` },
        adapter,
      );
    }
    const resp = await call(
      "POST",
      "/api/account/byok/anthropic",
      { userId: "user-B" },
      VALID_KEY_BODY,
      adapter,
    );
    expect(resp.status).toBe(200);
  });
});
