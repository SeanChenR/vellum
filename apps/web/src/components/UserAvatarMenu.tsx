/**
 * UserAvatarMenu — clickable avatar that opens a dropdown with
 * Profile / Active sessions links and a Sign out button.
 *
 * Used on both the dashboard page header and the in-canvas TopBar.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AuthUser } from "../auth/useAuth";
import { UserAvatar } from "./UserAvatar";

export interface UserAvatarMenuProps {
  user: AuthUser;
  onSignOut: () => void;
}

export function UserAvatarMenu({ user, onSignOut }: UserAvatarMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={t("nav.userMenu.label")}
        onClick={() => setOpen((v) => !v)}
        className="focus-visible-ring rounded-full transition-shadow hover:ring-2 hover:ring-accent-purple/20"
      >
        <UserAvatar user={user} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-xs font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          <a
            role="menuitem"
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="focus-visible-ring block px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-elevated"
          >
            {t("nav.userMenu.dashboard")}
          </a>
          <a
            role="menuitem"
            href="/account"
            onClick={() => setOpen(false)}
            className="focus-visible-ring block px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-elevated"
          >
            {t("nav.userMenu.settings")}
          </a>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="focus-visible-ring w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-elevated"
          >
            {t("nav.userMenu.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
