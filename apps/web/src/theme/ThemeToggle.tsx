/**
 * ThemeToggle — single-button cycle through system / light / dark.
 *
 * Placed in the navbar right region. Icon reflects the user-picked
 * mode (`Monitor` for system, `Sun` for light, `Moon` for dark). The
 * effective theme (what's actually applied) may differ from the
 * picked mode when system mode resolves to dark via OS preference;
 * we still show the picker icon so the user sees what THEY chose,
 * not the derived state.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Theme toggle is reachable from the navbar"
 */

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ThemeMode } from "../store/uiStore";
import { useTheme } from "./useTheme";

function ModeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === "system") {
    return <Monitor data-testid="theme-toggle-icon-system" size={16} aria-hidden />;
  }
  if (mode === "light") {
    return <Sun data-testid="theme-toggle-icon-light" size={16} aria-hidden />;
  }
  return <Moon data-testid="theme-toggle-icon-dark" size={16} aria-hidden />;
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const { themeMode, cycleTheme } = useTheme();
  const modeLabel = t(`nav.theme.${themeMode}`);
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={t("nav.theme.toggleAriaLabel", { mode: modeLabel })}
      className="focus-visible-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text-primary hover:border-accent-purple hover:text-accent-purple"
    >
      <ModeIcon mode={themeMode} />
    </button>
  );
}
