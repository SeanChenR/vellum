/**
 * useSortOrder tests — design Decision 9 / spec public-pages
 * "Sort order persists across page reload".
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useSortOrder } from "./useSortOrder";

const STORAGE_KEY = "vellum.dashboard.sortOrder";

beforeEach(() => {
  globalThis.localStorage?.removeItem(STORAGE_KEY);
});

afterEach(() => {
  globalThis.localStorage?.removeItem(STORAGE_KEY);
});

describe("useSortOrder", () => {
  test("defaults to 'recent' on first mount when localStorage is empty", () => {
    const { result } = renderHook(() => useSortOrder());
    expect(result.current.order).toBe("recent");
  });

  test("setOrder('alphabetical') writes localStorage", () => {
    const { result } = renderHook(() => useSortOrder());
    act(() => {
      result.current.setOrder("alphabetical");
    });
    expect(result.current.order).toBe("alphabetical");
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe("alphabetical");
  });

  test("mount reads persisted value from localStorage", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, "alphabetical");
    const { result } = renderHook(() => useSortOrder());
    expect(result.current.order).toBe("alphabetical");
  });

  test("invalid value in localStorage falls back to 'recent'", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, "junk-value");
    const { result } = renderHook(() => useSortOrder());
    expect(result.current.order).toBe("recent");
  });
});
