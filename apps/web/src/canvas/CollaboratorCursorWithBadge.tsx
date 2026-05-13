/**
 * CollaboratorCursorWithBadge — tldraw `CollaboratorCursor` override that
 * also surfaces the AI Side Panel's `meta.aiActive` flag as a ✨ overlay.
 *
 * Spec ref: openspec/specs/ai-side-panel/spec.md
 *   "Cursor AI Badge surfaces aiActive presence flag"
 *
 * Why this exists separately from `cursor-ai-badge.ts`:
 *   cursor-ai-badge writes the LOCAL presence record (sender side).
 *   This component reads REMOTE presence records' meta (receiver side).
 *   tldraw's built-in `TLCursorProps` only carries userId / point / zoom /
 *   color / name / chatMessage — `meta` is NOT forwarded. So we look the
 *   record up via the editor's store using the userId we DO receive.
 *
 * Layout: mirrors `DefaultCursor` exactly (svg + tl-nametag) plus a
 * positioned ✨ sprite that fades when aiActive flips.
 */

import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { type TLCursorProps, useEditor, useSharedSafeId, useTransform, useValue } from "tldraw";

export const CollaboratorCursorWithBadge = memo(function CollaboratorCursorWithBadge({
  className,
  zoom,
  point,
  color,
  name,
  chatMessage,
  userId,
}: TLCursorProps) {
  const { t } = useTranslation();
  const rCursor = useRef<HTMLDivElement>(null);
  useTransform(rCursor, point?.x, point?.y, 1 / zoom);
  const cursorId = useSharedSafeId("cursor");
  const editor = useEditor();

  // Reactive subscription: derive aiActive from the presence record that
  // matches this cursor's userId. tldraw's reactivity invalidates this
  // whenever the matching record's meta object changes.
  const aiActive = useValue(
    "collaborator-cursor:ai-active",
    () => {
      for (const r of editor.store.allRecords() as Array<{
        typeName: string;
        userId?: string;
        meta?: Record<string, unknown>;
      }>) {
        if (r.typeName === "instance_presence" && r.userId === userId) {
          return r.meta?.["aiActive"] === true;
        }
      }
      return false;
    },
    [editor, userId],
  );

  if (!point) return null;

  return (
    <div ref={rCursor} className={`tl-overlays__item ${className ?? ""}`.trim()}>
      <svg className="tl-cursor" aria-hidden="true">
        <use href={`#${cursorId}`} color={color} />
      </svg>
      {aiActive && (
        <div
          data-testid="collaborator-ai-badge"
          aria-label={name ? `${name} is editing with AI` : "AI editing"}
          style={{
            position: "absolute",
            // Float above the cursor sprite (which lives at the
            // top-left origin of `tl-overlays__item`).
            top: -22,
            left: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 6px 2px 5px",
            borderRadius: 999,
            // Use the cursor's own color so the chip reads as part of
            // that user's presence identity.
            backgroundColor: color ?? "#3B82F6",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.3,
            lineHeight: 1,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            animation: "vellum-ai-badge-pulse 1.6s ease-in-out infinite",
          }}
        >
          <Sparkles size={10} strokeWidth={2.5} />
          {t("agent.badge.aiLabel")}
        </div>
      )}
      {chatMessage ? (
        <>
          {name && (
            <div className="tl-nametag-title" style={{ color }}>
              {name}
            </div>
          )}
          <div className="tl-nametag-chat" style={{ backgroundColor: color }}>
            {chatMessage}
          </div>
        </>
      ) : (
        name && (
          <div className="tl-nametag" style={{ backgroundColor: color }}>
            {name}
          </div>
        )
      )}
    </div>
  );
});
