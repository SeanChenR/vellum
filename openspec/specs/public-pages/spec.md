# public-pages Specification

## Purpose

TBD - created by archiving change 'add-landing-and-branding'. Update Purpose after archive.

## Requirements

### Requirement: Public root and about routes render full landing surface

The system SHALL serve a public Homepage at the root path (`/`), a public About page at `/about`, and the Login page at `/login`. All three pages MUST be reachable without authentication and MUST be wrapped in the shared `PublicLayout` shell that renders a Navbar above and a Footer below the page content. Authenticated visitors arriving at `/` or `/about` MUST NOT be redirected — they MUST see the same public surface as anonymous visitors, with the Navbar's auth-aware right side (defined elsewhere) reflecting their signed-in state. Authenticated visitors arriving at `/login` MUST also see the login form (the system MUST NOT add a redirect to `/dashboard` for already-signed-in users at this route). The Homepage MUST present at least the following sections in document order: hero with product name, tagline, primary CTA, and a features section communicating the product's value proposition. The About page MUST present the product narrative (what Vellum is, who it is for, design philosophy) without external embeds.

#### Scenario: Anonymous visitor lands on the Homepage

- **WHEN** an anonymous visitor navigates to `/`
- **THEN** the system MUST render the `PublicLayout` shell containing a Navbar, the Homepage main content, and a Footer
- **AND** the Homepage MUST contain a hero element with the product name, a tagline, and a primary call-to-action button leading to `/login`
- **AND** the Homepage MUST contain a features section that lists the core product capabilities

#### Scenario: Anonymous visitor reads the About page

- **WHEN** an anonymous visitor navigates to `/about`
- **THEN** the system MUST render the `PublicLayout` shell containing the same Navbar and Footer used on the Homepage
- **AND** the About page MUST contain a heading and at least one narrative section describing the product's purpose and intended audience

#### Scenario: Authenticated visitor sees public pages without redirect

- **WHEN** an authenticated visitor navigates to `/` or `/about`
- **THEN** the system MUST render the `PublicLayout` shell with the page content unchanged from the anonymous visitor's view
- **AND** the system MUST NOT navigate the visitor away to `/dashboard` or any other route

#### Scenario: Login page is wrapped in PublicLayout

- **WHEN** any visitor navigates to `/login`
- **THEN** the system MUST render the `PublicLayout` shell containing a Navbar, the login form as main content, and a Footer
- **AND** the login form MUST appear regardless of the visitor's authentication state


<!-- @trace
source: unify-navbar
updated: 2026-05-05
code:
  - apps/web/src/dashboard/DashboardPage.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/landing/AboutPage.tsx
tests:
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/landing/AppLayout.forbidden.test.ts
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
-->

---
### Requirement: Navbar exposes product identity and primary navigation

The Navbar SHALL render the product logo on the left, an About navigation link, and an auth-aware action area on the right. The Navbar MUST be the same instance reused across Homepage, About, Login, Dashboard, Profile, Sessions, and any future authenticated route. The logo MUST link to `/` regardless of authentication state. The Navbar MUST include a navigation link to `/about`. The right-side action area MUST consult the authentication state and render exactly one of three states: a fixed-width loading placeholder while the auth state is resolving, a Sign-in CTA linking to `/login` when the visitor is anonymous, or the user-avatar menu when the visitor is authenticated. The placeholder dimensions MUST match the Sign-in CTA dimensions to prevent layout shift between states. All Navbar text strings MUST come from the i18n namespace `nav.*`.

#### Scenario: Anonymous visitor sees logo, About link, and Sign-in CTA

- **WHEN** the Navbar is rendered for an anonymous visitor
- **THEN** the Navbar MUST contain the product logo wrapped in a link to `/`
- **AND** the Navbar MUST contain a navigation link with the localized label `nav.about` pointing to `/about`
- **AND** the Navbar MUST contain a primary action with the localized label `nav.login` pointing to `/login`
- **AND** the Navbar MUST NOT render any user-avatar menu

#### Scenario: Authenticated visitor sees logo, About link, and avatar menu

- **WHEN** the Navbar is rendered for an authenticated visitor
- **THEN** the Navbar MUST contain the product logo wrapped in a link to `/`
- **AND** the Navbar MUST contain a navigation link with the localized label `nav.about` pointing to `/about`
- **AND** the Navbar MUST render the user-avatar menu component
- **AND** the Navbar MUST NOT render any Sign-in CTA

#### Scenario: Auth state still loading shows fixed-width placeholder

- **WHEN** the Navbar is rendered while the authentication state is resolving (`isLoading` is true)
- **THEN** the right-side action area MUST contain a placeholder element occupying the same width and height as the Sign-in CTA
- **AND** the Navbar MUST NOT render either the Sign-in CTA or the user-avatar menu until the auth state resolves

#### Scenario: Logo click returns to Homepage

- **WHEN** a visitor on the About page, the Login page, the Dashboard, or any authenticated route clicks the Navbar logo
- **THEN** the system MUST navigate the visitor to `/` regardless of their authentication state


<!-- @trace
source: unify-navbar
updated: 2026-05-05
code:
  - apps/web/src/dashboard/DashboardPage.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/landing/AboutPage.tsx
tests:
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/landing/AppLayout.forbidden.test.ts
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
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

---
### Requirement: Authenticated routes share an AppLayout shell that reuses the Navbar

The system SHALL provide a separate `AppLayout` shell for authenticated routes (Dashboard at `/dashboard`, Profile at `/profile`, Sessions at `/sessions`, and any future authenticated route except the canvas editor). The `AppLayout` shell MUST render the same `Navbar` component used by `PublicLayout` and MUST render the page content as its main child. The `AppLayout` shell MUST NOT render the public Footer (because authenticated work surfaces do not carry the made-with-care marketing footer). The `AppLayout` shell MUST NOT render the mobile graceful notice that PublicLayout shows below 768px (because authenticated visitors arrived at the work surface deliberately on a desktop browser). The canvas editor route (`/canvas/:id`) MUST continue to use its own `TopBar` and MUST NOT be wrapped in `AppLayout`.

#### Scenario: Dashboard renders inside AppLayout

- **WHEN** an authenticated visitor navigates to `/dashboard`
- **THEN** the system MUST render the `AppLayout` shell containing the same `Navbar` component as the public layout
- **AND** the page MUST NOT render the public Footer
- **AND** the page MUST NOT render the mobile graceful notice

#### Scenario: Account routes share the AppLayout

- **WHEN** an authenticated visitor navigates to `/profile` or `/sessions`
- **THEN** the system MUST render the `AppLayout` shell containing the same `Navbar` component
- **AND** the page MUST NOT render the public Footer

#### Scenario: Canvas editor is excluded from AppLayout

- **WHEN** an authenticated visitor navigates to `/canvas/:id`
- **THEN** the page MUST NOT be wrapped in `AppLayout`
- **AND** the page MUST continue to render its own canvas-editor `TopBar` chrome


<!-- @trace
source: unify-navbar
updated: 2026-05-05
code:
  - apps/web/src/dashboard/DashboardPage.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/landing/AboutPage.tsx
tests:
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/landing/AppLayout.forbidden.test.ts
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
-->

---
### Requirement: User avatar menu surfaces a Go-to-Dashboard entry

The user-avatar menu rendered by the Navbar SHALL include four menu items in this order: Go to Dashboard, Profile, Sessions, Sign out. The Go to Dashboard item MUST link to `/dashboard` and MUST be visible on every surface where the menu appears, including the Dashboard surface itself. The localized label for this item MUST come from the i18n namespace key `nav.userMenu.dashboard`, and that key MUST be defined in both the zh-TW and en locale files in the same change.

#### Scenario: Avatar menu shows four items in correct order

- **WHEN** an authenticated visitor opens the avatar menu from any surface
- **THEN** the menu MUST contain four interactive items in this exact order: Go to Dashboard (linking to `/dashboard`), Profile (linking to `/profile`), Sessions (linking to `/sessions`), Sign out (triggering the logout action)

#### Scenario: Go to Dashboard remains visible on the Dashboard surface

- **WHEN** an authenticated visitor on `/dashboard` opens the avatar menu
- **THEN** the menu MUST still contain the Go to Dashboard item
- **AND** clicking it MUST be a safe no-op or a self-navigation; the system MUST NOT crash, error, or hide the menu in an unexpected way

#### Scenario: Both locales define the new menu key

- **WHEN** the i18n key set under `nav.userMenu.*` is inspected in both `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json`
- **THEN** both files MUST contain the key `nav.userMenu.dashboard` with a non-empty translated string

<!-- @trace
source: unify-navbar
updated: 2026-05-05
code:
  - apps/web/src/dashboard/DashboardPage.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/landing/Navbar.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/AppHeader.tsx
  - apps/web/src/landing/AboutPage.tsx
tests:
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/landing/AboutPage.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/landing/AppLayout.forbidden.test.ts
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
-->