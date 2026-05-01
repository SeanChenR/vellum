/**
 * Sync handshake rate-limit tests (task 2.2).
 *
 * Covers spec requirement:
 *   "WebSocket handshake enforces connection rate limits"
 *
 * Two independent rules are enforced before upgrade:
 *   1. ws.connect.per_user_canvas: concurrent cap of 5 connections per (userId, canvasId)
 *   2. ws.connect.per_ip:          token bucket of 30 new connections per minute per source IP
 *
 * Either rule exceeded SHALL produce { allowed: false, retryAfterSeconds }.
 *
 * These tests inject a fake clock into RateLimiter so token-bucket assertions
 * are deterministic.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { RateLimiter } from "../lib/rate-limiter";
import {
  SYNC_CONNECT_PER_IP_RULE,
  SYNC_CONNECT_PER_USER_CANVAS_MAX,
} from "../lib/rate-limit-rules";
import {
  checkSyncConnectLimits,
  createConcurrentConnectionRegistry,
  type ConcurrentConnectionRegistry,
} from "./rate-limit";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER = "u-alice";
const OTHER_USER = "u-bob";
const CANVAS = "00000000-0000-0000-0000-000000000001";
const OTHER_CANVAS = "00000000-0000-0000-0000-000000000002";
const IP_A = "10.0.0.1";
const IP_B = "10.0.0.2";

let now: number;
let limiter: RateLimiter;
let registry: ConcurrentConnectionRegistry;

beforeEach(() => {
  now = 0;
  limiter = new RateLimiter({ now: () => now, capacity: 1000 });
  registry = createConcurrentConnectionRegistry();
});

function tick(ms: number) {
  now += ms;
}

function check(ctx: { userId: string; canvasId: string; ip: string }) {
  return checkSyncConnectLimits(limiter, registry, ctx);
}

// ---------------------------------------------------------------------------
// Constants sanity (caught early if numbers drift from design)
// ---------------------------------------------------------------------------

describe("sync connect rate-limit constants", () => {
  test("per-user-canvas concurrent max is 5 (per design)", () => {
    expect(SYNC_CONNECT_PER_USER_CANVAS_MAX).toBe(5);
  });

  test("per-ip rule is 30 connections per 60 seconds (per design)", () => {
    expect(SYNC_CONNECT_PER_IP_RULE.max).toBe(30);
    expect(SYNC_CONNECT_PER_IP_RULE.windowMs).toBe(60_000);
  });
});

// ---------------------------------------------------------------------------
// Per-user-canvas concurrent limit
// ---------------------------------------------------------------------------

describe("per-user-canvas concurrent connection limit", () => {
  test("first 5 concurrent connections from same user to same canvas SHALL be allowed", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_USER_CANVAS_MAX; i++) {
      const r = check({ userId: USER, canvasId: CANVAS, ip: IP_A });
      expect(r.allowed).toBe(true);
      registry.add(USER, CANVAS);
    }
    expect(registry.count(USER, CANVAS)).toBe(5);
  });

  test("the 6th concurrent connection from same (user, canvas) SHALL be rejected with retryAfter > 0", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_USER_CANVAS_MAX; i++) {
      check({ userId: USER, canvasId: CANVAS, ip: IP_A });
      registry.add(USER, CANVAS);
    }
    const sixth = check({ userId: USER, canvasId: CANVAS, ip: IP_A });
    expect(sixth.allowed).toBe(false);
    if (sixth.allowed) throw new Error("unreachable");
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("closing one connection MUST free a slot so the next attempt is allowed", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_USER_CANVAS_MAX; i++) {
      check({ userId: USER, canvasId: CANVAS, ip: IP_A });
      registry.add(USER, CANVAS);
    }
    expect(check({ userId: USER, canvasId: CANVAS, ip: IP_A }).allowed).toBe(false);

    // Simulate one client disconnecting.
    registry.remove(USER, CANVAS);
    expect(check({ userId: USER, canvasId: CANVAS, ip: IP_A }).allowed).toBe(true);
  });

  test("limit is scoped per (user, canvas) — different canvas does not share the bucket", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_USER_CANVAS_MAX; i++) {
      check({ userId: USER, canvasId: CANVAS, ip: IP_A });
      registry.add(USER, CANVAS);
    }
    // Same user, OTHER canvas — should be allowed.
    const r = check({ userId: USER, canvasId: OTHER_CANVAS, ip: IP_A });
    expect(r.allowed).toBe(true);
  });

  test("limit is scoped per user — a different user against the same canvas is unaffected", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_USER_CANVAS_MAX; i++) {
      check({ userId: USER, canvasId: CANVAS, ip: IP_A });
      registry.add(USER, CANVAS);
    }
    const r = check({ userId: OTHER_USER, canvasId: CANVAS, ip: IP_A });
    expect(r.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Per-IP token-bucket limit
// ---------------------------------------------------------------------------

describe("per-ip new-connection rate limit", () => {
  test("first 30 new connections from a single IP within 60s SHALL be allowed", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_IP_RULE.max; i++) {
      // Use a different (user, canvas) pair every call so the per-user-canvas
      // counter never trips first; we want to isolate the per-IP rule.
      const r = check({ userId: `u-${i}`, canvasId: `c-${i}`, ip: IP_A });
      expect(r.allowed).toBe(true);
    }
  });

  test("the 31st new connection from one IP within 60s SHALL be rejected with retryAfter > 0", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_IP_RULE.max; i++) {
      check({ userId: `u-${i}`, canvasId: `c-${i}`, ip: IP_A });
    }
    const thirtyFirst = check({
      userId: "u-overflow",
      canvasId: "c-overflow",
      ip: IP_A,
    });
    expect(thirtyFirst.allowed).toBe(false);
    if (thirtyFirst.allowed) throw new Error("unreachable");
    expect(thirtyFirst.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("after the 60-second window passes the IP regains all 30 tokens", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_IP_RULE.max; i++) {
      check({ userId: `u-${i}`, canvasId: `c-${i}`, ip: IP_A });
    }
    expect(check({ userId: "u-x", canvasId: "c-x", ip: IP_A }).allowed).toBe(false);

    tick(SYNC_CONNECT_PER_IP_RULE.windowMs + 1000);

    expect(check({ userId: "u-x", canvasId: "c-x", ip: IP_A }).allowed).toBe(true);
  });

  test("per-IP limit is scoped per source IP — a different IP is unaffected", () => {
    for (let i = 0; i < SYNC_CONNECT_PER_IP_RULE.max; i++) {
      check({ userId: `u-${i}`, canvasId: `c-${i}`, ip: IP_A });
    }
    const r = check({ userId: "u-from-b", canvasId: "c-from-b", ip: IP_B });
    expect(r.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rule precedence
// ---------------------------------------------------------------------------

describe("rule precedence", () => {
  test("either rule exceeded SHALL deny — order does not matter", () => {
    // Saturate the per-user-canvas limit but stay well under per-IP.
    for (let i = 0; i < SYNC_CONNECT_PER_USER_CANVAS_MAX; i++) {
      check({ userId: USER, canvasId: CANVAS, ip: IP_A });
      registry.add(USER, CANVAS);
    }
    const r = check({ userId: USER, canvasId: CANVAS, ip: IP_A });
    expect(r.allowed).toBe(false);
  });

  test("a successful check MUST consume a per-IP token (so saturation eventually triggers)", () => {
    // 30 calls — all distinct (user, canvas), shared IP.
    for (let i = 0; i < SYNC_CONNECT_PER_IP_RULE.max; i++) {
      const r = check({ userId: `u-${i}`, canvasId: `c-${i}`, ip: IP_A });
      expect(r.allowed).toBe(true);
    }
    // 31st distinct (user, canvas) on the same IP must trip the per-IP rule
    // (per-user-canvas is fresh for the new pair).
    const overflow = check({
      userId: "u-overflow",
      canvasId: "c-overflow",
      ip: IP_A,
    });
    expect(overflow.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Concurrent registry semantics
// ---------------------------------------------------------------------------

describe("ConcurrentConnectionRegistry", () => {
  test("count returns 0 for an unseen (user, canvas) pair", () => {
    expect(registry.count("u-fresh", "c-fresh")).toBe(0);
  });

  test("add/remove are symmetric", () => {
    registry.add(USER, CANVAS);
    registry.add(USER, CANVAS);
    expect(registry.count(USER, CANVAS)).toBe(2);
    registry.remove(USER, CANVAS);
    expect(registry.count(USER, CANVAS)).toBe(1);
    registry.remove(USER, CANVAS);
    expect(registry.count(USER, CANVAS)).toBe(0);
  });

  test("remove on a zero counter MUST clamp at 0 (defensive — never negative)", () => {
    registry.remove(USER, CANVAS);
    registry.remove(USER, CANVAS);
    expect(registry.count(USER, CANVAS)).toBe(0);
  });
});
