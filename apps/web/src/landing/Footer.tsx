/**
 * Footer — public-page footer.
 *
 * Spec: public-pages — "Footer surfaces version and a single attribution
 * row". Single horizontal row: brand mark · made-with-care tagline ·
 * © {year} Sean Chen · v{VELLUM_VERSION}. No social, no pricing, no
 * blog (phase 2+).
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { VELLUM_VERSION } from "@vellum/shared";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface-elevated/40">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-8 text-sm text-text-muted md:px-8">
        <span className="font-serif font-semibold text-text-primary">{t("nav.brand")}</span>
        <span>{t("footer.tagline")}</span>
        <span>{t("footer.copyright", { year })}</span>
        <span>{t("footer.versionLabel", { version: VELLUM_VERSION })}</span>
      </div>
    </footer>
  );
}
