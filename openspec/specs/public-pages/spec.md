# public-pages Specification

## Purpose

TBD - created by archiving change 'add-landing-and-branding'. Update Purpose after archive.

## Requirements

### Requirement: Public root and about routes render full landing surface

The system SHALL serve a public Homepage at the root path (`/`) and a public About page at `/about`. Both pages MUST be reachable without authentication and MUST be wrapped in a shared `PublicLayout` shell that renders a Navbar above and a Footer below the page content. Authenticated visitors arriving at `/` or `/about` MUST be redirected to `/dashboard`. The Homepage MUST present at least the following sections in document order: hero with product name, tagline, primary CTA, and a features section communicating the product's value proposition. The About page MUST present the product narrative (what Vellum is, who it is for, design philosophy) without external embeds.

#### Scenario: Anonymous visitor lands on the Homepage

- **WHEN** an anonymous visitor navigates to `/`
- **THEN** the system MUST render the `PublicLayout` shell containing a Navbar, the Homepage main content, and a Footer
- **AND** the Homepage MUST contain a hero element with the product name, a tagline, and a primary call-to-action button leading to `/login`
- **AND** the Homepage MUST contain a features section that lists the core product capabilities

#### Scenario: Anonymous visitor reads the About page

- **WHEN** an anonymous visitor navigates to `/about`
- **THEN** the system MUST render the `PublicLayout` shell containing the same Navbar and Footer used on the Homepage
- **AND** the About page MUST contain a heading and at least one narrative section describing the product's purpose and intended audience

#### Scenario: Authenticated visitor is redirected away from public routes

- **WHEN** an authenticated visitor navigates to `/` or `/about`
- **THEN** the system MUST navigate them to `/dashboard` without rendering the public layout


<!-- @trace
source: add-landing-and-branding
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/assets/vellum-favicon.png
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/motion/dialog.tsx
  - apps/web/src/assets/vellum-logo-removebg.png
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/motion/primitives.tsx
  - apps/web/src/router.tsx
  - asset/vellum-favicon.png
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/components/CanvasRenameDialog.tsx
tests:
  - apps/web/src/router.test.tsx
  - apps/web/src/App.test.tsx
  - apps/web/src/landing/Footer.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/motion/dialog.test.tsx
  - apps/web/src/motion/forbidden-imports.test.ts
  - apps/web/src/motion/primitives.test.tsx
-->

---
### Requirement: Navbar exposes product identity and primary navigation

The Navbar SHALL render the product logo on the left, navigation links in the center or right, and a primary call-to-action (Login) on the right. The navbar MUST be the same instance used on Homepage and About. The logo MUST link to `/`. The Navbar MUST include a navigation link to `/about`. The Navbar MUST include a Login link routing to `/login`. All Navbar text strings MUST come from the i18n namespace `nav.*`.

#### Scenario: Visitor sees logo, navigation, and login

- **WHEN** the Navbar is rendered
- **THEN** the Navbar MUST contain the product logo image with a link wrapping it pointing to `/`
- **AND** the Navbar MUST contain a navigation link with the localized label `nav.about` pointing to `/about`
- **AND** the Navbar MUST contain a primary action with the localized label `nav.login` pointing to `/login`

#### Scenario: Logo click returns to Homepage

- **WHEN** a visitor on the About page clicks the Navbar logo
- **THEN** the system MUST navigate the visitor to `/`


<!-- @trace
source: add-landing-and-branding
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/assets/vellum-favicon.png
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/motion/dialog.tsx
  - apps/web/src/assets/vellum-logo-removebg.png
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/motion/primitives.tsx
  - apps/web/src/router.tsx
  - asset/vellum-favicon.png
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/components/CanvasRenameDialog.tsx
tests:
  - apps/web/src/router.test.tsx
  - apps/web/src/App.test.tsx
  - apps/web/src/landing/Footer.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/motion/dialog.test.tsx
  - apps/web/src/motion/forbidden-imports.test.ts
  - apps/web/src/motion/primitives.test.tsx
-->

---
### Requirement: Footer surfaces version and a single attribution row

The Footer SHALL render at the bottom of every PublicLayout page. The Footer MUST display the product name and the build version (sourced from `VELLUM_VERSION` exported by `@vellum/shared`) in a single row. The Footer MUST NOT contain external links to social media, blog, pricing, or other Phase 2 surfaces. All Footer text strings MUST come from the i18n namespace `footer.*`.

#### Scenario: Visitor sees product name and version

- **WHEN** the Footer is rendered on any PublicLayout page
- **THEN** the Footer MUST contain a row displaying the product name from `nav.brand`
- **AND** the Footer MUST contain a row displaying a label and value from `footer.versionLabel` parameterized with the imported `VELLUM_VERSION` constant

#### Scenario: Footer omits Phase 2 surfaces

- **WHEN** the Footer is rendered
- **THEN** the rendered output MUST NOT contain anchor tags pointing to URLs containing the substrings `/pricing`, `/blog`, `/changelog`, `twitter.com`, `linkedin.com`, or `discord.com`


<!-- @trace
source: add-landing-and-branding
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/assets/vellum-favicon.png
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/motion/dialog.tsx
  - apps/web/src/assets/vellum-logo-removebg.png
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/motion/primitives.tsx
  - apps/web/src/router.tsx
  - asset/vellum-favicon.png
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/components/CanvasRenameDialog.tsx
tests:
  - apps/web/src/router.test.tsx
  - apps/web/src/App.test.tsx
  - apps/web/src/landing/Footer.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/motion/dialog.test.tsx
  - apps/web/src/motion/forbidden-imports.test.ts
  - apps/web/src/motion/primitives.test.tsx
-->

---
### Requirement: Public-page string set is fully internationalized in zh-TW and en

The system SHALL define every visible string on Homepage, About, Navbar, and Footer as an i18n key under one of the namespaces `landing.*`, `about.*`, `nav.*`, or `footer.*`. Both `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` MUST define every key in the same change. No raw display strings SHALL appear in the JSX of `landing/HomePage.tsx`, `landing/AboutPage.tsx`, `landing/Navbar.tsx`, or `landing/Footer.tsx`.

#### Scenario: zh-TW and en define the same key set

- **WHEN** the union of keys under `landing.*`, `about.*`, `nav.*`, `footer.*` in zh-TW.json and en.json is compared
- **THEN** the two key sets MUST be equal — every key in zh-TW MUST exist in en, and vice versa

#### Scenario: Public-page JSX contains no hardcoded display strings

- **WHEN** the JSX of any of `apps/web/src/landing/HomePage.tsx`, `landing/AboutPage.tsx`, `landing/Navbar.tsx`, `landing/Footer.tsx` is inspected
- **THEN** every visible text node MUST be the result of a `t(key)` call — no raw string literals MUST appear as JSX text children


<!-- @trace
source: add-landing-and-branding
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/assets/vellum-favicon.png
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/motion/dialog.tsx
  - apps/web/src/assets/vellum-logo-removebg.png
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/motion/primitives.tsx
  - apps/web/src/router.tsx
  - asset/vellum-favicon.png
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/components/CanvasRenameDialog.tsx
tests:
  - apps/web/src/router.test.tsx
  - apps/web/src/App.test.tsx
  - apps/web/src/landing/Footer.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/motion/dialog.test.tsx
  - apps/web/src/motion/forbidden-imports.test.ts
  - apps/web/src/motion/primitives.test.tsx
-->

---
### Requirement: Document head links favicon, title, and description

The system SHALL include in the served HTML document head a favicon link pointing to the product favicon image, a `<title>` element containing the product name and tagline, and a `<meta name="description">` element with a one-sentence product description. The favicon image MUST be the file `apps/web/src/assets/vellum-favicon.png`.

#### Scenario: Browser tab renders favicon, title, and description

- **WHEN** the browser loads any page served from `apps/web/src/index.html`
- **THEN** the document MUST contain `<link rel="icon" type="image/png">` whose `href` resolves to `apps/web/src/assets/vellum-favicon.png`
- **AND** the document MUST contain a non-empty `<title>` element
- **AND** the document MUST contain `<meta name="description">` with a non-empty `content` attribute


<!-- @trace
source: add-landing-and-branding
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/assets/vellum-favicon.png
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/motion/dialog.tsx
  - apps/web/src/assets/vellum-logo-removebg.png
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/motion/primitives.tsx
  - apps/web/src/router.tsx
  - asset/vellum-favicon.png
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/components/CanvasRenameDialog.tsx
tests:
  - apps/web/src/router.test.tsx
  - apps/web/src/App.test.tsx
  - apps/web/src/landing/Footer.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/motion/dialog.test.tsx
  - apps/web/src/motion/forbidden-imports.test.ts
  - apps/web/src/motion/primitives.test.tsx
-->

---
### Requirement: Public pages display a graceful message on viewports narrower than 768px

The system SHALL display a graceful informational message (not the broken desktop layout) when the viewport width is below 768 pixels. The message MUST inform the visitor that Vellum is best experienced on a desktop browser. This degradation MUST NOT apply to authenticated routes (canvas / dashboard) — those remain at desktop breakpoints as specified by the Phase 1 out-of-scope guard.

#### Scenario: Mobile viewport sees the desktop-only notice

- **WHEN** an anonymous visitor loads `/` or `/about` with a viewport width below 768 pixels
- **THEN** the system MUST render a centered notice using a localized key under `landing.mobileNotice.*` informing the visitor that Vellum is desktop-only in Phase 1
- **AND** the regular Homepage / About content MUST be hidden in this viewport range

<!-- @trace
source: add-landing-and-branding
updated: 2026-05-05
code:
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
  - apps/web/src/assets/vellum-favicon.png
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/motion/dialog.tsx
  - apps/web/src/assets/vellum-logo-removebg.png
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/motion/primitives.tsx
  - apps/web/src/router.tsx
  - asset/vellum-favicon.png
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/components/CanvasRenameDialog.tsx
tests:
  - apps/web/src/router.test.tsx
  - apps/web/src/App.test.tsx
  - apps/web/src/landing/Footer.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/motion/dialog.test.tsx
  - apps/web/src/motion/forbidden-imports.test.ts
  - apps/web/src/motion/primitives.test.tsx
-->