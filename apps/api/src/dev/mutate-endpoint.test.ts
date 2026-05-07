/**
 * mutate-endpoint.test.ts — unit tests for the dev-only mutate endpoint.
 *
 * Spec refs:
 *   - openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 *   - openspec/changes/add-permission-guard/specs/permission-guard/spec.md
 *     (the integration scenarios under
 *      "Dev mutate endpoint enforces Permission Guard before applying mutations")
 *
 * Test strategy: the guard's full decision matrix lives in
 * permission-guard.test.ts. Here we only verify the wiring — that the
 * endpoint calls the guard with the right args, in the right ordering
 * relative to rate-limit and payload validation.
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { RateLimiter } from "../lib/rate-limiter";
import { DEV_MUTATE_RULE } from "../lib/rate-limit-rules";
import type { CanvasRole, PermissionGuardDeps } from "../lib/permission-guard";
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

function makePermissionGuardStub(resolveResult: {
  canvasExists: boolean;
  role: CanvasRole | null;
}): {
  permissionGuard: PermissionGuardDeps;
  resolveCanvasRole: ReturnType<typeof mock>;
} {
  const resolveCanvasRole = mock(async () => resolveResult);
  return {
    permissionGuard: {
      resolveCanvasRole: resolveCanvasRole as unknown as PermissionGuardDeps["resolveCanvasRole"],
    },
    resolveCanvasRole,
  };
}

function makeDeps(
  applyResult: { ok: true; appliedCount: number } | { ok: false; errorKey: string },
  injectedGuard?: ReturnType<typeof makePermissionGuardStub>,
): {
  deps: DevMutateDeps;
  applyMutation: ReturnType<typeof mock>;
  resolveCanvasRole: ReturnType<typeof mock>;
} {
  const applyMutation = mock(async () => applyResult);
  // Default to an always-allow stub so existing happy-path / error-mapping /
  // rate-limit tests don't have to know about the guard at all.
  const guard = injectedGuard ?? makePermissionGuardStub({ canvasExists: true, role: "editor" });
  const deps: DevMutateDeps = {
    rateLimiter: new RateLimiter(),
    applyMutation: applyMutation as unknown as DevMutateDeps["applyMutation"],
    permissionGuard: guard.permissionGuard,
  };
  return { deps, applyMutation, resolveCanvasRole: guard.resolveCanvasRole };
}

let nowDeps: ReturnType<typeof makeDeps>;

beforeEach(() => {
  nowDeps = makeDeps({ ok: true, appliedCount: 1 });
});

// ---------------------------------------------------------------------------
// 4.1 happy path (existing — guard is always-allow stub)
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
// 4.2 + 4.3 error mapping (existing — guard is always-allow stub)
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
// 4.4 production gating predicate (unchanged — pure function)
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
// 4.5 rate limit (existing — guard is always-allow stub)
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
// 4.6 startup rule registration check (unchanged — pure function)
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

// ---------------------------------------------------------------------------
// 4.7 Permission Guard wiring (NEW — add-permission-guard spec)
//
// The endpoint MUST call requireRole(deps.permissionGuard, session, canvasId,
// ["owner", "editor"]) after rate-limit admission and before parsing the
// body or dispatching to applyMutation.
// ---------------------------------------------------------------------------

describe("handleDevMutateRequest — Permission Guard wiring", () => {
  test("viewer is rejected with 403 before the mutator runs", async () => {
    const guard = makePermissionGuardStub({ canvasExists: true, role: "viewer" });
    const { deps, applyMutation } = makeDeps({ ok: true, appliedCount: 1 }, guard);
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(403);
    const body = (await resp.json()) as { ok: boolean; errorKey: string };
    expect(body).toEqual({ ok: false, errorKey: "errors.canvas.forbidden" });
    expect(applyMutation).toHaveBeenCalledTimes(0);
  });

  test("editor passes the guard and reaches the mutator", async () => {
    const guard = makePermissionGuardStub({ canvasExists: true, role: "editor" });
    const { deps, applyMutation, resolveCanvasRole } = makeDeps(
      { ok: true, appliedCount: 1 },
      guard,
    );
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(200);
    expect(applyMutation).toHaveBeenCalledTimes(1);
    expect(resolveCanvasRole).toHaveBeenCalledWith(USER_ID, CANVAS_ID);
  });

  test("missing session is rejected with 401", async () => {
    const guard = makePermissionGuardStub({ canvasExists: true, role: "editor" });
    const { deps, applyMutation, resolveCanvasRole } = makeDeps(
      { ok: true, appliedCount: 1 },
      guard,
    );
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, null, deps, CANVAS_ID);

    expect(resp.status).toBe(401);
    const body = (await resp.json()) as { ok: boolean; errorKey: string };
    expect(body).toEqual({ ok: false, errorKey: "errors.auth.unauthorized" });
    expect(applyMutation).toHaveBeenCalledTimes(0);
    expect(resolveCanvasRole).toHaveBeenCalledTimes(0);
  });

  test("unknown canvas is rejected with 404", async () => {
    const guard = makePermissionGuardStub({ canvasExists: false, role: null });
    const { deps, applyMutation } = makeDeps({ ok: true, appliedCount: 1 }, guard);
    const r = reqJson(`/dev/canvas/${CANVAS_ID}/mutate`, VALID_BODY);

    const resp = await handleDevMutateRequest(r, { userId: USER_ID }, deps, CANVAS_ID);

    expect(resp.status).toBe(404);
    const body = (await resp.json()) as { ok: boolean; errorKey: string };
    expect(body).toEqual({ ok: false, errorKey: "errors.canvas.notFound" });
    expect(applyMutation).toHaveBeenCalledTimes(0);
  });

  test("rate-limit precedes guard: exhausted IP bucket + null session → 429 (not 401)", async () => {
    // Spec ordering matrix row [rate-limit=no, session=null, n/a, n/a → 429].
    // Implementation: when session is null, the endpoint keys rate-limit by
    // client IP (x-forwarded-for header) so anonymous requests still get
    // bucketed; guard only runs after admission.
    const guard = makePermissionGuardStub({ canvasExists: true, role: "editor" });
    const { deps, resolveCanvasRole } = makeDeps({ ok: true, appliedCount: 1 }, guard);

    const headers = { "content-type": "application/json", "x-forwarded-for": "10.1.2.3" };
    const reqAnon = (): Request =>
      new Request(`${BASE}/dev/canvas/${CANVAS_ID}/mutate`, {
        method: "POST",
        headers,
        body: JSON.stringify(VALID_BODY),
      });

    // Exhaust the anonymous bucket — each null-session request returns 401
    // (guard rejects), but rate-limit accounting still ticks down because
    // rate-limit fires BEFORE guard.
    for (let i = 0; i < DEV_MUTATE_RULE.max; i++) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await handleDevMutateRequest(reqAnon(), null, deps, CANVAS_ID);
      expect(resp.status).toBe(401);
    }

    // The (max+1)th anonymous request should now flip to 429, proving
    // rate-limit precedes guard.
    const resp = await handleDevMutateRequest(reqAnon(), null, deps, CANVAS_ID);

    expect(resp.status).toBe(429);
    expect(resp.headers.get("retry-after")).toBeTruthy();
    // Guard was never consulted on any null-session call.
    expect(resolveCanvasRole).toHaveBeenCalledTimes(0);
  });
});
