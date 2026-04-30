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

async function fetchCanvases(scope: CanvasScope, folderId?: string | null): Promise<Canvas[]> {
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

async function createCanvasApi(title: string, folderId?: string | null): Promise<Canvas> {
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

export function canvasListKey(scope: CanvasScope, folderId?: string | null): unknown[] {
  // Distinct sentinels: "all" (no filter) vs "unfiled" (folderId IS NULL).
  // Using `?? "all"` would collide because `null ?? "all" === "all"`, leaking
  // every canvas into the Unfiled view.
  if (folderId === undefined) return ["canvas", "list", scope, "all"];
  if (folderId === null) return ["canvas", "list", scope, "unfiled"];
  return ["canvas", "list", scope, folderId];
}

export function useCanvasList(scope: CanvasScope, folderId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery<Canvas[]>({
    queryKey: canvasListKey(scope, folderId),
    queryFn: () => fetchCanvases(scope, folderId),
    staleTime: 30_000,
  });

  // Broad invalidate covers both list queries (`["canvas","list",...]`) and
  // single-canvas queries (`["canvas","single",id]`). Without this, the
  // in-canvas TopBar shows stale title/folder after rename or move because
  // CanvasPage subscribes to the single-canvas key.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["canvas"], refetchType: "all" });
  };

  const renameCanvas = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => patchCanvas(id, { title }),
    // Optimistic update: list (current view) + single-canvas cache.
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: ["canvas"] });
      const prevList = queryClient.getQueryData<Canvas[]>(canvasListKey(scope, folderId));
      const prevSingle = queryClient.getQueryData<Canvas>(["canvas", "single", id]);
      queryClient.setQueryData<Canvas[]>(
        canvasListKey(scope, folderId),
        (old) => old?.map((c) => (c.id === id ? { ...c, title } : c)) ?? [],
      );
      if (prevSingle) {
        queryClient.setQueryData<Canvas>(["canvas", "single", id], { ...prevSingle, title });
      }
      return { prevList, prevSingle };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevList) {
        queryClient.setQueryData(canvasListKey(scope, folderId), ctx.prevList);
      }
      if (ctx?.prevSingle) {
        queryClient.setQueryData(["canvas", "single", vars.id], ctx.prevSingle);
      }
    },
    onSettled: invalidate,
  });

  const moveCanvas = useMutation({
    mutationFn: ({ id, folderId: targetFolderId }: { id: string; folderId: string | null }) =>
      patchCanvas(id, { folderId: targetFolderId }),
    // Walk every cached canvas list — when the moved canvas no longer matches
    // a list's folder filter, drop it so the source folder doesn't keep
    // showing the canvas after the move settles.
    onMutate: async ({ id, folderId: targetFolderId }) => {
      await queryClient.cancelQueries({ queryKey: ["canvas", "list"] });
      const snapshots: Array<[unknown[], Canvas[] | undefined]> = [];
      const entries = queryClient.getQueriesData<Canvas[]>({ queryKey: ["canvas", "list"] });
      for (const [key, data] of entries) {
        snapshots.push([key as unknown[], data]);
        const filter = (key as unknown[])[3];
        queryClient.setQueryData<Canvas[]>(key as unknown[], (old) => {
          if (!old) return old;
          if (filter === "all") {
            return old.map((c) => (c.id === id ? { ...c, folderId: targetFolderId } : c));
          }
          const filterFolderId = filter === "unfiled" ? null : (filter as string);
          if (filterFolderId !== targetFolderId) {
            return old.filter((c) => c.id !== id);
          }
          return old.map((c) => (c.id === id ? { ...c, folderId: targetFolderId } : c));
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.snapshots) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["canvas", "list"], refetchType: "all" }),
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
