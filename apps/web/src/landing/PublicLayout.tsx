/**
 * PublicLayout — shell for unauthenticated `/` and `/about` routes.
 *
 * Spec: public-pages — landing requirements share a single Navbar +
 * Footer wrapper. Below the md (768px) breakpoint the desktop layout
 * is hidden and a graceful "use a desktop browser" notice replaces it,
 * per "Public pages display a graceful message on viewports narrower
 * than 768px".
 */

import React, { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-off-white text-ink-navy">
      {/* Mobile graceful notice — visible only below 768px. */}
      <div className="md:hidden flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="font-serif text-2xl text-ink-navy">{t("landing.mobileNotice.heading")}</h1>
        <p className="text-sm text-warm-sepia">{t("landing.mobileNotice.body")}</p>
      </div>

      {/* Desktop layout — hidden below 768px. */}
      <div className="hidden md:flex md:min-h-screen md:flex-col">
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
        <Footer />
      </div>
    </div>
  );
}
