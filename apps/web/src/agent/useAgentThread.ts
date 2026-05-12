/**
 * useAgentThread.ts — TanStack Query hooks wrapping /api/agent/threads/*.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *
 * Endpoints:
 *   GET    /api/agent/threads/canvas/:canvasId  → thread list + activeThreadId
 *   POST   /api/agent/threads/canvas/:canvasId  → create new empty thread
 *   GET    /api/agent/threads/:threadId         → thread + messages + usage
 *   POST   /api/agent/threads/:threadId/clear   → 204
 *   DELETE /api/agent/threads/:threadId         → 204
 *
 * Errors surface their `errorKey` as the thrown error's message so
 * components can call `t(error.message)` directly.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIST_KEY = (canvasId: string) => ["agent", "threads", "canvas", canvasId] as const;
const ONE_KEY = (threadId: string) => ["agent", "threads", threadId] as const;

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { errorKey?: string; error?: string };
    if (body?.errorKey) return body.errorKey;
    if (body?.error) return body.error;
  } catch {
    /* fall through */
  }
  return "agent.error.internal";
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AiThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: unknown;
  toolName: string | null;
  toolCallId: string | null;
  tokenUsage: { input: number; output: number } | null;
  provider: string | null;
  model: string | null;
  runId: string | null;
  createdAt: string;
}

export interface ThreadDetail {
  thread: AiThreadSummary & { userId: string; canvasId: string };
  messages: AiMessage[];
  usage: { input: number; output: number };
}

export interface ThreadListData {
  threads: AiThreadSummary[];
  activeThreadId: string;
}

// ---------------------------------------------------------------------------
// List + active thread (per canvas)
// ---------------------------------------------------------------------------

export function useAgentThreadList(canvasId: string) {
  return useQuery({
    queryKey: LIST_KEY(canvasId),
    queryFn: async (): Promise<ThreadListData> => {
      const res = await fetch(`/api/agent/threads/canvas/${canvasId}`);
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: ThreadListData };
      return body.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Single thread (messages + usage)
// ---------------------------------------------------------------------------

export function useAgentThread(threadId: string | null) {
  return useQuery({
    queryKey: ONE_KEY(threadId ?? ""),
    enabled: threadId !== null,
    queryFn: async (): Promise<ThreadDetail> => {
      if (!threadId) throw new Error("agent.error.threadNotFound");
      const res = await fetch(`/api/agent/threads/${threadId}`);
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: ThreadDetail };
      return body.data;
    },
  });
}

// ---------------------------------------------------------------------------
// Create / clear / delete mutations
// ---------------------------------------------------------------------------

export function useCreateThread(canvasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AiThreadSummary> => {
      const res = await fetch(`/api/agent/threads/canvas/${canvasId}`, { method: "POST" });
      if (!res.ok) throw new Error(await parseError(res));
      const body = (await res.json()) as { data: AiThreadSummary };
      return body.data;
    },
    onSuccess() {
      void qc.invalidateQueries({ queryKey: LIST_KEY(canvasId) });
    },
  });
}

export function useClearThread(canvasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string): Promise<void> => {
      const res = await fetch(`/api/agent/threads/${threadId}/clear`, { method: "POST" });
      if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
    },
    onSuccess(_data, threadId) {
      void qc.invalidateQueries({ queryKey: LIST_KEY(canvasId) });
      void qc.invalidateQueries({ queryKey: ONE_KEY(threadId) });
    },
  });
}

export function useDeleteThread(canvasId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string): Promise<void> => {
      const res = await fetch(`/api/agent/threads/${threadId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
    },
    onSuccess(_data, threadId) {
      void qc.invalidateQueries({ queryKey: LIST_KEY(canvasId) });
      void qc.removeQueries({ queryKey: ONE_KEY(threadId) });
    },
  });
}
