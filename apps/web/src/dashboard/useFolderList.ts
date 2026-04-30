/**
 * useFolderList — TanStack Query hook for folder list.
 *
 * Provides:
 * - `folders`: list from GET /api/folder (sorted name asc on server)
 * - `isLoading`, `isError`
 * - `createFolder(name)` — POST /api/folder
 * - `renameFolder(id, name)` — PATCH /api/folder/:id
 * - `deleteFolder(id)` — DELETE /api/folder/:id (server enforces non-empty guard)
 *
 * Design: "前端架構：dashboard 用 TanStack Query 為 source of truth"
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiSuccess } from "@vellum/shared";

export interface Folder {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface FolderListResponse {
  data: Folder[];
  meta: { total: number };
}

async function fetchFolders(): Promise<Folder[]> {
  const resp = await fetch("/api/folder");
  if (!resp.ok) return [];
  const body = (await resp.json()) as FolderListResponse;
  return body.data ?? [];
}

async function createFolderApi(name: string): Promise<Folder> {
  const resp = await fetch("/api/folder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) {
    throw new Error("Failed to create folder");
  }
  const body = (await resp.json()) as ApiSuccess<Folder>;
  return body.data;
}

async function renameFolderApi(id: string, name: string): Promise<Folder> {
  const resp = await fetch(`/api/folder/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) {
    throw new Error("Failed to rename folder");
  }
  const body = (await resp.json()) as ApiSuccess<Folder>;
  return body.data;
}

async function deleteFolderApi(id: string): Promise<void> {
  const resp = await fetch(`/api/folder/${id}`, { method: "DELETE" });
  if (!resp.ok && resp.status !== 404) {
    // 409 = folder not empty; re-throw with structured error
    if (resp.status === 409) {
      throw Object.assign(new Error("errors.folder.notEmpty"), {
        errorKey: "errors.folder.notEmpty",
      });
    }
    throw new Error("Failed to delete folder");
  }
}

export const FOLDER_LIST_KEY = ["folder", "list"] as const;

export function useFolderList() {
  const queryClient = useQueryClient();

  const query = useQuery<Folder[]>({
    queryKey: FOLDER_LIST_KEY,
    queryFn: fetchFolders,
    staleTime: 30_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["folder", "list"] });
  };

  const createFolder = useMutation({
    mutationFn: (name: string) => createFolderApi(name),
    onSettled: invalidate,
  });

  const renameFolder = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFolderApi(id, name),
    // Optimistic rename
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: FOLDER_LIST_KEY });
      const prev = queryClient.getQueryData<Folder[]>(FOLDER_LIST_KEY);
      queryClient.setQueryData<Folder[]>(
        FOLDER_LIST_KEY,
        (old) => old?.map((f) => (f.id === id ? { ...f, name } : f)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(FOLDER_LIST_KEY, ctx.prev);
      }
    },
    onSettled: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => deleteFolderApi(id),
    onSettled: () => {
      invalidate();
      // Also invalidate canvas list since canvas folderId may have changed
      void queryClient.invalidateQueries({ queryKey: ["canvas", "list"] });
    },
  });

  return {
    folders: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}
