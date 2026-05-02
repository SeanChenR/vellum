/**
 * useShareState — TanStack Query hook driving the ShareDialog.
 *
 * Fetches `GET /api/canvas/:id/share` and exposes six mutations matching
 * the sharing REST endpoints. Every mutation invalidates `['share',
 * canvasId]` on settle so the dialog reflects server state immediately.
 *
 * Spec: sharing — "ShareDialog opens from the TopBar Share button"
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ShareRole = "editor" | "viewer";
export type LinkMode = "closed" | "view" | "edit";

export interface ShareMember {
  canvasId: string;
  userId: string;
  role: ShareRole;
  createdAt: string;
  user: { id: string; email: string; name: string } | null;
}

export interface ShareInvite {
  id: string;
  canvasId: string;
  email: string;
  role: ShareRole;
  expiresAt: string;
  createdAt: string;
}

export interface ShareLink {
  canvasId: string;
  token: string;
  mode: LinkMode;
  createdAt: string;
  rotatedAt: string;
}

export interface ShareState {
  ownerId: string;
  members: ShareMember[];
  invites: ShareInvite[];
  link: ShareLink | null;
}

interface ApiEnvelope<T> {
  data: T;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  if (!resp.ok && resp.status !== 204) {
    throw new Error(`request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  const body = (await resp.json()) as ApiEnvelope<T>;
  return body.data;
}

export function useShareState(canvasId: string) {
  const qc = useQueryClient();
  const queryKey = ["share", canvasId] as const;

  const query = useQuery<ShareState>({
    queryKey,
    queryFn: () => jsonFetch<ShareState>(`/api/canvas/${canvasId}/share`),
    staleTime: 10_000,
  });

  function invalidate(): void {
    void qc.invalidateQueries({ queryKey });
  }

  const invite = useMutation({
    mutationFn: (body: { email: string; role: ShareRole }) =>
      jsonFetch<{ kind: "member" | "pending" } & Record<string, unknown>>(
        `/api/canvas/${canvasId}/share/invite`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSettled: invalidate,
  });

  const patchRole = useMutation({
    mutationFn: (body: { userId: string; role: ShareRole }) =>
      jsonFetch<unknown>(`/api/canvas/${canvasId}/share/members/${body.userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: body.role }),
      }),
    onSettled: invalidate,
  });

  const removeMember = useMutation({
    mutationFn: (body: { userId: string }) =>
      jsonFetch<unknown>(`/api/canvas/${canvasId}/share/members/${body.userId}`, {
        method: "DELETE",
      }),
    onSettled: invalidate,
  });

  const revokeInvite = useMutation({
    mutationFn: (body: { inviteId: string }) =>
      jsonFetch<unknown>(`/api/canvas/${canvasId}/share/invites/${body.inviteId}`, {
        method: "DELETE",
      }),
    onSettled: invalidate,
  });

  const setLinkMode = useMutation({
    mutationFn: (body: { mode: LinkMode }) =>
      jsonFetch<ShareLink>(`/api/canvas/${canvasId}/share/link`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSettled: invalidate,
  });

  const rotateLink = useMutation({
    mutationFn: () =>
      jsonFetch<ShareLink>(`/api/canvas/${canvasId}/share/link/rotate`, {
        method: "POST",
      }),
    onSettled: invalidate,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    invite,
    patchRole,
    removeMember,
    revokeInvite,
    setLinkMode,
    rotateLink,
  };
}
