/**
 * MainMenu.tsx — Vellum File-style canvas main menu.
 *
 * A dropdown menu with four top-level items:
 *   Rename → calls onRename
 *   Duplicate → calls onDuplicate
 *   Delete → opens AlertDialog confirm; confirm calls onDelete
 *   Export → submenu with PNG / SVG / PDF / JSON; PNG and PDF expand
 *            to a nested 1× / 2× / 4× scale submenu. Hidden entirely
 *            when the session is read-only.
 *
 * Spec: canvas-export — "Editor and owner can export the canvas in
 * four formats", "Viewer cannot access export controls".
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { ExportFormat, ExportScale } from "../canvas/export/export-canvas";
import { DialogMotion, DialogPanel } from "../motion/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MainMenuProps {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: (format: ExportFormat, scale?: ExportScale) => void;
  isReadOnly: boolean;
}

const SCALES: readonly ExportScale[] = [1, 2, 4];

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
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

  return createPortal(
    <DialogMotion
      open={open}
      role="alertdialog"
      ariaLabelledBy="delete-confirm-title"
      className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
    >
      <DialogPanel className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
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
            className="focus-visible-ring rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {t("canvas.chrome.mainMenu.deleteConfirmYes")}
          </button>
        </div>
      </DialogPanel>
    </DialogMotion>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Export submenu structure
// ---------------------------------------------------------------------------

interface FormatEntry {
  format: ExportFormat;
  labelKey: string;
  hasScale: boolean;
}

const FORMAT_ENTRIES: readonly FormatEntry[] = [
  { format: "png", labelKey: "canvas.chrome.mainMenu.exportPng", hasScale: true },
  { format: "svg", labelKey: "canvas.chrome.mainMenu.exportSvg", hasScale: false },
  { format: "pdf", labelKey: "canvas.chrome.mainMenu.exportPdf", hasScale: true },
  { format: "json", labelKey: "canvas.chrome.mainMenu.exportJson", hasScale: false },
];

function scaleLabelKey(scale: ExportScale): string {
  return `canvas.chrome.mainMenu.exportScale${scale}x`;
}

// ---------------------------------------------------------------------------
// MainMenu
// ---------------------------------------------------------------------------

export function MainMenu({ onRename, onDuplicate, onDelete, onExport, isReadOnly }: MainMenuProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportSubmenuOpen, setExportSubmenuOpen] = useState(false);
  const [openScaleFormat, setOpenScaleFormat] = useState<ExportFormat | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setExportSubmenuOpen(false);
    setOpenScaleFormat(null);
  }

  function handleExport(format: ExportFormat, scale?: ExportScale) {
    closeMenu();
    onExport(format, scale);
  }

  return (
    <>
      <div ref={menuRef} className="pointer-events-auto relative">
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

        {menuOpen && (
          <div
            role="menu"
            className="absolute left-0 z-50 mt-1 min-w-[220px] rounded-lg border border-ink-navy/10 bg-white py-1 shadow-lg"
          >
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

            {!isReadOnly && (
              <>
                <div className="my-1 border-t border-ink-navy/10" />
                <div className="relative">
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="true"
                    aria-expanded={exportSubmenuOpen}
                    onMouseEnter={() => setExportSubmenuOpen(true)}
                    onFocus={() => setExportSubmenuOpen(true)}
                    onClick={() => setExportSubmenuOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
                  >
                    <span>{t("canvas.chrome.mainMenu.export")}</span>
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M4 2l6 4-6 4V2z" />
                    </svg>
                  </button>
                  {exportSubmenuOpen && (
                    <div
                      role="menu"
                      className="absolute left-full top-0 min-w-[220px] rounded-lg border border-ink-navy/10 bg-white py-1 shadow-lg"
                    >
                      {FORMAT_ENTRIES.map((entry) => (
                        <FormatItem
                          key={entry.format}
                          entry={entry}
                          openScaleFormat={openScaleFormat}
                          onOpenScale={setOpenScaleFormat}
                          onExport={handleExport}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
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

// ---------------------------------------------------------------------------
// FormatItem — single format row inside the export submenu, optionally
// expanding into a nested scale picker (PNG / PDF only).
// ---------------------------------------------------------------------------

interface FormatItemProps {
  entry: FormatEntry;
  openScaleFormat: ExportFormat | null;
  onOpenScale: (f: ExportFormat | null) => void;
  onExport: (format: ExportFormat, scale?: ExportScale) => void;
}

function FormatItem({ entry, openScaleFormat, onOpenScale, onExport }: FormatItemProps) {
  const { t } = useTranslation();
  const isOpen = openScaleFormat === entry.format;

  if (!entry.hasScale) {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={() => onExport(entry.format)}
        className="w-full px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
      >
        {t(entry.labelKey)}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onMouseEnter={() => onOpenScale(entry.format)}
        onFocus={() => onOpenScale(entry.format)}
        onClick={() => onOpenScale(isOpen ? null : entry.format)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
      >
        <span>{t(entry.labelKey)}</span>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M4 2l6 4-6 4V2z" />
        </svg>
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute left-full top-0 min-w-[160px] rounded-lg border border-ink-navy/10 bg-white py-1 shadow-lg"
        >
          {SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              role="menuitem"
              onClick={() => onExport(entry.format, scale)}
              className="w-full px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
            >
              {t(scaleLabelKey(scale))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
