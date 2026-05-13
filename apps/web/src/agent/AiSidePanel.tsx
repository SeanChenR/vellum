/**
 * AiSidePanel.tsx — top-level AI Side Panel composition.
 *
 * Composes:
 *   - ThreadSwitcher          (top)
 *   - ChatList                (scrollable middle)
 *   - ChatComposer            (bottom, sticky)
 *   - TokenUsageFooter        (very bottom)
 *
 * Owns:
 *   - useAgentThreadList(canvasId) — list + activeThreadId
 *   - useAgentThread(activeThreadId) — messages + usage aggregate
 *   - useAgentRun() — in-flight run state machine
 *   - useAiPanelStore — composer draft + active thread mirror
 *   - useApiKeysList — BYOK preferences for the composer's provider/model picker
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiKeysList } from "../account/useApiKeys";
import { ChatComposer } from "./ChatComposer";
import { ChatList } from "./ChatList";
import { ThreadSwitcher } from "./ThreadSwitcher";
import { TokenUsageFooter } from "./TokenUsageFooter";
import { useAiPanelStore } from "./store";
import { useAgentRun } from "./useAgentRun";
import { useCursorAiBadge } from "./cursor-ai-badge";
import {
  useAgentThread,
  useAgentThreadList,
  useClearThread,
  useCreateThread,
  useDeleteThread,
  type AiMessage,
} from "./useAgentThread";

export interface AiSidePanelProps {
  canvasId: string;
  /** Optional callback invoked after a successful run terminal `done`. */
  onRunDone?: () => void;
}

export function AiSidePanel({ canvasId, onRunDone }: AiSidePanelProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const list = useAgentThreadList(canvasId);
  const activeThreadId = useAiPanelStore((s) => s.activeThreadId);
  const setActiveThreadId = useAiPanelStore((s) => s.setActiveThreadId);
  const composerDraft = useAiPanelStore((s) => s.composerDraft);
  const setComposerDraft = useAiPanelStore((s) => s.setComposerDraft);

  // Sync active thread from server-resolved active when none is set locally.
  useEffect(() => {
    if (list.data?.activeThreadId && activeThreadId === null) {
      setActiveThreadId(list.data.activeThreadId);
    }
  }, [list.data?.activeThreadId, activeThreadId, setActiveThreadId]);

  const thread = useAgentThread(activeThreadId);
  const run = useAgentRun();
  // Optimistic user message — appears immediately on send, cleared once
  // the run terminates (the thread refetch then carries the persisted
  // row from the server).
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  // Flip the shared `aiActiveAtom` to true while the panel is mounted.
  // `useSyncStore`'s `getUserPresence` override reads the atom and
  // injects `meta.aiActive` into the local presence record on every
  // derivation; tldraw sync broadcasts presence to all collaborators.
  // The hook cleans up (false) on unmount (panel closed).
  useCursorAiBadge();
  const create = useCreateThread(canvasId);
  const clear = useClearThread(canvasId);
  const remove = useDeleteThread(canvasId);
  const apiKeys = useApiKeysList();

  // Reflect run terminal events back to the parent + refetch thread so the
  // persisted user / assistant / tool messages replace the optimistic bubble
  // and surface tool-call accordions.
  useEffect(() => {
    if (run.state === "done" || run.state === "error" || run.state === "cancelled") {
      onRunDone?.();
      if (activeThreadId) {
        void qc.invalidateQueries({ queryKey: ["agent", "threads", activeThreadId] });
      }
      void qc.invalidateQueries({ queryKey: ["agent", "threads", "canvas", canvasId] });
      setPendingUserMessage(null);
    }
  }, [run.state, onRunDone, qc, activeThreadId, canvasId]);

  // Surface terminal `error` runs as a transient toast. `cancelled` is
  // intentionally NOT toasted — the composer-reverts-to-Send signal is
  // enough UX for an intentional cancel. The toast auto-dismisses so it
  // doesn't linger when the user starts a new run.
  // Spec: ai-side-panel "Rate limit response shows toast with errorKey translation".
  const [toastErrorKey, setToastErrorKey] = useState<string | null>(null);
  useEffect(() => {
    if (run.state === "error" && run.error) {
      setToastErrorKey(run.error);
      const handle = setTimeout(() => setToastErrorKey(null), 6_000);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [run.state, run.error]);

  const messages = useMemo<AiMessage[]>(() => {
    const base = thread.data?.messages ?? [];
    if (!pendingUserMessage) return base;
    // Append optimistic user bubble (sentinel id, not persisted).
    const optimistic: AiMessage = {
      id: "__pending-user__",
      threadId: activeThreadId ?? "",
      role: "user",
      content: { text: pendingUserMessage },
      toolName: null,
      toolCallId: null,
      tokenUsage: null,
      provider: null,
      model: null,
      runId: null,
      createdAt: new Date().toISOString(),
    };
    return [...base, optimistic];
  }, [thread.data?.messages, pendingUserMessage, activeThreadId]);
  const threadUsage = thread.data?.usage ?? { input: 0, output: 0 };

  function handleSelect(id: string) {
    setActiveThreadId(id);
    run.reset();
  }

  function handleCreate() {
    create.mutate(undefined, {
      onSuccess(t) {
        setActiveThreadId(t.id);
        run.reset();
      },
    });
  }

  function handleDelete(id: string) {
    remove.mutate(id, {
      onSuccess() {
        // Pick the next-most-recent thread; fall back to refetching the list.
        const remaining = (list.data?.threads ?? []).filter((thr) => thr.id !== id);
        setActiveThreadId(remaining[0]?.id ?? null);
        run.reset();
      },
    });
  }

  function handleSend(input: {
    provider: "openai" | "anthropic" | "google";
    model: string;
    userMessage: string;
  }) {
    if (!activeThreadId) return;
    setPendingUserMessage(input.userMessage);
    void run.start({
      canvasId,
      threadId: activeThreadId,
      provider: input.provider,
      model: input.model,
      userMessage: input.userMessage,
    });
  }

  // Surface the in-flight assistant text by accumulating text events. The
  // SSE parser yields one event per delta; we render them as a single
  // streaming bubble until the next assistant message lands in the thread.
  const streamingText = useMemo(() => {
    return run.events
      .filter((e) => e.type === "text")
      .map((e) => (e as { delta: string }).delta)
      .join("");
  }, [run.events]);

  return (
    <aside
      data-testid="ai-side-panel"
      className="flex h-full w-full flex-col bg-white"
      aria-label={t("agent.panel.toggleOpen")}
    >
      <ThreadSwitcher
        threads={list.data?.threads ?? []}
        activeThreadId={activeThreadId}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatList
          messages={messages}
          streamingText={streamingText}
          isStreaming={run.state === "running"}
        />
      </div>
      <ChatComposer
        draft={composerDraft}
        setDraft={setComposerDraft}
        state={run.state}
        onSend={handleSend}
        onCancel={() => void run.cancel()}
        preferences={apiKeys.data?.preferences ?? {}}
        availableProviders={apiKeys.data?.keys ?? []}
      />
      <TokenUsageFooter
        thisRun={run.lastRunUsage}
        threadTotal={threadUsage}
        threadPriceModel={
          run.lastRunUsage
            ? { provider: run.lastRunUsage.provider, model: run.lastRunUsage.model }
            : null
        }
      />
      {/* Hidden util to allow clear-thread keyboard / menu actions later */}
      <button
        type="button"
        data-testid="ai-side-panel-clear-thread"
        className="hidden"
        onClick={() => activeThreadId && clear.mutate(activeThreadId)}
      >
        {t("agent.panel.clearThread")}
      </button>
      {toastErrorKey && (
        <div
          role="alert"
          data-testid="agent-error-toast"
          className="pointer-events-auto absolute right-4 top-4 z-50 max-w-[20rem] rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 shadow-md"
        >
          <div className="flex items-start gap-2">
            <span className="flex-1">{t(toastErrorKey)}</span>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => setToastErrorKey(null)}
              className="text-red-700/70 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
