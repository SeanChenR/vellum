/**
 * Navbar — public-page header.
 *
 * Spec: public-pages — "Navbar exposes product identity and primary
 * navigation". Logo on the left links home, About in the middle links
 * to /about, Sign-in CTA on the right links to /login.
 *
 * Style: editorial / Swiss-modern — minimal, generous whitespace, no
 * heavy chrome. Colors are sourced from the four brand tokens; no
 * extra accents.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import vellumLogo from "../assets/vellum-logo-removebg.png";

export function Navbar() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.brand")}
      className="sticky top-0 z-40 w-full border-b border-ink-navy/5 bg-off-white/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a
          href="/"
          className="flex items-center gap-2 text-ink-navy hover:opacity-80 transition-opacity"
          aria-label={t("nav.brand")}
        >
          <img
            src={vellumLogo}
            alt={t("nav.brand")}
            className="h-7 w-7 select-none"
            draggable={false}
          />
          <span className="font-serif text-lg font-semibold tracking-tight">{t("nav.brand")}</span>
        </a>

        <div className="flex items-center gap-8">
          <a
            href="/about"
            className="text-sm text-warm-sepia hover:text-ink-navy transition-colors cursor-pointer"
          >
            {t("nav.about")}
          </a>
          <a
            href="/login"
            className="rounded-lg bg-ink-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink-navy/90 transition-colors cursor-pointer"
          >
            {t("nav.login")}
          </a>
        </div>
      </div>
    </nav>
  );
}
