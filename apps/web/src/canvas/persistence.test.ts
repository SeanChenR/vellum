/**
 * persistence.test.ts — TDD tests for the persistence deep module.
 *
 * Covers spec: "Persistence module loads and saves snapshots in localStorage with a 5MB cap"
 *
 * Tests use happy-dom's localStorage (registered globally in bunfig.toml).
 * Each test gets a clean localStorage via beforeEach.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadSnapshot, saveSnapshot, _setStorage } from "./persistence";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A small snapshot-shaped object (well under 5MB)
const smallSnapshot = { v: 1, foo: "bar" } as unknown as ReturnType<
  typeof import("tldraw").getSnapshot
>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  // Ensure real localStorage is used between tests
  _setStorage(localStorage);
});

afterEach(() => {
  _setStorage(localStorage);
});

// ---------------------------------------------------------------------------
// Task 2.1 — 5 core scenarios
// ---------------------------------------------------------------------------

describe("persistence — core scenarios", () => {
  // (a) round-trip
  test("round-trip: write small payload then read back equal content", () => {
    const result = saveSnapshot("c1", smallSnapshot);
    expect(result).toEqual({ ok: true });
    const loaded = loadSnapshot("c1");
    expect(loaded).toEqual(smallSnapshot);
  });

  // (b) missing key returns null without throw
  test("loadSnapshot for non-existent key returns null", () => {
    expect(() => loadSnapshot("does-not-exist")).not.toThrow();
    expect(loadSnapshot("does-not-exist")).toBeNull();
  });

  // (c) malformed JSON returns null without throw
  test("loadSnapshot for malformed JSON returns null", () => {
    localStorage.setItem("vellum:canvas:bad-json:snapshot", "NOT_VALID_JSON{{");
    expect(() => loadSnapshot("bad-json")).not.toThrow();
    expect(loadSnapshot("bad-json")).toBeNull();
  });

  // (d) payload > 5MB returns too_large and setItem is NOT called
  test("saveSnapshot with payload > 5MB returns { ok:false, reason:'too_large' } and skips setItem", () => {
    const bigPayload = { data: "x".repeat(5_242_881) } as unknown as ReturnType<
      typeof import("tldraw").getSnapshot
    >;
    let setItemCallCount = 0;
    _setStorage({
      getItem: localStorage.getItem.bind(localStorage),
      setItem: (_k: string, _v: string) => {
        setItemCallCount++;
        localStorage.setItem(_k, _v);
      },
    });
    const result = saveSnapshot("c1", bigPayload);
    expect(result).toEqual({ ok: false, reason: "too_large" });
    expect(setItemCallCount).toBe(0);
    _setStorage(localStorage);
  });

  // (e) QuotaExceededError → { ok:false, reason:'quota' }, no throw
  // Single call: if saveSnapshot threw, the test would crash before the toEqual assertion.
  // That implicit behaviour serves as the "not.toThrow" verification.
  test("saveSnapshot when setItem throws QuotaExceededError returns { ok:false, reason:'quota' }", () => {
    const quotaError = new DOMException("quota exceeded", "QuotaExceededError");
    _setStorage({
      getItem: localStorage.getItem.bind(localStorage),
      setItem: () => {
        throw quotaError;
      },
    });
    const result = saveSnapshot("c1", smallSnapshot);
    expect(result).toEqual({ ok: false, reason: "quota" });
    _setStorage(localStorage);
  });
});

// ---------------------------------------------------------------------------
// Task 2.2 — key-naming round-trip
// ---------------------------------------------------------------------------

describe("persistence — key naming", () => {
  test("write c1 then read c2 returns null", () => {
    saveSnapshot("c1", smallSnapshot);
    expect(loadSnapshot("c2")).toBeNull();
  });

  test("write c1 stores under key vellum:canvas:c1:snapshot", () => {
    saveSnapshot("c1", smallSnapshot);
    const raw = localStorage.getItem("vellum:canvas:c1:snapshot");
    expect(raw).not.toBeNull();
    expect(typeof raw).toBe("string");
  });
});
