/**
 * og endpoint tests — POST /api/og handler.
 *
 * Spec: canvas-shapes — "OG metadata endpoint returns sanitized parsed
 * result with two-tier cache".
 *
 * Tested behaviour:
 *  - 401 when no session
 *  - 200 + parsed metadata on valid URL
 *  - 403 when SSRF guard rejects (private IP / non-http protocol)
 *  - 429 + Retry-After when rate limit exhausted
 *  - LRU cache hit avoids second outbound fetch within TTL
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { handleOgRequest, type OgHandlerDeps, type OgCache } from "./index";
import { RateLimiter } from "../lib/rate-limiter";
import type { ValidationResult } from "../lib/validate-external-url";

const USER_ID = "user-1";

function session() {
  return { userId: USER_ID };
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/og", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface FakeState {
  fetchCalls: string[];
  cacheGets: string[];
  cacheSets: Array<{ key: string }>;
  cache: Map<string, { value: unknown; expiresAt: number }>;
  validateOk: boolean;
  validateError?: ValidationResult;
  fetchHtml: string;
  fetchOk: boolean;
  fetchStatus: number;
  fetchContentType: string;
  now: number;
}

function makeState(): FakeState {
  return {
    fetchCalls: [],
    cacheGets: [],
    cacheSets: [],
    cache: new Map(),
    validateOk: true,
    fetchHtml: '<html><head><meta property="og:title" content="Hi"></head></html>',
    fetchOk: true,
    fetchStatus: 200,
    fetchContentType: "text/html",
    now: 1_700_000_000_000,
  };
}

function makeDeps(state: FakeState): { deps: OgHandlerDeps; cache: OgCache } {
  const cache: OgCache = {
    get(key) {
      state.cacheGets.push(key);
      const entry = state.cache.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= state.now) {
        state.cache.delete(key);
        return null;
      }
      return entry.value as never;
    },
    set(key, value, ttlMs) {
      state.cacheSets.push({ key });
      state.cache.set(key, { value, expiresAt: state.now + ttlMs });
    },
  };

  const deps: OgHandlerDeps = {
    async validateExternalUrl(raw) {
      if (!state.validateOk) {
        return (
          state.validateError ?? {
            ok: false,
            error: {
              kind: "blocked-address",
              address: "127.0.0.1",
              reason: "loopback",
            },
          }
        );
      }
      return { ok: true, url: new URL(raw) };
    },
    async fetch(url) {
      state.fetchCalls.push(url);
      return {
        ok: state.fetchOk,
        status: state.fetchStatus,
        contentType: state.fetchContentType,
        text: async () => state.fetchHtml,
      };
    },
    now: () => state.now,
  };

  return { deps, cache };
}

describe("POST /api/og — auth", () => {
  test("anonymous (no session) returns 401", async () => {
    const state = makeState();
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();
    const resp = await handleOgRequest(
      postReq({ url: "https://example.com" }),
      null,
      limiter,
      deps,
      cache,
    );
    expect(resp.status).toBe(401);
    expect(state.fetchCalls.length).toBe(0);
  });
});

describe("POST /api/og — happy path + cache", () => {
  test("first request fetches, parses, caches, and returns metadata", async () => {
    const state = makeState();
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();
    const resp = await handleOgRequest(
      postReq({ url: "https://example.com" }),
      session(),
      limiter,
      deps,
      cache,
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { data: { title: string; fetchedAt: string } };
    expect(body.data.title).toBe("Hi");
    expect(typeof body.data.fetchedAt).toBe("string");
    expect(state.fetchCalls.length).toBe(1);
    expect(state.cacheSets.length).toBe(1);
  });

  test("second identical request within TTL is served from cache (no new fetch)", async () => {
    const state = makeState();
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();

    await handleOgRequest(postReq({ url: "https://example.com" }), session(), limiter, deps, cache);
    expect(state.fetchCalls.length).toBe(1);

    // Second call within TTL → cache hit
    state.now += 60_000; // 1 min later, well within 30min TTL
    const resp2 = await handleOgRequest(
      postReq({ url: "https://example.com" }),
      session(),
      limiter,
      deps,
      cache,
    );
    expect(resp2.status).toBe(200);
    expect(state.fetchCalls.length).toBe(1); // unchanged
  });
});

describe("POST /api/og — SSRF guard", () => {
  test("blocked private IP returns 403 errors.og.invalidUrl, no fetch", async () => {
    const state = makeState();
    state.validateOk = false;
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();
    const resp = await handleOgRequest(
      postReq({ url: "http://192.168.1.1/admin" }),
      session(),
      limiter,
      deps,
      cache,
    );
    expect(resp.status).toBe(403);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.og.invalidUrl");
    expect(state.fetchCalls.length).toBe(0);
  });
});

describe("POST /api/og — rate limit", () => {
  test("31st request within 60s returns 429 with Retry-After", async () => {
    const state = makeState();
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();

    for (let i = 0; i < 30; i++) {
      const resp = await handleOgRequest(
        postReq({ url: `https://example.com/${i}` }),
        session(),
        limiter,
        deps,
        cache,
      );
      expect(resp.status).toBe(200);
    }
    const resp31 = await handleOgRequest(
      postReq({ url: "https://example.com/31" }),
      session(),
      limiter,
      deps,
      cache,
    );
    expect(resp31.status).toBe(429);
    expect(resp31.headers.get("retry-after")).not.toBeNull();
    const body = (await resp31.json()) as { error: string };
    expect(body.error).toBe("errors.rateLimit");
  });
});

describe("POST /api/og — fetch failures", () => {
  test("remote 502 returns errors.og.fetchFailed", async () => {
    const state = makeState();
    state.fetchOk = false;
    state.fetchStatus = 502;
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();
    const resp = await handleOgRequest(
      postReq({ url: "https://example.com" }),
      session(),
      limiter,
      deps,
      cache,
    );
    expect(resp.status).toBeGreaterThanOrEqual(400);
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.og.fetchFailed");
  });

  test("non-HTML content-type returns errors.og.fetchFailed", async () => {
    const state = makeState();
    state.fetchContentType = "application/json";
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();
    const resp = await handleOgRequest(
      postReq({ url: "https://example.com" }),
      session(),
      limiter,
      deps,
      cache,
    );
    const body = (await resp.json()) as { error: string };
    expect(body.error).toBe("errors.og.fetchFailed");
  });
});

describe("POST /api/og — input validation", () => {
  test("missing url field returns 400", async () => {
    const state = makeState();
    const { deps, cache } = makeDeps(state);
    const limiter = new RateLimiter();
    const resp = await handleOgRequest(postReq({}), session(), limiter, deps, cache);
    expect(resp.status).toBe(400);
  });
});
