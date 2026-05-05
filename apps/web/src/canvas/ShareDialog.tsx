/**
 * ShareDialog — TopBar's Share button opens this modal.
 *
 * Three sections:
 *   1. Invite by email (input + role select + send)
 *   2. Members (owner + accepted shares + pending invites; per-row role
 *      change + remove control)
 *   3. Public link (closed/view/edit radio + copy + rotate)
 *
 * Animation: motion is fine in dialogs (CLAUDE.md hard rule #5 only
 * forbids motion inside the canvas / on multiplayer cursors). Phase 1
 * keeps the dialog static for simplicity; motion can be layered in M8
 * along with other dialog polish.
 *
 * Spec: sharing — "ShareDialog opens from the TopBar Share button"
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useShareState, type LinkMode, type ShareRole } from "./useShareState";
import { DialogMotion, DialogPanel } from "../motion/dialog";

export interface ShareDialogProps {
  open: boolean;
  canvasId: string;
  onClose: () => void;
}

export function ShareDialog({ open, canvasId, onClose }: ShareDialogProps) {
  const { t } = useTranslation();
  const state = useShareState(canvasId);

  return createPortal(
    <DialogMotion
      open={open}
      ariaLabelledBy="share-dialog-title"
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
    >
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <DialogPanel className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <h2 id="share-dialog-title" className="mb-4 text-lg font-semibold text-ink-navy">
          {t("canvas.share.title")}
        </h2>

        <InviteSection state={state} />
        <MembersSection state={state} />
        <PublicLinkSection state={state} />
      </DialogPanel>
    </DialogMotion>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Invite section
// ---------------------------------------------------------------------------

function InviteSection({ state }: { state: ReturnType<typeof useShareState> }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    state.invite.mutate({ email, role }, { onSuccess: () => setEmail("") });
  }

  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-ink-navy">
        {t("canvas.share.inviteSection")}
      </h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t("canvas.share.emailLabel")}</span>
          <input
            type="email"
            aria-label={t("canvas.share.emailLabel")}
            placeholder={t("canvas.share.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-navy/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-navy"
          />
        </label>
        <select
          aria-label={t("canvas.share.roleEditor") + " / " + t("canvas.share.roleViewer")}
          value={role}
          onChange={(e) => setRole(e.target.value as ShareRole)}
          className="rounded-lg border border-ink-navy/20 px-2 py-2 text-sm"
        >
          <option value="editor">{t("canvas.share.roleEditor")}</option>
          <option value="viewer">{t("canvas.share.roleViewer")}</option>
        </select>
        <button
          type="submit"
          disabled={state.invite.isPending}
          className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-semibold text-white hover:bg-ink-navy/90 disabled:opacity-50"
        >
          {t("canvas.share.sendButton")}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Members section
// ---------------------------------------------------------------------------

function MembersSection({ state }: { state: ReturnType<typeof useShareState> }) {
  const { t } = useTranslation();
  const data = state.data;
  const members = data?.members ?? [];
  const invites = data?.invites ?? [];

  return (
    <section className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-ink-navy">
        {t("canvas.share.membersSection")}
      </h3>
      {members.length === 0 && invites.length === 0 && (
        <p className="text-sm text-warm-sepia">{t("canvas.share.emptyMembers")}</p>
      )}
      <ul className="space-y-2">
        {members.map((m) => {
          const label = m.user?.name || m.user?.email || m.userId;
          return (
            <li key={m.userId} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-ink-navy">{label}</span>
              <select
                aria-label={label}
                value={m.role}
                onChange={(e) =>
                  state.patchRole.mutate({ userId: m.userId, role: e.target.value as ShareRole })
                }
                className="rounded-lg border border-ink-navy/20 px-2 py-1 text-xs"
              >
                <option value="editor">{t("canvas.share.roleEditor")}</option>
                <option value="viewer">{t("canvas.share.roleViewer")}</option>
              </select>
              <button
                type="button"
                aria-label={`${t("canvas.share.removeButton")} ${label}`}
                onClick={() => state.removeMember.mutate({ userId: m.userId })}
                className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                {t("canvas.share.removeButton")}
              </button>
            </li>
          );
        })}
        {invites.map((inv) => (
          <li key={inv.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-ink-navy">{inv.email}</span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {t("canvas.share.pendingBadge")}
            </span>
            <button
              type="button"
              aria-label={`${t("canvas.share.removeButton")} ${inv.email}`}
              onClick={() => state.revokeInvite.mutate({ inviteId: inv.id })}
              className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              {t("canvas.share.removeButton")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Public link section
// ---------------------------------------------------------------------------

function PublicLinkSection({ state }: { state: ReturnType<typeof useShareState> }) {
  const { t } = useTranslation();
  const link = state.data?.link ?? null;
  const [copied, setCopied] = useState(false);

  const linkUrl = link
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/canvas/${link.canvasId}?share=${link.token}`
    : "";

  async function handleCopy() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }

  function modeLabel(mode: LinkMode): string {
    switch (mode) {
      case "closed":
        return t("canvas.share.modeClosed");
      case "view":
        return t("canvas.share.modeView");
      case "edit":
        return t("canvas.share.modeEdit");
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-ink-navy">
        {t("canvas.share.publicLinkSection")}
      </h3>
      <fieldset className="mb-3 space-y-1 text-sm">
        {(["closed", "view", "edit"] as LinkMode[]).map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input
              type="radio"
              name="link-mode"
              value={m}
              checked={(link?.mode ?? "closed") === m}
              onChange={() => state.setLinkMode.mutate({ mode: m })}
              aria-label={modeLabel(m)}
            />
            <span>{modeLabel(m)}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!link || link.mode === "closed"}
          className="rounded-lg border border-ink-navy/20 px-3 py-1.5 text-sm font-medium text-ink-navy hover:bg-parchment-cream disabled:opacity-50"
        >
          {copied ? t("canvas.share.copied") : t("canvas.share.copyLink")}
        </button>
        <button
          type="button"
          onClick={() => state.rotateLink.mutate()}
          disabled={state.rotateLink.isPending}
          className="rounded-lg border border-ink-navy/20 px-3 py-1.5 text-sm font-medium text-ink-navy hover:bg-parchment-cream disabled:opacity-50"
        >
          {t("canvas.share.rotateLink")}
        </button>
      </div>
    </section>
  );
}
