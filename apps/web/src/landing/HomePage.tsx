/**
 * HomePage — public landing page (route `/`).
 *
 * Spec: public-pages — "Public root and about routes render full
 * landing surface". Three sections: hero, features (3 cards),
 * narrative band linking to /about. The PublicLayout shell (Navbar +
 * Footer) is supplied at the router level.
 *
 * Style: editorial / Swiss-modern minimal. Newsreader for the
 * headline, Inter for body. Brand tokens only — no extra accents.
 *
 * Animation: hero opens with FadeIn; feature cards stagger in via
 * StaggerContainer + FadeIn; narrative slides up from below. All
 * primitives respect prefers-reduced-motion via useReducedMotion.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { FadeIn, SlideIn, StaggerContainer } from "../motion/primitives";
import vellumLogo from "../assets/vellum-logo-removebg.png";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <Hero t={t} />
      <Features t={t} />
      <Narrative t={t} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero — full-bleed introduction
// ---------------------------------------------------------------------------

function Hero({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden px-6 py-24">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <FadeIn duration={500}>
          <img
            src={vellumLogo}
            alt={t("nav.brand")}
            className="mb-8 h-16 w-16 select-none"
            draggable={false}
          />
        </FadeIn>

        <FadeIn delay={100} duration={600}>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight text-ink-navy md:text-6xl lg:text-7xl">
            {t("landing.hero.headline")}
          </h1>
        </FadeIn>

        <FadeIn delay={250} duration={600}>
          <p className="mt-6 max-w-2xl text-lg text-warm-sepia">{t("landing.hero.tagline")}</p>
        </FadeIn>

        <FadeIn delay={400} duration={500}>
          <a
            href="/login"
            className="mt-12 inline-flex cursor-pointer items-center justify-center rounded-lg bg-ink-navy px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-navy/90"
          >
            {t("landing.hero.cta")}
          </a>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features — three-card grid
// ---------------------------------------------------------------------------

const FEATURE_KEYS = ["canvas", "multiplayer", "sharing"] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];

function Features({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section className="border-t border-ink-navy/5 bg-parchment-cream/30 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SlideIn from="bottom" duration={500}>
          <h2 className="mb-16 max-w-2xl font-serif text-3xl font-semibold leading-tight text-ink-navy md:text-4xl">
            {t("landing.features.heading")}
          </h2>
        </SlideIn>

        <StaggerContainer staggerMs={120} className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {FEATURE_KEYS.map((key) => (
            <FadeIn key={key} duration={500}>
              <FeatureCard featureKey={key} t={t} />
            </FadeIn>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

function FeatureCard({
  featureKey,
  t,
}: {
  featureKey: FeatureKey;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-xl font-semibold text-ink-navy">
        {t(`landing.features.${featureKey}.title`)}
      </h3>
      <p className="text-sm leading-relaxed text-warm-sepia">
        {t(`landing.features.${featureKey}.body`)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Narrative — quote-style band linking to /about
// ---------------------------------------------------------------------------

function Narrative({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section className="border-t border-ink-navy/5 px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <SlideIn from="bottom" duration={500}>
          <h2 className="font-serif text-3xl font-semibold leading-tight text-ink-navy md:text-4xl">
            {t("landing.narrative.heading")}
          </h2>
        </SlideIn>

        <FadeIn delay={150} duration={600}>
          <p className="mt-8 text-lg leading-relaxed text-ink-navy/80">
            {t("landing.narrative.body")}
          </p>
        </FadeIn>

        <FadeIn delay={300} duration={500}>
          <a
            href="/about"
            className="mt-8 inline-flex cursor-pointer items-center text-sm font-medium text-warm-sepia transition-colors hover:text-ink-navy"
          >
            {t("landing.narrative.readMore")}
          </a>
        </FadeIn>
      </div>
    </section>
  );
}
