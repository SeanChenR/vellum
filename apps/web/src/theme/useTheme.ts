/**
 * useTheme.ts — React hook exposing themeMode + effectiveTheme + cycleTheme.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "System-aware theme mode with persisted user preference"
 *
 * The persisted mode lives in Zustand (`useUIStore.themeMode`). The
 * effective theme is derived per-render by combining mode with
 * `prefers-color-scheme`. When mode === "system" we subscribe to
 * `matchMedia` change events so the effective theme tracks the OS
 * preference live; when mode is explicit we ignore the listener.
 */

import { useEffect, useState } from "react";
import { useUIStore, type ThemeMode } from "../store/uiStore";

export type EffectiveTheme = "light" | "dark";

const CYCLE: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system",
};

function getCurrentMql(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function deriveEffective(mode: ThemeMode, prefersDark: boolean): EffectiveTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return prefersDark ? "dark" : "light";
}

export interface UseThemeResult {
  themeMode: ThemeMode;
  effectiveTheme: EffectiveTheme;
  cycleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  // Track `prefers-color-scheme` only while in system mode. Initial
  // value comes from a synchronous matchMedia read so the first render
  // already has the right effective theme.
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    const mql = getCurrentMql();
    return mql ? mql.matches : false;
  });

  useEffect(() => {
    if (themeMode !== "system") return;
    const mql = getCurrentMql();
    if (!mql) return;
    // Re-sync once on (re)entering system mode in case the OS state
    // moved while we were on an explicit mode.
    setPrefersDark(mql.matches);
    const onChange = (ev: MediaQueryListEvent) => setPrefersDark(ev.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [themeMode]);

  const effectiveTheme = deriveEffective(themeMode, prefersDark);

  return {
    themeMode,
    effectiveTheme,
    cycleTheme: () => setThemeMode(CYCLE[themeMode]),
  };
}
