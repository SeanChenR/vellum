/**
 * ChatList.tsx — renders thread messages in chronological order.
 *
 * Visual variants by role + content kind:
 *   user      → right-aligned text bubble
 *   assistant → left-aligned text bubble (streaming caret on last + running)
 *   tool/call → collapsed accordion (tool name + JSON args)
 *   tool/result → collapsed accordion (success or errorKey translation)
 *
 * Spec ref: ai-side-panel "Panel renders chat list with four message kinds"
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiMessage } from "./useAgentThread";

/**
 * Assistant bubbles render their text through react-markdown so headings,
 * lists, bold/italic, code, links, and tables become real DOM elements.
 * User bubbles intentionally stay plain — rendering markdown from user
 * input would open a prompt-injection-via-markdown surface (e.g. a link
 * crafted to phish another reader of a shared canvas in the future).
 */
function AssistantMarkdown({ text }: { text: string }) {
  // Prose defaults bake in slate-900-ish text for headings / strong / code,
  // which goes invisible on the dark Aura surface. We pin every element to
  // text-text-primary (the heading/strong/em variants don't inherit from
  // the parent's text-* class — they need explicit prose-* overrides).
  return (
    <div className="prose prose-sm max-w-none break-words text-text-primary prose-headings:text-text-primary prose-strong:text-text-primary prose-em:text-text-primary prose-blockquote:text-text-muted prose-blockquote:border-border prose-hr:border-border prose-th:text-text-primary prose-td:text-text-primary [&_a]:text-text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-text-muted/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:text-text-primary [&_code]:before:content-none [&_code]:after:content-none [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-text-muted/10 [&_pre]:p-2 [&_pre]:text-text-primary [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-text-primary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li]:text-text-primary">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export interface ChatListProps {
  messages: AiMessage[];
  /** Streaming events from the in-flight run, appended after `messages`. */
  streamingText?: string;
  /** True while a run is in `running` state — shows caret on last assistant. */
  isStreaming: boolean;
}

export function ChatList({ messages, streamingText, isStreaming }: ChatListProps) {
  const { t } = useTranslation();
  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (m.role === "assistant") return m.id;
    }
    return null;
  })();

  // Streaming bubble only renders while the run is in-flight. Once the
  // run terminates, the thread refetch carries the persisted assistant
  // row — keeping this open after that point would render the answer
  // twice (once from the SSE stream, once from the rehydrated row).
  const hasStreamText = (streamingText?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4" data-testid="chat-list">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} showCaret={isStreaming && m.id === lastAssistantId} />
      ))}
      {isStreaming && (
        <div className="flex" data-testid="chat-message-assistant-streaming">
          <div className="max-w-[85%] rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary">
            {hasStreamText ? (
              <>
                <AssistantMarkdown text={streamingText ?? ""} />
                <span className="ml-1 animate-blink">▍</span>
              </>
            ) : (
              <span
                data-testid="chat-message-assistant-thinking"
                className="inline-flex items-center gap-1 text-text-muted"
              >
                {t("agent.panel.thinking")}
                <span className="animate-blink">▍</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, showCaret }: { message: AiMessage; showCaret: boolean }) {
  const { t } = useTranslation();
  if (message.role === "user") {
    const text = (message.content as { text?: string } | undefined)?.text ?? "";
    return (
      <div className="flex justify-end" data-testid="chat-message-user">
        <div className="max-w-[85%] rounded-lg bg-accent-purple px-3 py-2 text-sm text-white">
          {text}
        </div>
      </div>
    );
  }
  if (message.role === "assistant") {
    const text = (message.content as { text?: string } | undefined)?.text ?? "";
    return (
      <div className="flex" data-testid="chat-message-assistant">
        <div className="max-w-[85%] rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary">
          <AssistantMarkdown text={text} />
          {showCaret && <span className="ml-1 animate-blink">▍</span>}
        </div>
      </div>
    );
  }
  // role === "tool"
  const content = message.content as
    | { kind?: "call" | "result"; name?: string; args?: unknown; result?: unknown }
    | undefined;
  if (content?.kind === "call") {
    return (
      <ToolAccordion testId="chat-message-tool-call" label={`→ ${message.toolName ?? "?"}`}>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px]">
          {JSON.stringify(content.args ?? {}, null, 2)}
        </pre>
      </ToolAccordion>
    );
  }
  // result
  const result = content?.result as Record<string, unknown> | undefined;
  const errKey = result && "errorKey" in result ? (result["errorKey"] as string) : null;
  return (
    <ToolAccordion
      testId="chat-message-tool-result"
      label={errKey ? `✗ ${message.toolName ?? "?"}` : `✓ ${message.toolName ?? "?"}`}
    >
      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px]">
        {errKey ? t(errKey) : JSON.stringify(result ?? {}, null, 2)}
      </pre>
    </ToolAccordion>
  );
}

function ToolAccordion({
  testId,
  label,
  children,
}: {
  testId: string;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-testid={testId}
      className="rounded-md border border-border/30 bg-surface-elevated/40 px-2 py-1 font-mono text-xs"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-text-primary"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className="text-text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="mt-1 text-text-muted">{children}</div>}
    </div>
  );
}
