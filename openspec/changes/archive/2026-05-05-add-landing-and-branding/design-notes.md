# Design Notes — add-landing-and-branding

Captured from `~/.shared/ui-ux-pro-max/scripts/search.py` to inform the
implementation of `apps/web/src/landing/*` (Navbar / Footer / PublicLayout
/ HomePage / AboutPage). Source-of-truth for styling decisions until the
change is archived.

## Style direction (decision)

Mix of **Swiss Modernism 2.0** + **Minimal Single Column** landing
pattern, applied through Vellum's existing brand tokens (ink-navy /
parchment-cream / warm-sepia / off-white).

- 12-column grid with generous gutters; mathematical spacing (8 / 16
  / 24 / 48 / 96 px).
- Minimal palette: 4 brand tokens only, no extra accents.
- High contrast (text > 7:1) — `ink-navy #1a2332` on `off-white #fafaf7`.
- Lots of whitespace; type does most of the talking.
- Pre-delivery checklist (icons / hover stable / cursor-pointer / floating
  navbar / responsive notice) applied before completion.

## Typography (decision)

Sticking with the already-pinned pairing **Inter (body) + Newsreader
(serif headlines)**. Closest match in the search DB was "News Editorial"
(Newsreader + Roboto) — we keep Inter for UI consistency rather than
swapping in Roboto.

- Hero headline: Newsreader 600 / `clamp(2.75rem, 6vw, 4.5rem)` /
  `letter-spacing: -0.02em` / `line-height: 1.05`.
- Section headings (h2): Newsreader 600 / 2rem / line-height 1.2.
- Body / nav / button: Inter 400–500.
- Tagline / muted captions: Inter 400 / `text-warm-sepia`.

## Color usage (decision)

| Role | Token | Hex | Usage |
| --- | --- | --- | --- |
| Page background | `off-white` | `#fafaf7` | `<body>`, PublicLayout main |
| Surface accent | `parchment-cream` | `#f5f0e6` | Section bands, Footer |
| Primary text | `ink-navy` | `#1a2332` | Headings, body copy, primary CTA bg |
| Secondary text | `warm-sepia` | `#8b6f47` | Tagline, footer text, muted hints |
| CTA text-on-bg | white (#ffffff) | — | text inside ink-navy buttons |

No additional vibrant accents — the search recommended a vibrant CTA
accent for SaaS, but we keep ink-navy CTAs to preserve the editorial
feel. CTA differentiation comes from typography weight + spacing + a
subtle hover lift, not color.

## Landing structure (decision)

Adopting **"Minimal Single Column"** with a 4-section vertical flow:

1. **Hero**: full viewport height; brand mark + serif headline +
   warm-sepia tagline + single primary CTA → `/login`.
2. **Features (3-column at ≥ 1024px, 1-column otherwise)**: 3 cards
   summarising core value props (Canvas + Multiplayer + Sharing). Plain
   icon (lucide) + h3 + 2-line description per card.
3. **Narrative band**: 2-paragraph quote-styled "why we built Vellum"
   teaser, links to `/about` for the full essay.
4. **Footer call-out**: a single-row "Made with care · v{VELLUM_VERSION}"
   footer; no social links.

Animation: hero (FadeIn 600ms) + features (StaggerContainer 80ms with
FadeIn per card) + narrative (SlideIn from='bottom' 400ms) + footer
(no animation).

## About page structure (decision)

Single column, 720px max width, generous prose:

1. Page heading (Newsreader) + lead paragraph (warm-sepia, italic).
2. Section: "Why Vellum" — 2 paragraphs on the craftsmanship
   philosophy.
3. Section: "Who is it for" — 2 paragraphs describing the target
   audience (solo thinkers, small teams, design-curious folk).
4. Section: "Built with" — 1 paragraph on the underlying stack +
   open-source acknowledgement (tldraw, motion, Tailwind).
5. Closing CTA back to `/` or `/login`.

Animation: each section uses `<SlideIn from="bottom">` wrapping its
heading; body copy fades in via stagger.

## Animation rhythm (decision)

| Surface | Primitive | Duration | Notes |
| --- | --- | --- | --- |
| Hero headline / tagline / CTA | FadeIn (stagger 100ms) | 600ms | Once per route mount |
| Feature cards | StaggerContainer + FadeIn | 600ms | staggerMs default 80 |
| About sections | SlideIn from='bottom' | 400ms | One per section |
| Dialog enter/exit | scale 0.95→1 + fade | 180ms | All four dialogs |
| Dashboard list cards | StaggerContainer + FadeIn | 400ms | First mount only |

`prefers-reduced-motion: reduce` collapses all of the above to 0ms
duration with no transform offset.

## a11y checklist (from search "ux animation/accessibility")

- Every motion primitive checks `prefers-reduced-motion` via the
  motion lib's `useReducedMotion()` hook.
- Animate at most 1–2 key elements per view; avoid blanket
  `animate-bounce` style applied to many elements.
- Floating navbar gets `top-4 left-4 right-4` spacing (per
  ui-ux-pro-max common-rules) — but Vellum's design uses a normal
  pinned navbar, not a floating one, so this rule maps to: navbar has
  a 4px breathing space below before content begins.
- All clickable elements get `cursor-pointer`.
- Hover transitions limited to color/opacity (no scale-shift on
  layout-affecting elements).
- Light-mode contrast: text >= 4.5:1 minimum, headings >= 7:1.

## Hero copy (English; zh-TW key set in i18n task)

- Headline: "A whiteboard built with care."
- Tagline: "Light, fast, and made for thinking. Vellum is a
  craftsmanship-driven canvas — no AI gimmicks, no upsell."
- CTA: "Get started"

## Feature copy (3 cards)

| Card | Heading | Body |
| --- | --- | --- |
| 1 | Infinite canvas | tldraw-powered freeform thinking with custom Markdown, code, callout, and link-card shapes. |
| 2 | Real-time multiplayer | Edit together with your team. Cursor presence, optimistic sync, and a self-hosted backend. |
| 3 | Yours to share | Per-canvas public links and email invites with editor / viewer roles. Export anytime to PNG / SVG / PDF / JSON. |

## About copy (English skeleton)

- Lead: "Vellum is a whiteboard for the patient — a canvas that
  rewards craft, slow thinking, and small teams who care about how
  their tools feel."
- Why Vellum (2 paragraphs)
- Who it's for (2 paragraphs)
- Built with: tldraw, motion, Tailwind CSS v4, React, Bun
- Closing: "Make something thoughtful." → `/login` CTA
