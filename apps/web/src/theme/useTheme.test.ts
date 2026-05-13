/**
 * useTheme.test.ts — hook contract.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "System-aware theme mode with persisted user preference"
 *   scenarios: "System mode reacts to OS preference change",
 *              "Explicit mode ignores OS preference change",
 *              "Cycling through modes"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useUIStore } from "../store/uiStore";
import { useTheme } from "./useTheme";

type MqlListener = (ev: { matches: boolean }) => void;

class FakeMql {
  matches: boolean;
  listeners = new Set<MqlListener>();
  constructor(matches: boolean) {
    this.matches = matches;
  }
  addEventListener(_type: "change", listener: MqlListener) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: "change", listener: MqlListener) {
    this.listeners.delete(listener);
  }
  dispatch(matches: boolean) {
    this.matches = matches;
    for (const l of this.listeners) l({ matches });
  }
}

let mql: FakeMql;
let originalMatchMedia: typeof window.matchMedia;

beforeEach(() => {
  mql = new FakeMql(false);
  originalMatchMedia = window.matchMedia;
  // @ts-expect-error happy-dom matchMedia override
  window.matchMedia = (_query: string) => mql;
  localStorage.clear();
  useUIStore.setState({ themeMode: "system" });
});

afterEach(() => {
  cleanup();
  window.matchMedia = originalMatchMedia;
  localStorage.clear();
});

describe("useTheme", () => {
  test("returns themeMode + effectiveTheme + cycleTheme", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.themeMode).toBe("system");
    expect(result.current.effectiveTheme).toBe("light");
    expect(typeof result.current.cycleTheme).toBe("function");
  });

  test("system mode + matchMedia.matches=true → effectiveTheme is dark", () => {
    mql.matches = true;
    useUIStore.setState({ themeMode: "system" });
    const { result } = renderHook(() => useTheme());
    expect(result.current.effectiveTheme).toBe("dark");
  });

  test("system mode reacts to matchMedia change event", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.effectiveTheme).toBe("light");
    act(() => {
      mql.dispatch(true);
    });
    expect(result.current.effectiveTheme).toBe("dark");
  });

  test("explicit light mode ignores matchMedia change", () => {
    useUIStore.setState({ themeMode: "light" });
    const { result } = renderHook(() => useTheme());
    expect(result.current.effectiveTheme).toBe("light");
    act(() => {
      mql.dispatch(true);
    });
    expect(result.current.effectiveTheme).toBe("light");
  });

  test("explicit dark mode ignores matchMedia change", () => {
    useUIStore.setState({ themeMode: "dark" });
    const { result } = renderHook(() => useTheme());
    expect(result.current.effectiveTheme).toBe("dark");
    act(() => {
      mql.dispatch(false);
    });
    expect(result.current.effectiveTheme).toBe("dark");
  });

  test("cycleTheme walks system → light → dark → system", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.themeMode).toBe("system");
    act(() => result.current.cycleTheme());
    expect(result.current.themeMode).toBe("light");
    act(() => result.current.cycleTheme());
    expect(result.current.themeMode).toBe("dark");
    act(() => result.current.cycleTheme());
    expect(result.current.themeMode).toBe("system");
  });
});
