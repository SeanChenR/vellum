/**
 * HomePage — public landing page (route `/`).
 *
 * Spec: openspec/specs/public-pages/spec.md
 *   "All non-canvas pages share the same outer container width"
 *   "HomePage feature cards use the elevated Card primitive"
 *
 * Design ref: docs/design/aura-redesign/project/public-frames.jsx
 *   - Hero: Badge over Newsreader headline, primary + secondary CTAs
 *     with lucide icons.
 *   - Feature cards: elevated Card with 2px colored top border (purple
 *     / cyan / pink) + lucide icon at top in matching accent color.
 *   - Narrative band: surface-elevated background, two-column quote
 *     treatment with large italic open-quote glyph.
 */

import { ArrowRight, Bot, Layers, PenTool } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
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
// Hero
// ---------------------------------------------------------------------------

function Hero({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  const { isAuthenticated } = useAuth();
  const ctaHref = isAuthenticated ? "/dashboard" : "/login";
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-6 py-24 text-center md:px-8">
        <FadeIn duration={500}>
          <img
            src={vellumLogo}
            alt={t("nav.brand")}
            className="mb-6 h-16 w-16 select-none"
            draggable={false}
          />
        </FadeIn>

        <FadeIn delay={80} duration={500}>
          <Badge tone="purple" dot className="mb-6">
            {t("landing.hero.badge", { defaultValue: "v0.7 · 公開測試版" })}
          </Badge>
        </FadeIn>

        <FadeIn delay={120} duration={600}>
          <h1
            className="font-serif text-5xl font-medium leading-[1.05] tracking-tight text-text-primary md:text-6xl lg:text-7xl"
            style={{ textWrap: "balance" }}
          >
            {t("landing.hero.headline")}
          </h1>
        </FadeIn>

        <FadeIn delay={260} duration={600}>
          <p className="mt-6 max-w-2xl text-lg text-text-muted" style={{ textWrap: "pretty" }}>
            {t("landing.hero.tagline")}
          </p>
        </FadeIn>

        <FadeIn delay={400} duration={500}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <a href={ctaHref} className="contents">
              <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />}>
                {t("landing.hero.cta")}
              </Button>
            </a>
            <a href="/about" className="contents">
              <Button variant="secondary" size="lg">
                {t("landing.hero.secondaryCta", { defaultValue: "看一下這是什麼" })}
              </Button>
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Features — three cards with colored accent-top + lucide icons
// ---------------------------------------------------------------------------

interface FeatureSpec {
  key: "canvas" | "multiplayer" | "sharing";
  accent: "purple" | "cyan" | "pink";
  icon: typeof PenTool;
}

const FEATURES: FeatureSpec[] = [
  { key: "canvas", accent: "purple", icon: PenTool },
  { key: "multiplayer", accent: "cyan", icon: Bot },
  { key: "sharing", accent: "pink", icon: Layers },
];

function Features({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section className="border-t border-border bg-surface-elevated/40">
      <div className="mx-auto w-full max-w-7xl px-6 py-24 md:px-8">
        <SlideIn from="bottom" duration={500}>
          <h2 className="mb-12 max-w-2xl font-serif text-3xl font-medium leading-tight text-text-primary md:text-4xl">
            {t("landing.features.heading")}
          </h2>
        </SlideIn>

        <StaggerContainer
          staggerMs={120}
          className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3"
        >
          {FEATURES.map(({ key, accent, icon: Icon }) => (
            <FadeIn key={key} duration={500} className="h-full">
              <Card
                variant="elevated"
                data-testid={`feature-card-${key}`}
                className="v-card-hover-ring relative flex h-full flex-col !p-7 transition-shadow duration-150 hover:shadow-[0_0_0_2px_var(--accent-purple)]"
                style={{
                  borderTop: `2px solid var(--accent-${accent})`,
                }}
              >
                <span
                  aria-hidden
                  className={`mb-4 inline-flex text-accent-${accent}`}
                  data-testid={`feature-icon-${key}`}
                >
                  <Icon size={22} strokeWidth={2} />
                </span>
                <h3 className="mb-2 font-serif text-xl font-medium text-text-primary">
                  {t(`landing.features.${key}.title`)}
                </h3>
                <p
                  className="text-sm leading-relaxed text-text-muted"
                  style={{ textWrap: "pretty" }}
                >
                  {t(`landing.features.${key}.body`)}
                </p>
              </Card>
            </FadeIn>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Narrative — quote treatment
// ---------------------------------------------------------------------------

function Narrative({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <section className="border-t border-border bg-surface-elevated/30">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:px-8">
        <div>
          <Badge tone="muted">{t("landing.narrative.badge", { defaultValue: "緣起" })}</Badge>
          <h2 className="mt-4 font-serif text-3xl font-medium leading-tight tracking-tight text-text-primary md:text-4xl">
            {t("landing.narrative.heading")}
          </h2>
          <p
            className="mt-5 text-base leading-relaxed text-text-muted md:text-lg"
            style={{ textWrap: "pretty" }}
          >
            {t("landing.narrative.body")}
          </p>
          <a href="/about" className="contents">
            <Button variant="ghost" size="md" className="mt-5" iconRight={<ArrowRight size={15} />}>
              {t("landing.narrative.readMore")}
            </Button>
          </a>
        </div>

        <div className="flex aspect-[4/3] flex-col justify-between rounded-2xl border border-border bg-surface p-8">
          <div
            aria-hidden
            className="font-serif text-accent-purple"
            style={{
              fontSize: 88,
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: 1,
            }}
          >
            “
          </div>
          <p
            className="font-serif text-xl leading-snug text-text-primary md:text-2xl"
            style={{ textWrap: "pretty" }}
          >
            {t("landing.narrative.pullQuote", {
              defaultValue: "寫在羊皮紙上的字，會被認真地讀。",
            })}
          </p>
          <div className="font-mono text-xs text-text-muted">
            {t("landing.narrative.pullQuoteAttribution", {
              defaultValue: "── 設計筆記，2026.04",
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
