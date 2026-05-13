/**
 * usePatTokens.ts — TanStack Query hooks wrapping /api/account/pat/*.
 *
 *   GET    /api/account/pat        → { data: PatRowDto[] }
 *   POST   /api/account/pat        → { data: PatCreatedDto } (status 201)
 *   DELETE /api/account/pat/:id    → 204
 *
 * Errors surface their `errorKey` as the thrown error's message so
 * components can call `t(error.message)` directly.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIST_KEY = ["account", "pat"] as const;

export interface PatRowDto {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface PatCreatedDto {
  token: string;
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreatePatInput {
  name: string;
  expiresInDays?: 30 | 90 | null;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* fall through */
  }
  return "errors.internal";
}

export function usePatTokens() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<PatRowDto[]> => {
      const res = await fetch("/api/account/pat");
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: PatRowDto[] };
      return body.data;
    },
  });
}

export function useCreatePatToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePatInput): Promise<PatCreatedDto> => {
      const res = await fetch("/api/account/pat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: PatCreatedDto };
      return body.data;
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useRevokePatToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string): Promise<void> => {
      const res = await fetch(`/api/account/pat/${tokenId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
