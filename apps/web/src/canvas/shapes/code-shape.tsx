/**
 * code-shape — read-only view component for the Code custom shape.
 *
 * Editing happens through a dialog (see shape-utils.tsx CodeShapeWrapper)
 * for parity with Markdown / Callout — no inline textarea. The view
 * renders a syntax-highlighted `<pre>` plus a header (language label +
 * Copy button). Internal wheel events are caught with a capture-phase
 * native listener so the canvas does not pan/zoom while the user
 * scrolls the code block.
 *
 * Spec: canvas-shapes — "Code shape supports inline editing via textarea
 * overlay" — REVISED: editing is via dialog (alignment with other shapes,
 * per user feedback during M6 acceptance).
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  highlightCode,
  SUPPORTED_LANGUAGES,
  type HighlightToken,
  type SupportedLanguage,
} from "./code-highlight";
import { writeToClipboard } from "./clipboard";

export interface CodeShapeLockedBy {
  userId: string;
  userName: string;
}

export interface CodeShapeViewProps {
  source: string;
  language: SupportedLanguage | string;
  locked: boolean;
  lockedBy: CodeShapeLockedBy | null;
  onRequestEdit: () => void;
}

const COPIED_HIDE_MS = 1500;

export function CodeShapeView({
  source,
  language,
  locked,
  lockedBy,
  onRequestEdit,
}: CodeShapeViewProps) {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState<HighlightToken[][]>([]);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(source, language).then((r) => {
      if (!cancelled) setTokens(r.tokens);
    });
    return () => {
      cancelled = true;
    };
  }, [source, language]);

  // Capture wheel events on the scroll viewport so they scroll the code
  // block (default browser behaviour) instead of bubbling to tldraw's
  // canvas wheel listener (pan/zoom).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { capture: true, passive: true });
    return () => el.removeEventListener("wheel", stop, { capture: true });
  }, []);

  async function handleCopy() {
    try {
      await writeToClipboard(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_HIDE_MS);
    } catch {
      // Clipboard access may be denied; silently no-op.
    }
  }

  const languageLabel = SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? t(`shapes.code.languages.${language}`)
    : language;

  return (
    <div
      data-testid="code-shape-root"
      onDoubleClick={() => {
        if (locked) return;
        onRequestEdit();
      }}
      className="relative flex h-full min-h-[120px] min-w-[240px] flex-col overflow-hidden rounded-lg border border-warm-200 bg-white"
    >
      {locked && lockedBy && (
        <span
          data-testid="code-shape-lock-badge"
          className="absolute right-2 top-2 z-10 rounded-md bg-ink-navy/85 px-2 py-1 text-xs font-medium text-white"
        >
          {t("shapes.common.lockedBy", { name: lockedBy.userName })}
        </span>
      )}

      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-2 border-b border-warm-200 bg-warm-50 px-3 py-2 text-xs"
      >
        <span data-testid="code-shape-language" className="font-medium text-ink-navy">
          {languageLabel}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void handleCopy();
          }}
          className="ml-auto rounded border border-warm-200 bg-white px-2 py-1 hover:bg-warm-100"
        >
          {t("shapes.code.copyButton")}
        </button>
        {copied && <span className="text-xs text-warm-sepia">{t("shapes.code.copied")}</span>}
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto font-mono text-sm leading-6">
        <pre className="m-0 whitespace-pre p-3">
          {tokens.length > 0 ? (
            tokens.map((row, ri) => (
              <div key={ri} className="min-h-[1.5em]">
                {row.map((tok, ti) => (
                  <span key={ti} style={tok.color ? { color: tok.color } : undefined}>
                    {tok.content}
                  </span>
                ))}
              </div>
            ))
          ) : (
            <span>{source}</span>
          )}
        </pre>
      </div>
    </div>
  );
}
