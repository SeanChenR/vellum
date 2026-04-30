/**
 * MainMenu.tsx — Vellum File-style canvas main menu.
 *
 * A dropdown menu with four top-level items:
 *   Rename → calls onRename
 *   Duplicate → calls onDuplicate
 *   Delete → opens AlertDialog confirm; confirm calls onDelete
 *   Export → submenu with 5 disabled "coming soon" items
 *
 * Spec: "MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu"
 * Design: "mainmenu の export submenu 顯示「敬請期待」而非隱藏"
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MainMenuProps {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// DeleteConfirmDialog (AlertDialog)
// ---------------------------------------------------------------------------

interface DeleteConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteConfirmDialog({ open, onConfirm, onClose }: DeleteConfirmDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // Portal to body so the dialog escapes tldraw's `pointer-events: none`
  // chrome container.
  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="delete-confirm-title" className="mb-2 text-base font-semibold text-ink-navy">
          {t("canvas.chrome.mainMenu.deleteConfirmTitle")}
        </h2>
        <p className="mb-6 text-sm text-warm-sepia">
          {t("canvas.chrome.mainMenu.deleteConfirmBody")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-warm-sepia hover:bg-parchment-cream"
          >
            {t("canvas.chrome.mainMenu.deleteConfirmNo")}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {t("canvas.chrome.mainMenu.deleteConfirmYes")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Export submenu items
// ---------------------------------------------------------------------------

const EXPORT_ITEMS = [
  "exportPng",
  "exportSvg",
  "exportPdf",
  "exportJson",
  "exportMarkdown",
] as const;

// ---------------------------------------------------------------------------
// MainMenu
// ---------------------------------------------------------------------------

export function MainMenu({ onRename, onDuplicate, onDelete }: MainMenuProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportSubmenuOpen, setExportSubmenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setExportSubmenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setExportSubmenuOpen(false);
  }

  return (
    <>
      <div ref={menuRef} className="pointer-events-auto relative">
        {/* Menu trigger */}
        <button
          type="button"
          aria-label={t("canvas.chrome.mainMenu.label")}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-8 items-center gap-1 rounded px-2 text-sm text-ink-navy hover:bg-parchment-cream"
        >
          <span>{t("canvas.chrome.mainMenu.label")}</span>
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 8L1 3h10L6 8z" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div
            role="menu"
            className="absolute left-0 z-50 mt-1 min-w-[220px] rounded-lg border border-ink-navy/10 bg-white py-1 shadow-lg"
          >
            {/* Rename */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onRename();
              }}
              className="w-full px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
            >
              {t("canvas.chrome.mainMenu.rename")}
            </button>

            {/* Duplicate */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onDuplicate();
              }}
              className="w-full px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
            >
              {t("canvas.chrome.mainMenu.duplicate")}
            </button>

            {/* Delete */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setDeleteConfirmOpen(true);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              {t("canvas.chrome.mainMenu.delete")}
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-ink-navy/10" />

            {/* Export submenu */}
            <div
              className="relative"
              onMouseEnter={() => setExportSubmenuOpen(true)}
              onMouseLeave={() => setExportSubmenuOpen(false)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="true"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
              >
                <span>{t("canvas.chrome.mainMenu.export")}</span>
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <path d="M4 2l6 4-6 4V2z" />
                </svg>
              </button>
              {exportSubmenuOpen && (
                <div
                  role="menu"
                  className="absolute left-full top-0 min-w-[220px] rounded-lg border border-ink-navy/10 bg-white py-1 shadow-lg"
                >
                  {EXPORT_ITEMS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitem"
                      aria-disabled="true"
                      disabled
                      className="w-full cursor-not-allowed px-3 py-2 text-left text-sm text-ink-navy/40"
                    >
                      {t(`canvas.chrome.mainMenu.${key}`)}{" "}
                      <span className="text-xs">
                        ({t("canvas.chrome.mainMenu.exportComingSoon")})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        onConfirm={onDelete}
        onClose={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}
