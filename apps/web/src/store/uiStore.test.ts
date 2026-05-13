/**
 * uiStore.test.ts — themeMode persistence contract.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "System-aware theme mode with persisted user preference"
 *   scenarios: "First-visit default is system mode", "User picks light explicitly"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useUIStore } from "./uiStore";

describe("uiStore — themeMode persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ themeMode: "system" });
  });
  afterEach(() => {
    localStorage.clear();
  });

  test("setThemeMode('light') persists 'light' to localStorage", () => {
    useUIStore.getState().setThemeMode("light");
    expect(localStorage.getItem("vellum.theme")).toBe("light");
    expect(useUIStore.getState().themeMode).toBe("light");
  });

  test("setThemeMode('dark') persists 'dark' to localStorage", () => {
    useUIStore.getState().setThemeMode("dark");
    expect(localStorage.getItem("vellum.theme")).toBe("dark");
    expect(useUIStore.getState().themeMode).toBe("dark");
  });

  test("setThemeMode('system') removes the localStorage entry", () => {
    localStorage.setItem("vellum.theme", "dark");
    useUIStore.getState().setThemeMode("system");
    expect(localStorage.getItem("vellum.theme")).toBeNull();
    expect(useUIStore.getState().themeMode).toBe("system");
  });
});
