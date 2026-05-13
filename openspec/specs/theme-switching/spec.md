# theme-switching Specification

## Purpose

TBD - created by archiving change 'redesign-ui-aura-theme'. Update Purpose after archive.

## Requirements

### Requirement: System-aware theme mode with persisted user preference

The system SHALL expose three theme modes: `system`, `light`, `dark`. The default on first visit SHALL be `system`. The user's explicit choice (light or dark) SHALL be persisted in `localStorage` under the key `vellum.theme`. The system mode SHALL resolve to `light` or `dark` by reading `window.matchMedia('(prefers-color-scheme: dark)')` at runtime, and SHALL update reactively when the operating-system preference changes (only while the mode is `system`).

#### Scenario: First-visit default is system mode

- **GIVEN** a fresh browser with no `vellum.theme` localStorage entry
- **WHEN** the user opens any Vellum page
- **THEN** the effective theme MUST match `prefers-color-scheme`
- **AND** the `localStorage.getItem('vellum.theme')` value MUST be absent (no write before user action)

#### Scenario: User picks light explicitly

- **WHEN** the user toggles theme through the navbar control until light is active
- **THEN** `localStorage.getItem('vellum.theme')` MUST equal `light`
- **AND** subsequent loads MUST stay light even when OS preference is dark

#### Scenario: System mode reacts to OS preference change

- **GIVEN** the user has chosen `system` mode
- **AND** the OS preference is currently light
- **WHEN** the OS preference changes to dark while the page is open
- **THEN** the document MUST switch to dark theme without a page reload

#### Scenario: Explicit mode ignores OS preference change

- **GIVEN** the user has chosen `light` mode explicitly
- **WHEN** the OS preference changes to dark while the page is open
- **THEN** the document MUST stay in light theme


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
### Requirement: Document theme is applied before React mount

The system SHALL set the `data-theme` attribute on `document.documentElement` before React renders its first frame so the initial paint matches the resolved theme. The initial application SHALL run as the first synchronous statement of `apps/web/src/main.tsx` (or imported as its first import), reading from localStorage and `matchMedia` synchronously.

#### Scenario: No theme flicker on cold load

- **GIVEN** a user whose `vellum.theme` is `dark`
- **WHEN** the user reloads the page on a fast network
- **THEN** the page MUST NOT display the light background at any point during initial paint


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
### Requirement: Theme tokens are CSS custom properties switched by data-theme

All color, surface, border, and text tokens SHALL be declared as CSS custom properties scoped to `:root[data-theme="light"]` and `:root[data-theme="dark"]`. Components SHALL consume tokens through Tailwind utility classes that resolve via `@theme inline` to those custom properties. Components SHALL NOT hard-code hex values, and SHALL NOT use Tailwind's `dark:` variant for theme switching.

#### Scenario: A primitive renders both themes from the same JSX

- **GIVEN** the `<Card variant="elevated">` primitive
- **WHEN** the same component is rendered under `data-theme="light"` and `data-theme="dark"`
- **THEN** the background color MUST be the value of `--surface-elevated` for the active theme
- **AND** the React tree MUST be byte-identical (no conditional className branching on theme)


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
### Requirement: Theme toggle is reachable from the navbar

The system SHALL present a single icon button in the navbar's right region that cycles theme mode in the order `system → light → dark → system`. The icon SHALL reflect the active mode (`Monitor` for system, `Sun` for light, `Moon` for dark). The button SHALL be available on every public and authenticated page that renders the navbar.

#### Scenario: Cycling through modes

- **GIVEN** the theme toggle showing the `Sun` icon (light mode)
- **WHEN** the user clicks the toggle once
- **THEN** the icon MUST change to `Moon`
- **AND** the document `data-theme` MUST equal `dark`

#### Scenario: Toggle has accessible label

- **THEN** the toggle MUST have a translated `aria-label` whose value reflects the current mode (e.g. "Switch theme — current: dark")
- **AND** the `aria-label` MUST update when the mode cycles

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