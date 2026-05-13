# motion-system Specification

## Purpose

TBD - created by archiving change 'add-landing-and-branding'. Update Purpose after archive.

## Requirements

### Requirement: Motion library dependency is installed and importable

The system SHALL ensure the `motion` npm package is installed in the `apps/web` workspace and is importable from any module under `apps/web/src/`. The lockfile MUST record an exact resolved version. MagicUI and Animate UI components are NOT npm dependencies of this milestone — those component libraries follow a copy-into-source distribution model (shadcn CLI) and are deferred to a later change once the shadcn registry is wired into this repo.

#### Scenario: motion library is importable

- **WHEN** any module under `apps/web/src/` imports a default or named export from `motion`
- **THEN** the bundler MUST resolve the import without error during type checking and during the production build


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
### Requirement: System provides four reusable motion primitives

The system SHALL expose four React component primitives from `apps/web/src/motion/primitives.tsx` for declarative entrance and stagger animations: `<FadeIn>`, `<SlideIn>`, `<ScaleIn>`, and `<StaggerContainer>`. Each primitive MUST forward its `children` prop to the rendered output. Each primitive MUST accept optional configuration props for delay (in milliseconds) and duration (in milliseconds). The `<SlideIn>` primitive MUST accept a `from` prop with the value `"left"`, `"right"`, `"top"`, or `"bottom"`. The `<StaggerContainer>` primitive MUST stagger child entrance animations by a configurable interval (in milliseconds) defaulting to 80ms.

#### Scenario: FadeIn animates child opacity from 0 to 1

- **WHEN** a component renders `<FadeIn>` wrapping any child element
- **THEN** the wrapped element MUST start at `opacity: 0` on mount
- **AND** transition to `opacity: 1` within the configured duration (default 300ms)

#### Scenario: SlideIn translates from the configured direction

- **WHEN** a component renders `<SlideIn from="left">` wrapping a child
- **THEN** the wrapped element MUST start with a non-zero negative `translateX` offset
- **AND** transition to `translateX: 0` within the configured duration

#### Scenario: StaggerContainer cascades child entrances

- **WHEN** a component renders `<StaggerContainer staggerMs={100}>` wrapping three direct child `<FadeIn>` elements
- **THEN** child 1 MUST start its animation at t=0
- **AND** child 2 MUST start its animation at t=100ms
- **AND** child 3 MUST start its animation at t=200ms

##### Example: stagger interval table

| staggerMs | Child 1 start | Child 2 start | Child 3 start |
| --------- | ------------- | ------------- | ------------- |
| 80 (default) | 0ms | 80ms | 160ms |
| 100 | 0ms | 100ms | 200ms |
| 200 | 0ms | 200ms | 400ms |


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
### Requirement: All motion primitives respect prefers-reduced-motion

The system SHALL detect the operating-system preference `prefers-reduced-motion: reduce` on every motion primitive render. When the preference is active, the primitive MUST disable the animation by setting effective duration to 0 and skipping the initial transform offset. The detection mechanism MUST use a runtime hook (motion library's `useReducedMotion` or equivalent) so changes to the OS setting at runtime take effect without page reload.

#### Scenario: Reduced-motion user sees instant render with no transition

- **WHEN** the OS reports `prefers-reduced-motion: reduce` is true at the moment a `<FadeIn>` mounts
- **THEN** the wrapped element MUST appear at `opacity: 1` from the first paint frame
- **AND** the rendered element MUST NOT have any non-zero CSS transition duration applied

#### Scenario: Reduced-motion preference toggling at runtime takes effect

- **WHEN** the OS preference changes from `no-preference` to `reduce` while a page with motion primitives is mounted
- **THEN** subsequent primitive mounts on the same page MUST honor the new preference without a page reload


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
### Requirement: Motion is allowed only on listed surfaces

The system SHALL allow motion primitives and any direct `motion` library imports to be rendered only on the following surfaces: the Homepage hero and feature sections, the About page, dialog enter and exit transitions (ShareDialog, CanvasRenameDialog, FolderDeleteDialog, MainMenu DeleteConfirmDialog), the Dashboard list rendering (canvas and folder cards), toast notifications, sidebar slide transitions, empty states, and loading indicators. The system MUST NOT import any motion primitive or `motion` library symbol into the canvas-editor module (`apps/web/src/canvas/Editor.tsx` and any module imported transitively by `Editor.tsx` for the purpose of rendering inside the tldraw canvas surface) or into any module that renders multiplayer cursor or presence indicators.

#### Scenario: Editor.tsx contains no motion imports

- **WHEN** the static imports of `apps/web/src/canvas/Editor.tsx` are inspected
- **THEN** none of the import paths MUST resolve to `motion` or `apps/web/src/motion/primitives.tsx`

#### Scenario: Multiplayer cursor module contains no motion imports

- **WHEN** the static imports of `apps/web/src/canvas/CollaboratorAvatars.tsx` and any future module rendering multiplayer cursor or presence indicators are inspected
- **THEN** none of the import paths MUST resolve to `motion` or `apps/web/src/motion/primitives.tsx`

##### Example: allowed vs forbidden surface mapping

| Surface | Motion allowed? |
| ------- | --------------- |
| Homepage hero | yes |
| About page section | yes |
| Dashboard canvas list | yes |
| ShareDialog enter / exit | yes |
| Toast | yes |
| Sidebar slide | yes |
| Loading spinner | yes |
| Empty state | yes |
| tldraw canvas inner surface | no |
| Multiplayer cursor / presence | no |
| Tool toolbar inside canvas | no |


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
### Requirement: Existing dialogs receive enter and exit motion

The system SHALL apply enter and exit motion transitions to the following existing dialog components: `ShareDialog` (`apps/web/src/canvas/ShareDialog.tsx`), `CanvasRenameDialog` (`apps/web/src/components/CanvasRenameDialog.tsx`), `FolderDeleteDialog` (`apps/web/src/components/FolderDeleteDialog.tsx`), and the inline `DeleteConfirmDialog` defined inside `MainMenu` (`apps/web/src/chrome/MainMenu.tsx`). The transition MUST combine an opacity fade (0 → 1 on enter, 1 → 0 on exit) with a scale transform (0.95 → 1 on enter, 1 → 0.95 on exit). The transition duration MUST be 180 milliseconds when the user has not requested reduced motion, and 0 milliseconds when the user has requested reduced motion.

#### Scenario: Dialog mounts with fade-and-scale enter

- **WHEN** any of the four listed dialogs transitions from closed to open
- **THEN** the dialog overlay's first frame MUST have `opacity: 0` and a `scale` of approximately 0.95
- **AND** the dialog MUST reach `opacity: 1` and `scale: 1` within 180 milliseconds (or instantly under reduced motion)

#### Scenario: Dialog unmounts with fade-and-scale exit

- **WHEN** any of the four listed dialogs transitions from open to closed
- **THEN** the dialog MUST animate from `opacity: 1, scale: 1` toward `opacity: 0, scale: 0.95` before unmounting
- **AND** the unmount MUST complete within 180 milliseconds (or instantly under reduced motion)


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
### Requirement: Dashboard list applies stagger entrance on mount

The system SHALL animate the entrance of canvas and folder cards on the Dashboard list using `<StaggerContainer>` wrapping `<FadeIn>` per card. The stagger MUST use the default interval (80 milliseconds). The stagger MUST run only on initial list mount, not on subsequent updates within the same session (e.g., when a new canvas is created, the new card MAY animate in but existing cards MUST NOT re-animate).

#### Scenario: First render of dashboard list staggers cards

- **WHEN** an authenticated visitor first navigates to `/dashboard` and the canvas list contains three or more cards
- **THEN** the first card MUST start animating at t=0
- **AND** each subsequent card MUST start animating 80 milliseconds after the previous card

#### Scenario: Re-rendering the dashboard list does not re-stagger existing cards

- **WHEN** a new canvas is created and the list re-renders to include the new card
- **THEN** the existing cards MUST NOT re-trigger their entrance animation
- **AND** the new card MAY animate in independently

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
### Requirement: Card hover-ring transition is bounded and respects reduced-motion

The `<Card>` primitive's `hover-ring` variant SHALL apply a 2 px ring in `--accent-purple` on pointer hover. The ring SHALL appear and disappear via a CSS transition no longer than 200 ms (`transition-shadow duration-150`). When `prefers-reduced-motion: reduce` is active, the transition duration SHALL collapse to `0ms` and the ring SHALL toggle instantly on hover.

#### Scenario: Card hover ring transitions within 200 ms by default

- **GIVEN** the user has no reduced-motion preference
- **AND** the homepage feature card is hovered
- **THEN** the ring MUST animate in over a duration ≤ 200 ms
- **AND** removing the pointer MUST reverse the transition within ≤ 200 ms

#### Scenario: Reduced-motion users see instant hover ring

- **GIVEN** the user has `prefers-reduced-motion: reduce`
- **WHEN** the user hovers a `hover-ring` card
- **THEN** the ring MUST appear with no perceptible animation (computed transition-duration `0s`)


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
### Requirement: Theme switching is instant with no animation

The system SHALL switch between light and dark themes without any CSS transition on background, text, or border properties at the document root. Theme switching is intentionally non-animated because partial-frame transitions look worse than an instant cut.

#### Scenario: Toggling theme does not animate root colors

- **GIVEN** the user clicks the theme toggle in the navbar
- **THEN** the `<html>` element MUST NOT have any `transition` property that includes `background-color`, `color`, or `border-color`
- **AND** the first frame after the toggle MUST already display the target theme's tokens

#### Scenario: Component-level transitions still run on theme switch

- **GIVEN** a button is currently hovered while the user toggles the theme
- **THEN** the document MUST swap themes instantly
- **AND** the button's own hover-state transition MUST continue running normally (button transitions are not suppressed by the root-level no-transition rule)

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