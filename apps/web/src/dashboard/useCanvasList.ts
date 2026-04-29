/**
 * useCanvasList — TanStack Query hook for canvas list.
 *
 * Provides:
 * - `canvases`: list from GET /api/canvas (scope + optional folderId filter)
 * - `isLoading`, `isError`
 * - `renameCanvas(id, title)` — optimistic PATCH, invalidates on settle
 * - `moveCanvas(id, folderId)` — optimistic PATCH, invalidates on settle
 * - `deleteCanvas(id)` — non-optimistic DELETE (destructive), invalidates on settle
 * - `createCanvas(title, folderId?)` — POST, invalidates list
 *
 * Design: "前端架構：dashboard 用 TanStack Query 為 source of truth"
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiSuccess } from "@vellum/shared";

export interface Canvas {
  id: string;
  ownerId: string;
  folderId: string | null;
  title: string;
  snapshot: unknown;
  createdAt: string;
  updatedAt: string;
}

export type CanvasScope = "owned" | "shared";

interface ListResponse {
  data: Canvas[];
  meta: { total: number };
}

async function fetchCanvases(
  scope: CanvasScope,
  folderId?: string | null,
): Promise<Canvas[]> {
  const params = new URLSearchParams({ scope });
  if (folderId !== undefined) {
    params.set("folderId", folderId === null ? "null" : folderId);
  }
  const resp = await fetch(`/api/canvas?${params}`);
  if (!resp.ok) return [];
  const body = (await resp.json()) as ListResponse;
  return body.data ?? [];
}

async function patchCanvas(
  id: string,
  patch: { title?: string; folderId?: string | null },
): Promise<Canvas> {
  const resp = await fetch(`/api/canvas/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!resp.ok) {
    throw new Error("Failed to update canvas");
  }
  const body = (await resp.json()) as ApiSuccess<Canvas>;
  return body.data;
}

async function deleteCanvasById(id: string): Promise<void> {
  const resp = await fetch(`/api/canvas/${id}`, { method: "DELETE" });
  if (!resp.ok && resp.status !== 404) {
    throw new Error("Failed to delete canvas");
  }
}

async function createCanvasApi(
  title: string,
  folderId?: string | null,
): Promise<Canvas> {
  const resp = await fetch("/api/canvas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, folderId }),
  });
  if (!resp.ok) {
    throw new Error("Failed to create canvas");
  }
  const body = (await resp.json()) as ApiSuccess<Canvas>;
  return body.data;
}

export function canvasListKey(
  scope: CanvasScope,
  folderId?: string | null,
): unknown[] {
  return ["canvas", "list", scope, folderId ?? "all"];
}

export function useCanvasList(scope: CanvasScope, folderId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<Canvas[]>({
    queryKey: canvasListKey(scope, folderId),
    queryFn: () => fetchCanvases(scope, folderId),
    staleTime: 30_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["canvas", "list"] });
  };

  const renameCanvas = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      patchCanvas(id, { title }),
    // Optimistic update
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: ["canvas", "list"] });
      const prev = queryClient.getQueryData<Canvas[]>(canvasListKey(scope, folderId));
      queryClient.setQueryData<Canvas[]>(
        canvasListKey(scope, folderId),
        (old) => old?.map((c) => (c.id === id ? { ...c, title } : c)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(canvasListKey(scope, folderId), ctx.prev);
      }
    },
    onSettled: invalidate,
  });

  const moveCanvas = useMutation({
    mutationFn: ({
      id,
      folderId: targetFolderId,
    }: {
      id: string;
      folderId: string | null;
    }) => patchCanvas(id, { folderId: targetFolderId }),
    // Optimistic update
    onMutate: async ({ id, folderId: targetFolderId }) => {
      await queryClient.cancelQueries({ queryKey: ["canvas", "list"] });
      const prev = queryClient.getQueryData<Canvas[]>(canvasListKey(scope, folderId));
      queryClient.setQueryData<Canvas[]>(
        canvasListKey(scope, folderId),
        (old) =>
          old?.map((c) =>
            c.id === id ? { ...c, folderId: targetFolderId } : c,
          ) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(canvasListKey(scope, folderId), ctx.prev);
      }
    },
    onSettled: invalidate,
  });

  // Non-optimistic (destructive) — no local state update before server confirm
  const deleteCanvas = useMutation({
    mutationFn: (id: string) => deleteCanvasById(id),
    onSettled: invalidate,
  });

  const createCanvas = useMutation({
    mutationFn: ({
      title,
      folderId: targetFolderId,
    }: {
      title: string;
      folderId?: string | null;
    }) => createCanvasApi(title, targetFolderId),
    onSettled: invalidate,
  });

  return {
    canvases: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    renameCanvas,
    moveCanvas,
    deleteCanvas,
    createCanvas,
  };
}
