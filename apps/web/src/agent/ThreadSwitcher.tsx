/**
 * ThreadSwitcher.tsx — dropdown listing the user's threads on this canvas.
 *
 * - Sorted by updated_at DESC (server already orders this way)
 * - "+ New chat" action creates a fresh thread + sets it active
 * - Hover-revealed delete button per thread
 *
 * Spec ref: ai-side-panel "Thread switcher allows multi-thread navigation"
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiThreadSummary } from "./useAgentThread";

export interface ThreadSwitcherProps {
  threads: AiThreadSummary[];
  activeThreadId: string | null;
  onSelect(threadId: string): void;
  onCreate(): void;
  onDelete(threadId: string): void;
}

export function ThreadSwitcher({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
  onDelete,
}: ThreadSwitcherProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const active = threads.find((th) => th.id === activeThreadId);

  return (
    <div className="relative border-b border-border/30" data-testid="thread-switcher">
      <button
        type="button"
        data-testid="thread-switcher-toggle"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-surface-elevated/50"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{active?.title || t("agent.panel.untitled")}</span>
        <span className="text-text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div
          data-testid="thread-switcher-list"
          className="absolute left-0 right-0 top-full z-10 max-h-64 overflow-y-auto bg-surface shadow-md"
        >
          <button
            type="button"
            data-testid="thread-switcher-new"
            className="flex w-full items-center gap-2 border-b border-border/20 px-3 py-2 text-left text-sm font-medium text-text-primary hover:bg-surface-elevated"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
          >
            <span>+ {t("agent.panel.newChat")}</span>
          </button>
          {threads.map((th) => (
            <ThreadRow
              key={th.id}
              thread={th}
              active={th.id === activeThreadId}
              onClick={() => {
                onSelect(th.id);
                setOpen(false);
              }}
              onDelete={() => onDelete(th.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
  onDelete,
}: {
  thread: AiThreadSummary;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="thread-switcher-row"
      data-thread-id={thread.id}
      className={`group flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-elevated ${
        active ? "bg-surface-elevated/60 font-medium text-text-primary" : "text-text-muted"
      }`}
    >
      <button type="button" className="flex-1 truncate text-left" onClick={onClick}>
        {thread.title || t("agent.panel.untitled")}
      </button>
      <button
        type="button"
        data-testid="thread-switcher-delete"
        aria-label={t("agent.panel.deleteThread")}
        className="ml-2 hidden text-xs text-accent-red hover:underline group-hover:inline"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}
