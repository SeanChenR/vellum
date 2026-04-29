import { describe, expect, test } from "bun:test";
import { RateLimiter } from "./rate-limiter";

const RULE = { windowMs: 1_000, max: 3 } as const;

function makeClock(): { advance: (ms: number) => void; now: () => number } {
  let t = 1_000_000;
  return {
    advance: (ms) => {
      t += ms;
    },
    now: () => t,
  };
}

describe("RateLimiter", () => {
  test("first N requests under max are allowed", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    expect(rl.limit("k", RULE).allowed).toBe(true);
    expect(rl.limit("k", RULE).allowed).toBe(true);
    expect(rl.limit("k", RULE).allowed).toBe(true);
  });

  test("exceeding max returns retry-after in seconds", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    rl.limit("k", RULE);
    rl.limit("k", RULE);
    rl.limit("k", RULE);
    const result = rl.limit("k", RULE);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });

  test("tokens refill over time", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    rl.limit("k", RULE);
    rl.limit("k", RULE);
    rl.limit("k", RULE);
    expect(rl.limit("k", RULE).allowed).toBe(false);

    // Full window passes — bucket fully refills.
    clock.advance(RULE.windowMs);
    expect(rl.limit("k", RULE).allowed).toBe(true);
  });

  test("partial refill grants partial tokens", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    rl.limit("k", RULE);
    rl.limit("k", RULE);
    rl.limit("k", RULE);

    // After 1/3 of window, ~1 token has refilled (3 tokens / 1000ms ≈ 0.333/ms).
    clock.advance(Math.ceil(RULE.windowMs / 3));
    expect(rl.limit("k", RULE).allowed).toBe(true);
    // But the next one should fail again.
    expect(rl.limit("k", RULE).allowed).toBe(false);
  });

  test("different keys have isolated buckets", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    for (let i = 0; i < RULE.max; i++) rl.limit("a", RULE);
    expect(rl.limit("a", RULE).allowed).toBe(false);
    expect(rl.limit("b", RULE).allowed).toBe(true);
  });

  test("LRU eviction kicks in at capacity", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ capacity: 2, now: clock.now });
    rl.limit("a", RULE);
    rl.limit("b", RULE);
    rl.limit("c", RULE); // evicts oldest (a)
    expect(rl.size()).toBe(2);
    // 'a' was evicted, so it gets a fresh bucket.
    expect(rl.limit("a", RULE).allowed).toBe(true);
  });

  test("recently-used keys are kept on LRU", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ capacity: 2, now: clock.now });
    rl.limit("a", RULE);
    rl.limit("b", RULE);
    // Touch 'a' to make it most recent.
    rl.limit("a", RULE);
    rl.limit("c", RULE); // evicts 'b' (oldest after touch)
    expect(rl.size()).toBe(2);
  });

  test("clear() resets all buckets", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    for (let i = 0; i < RULE.max; i++) rl.limit("k", RULE);
    expect(rl.limit("k", RULE).allowed).toBe(false);
    rl.clear();
    expect(rl.size()).toBe(0);
    expect(rl.limit("k", RULE).allowed).toBe(true);
  });
});
