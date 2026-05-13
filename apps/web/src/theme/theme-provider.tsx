/**
 * theme-provider.tsx — keeps `<html data-theme="...">` in sync with the
 * effective theme derived in `useTheme()`.
 *
 * The initial `data-theme` is set by `applyInitialTheme()` in
 * `main.tsx` BEFORE React mounts (no-flicker contract). This provider
 * picks up control on mount and re-writes the attribute whenever the
 * effective theme changes — e.g. user cycles modes, or OS preference
 * changes while in system mode.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 */

import { useEffect, type ReactNode } from "react";
import { useTheme } from "./useTheme";

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { effectiveTheme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  return <>{children}</>;
}
