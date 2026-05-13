import { create } from "zustand";

/**
 * Theme mode the USER picked. `"system"` means "track OS preference";
 * `"light"` / `"dark"` are explicit overrides.
 *
 * The effective theme actually applied to `<html data-theme="...">` is
 * derived inside `useTheme()` by combining this mode with
 * `prefers-color-scheme`.
 *
 * Persistence:
 *   - mode === "light" or "dark" → localStorage["vellum.theme"] = mode
 *   - mode === "system" → localStorage["vellum.theme"] removed
 *
 * This is the contract `bootstrap-theme.ts` reads against to skip the
 * first-paint flash.
 */
export type ThemeMode = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "vellum.theme";

function persistThemeMode(mode: ThemeMode): void {
  if (typeof localStorage === "undefined") return;
  if (mode === "system") {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

function readInitialThemeMode(): ThemeMode {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  themeMode: readInitialThemeMode(),
  setThemeMode: (mode) => {
    persistThemeMode(mode);
    set({ themeMode: mode });
  },
}));
