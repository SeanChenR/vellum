/**
 * useCanvasQuery — TanStack Query hook for fetching a single canvas by ID.
 *
 * Fetches GET /api/canvas/:id and returns the canvas metadata.
 * Used by CanvasPage to get the canvas title/folder before rendering the editor.
 *
 * Canvas access check (canAccess) is enforced server-side; 403/404 are handled
 * by this hook's error state and surfaced by CanvasPage.
 */

import { useQuery } from "@tanstack/react-query";
import type { Canvas } from "../dashboard/useCanvasList";
import type { ApiSuccess } from "@vellum/shared";

/** Canvas DTO as returned by the API, including the caller's effective role. */
export interface CanvasWithRole extends Canvas {
  /** Server-resolved role for this caller against this canvas. */
  effectiveRole?: "editor" | "viewer";
}

async function fetchCanvas(id: string, shareToken?: string): Promise<CanvasWithRole> {
  const url = shareToken
    ? `/api/canvas/${id}?share=${encodeURIComponent(shareToken)}`
    : `/api/canvas/${id}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const err = Object.assign(new Error(`Canvas fetch failed: ${resp.status}`), {
      status: resp.status,
    });
    throw err;
  }
  const body = (await resp.json()) as ApiSuccess<CanvasWithRole>;
  return body.data;
}

export function canvasQueryKey(id: string, shareToken?: string): unknown[] {
  return shareToken ? ["canvas", "single", id, "share", shareToken] : ["canvas", "single", id];
}

export type CanvasQueryResult =
  | { status: "loading" }
  | { status: "success"; data: CanvasWithRole }
  | { status: "error"; httpStatus?: number };

export function useCanvasQuery(id: string, shareToken?: string): CanvasQueryResult {
  const { data, isLoading, isError } = useQuery<CanvasWithRole>({
    queryKey: canvasQueryKey(id, shareToken),
    queryFn: () => fetchCanvas(id, shareToken),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) return { status: "loading" };
  if (isError || !data) return { status: "error" };
  return { status: "success", data };
}
