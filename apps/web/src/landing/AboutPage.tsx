/**
 * AboutPage — public route `/about`.
 *
 * Spec: openspec/specs/public-pages/spec.md
 *   "All non-canvas pages share the same outer container width"
 *   scenario: "AboutPage body prose remains narrow within wide container"
 *
 * Layout: outer container at `max-w-7xl` to match Navbar / Footer, the
 * prose article self-clamps to `max-w-prose` (~64ch) for reading.
 */

import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { FadeIn, SlideIn } from "../motion/primitives";

export function AboutPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const ctaHref = isAuthenticated ? "/dashboard" : "/login";
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-24 md:px-8">
      <article className="mx-auto flex max-w-prose flex-col gap-16">
        <header className="flex flex-col gap-6">
          <FadeIn duration={500}>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-text-primary md:text-5xl">
              {t("about.heading")}
            </h1>
          </FadeIn>
          <FadeIn delay={150} duration={500}>
            <p className="font-serif text-xl italic leading-relaxed text-text-muted">
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
          <div className="flex flex-col items-start gap-6 border-t border-border pt-12">
            <h2 className="font-serif text-2xl font-semibold text-text-primary">
              {t("about.closing.heading")}
            </h2>
            <a
              href={ctaHref}
              className="focus-visible-ring inline-flex cursor-pointer items-center justify-center rounded-lg bg-accent-purple px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("about.closing.cta")}
            </a>
          </div>
        </SlideIn>
      </article>
    </div>
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
        <h2 className="font-serif text-2xl font-semibold text-text-primary">{heading}</h2>
        <div className="flex flex-col gap-4 text-base leading-relaxed text-text-primary/85">
          {children}
        </div>
      </section>
    </SlideIn>
  );
}
