/**
 * AppLayout — shell for authenticated routes (Dashboard, Profile,
 * Sessions, and any future authenticated route except the canvas
 * editor).
 *
 * Spec: public-pages — "Authenticated routes share an AppLayout shell
 * that reuses the Navbar". Reuses the same Navbar as PublicLayout but
 * does NOT render the Footer or the mobile graceful notice — those
 * belong to the public marketing surface.
 *
 * The canvas editor route (/canvas/:id) keeps its own TopBar and is
 * NOT wrapped in AppLayout.
 */

import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-off-white text-ink-navy">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-navy focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        {t("a11y.skipToMain")}
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
