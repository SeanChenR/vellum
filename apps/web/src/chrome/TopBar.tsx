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
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AuthUser } from "../auth/useAuth";
import { UserAvatarMenu } from "../components/UserAvatarMenu";
import { CollaboratorAvatars } from "../canvas/CollaboratorAvatars";
import type { CollaboratorPresence } from "../canvas/CollaboratorAvatars";
import { ConnectionStatus } from "../canvas/ConnectionStatus";
import vellumLogo from "../assets/vellum-logo.png";

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
  /**
   * Active collaborators in the same sync room as the local user. Defaults
   * to an empty list so the chrome renders cleanly before presence data is
   * available.
   */
  collaborators?: CollaboratorPresence[];
  /**
   * True when the local user is the canvas owner. Owner-only controls
   * (Share button) are hidden when false. Defaults to true so existing
   * call sites keep their previous behaviour.
   */
  isOwner?: boolean;
  /**
   * True when the multiplayer-sync handshake resolved a viewer role.
   * Adds a "View only" badge to the TopBar. Defaults to false.
   */
  isReadOnly?: boolean;
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

  // Portal to body — TopBar is rendered inside tldraw's TopPanel slot which
  // has `pointer-events: none` to let the canvas receive clicks. Without
  // portaling, the dialog backdrop inherits `none` and clicks pass through.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("canvas.title.renameDialog.label")}
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
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
    </div>,
    document.body,
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
  collaborators = [],
  isOwner = true,
  isReadOnly = false,
}: TopBarProps) {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);

  const breadcrumb = folder?.name ?? t("canvas.chrome.topbar.breadcrumb.myCanvases");

  return (
    <>
      <header className="pointer-events-auto flex h-14 shrink-0 items-center gap-3 border-b border-ink-navy/10 bg-white px-4">
        {/* Logo — clickable, returns to dashboard */}
        <a
          href="/dashboard"
          aria-label={t("nav.backToDashboard")}
          className="flex shrink-0 items-center gap-2 rounded-md p-1 hover:bg-parchment-cream"
        >
          <img
            src={vellumLogo}
            alt={t("app.name")}
            className="h-8 w-8 select-none"
            draggable={false}
          />
        </a>

        {/* Breadcrumb + title — folder/all-canvases segment links back to dashboard */}
        <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          <a
            href="/dashboard"
            className="shrink-0 rounded px-1 text-warm-sepia hover:bg-parchment-cream hover:text-ink-navy"
          >
            {breadcrumb}
          </a>
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
        <div className="flex shrink-0 items-center gap-3">
          {/* Multiplayer presence — collaborator avatars + connection state */}
          <CollaboratorAvatars localUserId={currentUser.id} collaborators={collaborators} />
          <ConnectionStatus />

          {/* View-only badge — shown when handshake resolved viewer role */}
          {isReadOnly && (
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {t("canvas.chrome.topbar.viewOnlyBadge")}
            </span>
          )}

          {/* Share button — owner-only */}
          {isOwner && (
            <button
              type="button"
              onClick={onShareClick}
              className="rounded-lg border border-ink-navy/20 px-3 py-1.5 text-sm font-medium text-ink-navy hover:bg-parchment-cream"
            >
              {t("canvas.chrome.topbar.shareButton")}
            </button>
          )}

          <UserAvatarMenu user={currentUser} onSignOut={onSignOut} />
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
