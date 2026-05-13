/**
 * LocaleToggle — two-state language switcher in the navbar.
 *
 * Per design Decision 4: vellum supports exactly two locales (zh-TW
 * and en) so we collapse the picker into a single button rather than
 * a dropdown. Click toggles between the two.
 *
 * Server sync: when the user is signed in we PATCH `/api/account/me`
 * with the new locale. If the server returns an error we KEEP the
 * client-side switch and surface the failure via an aria-live span
 * (no global toast system in the public chrome).
 *
 * Spec ref: openspec/specs/locale-switching/spec.md
 */

import { Languages } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";

type SupportedLocale = "zh-TW" | "en";

function nextLocale(current: string): SupportedLocale {
  return current === "en" ? "zh-TW" : "en";
}

function shortLabel(locale: SupportedLocale): string {
  return locale === "en" ? "EN" : "中";
}

async function patchServerLocale(locale: SupportedLocale): Promise<boolean> {
  try {
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function LocaleToggle() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string>("");

  const current = (i18n.language === "en" ? "en" : "zh-TW") as SupportedLocale;
  const nameLabel = t(`nav.locale.${current}`);

  async function handleClick() {
    const next = nextLocale(current);
    setServerError("");
    await i18n.changeLanguage(next);
    if (!isAuthenticated) return;

    // Optimistically write the new locale into the session cache BEFORE
    // hitting the network. `useAuth` has a useEffect that syncs
    // `i18n.language` from `user.locale` on every route render; without
    // this optimistic update, the cached pre-PATCH locale would revert
    // the navbar switch as soon as the user navigates.
    queryClient.setQueryData(
      ["auth", "session"],
      (
        prev: { locale?: string } | null | undefined,
      ): { locale: string; [k: string]: unknown } | null | undefined => {
        if (!prev) return prev;
        return { ...prev, locale: next };
      },
    );

    const ok = await patchServerLocale(next);
    if (ok) {
      // Pull the authoritative server copy in case other fields changed.
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      return;
    }
    // PATCH failed but the UI MUST NOT revert (spec contract). The
    // optimistic setQueryData above keeps the client locale stable.
    setServerError(t("nav.locale.serverPatchFailed"));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        aria-label={t("nav.locale.toggleAriaLabel", { name: nameLabel })}
        className="focus-visible-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-semibold text-text-primary hover:border-accent-purple hover:text-accent-purple"
      >
        <Languages size={14} aria-hidden />
        <span data-testid="locale-toggle-label">{shortLabel(current)}</span>
      </button>
      <span
        data-testid="locale-toggle-server-error"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {serverError}
      </span>
    </>
  );
}
