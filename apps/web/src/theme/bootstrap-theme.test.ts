/**
 * bootstrap-theme.test.ts — pure-function contract for the
 * pre-React theme resolver.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Document theme is applied before React mount"
 *   scenarios: "No theme flicker on cold load"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyInitialTheme, resolveInitialTheme } from "./bootstrap-theme";

interface FakeStorage {
  values: Map<string, string>;
}

function makeStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(_index: number) {
      return null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

function makeMatchMedia(matches: boolean): typeof window.matchMedia {
  return ((_query: string) =>
    ({
      matches,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

describe("resolveInitialTheme", () => {
  test("returns 'dark' when localStorage vellum.theme is 'dark'", () => {
    const result = resolveInitialTheme({
      storage: makeStorage({ "vellum.theme": "dark" }),
      matchMedia: makeMatchMedia(false),
    });
    expect(result).toBe("dark");
  });

  test("returns 'light' when localStorage vellum.theme is 'light'", () => {
    const result = resolveInitialTheme({
      storage: makeStorage({ "vellum.theme": "light" }),
      matchMedia: makeMatchMedia(true),
    });
    expect(result).toBe("light");
  });

  test("falls back to matchMedia when no localStorage entry, matches=true → dark", () => {
    const result = resolveInitialTheme({
      storage: makeStorage(),
      matchMedia: makeMatchMedia(true),
    });
    expect(result).toBe("dark");
  });

  test("falls back to matchMedia when no localStorage entry, matches=false → light", () => {
    const result = resolveInitialTheme({
      storage: makeStorage(),
      matchMedia: makeMatchMedia(false),
    });
    expect(result).toBe("light");
  });

  test("returns 'light' when matchMedia is unavailable (SSR / very old browsers)", () => {
    const result = resolveInitialTheme({
      storage: makeStorage(),
      matchMedia: undefined,
    });
    expect(result).toBe("light");
  });

  test("ignores invalid localStorage value and falls back to matchMedia", () => {
    const result = resolveInitialTheme({
      storage: makeStorage({ "vellum.theme": "neon-pink" }),
      matchMedia: makeMatchMedia(true),
    });
    expect(result).toBe("dark");
  });

  test("explicit 'system' in localStorage is treated as system mode (falls back to matchMedia)", () => {
    const result = resolveInitialTheme({
      storage: makeStorage({ "vellum.theme": "system" }),
      matchMedia: makeMatchMedia(true),
    });
    expect(result).toBe("dark");
  });
});

describe("applyInitialTheme", () => {
  let originalTheme: string | null;
  beforeEach(() => {
    originalTheme = document.documentElement.getAttribute("data-theme");
    localStorage.clear();
  });
  afterEach(() => {
    if (originalTheme === null) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", originalTheme);
    }
    localStorage.clear();
  });

  test("sets data-theme=dark on documentElement when stored preference is dark", () => {
    localStorage.setItem("vellum.theme", "dark");
    applyInitialTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("sets data-theme=light when no stored preference and system prefers light", () => {
    // happy-dom matchMedia returns matches=false by default
    applyInitialTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
