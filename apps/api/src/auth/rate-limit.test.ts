import { beforeEach, describe, expect, test } from "bun:test";
import { RateLimiter } from "../lib/rate-limiter";
import { applyAuthRateLimit, type AuthRateLimitKind } from "./rate-limit";

// ---------------------------------------------------------------------------
// Per-email Magic Link rule: 3 requests / 10 minutes
// Per-IP Magic Link rule:   10 requests / hour
// Per-IP Login rule:        10 requests / minute
// ---------------------------------------------------------------------------

describe("applyAuthRateLimit — magic-link:email rule (3/10min)", () => {
  let limiter: RateLimiter;
  let nowMs: number;

  beforeEach(() => {
    nowMs = 0;
    limiter = new RateLimiter({ now: () => nowMs });
  });

  test("first 3 sends are allowed", () => {
    for (let i = 0; i < 3; i++) {
      const result = applyAuthRateLimit(
        { kind: "magic-link", ip: "1.2.3.4", email: "a@test.com" },
        limiter,
      );
      expect(result.allowed).toBe(true);
    }
  });

  test("4th send within 10 min is blocked", () => {
    for (let i = 0; i < 3; i++) {
      applyAuthRateLimit({ kind: "magic-link", ip: "1.2.3.4", email: "a@test.com" }, limiter);
    }
    const result = applyAuthRateLimit(
      { kind: "magic-link", ip: "1.2.3.4", email: "a@test.com" },
      limiter,
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  test("send after window refills is allowed", () => {
    for (let i = 0; i < 3; i++) {
      applyAuthRateLimit({ kind: "magic-link", ip: "1.2.3.4", email: "a@test.com" }, limiter);
    }
    // Advance past 10-minute window
    nowMs = 10 * 60 * 1000 + 1;
    const result = applyAuthRateLimit(
      { kind: "magic-link", ip: "1.2.3.4", email: "a@test.com" },
      limiter,
    );
    expect(result.allowed).toBe(true);
  });
});

describe("applyAuthRateLimit — magic-link:ip rule (10/hr)", () => {
  let limiter: RateLimiter;
  let nowMs: number;

  beforeEach(() => {
    nowMs = 0;
    limiter = new RateLimiter({ now: () => nowMs });
  });

  test("10 sends from same IP across different emails are allowed", () => {
    for (let i = 0; i < 10; i++) {
      const result = applyAuthRateLimit(
        { kind: "magic-link", ip: "5.5.5.5", email: `user${i}@test.com` },
        limiter,
      );
      expect(result.allowed).toBe(true);
    }
  });

  test("11th send from same IP within an hour is blocked", () => {
    for (let i = 0; i < 10; i++) {
      applyAuthRateLimit(
        { kind: "magic-link", ip: "5.5.5.5", email: `user${i}@test.com` },
        limiter,
      );
    }
    const result = applyAuthRateLimit(
      { kind: "magic-link", ip: "5.5.5.5", email: "newuser@test.com" },
      limiter,
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});

describe("applyAuthRateLimit — login:ip rule (10/min)", () => {
  let limiter: RateLimiter;
  let nowMs: number;

  beforeEach(() => {
    nowMs = 0;
    limiter = new RateLimiter({ now: () => nowMs });
  });

  test("first 10 login attempts from same IP are allowed", () => {
    for (let i = 0; i < 10; i++) {
      const result = applyAuthRateLimit({ kind: "login", ip: "9.9.9.9" }, limiter);
      expect(result.allowed).toBe(true);
    }
  });

  test("11th login attempt from same IP within a minute is blocked", () => {
    for (let i = 0; i < 10; i++) {
      applyAuthRateLimit({ kind: "login", ip: "9.9.9.9" }, limiter);
    }
    const result = applyAuthRateLimit({ kind: "login", ip: "9.9.9.9" }, limiter);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});

describe("applyAuthRateLimit — magic-link retryAfterSeconds takes max of two rules", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ now: () => 0 });
  });

  test("retryAfterSeconds ≥ 1 when blocked", () => {
    // exhaust per-email rule first
    for (let i = 0; i < 3; i++) {
      applyAuthRateLimit({ kind: "magic-link", ip: "2.2.2.2", email: "b@test.com" }, limiter);
    }
    const result = applyAuthRateLimit(
      { kind: "magic-link", ip: "2.2.2.2", email: "b@test.com" },
      limiter,
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });
});
