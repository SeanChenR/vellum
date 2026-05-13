/**
 * bootstrap-theme.ts — pre-React theme application.
 *
 * Runs as the first synchronous statement in `main.tsx` so the
 * document's `data-theme` attribute is set BEFORE React renders its
 * first frame. Eliminates the white-to-dark flash for users whose
 * stored preference is `dark`.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Document theme is applied before React mount"
 *   "System-aware theme mode with persisted user preference"
 *
 * The persisted preference values are `"light"` and `"dark"` ONLY.
 * `"system"` mode is represented by the ABSENCE of the localStorage
 * entry; the resolver falls back to `prefers-color-scheme` in that
 * case. Any other stored value is treated as invalid and ignored.
 */

export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "vellum.theme";

export interface ResolveOptions {
  storage: Storage;
  matchMedia: ((query: string) => MediaQueryList) | undefined;
}

export function resolveInitialTheme(opts: ResolveOptions): EffectiveTheme {
  const stored = opts.storage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  // No stored preference (or "system" / invalid): fall back to OS preference.
  if (!opts.matchMedia) return "light";
  try {
    const match = opts.matchMedia("(prefers-color-scheme: dark)");
    return match.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Apply the resolved theme to `<html data-theme="...">`. Called from
 * `main.tsx` before `createRoot()`. Idempotent.
 */
export function applyInitialTheme(): void {
  if (typeof document === "undefined") return;
  const theme = resolveInitialTheme({
    storage: globalThis.localStorage,
    matchMedia:
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia.bind(window)
        : undefined,
  });
  document.documentElement.setAttribute("data-theme", theme);
}
