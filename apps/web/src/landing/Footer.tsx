/**
 * Footer — public-page footer.
 *
 * Spec: public-pages — "Footer surfaces version and a single attribution
 * row". Single horizontal row: brand mark · made-with-care tagline ·
 * v{VELLUM_VERSION}. No social, no pricing, no blog (phase 2+).
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { VELLUM_VERSION } from "@vellum/shared";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-ink-navy/5 bg-parchment-cream/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-8 text-sm text-warm-sepia">
        <span className="font-serif font-semibold text-ink-navy">{t("nav.brand")}</span>
        <span>{t("footer.tagline")}</span>
        <span>{t("footer.versionLabel", { version: VELLUM_VERSION })}</span>
      </div>
    </footer>
  );
}
