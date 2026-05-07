/**
 * useApiKeys.ts — TanStack Query hooks wrapping /api/account/byok/*.
 *
 * Endpoints:
 *   GET    /api/account/byok               → { data: { keys, preferences } }
 *   POST   /api/account/byok/:provider     → { data: ProviderListItem }
 *   DELETE /api/account/byok/:provider     → 204
 *   PATCH  /api/account/byok/preferences   → { data: BYOKPreferences }
 *
 * Errors surface their `errorKey` as the thrown error's message so
 * components can call `t(error.message)` directly.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BYOKListResponse,
  BYOKPreferences,
  BYOKPreferencesMap,
  BYOKPreferencesPatchBody,
  BYOKProviderListItem,
} from "@vellum/shared";

const LIST_KEY = ["account", "byok"] as const;

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* fall through */
  }
  return "errors.internal";
}

interface ApiKeysListData {
  keys: BYOKProviderListItem[];
  preferences: BYOKPreferencesMap;
}

export function useApiKeysList() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<ApiKeysListData> => {
      const res = await fetch("/api/account/byok");
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as BYOKListResponse;
      return body.data;
    },
  });
}

export function useSaveApiKey(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apiKey: string): Promise<BYOKProviderListItem> => {
      const res = await fetch(`/api/account/byok/${provider}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: BYOKProviderListItem };
      return body.data;
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteApiKey(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await fetch(`/api/account/byok/${provider}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BYOKPreferencesPatchBody): Promise<BYOKPreferences> => {
      const res = await fetch("/api/account/byok/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: BYOKPreferences };
      return body.data;
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
