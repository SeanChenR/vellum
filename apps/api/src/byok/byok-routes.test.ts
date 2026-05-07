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
import {
  handleByokRequest,
  type ByokDeps,
  type ByokRepo,
  type StoredApiKey,
  type StoredPreferences,
} from "./routes";
import type { ProviderAdapter } from "./providers/types";

const USER_ID = "user-test-1";
const OTHER_USER_ID = "user-test-2";
const BASE = "http://localhost:3000";
const VALID_KEY_BODY = { apiKey: "sk-ant-valid-12345678" };

// ---------------------------------------------------------------------------
// In-memory repo
// ---------------------------------------------------------------------------

interface StoredPreferenceRow extends StoredPreferences {
  userId: string;
}

function makeMemoryRepo(): ByokRepo & {
  rows: StoredApiKey[];
  prefRows: StoredPreferenceRow[];
} {
  const rows: StoredApiKey[] = [];
  const prefRows: StoredPreferenceRow[] = [];
  return {
    rows,
    prefRows,
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
    async getPreferences(userId) {
      return prefRows
        .filter((r) => r.userId === userId)
        .map((r) => ({ provider: r.provider, model: r.model, updatedAt: r.updatedAt }));
    },
    async upsertPreferences(userId, provider, model) {
      const now = new Date();
      const existing = prefRows.find((r) => r.userId === userId && r.provider === provider);
      if (existing) {
        existing.model = model;
        existing.updatedAt = now;
        return { provider, model, updatedAt: now };
      }
      prefRows.push({ userId, provider, model, updatedAt: now });
      return { provider, model, updatedAt: now };
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
  // All three providers share the same stub adapter unless a test overrides
  // them via depsForAdapters. Sufficient for save / list / delete tests.
  return {
    repo,
    vault: VAULT,
    adapters: { anthropic: adapter, openai: adapter, google: adapter },
    rateLimiter,
  };
}

function depsForAdapters(adapters: Record<string, ProviderAdapter>): ByokDeps {
  return {
    repo,
    vault: VAULT,
    adapters,
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
  test("authenticated, no rows / no preferences → 200 with { keys: [], preferences: {} }", async () => {
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      data: { keys: unknown[]; preferences: Record<string, unknown> };
    };
    expect(body.data.keys).toEqual([]);
    expect(body.data.preferences).toEqual({});
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
      data: {
        keys: Array<{ provider: string; createdAt: string; lastUsedAt: string | null }>;
        preferences: Record<string, unknown>;
      };
    };
    expect(body.data.keys).toHaveLength(1);
    expect(body.data.keys[0]?.provider).toBe("anthropic");
    expect(body.data.keys[0]?.lastUsedAt).toBeNull();
    expect("encryptedKey" in (body.data.keys[0] as object)).toBe(false);
    expect(body.data.preferences).toEqual({});
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
  test("POST /api/account/byok/cohere → 400 + errors.byok.providerUnknown, adapter never looked up", async () => {
    // pass an adapter (used by valid providers); cohere path must reject before hitting any adapter
    const { adapter, validateKey } = makeAdapter({ ok: true });
    const resp = await call(
      "POST",
      "/api/account/byok/cohere",
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

// ---------------------------------------------------------------------------
// 13.1 — in-memory repo: preferences contract
// ---------------------------------------------------------------------------

describe("in-memory repo — preferences helper contract (per-provider)", () => {
  test("getPreferences returns empty array for users with no preference rows", async () => {
    expect(await repo.getPreferences(USER_ID)).toEqual([]);
  });

  test("upsertPreferences inserts a row keyed by (user, provider) on first call", async () => {
    const result = await repo.upsertPreferences(USER_ID, "anthropic", "claude-haiku-4-5");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-haiku-4-5");
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(repo.prefRows).toHaveLength(1);
  });

  test("second upsert on the SAME provider updates in place", async () => {
    await repo.upsertPreferences(USER_ID, "anthropic", "claude-haiku-4-5");
    const second = await repo.upsertPreferences(USER_ID, "anthropic", "claude-sonnet-4-6");

    expect(repo.prefRows).toHaveLength(1);
    expect(second.model).toBe("claude-sonnet-4-6");

    const fetched = await repo.getPreferences(USER_ID);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      updatedAt: second.updatedAt,
    });
  });

  test("upsert on a DIFFERENT provider inserts a new row, leaving the first untouched", async () => {
    await repo.upsertPreferences(USER_ID, "anthropic", "claude-haiku-4-5");
    const second = await repo.upsertPreferences(USER_ID, "openai", "gpt-5-mini");

    expect(repo.prefRows).toHaveLength(2);
    expect(second.provider).toBe("openai");

    const fetched = await repo.getPreferences(USER_ID);
    const byProvider = Object.fromEntries(fetched.map((p) => [p.provider, p.model]));
    expect(byProvider).toEqual({
      anthropic: "claude-haiku-4-5",
      openai: "gpt-5-mini",
    });
  });

  test("upsertPreferences refreshes updatedAt on every write to the same row", async () => {
    const first = await repo.upsertPreferences(USER_ID, "anthropic", "claude-haiku-4-5");
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.upsertPreferences(USER_ID, "anthropic", "claude-haiku-4-5");
    expect(second.updatedAt.getTime()).toBeGreaterThan(first.updatedAt.getTime());
  });

  test("preferences are scoped per user — user-A's rows do not surface for user-B", async () => {
    await repo.upsertPreferences(USER_ID, "anthropic", "claude-haiku-4-5");
    expect(await repo.getPreferences(OTHER_USER_ID)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 17.1 PATCH preferences endpoint
// ---------------------------------------------------------------------------

describe("PATCH /api/account/byok/preferences — auth + happy path", () => {
  test("unauthenticated → 401 + errors.byok.notAuthenticated", async () => {
    const resp = await call("PATCH", "/api/account/byok/preferences", null, {
      provider: "openai",
      model: "gpt-5-mini",
    });
    expect(resp.status).toBe(401);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.notAuthenticated");
  });

  test("valid combo → 200 + persists row + returns updatedAt", async () => {
    const resp = await call(
      "PATCH",
      "/api/account/byok/preferences",
      { userId: USER_ID },
      { provider: "openai", model: "gpt-5-mini" },
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      data: { provider: string; model: string; updatedAt: string };
    };
    expect(body.data.provider).toBe("openai");
    expect(body.data.model).toBe("gpt-5-mini");
    expect(typeof body.data.updatedAt).toBe("string");
    expect(repo.prefRows).toHaveLength(1);
    expect(repo.prefRows[0]?.userId).toBe(USER_ID);
  });
});

describe("PATCH /api/account/byok/preferences — rejection paths", () => {
  test("unknown model id → 400 + errors.byok.invalidPreference, no row written", async () => {
    const resp = await call(
      "PATCH",
      "/api/account/byok/preferences",
      { userId: USER_ID },
      { provider: "openai", model: "gpt-9000" },
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.invalidPreference");
    expect(repo.prefRows).toHaveLength(0);
  });

  test("unknown provider → 400 + errors.byok.invalidPreference", async () => {
    const resp = await call(
      "PATCH",
      "/api/account/byok/preferences",
      { userId: USER_ID },
      { provider: "cohere", model: "command" },
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.invalidPreference");
    expect(repo.prefRows).toHaveLength(0);
  });

  test("missing fields → 400 + errors.byok.invalidPreference", async () => {
    const resp = await call("PATCH", "/api/account/byok/preferences", { userId: USER_ID }, {});
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.invalidPreference");
  });

  test("PATCH only updates the addressed provider's row", async () => {
    // Seed an existing anthropic preference.
    repo.prefRows.push({
      userId: USER_ID,
      provider: "anthropic",
      model: "claude-haiku-4-5",
      updatedAt: new Date("2026-05-07T10:00:00.000Z"),
    });
    const resp = await call(
      "PATCH",
      "/api/account/byok/preferences",
      { userId: USER_ID },
      { provider: "google", model: "gemini-2.5-flash" },
    );
    expect(resp.status).toBe(200);
    expect(repo.prefRows).toHaveLength(2);
    const byProvider = Object.fromEntries(repo.prefRows.map((p) => [p.provider, p.model]));
    expect(byProvider.anthropic).toBe("claude-haiku-4-5");
    expect(byProvider.google).toBe("gemini-2.5-flash");
  });

  test("preference allowed even when corresponding key not yet saved", async () => {
    // No openai row in repo.rows; PATCH still accepts the preference.
    expect(repo.rows).toHaveLength(0);
    const resp = await call(
      "PATCH",
      "/api/account/byok/preferences",
      { userId: USER_ID },
      { provider: "openai", model: "gpt-5" },
    );
    expect(resp.status).toBe(200);
  });
});

describe("PATCH /api/account/byok/preferences — rate limit", () => {
  test("61st request within one minute → 429 + Retry-After", async () => {
    // Drain the 60-token bucket.
    for (let i = 0; i < 60; i++) {
      // eslint-disable-next-line no-await-in-loop
      await call(
        "PATCH",
        "/api/account/byok/preferences",
        { userId: USER_ID },
        { provider: "anthropic", model: "claude-haiku-4-5" },
      );
    }
    const resp = await call(
      "PATCH",
      "/api/account/byok/preferences",
      { userId: USER_ID },
      { provider: "anthropic", model: "claude-haiku-4-5" },
    );
    expect(resp.status).toBe(429);
    expect(resp.headers.get("retry-after")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 17.2 GET response — preferences field
// ---------------------------------------------------------------------------

describe("GET /api/account/byok — preferences map (per-provider)", () => {
  test("preferences: empty {} when none set", async () => {
    repo.rows.push({
      userId: USER_ID,
      provider: "openai",
      encryptedKey: "cipher",
      createdAt: new Date(),
      lastUsedAt: null,
    });
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    const body = (await resp.json()) as {
      data: { keys: unknown[]; preferences: Record<string, unknown> };
    };
    expect(body.data.preferences).toEqual({});
  });

  test("preferences keyed by provider when one is set", async () => {
    repo.prefRows.push({
      userId: USER_ID,
      provider: "anthropic",
      model: "claude-haiku-4-5",
      updatedAt: new Date("2026-05-07T10:00:00.000Z"),
    });
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    const body = (await resp.json()) as {
      data: {
        keys: unknown[];
        preferences: Record<string, { model: string; updatedAt: string }>;
      };
    };
    expect(Object.keys(body.data.preferences)).toEqual(["anthropic"]);
    expect(body.data.preferences.anthropic?.model).toBe("claude-haiku-4-5");
    expect(typeof body.data.preferences.anthropic?.updatedAt).toBe("string");
  });

  test("preferences holds multiple entries when several providers are set", async () => {
    repo.prefRows.push(
      {
        userId: USER_ID,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        updatedAt: new Date("2026-05-07T10:00:00.000Z"),
      },
      {
        userId: USER_ID,
        provider: "openai",
        model: "gpt-5-mini",
        updatedAt: new Date("2026-05-07T11:00:00.000Z"),
      },
    );
    const resp = await call("GET", "/api/account/byok", { userId: USER_ID }, undefined);
    const body = (await resp.json()) as {
      data: { preferences: Record<string, { model: string }> };
    };
    expect(Object.keys(body.data.preferences).sort()).toEqual(["anthropic", "openai"]);
    expect(body.data.preferences.anthropic?.model).toBe("claude-haiku-4-5");
    expect(body.data.preferences.openai?.model).toBe("gpt-5-mini");
    expect(body.data.preferences.google).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 17.3 POST multi-provider — happy + isolation
// ---------------------------------------------------------------------------

describe("POST /api/account/byok/:provider — multi-provider happy path", () => {
  test("openai save: 200 + row inserted with provider='openai'", async () => {
    const resp = await call(
      "POST",
      "/api/account/byok/openai",
      { userId: USER_ID },
      { apiKey: "sk-proj-openai-12345678" },
    );
    expect(resp.status).toBe(200);
    expect(repo.rows.find((r) => r.userId === USER_ID && r.provider === "openai")).toBeDefined();
  });

  test("google save: 200 + row inserted with provider='google'", async () => {
    const resp = await call(
      "POST",
      "/api/account/byok/google",
      { userId: USER_ID },
      { apiKey: "AIza-google-12345678" },
    );
    expect(resp.status).toBe(200);
    expect(repo.rows.find((r) => r.userId === USER_ID && r.provider === "google")).toBeDefined();
  });

  test("save openai does not affect existing anthropic row", async () => {
    repo.rows.push({
      userId: USER_ID,
      provider: "anthropic",
      encryptedKey: "anthropic-cipher",
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      lastUsedAt: null,
    });
    const resp = await call(
      "POST",
      "/api/account/byok/openai",
      { userId: USER_ID },
      { apiKey: "sk-proj-openai-12345678" },
    );
    expect(resp.status).toBe(200);
    const anthropicRow = repo.rows.find((r) => r.userId === USER_ID && r.provider === "anthropic");
    expect(anthropicRow?.encryptedKey).toBe("anthropic-cipher");
    expect(repo.rows.filter((r) => r.userId === USER_ID)).toHaveLength(2);
  });

  test("openai save with adapter rejection → 400 + errorKey, no row inserted", async () => {
    const { adapter } = makeAdapter({ ok: false, errorKey: "errors.byok.invalidKey" });
    const resp = await call(
      "POST",
      "/api/account/byok/openai",
      { userId: USER_ID },
      { apiKey: "sk-proj-bad-12345678" },
      adapter,
    );
    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.byok.invalidKey");
    expect(repo.rows).toHaveLength(0);
  });

  test("openai save uses the openai adapter, not anthropic's", async () => {
    const anthropic = makeAdapter({ ok: true });
    const openai = makeAdapter({ ok: true });
    const google = makeAdapter({ ok: true });

    const r = req("POST", "/api/account/byok/openai", { apiKey: "sk-proj-routing-test" });
    const resp = await handleByokRequest(
      r,
      { userId: USER_ID },
      depsForAdapters({
        anthropic: anthropic.adapter,
        openai: openai.adapter,
        google: google.adapter,
      }),
    );
    expect(resp?.status).toBe(200);
    expect(openai.validateKey).toHaveBeenCalledTimes(1);
    expect(anthropic.validateKey).not.toHaveBeenCalled();
    expect(google.validateKey).not.toHaveBeenCalled();
  });
});
