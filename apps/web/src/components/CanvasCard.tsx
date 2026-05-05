/**
 * CanvasCard — dashboard card for a single canvas.
 *
 * Displays:
 * - Canvas title
 * - Localized relative last-edited time (Intl.RelativeTimeFormat)
 * - Placeholder thumbnail (CSS gradient)
 * - Context menu: Rename / Move / Delete (triggers callbacks, no inline action)
 *
 * Navigation: clicking the card body navigates to /canvas/:id
 * (handled by add-canvas-editor-shell; Link renders but page doesn't exist yet)
 *
 * Spec: "Canvas card displays metadata"
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useDraggable } from "@dnd-kit/core";
import type { Canvas } from "../dashboard/useCanvasList";

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.round(diffMs / 1_000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  return rtf.format(-diffDay, "day");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasCardProps {
  canvas: Canvas;
  onRename: (canvas: Canvas) => void;
  onDelete: (canvas: Canvas) => void;
  onMove: (canvas: Canvas) => void;
}

// ---------------------------------------------------------------------------
// CanvasCard
// ---------------------------------------------------------------------------

export function CanvasCard({ canvas, onRename, onDelete, onMove }: CanvasCardProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const relTime = relativeTime(canvas.updatedAt);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: canvas.id });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setDragRef}
      style={dragStyle}
      className={`group relative rounded-xl border border-warm-200 bg-white shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? "z-50 cursor-grabbing opacity-80 shadow-2xl" : ""
      }`}
      data-canvas-id={canvas.id}
    >
      {/* Thumbnail placeholder — also the drag handle */}
      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
      {/* @ts-expect-error canvas route registered in add-canvas-editor-shell */}
      <Link to={`/canvas/${canvas.id}`} className="block">
        <div
          className="h-36 w-full cursor-grab rounded-t-xl active:cursor-grabbing"
          style={{
            background: `linear-gradient(135deg, hsl(${parseInt(canvas.id.slice(-6), 16) % 360}, 60%, 80%), hsl(${(parseInt(canvas.id.slice(-6), 16) + 60) % 360}, 60%, 90%))`,
          }}
          aria-hidden="true"
          {...attributes}
          {...listeners}
        />
      </Link>

      {/* Card body */}
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{canvas.title}</p>
            <time dateTime={canvas.updatedAt} className="mt-0.5 block text-xs text-gray-500">
              {t("canvas.card.lastEdited", { time: relTime })}
            </time>
          </div>

          {/* Context menu trigger */}
          <div className="relative">
            <button
              type="button"
              aria-label={t("canvas.card.menuLabel")}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="focus-visible-ring rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen((v) => !v);
              }}
            >
              {/* Three-dot icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                className="h-4 w-4 fill-current"
                aria-hidden="true"
              >
                <circle cx="8" cy="3" r="1.25" />
                <circle cx="8" cy="8" r="1.25" />
                <circle cx="8" cy="13" r="1.25" />
              </svg>
            </button>

            {menuOpen && (
              <>
                {/* Click-outside backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => setMenuOpen(false)}
                />
                {/* Menu */}
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  <button
                    role="menuitem"
                    type="button"
                    className="focus-visible-ring flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onRename(canvas);
                    }}
                  >
                    {t("canvas.card.menu.rename")}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="focus-visible-ring flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onMove(canvas);
                    }}
                  >
                    {t("canvas.card.menu.move")}
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    className="focus-visible-ring flex w-full items-center px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(canvas);
                    }}
                  >
                    {t("canvas.card.menu.delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
