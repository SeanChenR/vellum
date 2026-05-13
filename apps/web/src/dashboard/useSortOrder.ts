/**
 * useSortOrder — persisted sort-order state for the dashboard.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 9
 * Spec ref:   openspec/specs/public-pages/spec.md
 *   "DashboardPage uses a two-column layout" — sort order persists
 *   across page reload in `localStorage["vellum.dashboard.sortOrder"]`.
 */

import { useCallback, useEffect, useState } from "react";

export type SortOrder = "recent" | "alphabetical";

const STORAGE_KEY = "vellum.dashboard.sortOrder";
const VALID: readonly SortOrder[] = ["recent", "alphabetical"] as const;

function readInitial(): SortOrder {
  if (typeof window === "undefined") return "recent";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw && (VALID as readonly string[]).includes(raw)) {
    return raw as SortOrder;
  }
  return "recent";
}

export interface UseSortOrderResult {
  order: SortOrder;
  setOrder: (next: SortOrder) => void;
}

export function useSortOrder(): UseSortOrderResult {
  const [order, setOrderState] = useState<SortOrder>(readInitial);

  // Re-read on mount in case SSR-paint defaulted to "recent" while
  // localStorage already contained another value.
  useEffect(() => {
    setOrderState(readInitial());
  }, []);

  const setOrder = useCallback((next: SortOrder) => {
    setOrderState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { order, setOrder };
}
