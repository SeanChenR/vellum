/**
 * AccountPage — `/account` tabbed settings shell.
 *
 * Design ref: openspec/changes/redesign-ui-aura-theme/design.md Decision 10
 * Spec ref:   openspec/specs/account/spec.md
 *   "Account settings live under a single tabbed route" — four panels
 *   controlled by `?tab=<id>` (default profile).
 *
 * Legacy `/account/profile`, `/account/sessions`, `/account/api-keys`
 * paths still resolve via dedicated redirect components in
 * `legacy-redirects.tsx` so external bookmarks keep working.
 */

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApiKeysTab } from "./ApiKeysTab";
import { PricingTab } from "./PricingTab";
import { ProfileTab } from "./ProfileTab";
import { SessionsTab } from "./SessionsTab";
import { Tabs, type TabItem } from "./Tabs";

const TAB_IDS = ["profile", "sessions", "api-keys", "pricing"] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && (TAB_IDS as readonly string[]).includes(value);
}

export function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: string };
  const activeId: TabId = isTabId(search.tab) ? search.tab : "profile";

  const items: TabItem[] = [
    { id: "profile", label: t("account.tabs.profile") },
    { id: "sessions", label: t("account.tabs.sessions") },
    { id: "api-keys", label: t("account.tabs.apiKeys") },
    { id: "pricing", label: t("account.tabs.pricing") },
  ];

  function handleChange(id: string) {
    navigate({
      to: "/account",
      search: { tab: id },
      replace: true,
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-text-primary">{t("account.heading")}</h1>
      </header>

      <Tabs items={items} activeId={activeId} onChange={handleChange} />

      <div
        role="tabpanel"
        id={`tabpanel-${activeId}`}
        aria-labelledby={`tab-${activeId}`}
        className="mt-8"
      >
        {activeId === "profile" && <ProfileTab />}
        {activeId === "sessions" && <SessionsTab />}
        {activeId === "api-keys" && <ApiKeysTab />}
        {activeId === "pricing" && <PricingTab />}
      </div>
    </div>
  );
}
