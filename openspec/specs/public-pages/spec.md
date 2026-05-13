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

The NavBar SHALL render as a CSS grid with three regions arranged as `[1fr][auto][1fr]`. The left region SHALL hold the brand mark (logo + wordmark in Newsreader). The center region SHALL hold the primary navigation links (`Home`, `About`) centered horizontally. The right region SHALL hold, in this order: `<LocaleToggle />`, `<ThemeToggle />`, and the auth action (avatar menu when signed in, "Sign in" CTA when signed out, fixed-width placeholder while auth is loading). All right-region controls SHALL be 36 px tall and visually align on the same baseline. The auth-state placeholder SHALL have the same rendered width as the signed-in avatar menu so layout does not shift when auth resolves.

#### Scenario: NavBar regions render in the correct order

- **GIVEN** an authenticated user visits the homepage
- **THEN** the NavBar children in DOM order MUST be: brand, primary nav, locale toggle, theme toggle, avatar menu
- **AND** primary nav MUST be centered within its grid cell

#### Scenario: Loading state does not shift layout

- **GIVEN** the auth status is still loading
- **THEN** the auth action SHALL render a placeholder with the same width as the signed-in avatar menu
- **AND** the navbar layout MUST NOT shift when auth resolves

#### Scenario: Active route link is visually distinguished

- **GIVEN** the user is currently on `/about`
- **THEN** the "About" link MUST display the active-route style (filled text color plus a 2 px accent-purple underline)
- **AND** all other links MUST display the muted style


<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
-->

---
### Requirement: Footer surfaces version and a single attribution row

The Footer SHALL render inside a container with the same `max-width` as the NavBar (1152 px / `max-w-6xl`) and matching horizontal padding. The footer SHALL display the build version sourced from `VELLUM_VERSION` together with the brand attribution on a single row at `md` and above; below `md` the row wraps as needed. Footer text and links SHALL consume `--text-muted` for body color and `--accent-purple` on hover. Footer SHALL NOT hard-code colors.

#### Scenario: Footer dark theme

- **GIVEN** `data-theme="dark"` is active
- **THEN** Footer text MUST resolve to the dark-theme `--text-muted` token value
- **AND** Footer hover MUST resolve to the dark-theme `--accent-purple` token value

#### Scenario: Footer container matches Navbar width

- **GIVEN** the same browser viewport at 1280 px
- **THEN** the Footer container measured from page edge MUST equal the NavBar container width (±0 px)


<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
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

---
### Requirement: All non-canvas pages share the same outer container width

Every page rendered under `PublicLayout` or `AppLayout` SHALL place its content inside a container with `max-width: var(--container-max)` (1152 px / `max-w-6xl`) and horizontal padding of `var(--container-px-md)` (32 px) on screens at or above the `md` breakpoint and `var(--container-px-sm)` (24 px) below. Long-form prose (e.g., `/about` body copy) MAY apply a narrower inner `max-width` for readability, but the outer container width SHALL remain consistent across routes.

#### Scenario: HomePage, AboutPage, DashboardPage share container width

- **GIVEN** the same browser viewport at 1280 px wide
- **WHEN** the user navigates between `/`, `/about`, and `/dashboard`
- **THEN** the outer container measured from page edge to first content gutter MUST be identical on all three routes (±0 px)

#### Scenario: AboutPage body prose remains narrow within wide container

- **GIVEN** the `/about` route is rendered in a 1280 px viewport
- **THEN** the outer container MUST be 1152 px wide
- **AND** the body paragraph MUST clamp its own width to approximately 640 px for reading comfort
- **AND** that prose block MUST sit centered inside the outer container


<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
-->

---
### Requirement: HomePage feature cards use the elevated Card primitive

The three feature cards on the homepage SHALL use the shared `<Card variant="elevated">` primitive. They SHALL display a hover ring in `--accent-purple` when the pointer enters, with a transition no longer than 200 ms. The card layout SHALL remain a three-column grid at `md` and above, collapsing to a single column below `md`.

#### Scenario: Feature card hover ring

- **GIVEN** the homepage rendered at 1280 px viewport
- **WHEN** the pointer hovers a feature card
- **THEN** the card MUST display a 2 px ring in the active theme's `--accent-purple`
- **AND** the ring MUST disappear when the pointer leaves


<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
-->

---
### Requirement: Public pages consume the Aura token palette via CSS variables

All public-page surfaces (HomePage, AboutPage, NavBar, Footer) SHALL consume background, text, border, and accent colors through the CSS custom properties declared in `apps/web/src/styles.css` (`--bg`, `--surface`, `--surface-elevated`, `--border`, `--text-primary`, `--text-muted`, `--accent-purple`, `--accent-cyan`, `--accent-pink`, `--accent-orange`, `--accent-red`). They SHALL NOT reference the legacy brand tokens (`--color-ink-navy`, `--color-warm-sepia`, `--color-parchment-cream`, `--color-off-white`) directly; transitional aliases MAY exist in `styles.css` only during the implementation window and MUST be removed before the change is archived.

#### Scenario: Grep finds no legacy token usage in public-page components after archive

- **GIVEN** the change is ready to archive
- **WHEN** `apps/web/src/landing/**/*.tsx` is grepped for `ink-navy|warm-sepia|parchment-cream|off-white`
- **THEN** zero matches MUST be returned


<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
-->

---
### Requirement: DashboardPage uses a two-column layout with greeting strip, sidebar, and canvas grid

The `/dashboard` route SHALL render three regions inside the unified `max-w-6xl` container:

1. **Greeting strip** at the top: localised date label, "歡迎/Welcome" headline with the user's display name, a search input (placeholder `搜尋畫布⋯` / `Search canvases…`, lucide `Search` icon prefix), and a primary "新畫布 / New canvas" CTA with a lucide `Plus` icon.
2. **Left sidebar** (220 px fixed width at `md` and above; collapses above the grid below `md`): folder list (sentinel rows `全部畫布` / `共享` / `封存` plus user-created folders), optional tag chips, and a sort-order toggle exposing `最近編輯 / Recent` and `字母排序 / Alphabetical` ghost buttons.
3. **Right canvas grid** rendering `<Card variant="hover-ring">` thumbnails in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). Each card MUST show a 16:10 thumbnail area, a role badge (`owner` purple / `editor` cyan / `viewer` muted), the canvas title, and a relative last-edited timestamp rendered in `font-mono`.

The page SHALL NOT render any subscription / "Upgrade" CTA. Vellum does not offer a paid plan; that section of the design is intentionally left blank or replaced with a Phase milestone badge.

#### Scenario: Greeting strip exposes search, primary CTA, and welcome line

- **GIVEN** the `/dashboard` route is rendered for an authenticated user named "沛緹"
- **THEN** the greeting region MUST contain (a) today's localised date, (b) a welcome line including the user's display name, (c) a search `<input>` with the lucide `Search` icon, (d) a primary button labelled `新畫布 / New canvas`

#### Scenario: Sidebar folder active state uses accent-purple-soft

- **GIVEN** the user selects a folder named `工作中`
- **THEN** that folder row MUST render with `--accent-purple-soft` (or equivalent `bg-accent-purple/10`) background and `--accent-purple` text
- **AND** other folder rows MUST render with the muted text-primary styling

#### Scenario: Sort order persists across page reload

- **WHEN** the user clicks the `字母排序 / Alphabetical` sort button
- **THEN** the canvas grid MUST re-order alphabetically by title (case-insensitive)
- **AND** `localStorage.getItem("vellum.dashboard.sortOrder")` MUST equal `"alphabetical"`
- **AND** reloading the page MUST keep the alphabetical order without an additional click

#### Scenario: Search filters the canvas grid in place

- **GIVEN** the user has 8 canvases including one titled "電商訂單處理流程"
- **WHEN** the user types `電商` into the search input
- **THEN** the canvas grid MUST render only canvases whose title contains `電商` (case-insensitive)
- **AND** clearing the input MUST restore the full grid without a network refetch

#### Scenario: No subscription/upgrade callout is rendered

- **GIVEN** the `/dashboard` route is rendered
- **THEN** the DOM MUST NOT contain text matching `升級 / Upgrade / Studio / Pro`
- **AND** the sidebar MUST NOT contain a paid-plan promotional card

<!-- @trace
source: redesign-ui-aura-theme
updated: 2026-05-13
code:
  - apps/web/src/account/SessionsTab.tsx
  - apps/web/src/components/ui/Card.tsx
  - apps/web/src/agent/TokenUsageFooter.tsx
  - docs/design/aura-redesign/project/auth-frames.jsx
  - packages/shared/src/index.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/components/FolderRenameDialog.tsx
  - apps/web/src/agent/AiSidePanel.tsx
  - docs/design/aura-redesign/project/tokens.css
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/components/ui/Badge.tsx
  - apps/web/src/dashboard/CanvasGrid.tsx
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/web/src/canvas/CollaboratorCursorWithBadge.tsx
  - apps/web/src/chrome/MainMenu.tsx
  - asset/claude.png
  - apps/web/src/assets/providers/chatgpt.png
  - apps/web/src/components/CanvasRenameDialog.tsx
  - apps/web/src/account/ApiKeyRow.tsx
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - asset/anthropic.png
  - apps/web/src/agent/ThreadSwitcher.tsx
  - docs/design/aura-redesign/project/public-frames.jsx
  - apps/web/src/dashboard/DashboardGreeting.tsx
  - apps/web/src/account/legacy-redirects.tsx
  - apps/web/src/agent/ChatList.tsx
  - apps/web/src/components/CanvasMoveDialog.tsx
  - apps/web/src/assets/providers/claude.png
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/web/src/dashboard/SortToggle.tsx
  - apps/web/src/theme/useTheme.ts
  - apps/web/src/components/ui/Input.tsx
  - apps/web/src/main.tsx
  - apps/web/src/account/ProfileTab.tsx
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/web/src/account/PatTokensSection.tsx
  - apps/web/src/theme/ThemeToggle.tsx
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/package.json
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/src/landing/Footer.tsx
  - apps/web/src/account/AccountPage.tsx
  - apps/web/src/components/UserAvatarMenu.tsx
  - apps/web/src/account/ApiKeysPage.tsx
  - apps/web/src/landing/HomePage.tsx
  - apps/api/package.json
  - docs/design/aura-redesign/project/spec-frames.jsx
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/landing/AppLayout.tsx
  - apps/web/src/account/Tabs.tsx
  - apps/web/src/store/uiStore.ts
  - asset/gemini.png
  - apps/web/src/canvas/VellumToolbar.tsx
  - docs/design/aura-redesign/project/design-canvas.jsx
  - apps/web/src/account/ApiKeysTab.tsx
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/router.tsx
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/src/account/ProfilePage.tsx
  - apps/web/src/i18n/LocaleToggle.tsx
  - docs/design/aura-redesign/project/Vellum Redesign.html
  - packages/shared/src/locales/en.json
  - package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/styles.css
  - docs/design/aura-redesign/project/components.jsx
  - apps/web/src/dashboard/DashboardSidebar.tsx
  - asset/openai.png
  - bun.lock
  - docs/design/aura-redesign/README.md
  - apps/web/src/components/CanvasCard.tsx
  - apps/web/src/assets/providers/anthropic.png
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/dashboard/useSortOrder.ts
  - apps/web/src/agent/ChatComposer.tsx
  - asset/google.png
  - apps/web/src/assets/providers/google.png
  - docs/design/aura-redesign/chats/chat1.md
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/landing/PublicLayout.tsx
  - apps/web/src/theme/bootstrap-theme.ts
  - apps/web/src/components/ui/Button.tsx
  - apps/web/src/landing/AboutPage.tsx
  - apps/web/src/account/PricingTab.tsx
  - apps/web/src/theme/theme-provider.tsx
  - apps/web/src/landing/Navbar.tsx
  - docs/design/aura-redesign/project/icons.jsx
  - docs/PHASE2_MILESTONES.md
  - apps/web/src/assets/providers/gemini.png
  - packages/shared/package.json
  - apps/web/src/assets/providers/openai.png
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/components/UserAvatar.tsx
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ApiKeysPricingTable.tsx
tests:
  - apps/web/src/dashboard/DashboardGreeting.test.tsx
  - apps/web/src/store/uiStore.test.ts
  - apps/web/src/theme/useTheme.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/web/src/dashboard/useSortOrder.test.ts
  - apps/web/src/main.test.ts
  - apps/web/src/theme/ThemeToggle.test.tsx
  - apps/web/src/account/legacy-redirects.test.tsx
  - apps/web/src/components/ui/Card.motion.test.tsx
  - apps/web/src/account/ApiKeyRow.test.tsx
  - apps/web/src/account/SessionsTab.test.tsx
  - apps/web/src/landing/AppLayout.test.tsx
  - apps/web/src/__audits__/no-legacy-tokens.test.ts
  - apps/web/src/components/UserAvatarMenu.test.tsx
  - apps/web/src/i18n/LocaleToggle.test.tsx
  - apps/web/src/account/Tabs.test.tsx
  - apps/web/src/account/PatTokensSection.test.tsx
  - apps/web/src/components/ui/Badge.test.tsx
  - apps/web/src/account/ApiKeysPage.test.tsx
  - apps/web/src/dashboard/DashboardSidebar.test.tsx
  - apps/web/src/account/ProfileTab.test.tsx
  - apps/web/src/components/ui/Card.test.tsx
  - apps/web/src/styles.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/web/src/dashboard/SortToggle.test.tsx
  - apps/web/src/dashboard/DashboardPage.dialog.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/web/src/components/ui/Button.test.tsx
  - apps/web/src/landing/HomePage.test.tsx
  - apps/web/src/account/AccountPage.test.tsx
  - apps/web/src/landing/PublicLayout.test.tsx
  - apps/web/src/theme/bootstrap-theme.test.ts
  - apps/web/src/theme/theme-provider.test.tsx
  - apps/web/src/account/ApiKeysTab.test.tsx
  - apps/web/src/dashboard/CanvasGrid.test.tsx
  - apps/web/src/landing/Navbar.test.tsx
  - apps/web/src/account/PricingTab.test.tsx
  - apps/web/src/components/ui/Input.test.tsx
-->