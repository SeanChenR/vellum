/**
 * TopBar.tsx — Vellum chrome top bar.
 *
 * Dumb component: all actions are callbacks; no internal data fetching.
 * Props:
 *   canvasId      - used for a11y labelling
 *   title         - canvas title (clickable → rename dialog)
 *   folder        - parent folder ({ id, name }) or null
 *   onShareClick  - called when Share button is clicked
 *   onRenameSubmit - called with new title on rename dialog confirm
 *   currentUser   - AuthUser for avatar + sign-out
 *   onSignOut     - called when user clicks Sign out
 *
 * Spec: "TopBar exposes canvas title, folder breadcrumb, share placeholder, and user menu"
 */

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AuthUser } from "../auth/useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopBarFolder {
  id: string;
  name: string;
}

export interface TopBarProps {
  canvasId: string;
  title: string;
  folder: TopBarFolder | null;
  onShareClick: () => void;
  onRenameSubmit: (newTitle: string) => void;
  currentUser: AuthUser;
  onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// Rename dialog schema
// ---------------------------------------------------------------------------

const renameSchema = z.object({ title: z.string().min(1).max(200) });
type RenameFields = z.infer<typeof renameSchema>;

// ---------------------------------------------------------------------------
// RenameTitleDialog
// ---------------------------------------------------------------------------

interface RenameTitleDialogProps {
  open: boolean;
  currentTitle: string;
  onConfirm: (newTitle: string) => void;
  onClose: () => void;
}

function RenameTitleDialog({ open, currentTitle, onConfirm, onClose }: RenameTitleDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RenameFields>({
    resolver: zodResolver(renameSchema),
    defaultValues: { title: currentTitle },
  });

  // Sync default value when dialog opens
  useEffect(() => {
    if (open) {
      reset({ title: currentTitle });
    }
  }, [open, currentTitle, reset]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Handle Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("canvas.title.renameDialog.label")}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-base font-semibold text-ink-navy">
          {t("canvas.title.renameDialog.label")}
        </h2>
        <form
          onSubmit={handleSubmit(({ title }) => {
            onConfirm(title);
            onClose();
          })}
        >
          <input
            type="text"
            autoFocus
            className="mb-1 w-full rounded-lg border border-ink-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-navy"
            {...register("title")}
            ref={(el) => {
              register("title").ref(el);
              (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            }}
          />
          {errors.title && <p className="mb-2 text-xs text-red-600">{errors.title.message}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-warm-sepia hover:bg-parchment-cream"
            >
              {t("canvas.title.renameDialog.cancel")}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink-navy/90"
            >
              {t("canvas.title.renameDialog.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

export function TopBar({
  title,
  folder,
  onShareClick,
  onRenameSubmit,
  currentUser,
  onSignOut,
}: TopBarProps) {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  const breadcrumb = folder?.name ?? t("canvas.chrome.topbar.breadcrumb.myCanvases");

  return (
    <>
      <header className="pointer-events-auto flex h-14 shrink-0 items-center gap-3 border-b border-ink-navy/10 bg-white px-4">
        {/* Logo slot — placeholder; replace with asset/vellum-logo.png integration */}
        <div className="flex shrink-0 items-center gap-2">
          <span aria-label={t("app.name")} className="font-serif text-lg font-bold text-ink-navy">
            {t("app.name").charAt(0)}
          </span>
        </div>

        {/* Breadcrumb + title */}
        <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          <span className="shrink-0 text-warm-sepia">{breadcrumb}</span>
          <span className="shrink-0 text-ink-navy/40">/</span>
          <button
            type="button"
            aria-label={title}
            onClick={() => setRenameOpen(true)}
            className="min-w-0 truncate rounded px-1 font-serif text-ink-navy hover:bg-parchment-cream focus:outline-none focus:ring-2 focus:ring-ink-navy/30"
          >
            {title}
          </button>
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Share button */}
          <button
            type="button"
            onClick={onShareClick}
            className="rounded-lg border border-ink-navy/20 px-3 py-1.5 text-sm font-medium text-ink-navy hover:bg-parchment-cream"
          >
            {t("canvas.chrome.topbar.shareButton")}
          </button>

          {/* User menu */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              aria-label={t("canvas.chrome.topbar.userMenu.label")}
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-navy text-xs font-bold text-white hover:bg-ink-navy/80"
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </button>
            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-ink-navy/10 bg-white py-1 shadow-lg"
              >
                <div className="border-b border-ink-navy/10 px-3 py-2">
                  <p className="truncate text-xs font-medium text-ink-navy">{currentUser.name}</p>
                  <p className="truncate text-xs text-warm-sepia">{currentUser.email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-ink-navy hover:bg-parchment-cream"
                >
                  {t("canvas.chrome.topbar.userMenu.signOut")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <RenameTitleDialog
        open={renameOpen}
        currentTitle={title}
        onConfirm={(newTitle) => {
          onRenameSubmit(newTitle);
          setRenameOpen(false);
        }}
        onClose={() => setRenameOpen(false)}
      />
    </>
  );
}
