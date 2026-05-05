/**
 * AboutPage — public route `/about`.
 *
 * Spec: public-pages — narrative explaining what Vellum is, who it's
 * for, and how it's built. Single column, generous prose, sections
 * slide in from below as the visitor reaches them on first paint.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { FadeIn, SlideIn } from "../motion/primitives";

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-16 px-6 py-24">
      <header className="flex flex-col gap-6">
        <FadeIn duration={500}>
          <h1 className="font-serif text-4xl font-semibold leading-tight text-ink-navy md:text-5xl">
            {t("about.heading")}
          </h1>
        </FadeIn>
        <FadeIn delay={150} duration={500}>
          <p className="font-serif text-xl italic leading-relaxed text-warm-sepia">
            {t("about.lead")}
          </p>
        </FadeIn>
      </header>

      <Section heading={t("about.why.heading")}>
        <p>{t("about.why.paragraph1")}</p>
        <p>{t("about.why.paragraph2")}</p>
      </Section>

      <Section heading={t("about.audience.heading")}>
        <p>{t("about.audience.paragraph1")}</p>
        <p>{t("about.audience.paragraph2")}</p>
      </Section>

      <Section heading={t("about.builtWith.heading")}>
        <p>{t("about.builtWith.body")}</p>
      </Section>

      <SlideIn from="bottom" duration={500}>
        <div className="flex flex-col items-start gap-6 border-t border-ink-navy/10 pt-12">
          <h2 className="font-serif text-2xl font-semibold text-ink-navy">
            {t("about.closing.heading")}
          </h2>
          <a
            href="/login"
            className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-ink-navy px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-navy/90"
          >
            {t("about.closing.cta")}
          </a>
        </div>
      </SlideIn>
    </article>
  );
}

interface SectionProps {
  heading: string;
  children: React.ReactNode;
}

function Section({ heading, children }: SectionProps) {
  return (
    <SlideIn from="bottom" duration={500}>
      <section className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-semibold text-ink-navy">{heading}</h2>
        <div className="flex flex-col gap-4 text-base leading-relaxed text-ink-navy/80">
          {children}
        </div>
      </section>
    </SlideIn>
  );
}
