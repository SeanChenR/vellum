/**
 * mutate-endpoint.test.ts — unit tests for the dev-only mutate endpoint.
 *
 * Spec ref: openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RateLimiter } from "../lib/rate-limiter";
import { DEV_MUTATE_RULE } from "../lib/rate-limit-rules";
import {
  handleDevMutateRequest,
  shouldRegisterDevMutate,
  assertDevMutateRuleRegistered,
  type DevMutateDeps,
} from "./mutate-endpoint";

const BASE = "http://localhost:3000";
const CANVAS_ID = "canvas-1";
const USER_ID = "user-1";

const VALID_BODY = {
  mutations: [
    {
      type: "createShape",
      payload: {
        id: "shape:abc",
        type: "geo",
        x: 100,
        y: 100,
        props: { color: "blue" },
      },
    },
  ],
};

function reqJson(path: string, body: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeps(
  applyResult: { ok: true; appliedCount: number } | { ok: false; errorKey: string },
): {
  deps: DevMutateDeps;
  applyMutation: ReturnType<typeof mock>;
} {
  const applyMutation = mock(async () => applyResult);
  const deps: DevMutateDeps = {
    rateLimiter: new RateLimiter(),
    applyMutation: applyMutation as unknown as DevMutateDeps["applyMutation"],
  };
  return { deps, applyMutation };
}

let nowDeps: ReturnType<typeof makeDeps>;

beforeEach(() => {
  nowDeps = makeDeps({ ok: true, appliedCount: 1 });
});

// ---------------------------------------------------------------------------
// 4.1 happy path
// ---------------------------------------------------------------------------

describe("handleDevMutateRequest — happy path", () => {
  test("valid body + ok mutator → 200 with appliedCount", async () => {
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);
    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, nowDeps.deps, CANVAS_ID);

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { ok: boolean; appliedCount: number };
    expect(body).toEqual({ ok: true, appliedCount: 1 });
    expect(nowDeps.applyMutation).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 4.2 + 4.3 error mapping (errorKey → status code)
// ---------------------------------------------------------------------------

describe("handleDevMutateRequest — errorKey → status code mapping", () => {
  test("invalidPayload → 400 with same errorKey", async () => {
    const { deps } = makeDeps({ ok: false, errorKey: "errors.devMutate.invalidPayload" });
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(400);
    const body = (await resp.json()) as { ok: boolean; errorKey: string };
    expect(body).toEqual({ ok: false, errorKey: "errors.devMutate.invalidPayload" });
  });

  test("canvasNotInActiveRoom → 409 with same errorKey", async () => {
    const { deps } = makeDeps({ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" });
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(409);
    const body = (await resp.json()) as { ok: boolean; errorKey: string };
    expect(body).toEqual({ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" });
  });

  test("mutationFailed → 500 with same errorKey", async () => {
    const { deps } = makeDeps({ ok: false, errorKey: "errors.devMutate.mutationFailed" });
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(500);
    const body = (await resp.json()) as { ok: boolean; errorKey: string };
    expect(body).toEqual({ ok: false, errorKey: "errors.devMutate.mutationFailed" });
  });
});

// ---------------------------------------------------------------------------
// 4.4 production gating predicate
// ---------------------------------------------------------------------------

describe("shouldRegisterDevMutate — production gating", () => {
  test("NODE_ENV=production → false", () => {
    expect(shouldRegisterDevMutate({ NODE_ENV: "production" })).toBe(false);
  });

  test("NODE_ENV unset → true (dev default)", () => {
    expect(shouldRegisterDevMutate({ NODE_ENV: undefined })).toBe(true);
    expect(shouldRegisterDevMutate({})).toBe(true);
  });

  test("NODE_ENV=development / test → true", () => {
    expect(shouldRegisterDevMutate({ NODE_ENV: "development" })).toBe(true);
    expect(shouldRegisterDevMutate({ NODE_ENV: "test" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4.5 rate limit
// ---------------------------------------------------------------------------

describe("handleDevMutateRequest — rate limit", () => {
  test("31st request inside 60s → 429 with Retry-After header", async () => {
    const { deps } = makeDeps({ ok: true, appliedCount: 1 });

    // Burn through the bucket: 30 allowed, 31st rejected. Sequential
    // by design — each await consumes exactly one token.
    for (let i = 0; i < DEV_MUTATE_RULE.max; i++) {
      const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);
      // eslint-disable-next-line no-await-in-loop
      const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);
      expect(resp.status).toBe(200);
    }

    const tipping = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);
    const resp = await handleDevMutateRequest(tipping, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(429);
    expect(resp.headers.get("retry-after")).toBeTruthy();
    const body = (await resp.json()) as { ok: boolean; errorKey: string; retryAfter: number };
    expect(body.ok).toBe(false);
    expect(body.errorKey).toBe("errors.rateLimit");
    expect(typeof body.retryAfter).toBe("number");
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  test("rate limits are scoped per user", async () => {
    const { deps } = makeDeps({ ok: true, appliedCount: 1 });
    for (let i = 0; i < DEV_MUTATE_RULE.max; i++) {
      const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);
      // eslint-disable-next-line no-await-in-loop
      await handleDevMutateRequest(r, { userId: "user-A" }, deps, CANVAS_ID);
    }
    // user-B starts fresh.
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);
    const resp = await handleDevMutateRequest(r, { userId: "user-B" }, deps, CANVAS_ID);
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 4.6 startup rule registration check
// ---------------------------------------------------------------------------

describe("assertDevMutateRuleRegistered", () => {
  test("undefined rule throws", () => {
    expect(() => assertDevMutateRuleRegistered(undefined)).toThrow();
  });

  test("rule with non-positive max throws", () => {
    expect(() => assertDevMutateRuleRegistered({ max: 0, windowMs: 60_000 })).toThrow();
    expect(() => assertDevMutateRuleRegistered({ max: -1, windowMs: 60_000 })).toThrow();
  });

  test("rule with non-positive windowMs throws", () => {
    expect(() => assertDevMutateRuleRegistered({ max: 30, windowMs: 0 })).toThrow();
  });

  test("valid rule passes silently", () => {
    expect(() => assertDevMutateRuleRegistered(DEV_MUTATE_RULE)).not.toThrow();
  });
});
