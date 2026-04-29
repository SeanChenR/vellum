/**
 * Rate-limit rules tests.
 *
 * Verifies that canvas/folder endpoint rules correctly enforce limits using
 * the in-process RateLimiter.
 *
 * Spec: "Canvas creation — Rate limit exceeded" and
 *       "Folder creation — Rate limit exceeded" scenarios.
 *
 * These tests verify the RULE CONSTANTS are correctly configured —
 * actual endpoint 429 behaviour is tested in canvas.test.ts / folder.test.ts.
 */

import { describe, expect, test } from "bun:test";
import { RateLimiter } from "./rate-limiter";
import {
  CANVAS_CREATE_RULE,
  CANVAS_LIST_RULE,
  CANVAS_READ_RULE,
  CANVAS_UPDATE_RULE,
  CANVAS_DELETE_RULE,
  FOLDER_CREATE_RULE,
  FOLDER_LIST_RULE,
  FOLDER_UPDATE_RULE,
  FOLDER_DELETE_RULE,
} from "./rate-limit-rules";

function makeClock() {
  let t = 1_000_000;
  return { advance: (ms: number) => { t += ms; }, now: () => t };
}

function drainAndExpect429(
  limiter: RateLimiter,
  key: string,
  rule: { windowMs: number; max: number },
) {
  // Exhaust all tokens
  for (let i = 0; i < rule.max; i++) {
    const r = limiter.limit(key, rule);
    expect(r.allowed).toBe(true);
  }
  // The next request must be denied
  const denied = limiter.limit(key, rule);
  expect(denied.allowed).toBe(false);
  if (!denied.allowed) {
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  }
}

describe("Canvas create rule — 10/60s", () => {
  test("11th request within 60s returns denied + retryAfterSeconds", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    drainAndExpect429(rl, "api:canvas:create:user-1", CANVAS_CREATE_RULE);
  });

  test("after full window refill, requests are allowed again", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    drainAndExpect429(rl, "api:canvas:create:user-1", CANVAS_CREATE_RULE);
    clock.advance(CANVAS_CREATE_RULE.windowMs);
    expect(rl.limit("api:canvas:create:user-1", CANVAS_CREATE_RULE).allowed).toBe(true);
  });
});

describe("Folder create rule — 10/60s", () => {
  test("11th request within 60s returns denied + retryAfterSeconds", () => {
    const clock = makeClock();
    const rl = new RateLimiter({ now: clock.now });
    drainAndExpect429(rl, "api:folder:create:user-1", FOLDER_CREATE_RULE);
  });
});

describe("Rule constants match design spec", () => {
  test("CANVAS_CREATE_RULE is 10/60s", () => {
    expect(CANVAS_CREATE_RULE.max).toBe(10);
    expect(CANVAS_CREATE_RULE.windowMs).toBe(60_000);
  });
  test("CANVAS_UPDATE_RULE is 60/60s", () => {
    expect(CANVAS_UPDATE_RULE.max).toBe(60);
  });
  test("CANVAS_DELETE_RULE is 30/60s", () => {
    expect(CANVAS_DELETE_RULE.max).toBe(30);
  });
  test("CANVAS_LIST_RULE is 60/60s", () => {
    expect(CANVAS_LIST_RULE.max).toBe(60);
  });
  test("CANVAS_READ_RULE is 100/60s (permissive for collab)", () => {
    expect(CANVAS_READ_RULE.max).toBe(100);
  });
  test("FOLDER_CREATE_RULE is 10/60s", () => {
    expect(FOLDER_CREATE_RULE.max).toBe(10);
  });
  test("FOLDER_UPDATE_RULE is 30/60s", () => {
    expect(FOLDER_UPDATE_RULE.max).toBe(30);
  });
  test("FOLDER_DELETE_RULE is 10/60s", () => {
    expect(FOLDER_DELETE_RULE.max).toBe(10);
  });
  test("FOLDER_LIST_RULE is 60/60s", () => {
    expect(FOLDER_LIST_RULE.max).toBe(60);
  });
});
