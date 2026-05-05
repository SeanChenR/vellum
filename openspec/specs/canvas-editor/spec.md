# canvas-editor Specification

## Purpose

TBD - created by archiving change 'add-canvas-editor-shell'. Update Purpose after archive.

## Requirements

### Requirement: Canvas editor route renders Vellum chrome around tldraw

The system SHALL serve an authenticated route at `/canvas/:id` that renders a Vellum-branded editor surface composed of (a) a custom top bar, (b) a custom main menu, and (c) the tldraw `<Tldraw>` component with its built-in side and bottom toolbars, transform handles, undo/redo, and keyboard shortcuts intact. The system SHALL NOT render tldraw's default top panel, default main menu, or default share panel.

#### Scenario: Authenticated user opens an existing canvas

- **WHEN** an authenticated user navigates to `/canvas/<existing-id>` for a canvas they own or have edit access to
- **THEN** the system renders the Vellum `TopBar` at the top of the viewport, the tldraw canvas filling the remaining space, and the Vellum `MainMenu` accessible from the TopBar
- **AND** tldraw's default top panel, default share panel, and default main menu MUST NOT appear

#### Scenario: tldraw built-in tools remain operational

- **WHEN** the editor is mounted
- **THEN** the user MUST be able to select tldraw built-in tools (select, pencil, rectangle, ellipse, arrow, sticky, text), apply transforms, undo/redo with Ctrl+Z / Ctrl+Shift+Z, and use tldraw keyboard shortcuts unchanged

#### Scenario: tldraw watermark remains visible in phase 1

- **WHEN** the editor is mounted
- **THEN** the tldraw watermark element rendered by the SDK MUST remain visible (phase 1 free-license compliance)


<!-- @trace
source: add-canvas-editor-shell
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasRenameDialog.tsx
  - packages/shared/src/index.ts
  - packages/shared/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/main.tsx
  - package.json
  - apps/api/src/index.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/.env.example
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - scripts/dev.ts
  - apps/web/src/components/CanvasCard.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/api/package.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/chrome/index.tsx
  - apps/api/src/folder/index.ts
  - packages/shared/src/shape-types.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - scripts/dev-proxy.ts
  - apps/api/src/lib/permission.ts
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/api/src/email/mailpit.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/auth/useAuth.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - apps/web/src/dashboard/useFolderList.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/router.tsx
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/api/src/db/schema.ts
  - apps/web/src/canvas/persistence.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/canvas/index.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/auth/config.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/canvas/Editor.tsx
  - docker-compose.yml
tests:
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/router.test.tsx
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - e2e/account-delete.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/api/src/auth/magic-link.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/account/profile.test.ts
-->

---
### Requirement: TopBar exposes canvas title, folder breadcrumb, share placeholder, and user menu

The TopBar component SHALL display, from left to right: the Vellum logo, a folder breadcrumb showing the canvas's parent folder name (or a localized "My canvases" label when the canvas has no folder), the canvas title (clickable to open a rename dialog), a Share button (visible only to the canvas owner) that opens the share dialog defined by the `sharing` capability, the multiplayer presence collaborator avatars, the sync connection indicator, and a user menu showing the signed-in user's avatar with a sign-out item. The previous Phase 1 placeholder behaviour where Share displayed `canvas.chrome.topbar.sharePlaceholderToast` is superseded — that toast key is no longer referenced. When the local user has read-only access (the multiplayer-sync handshake resolved a viewer role), the TopBar SHALL also display a "View only" badge using the localized key `canvas.chrome.topbar.viewOnlyBadge`.

#### Scenario: Canvas with a parent folder

- **WHEN** the loaded canvas has a non-null `folder.name`
- **THEN** the breadcrumb element MUST display that folder name as a non-interactive label

#### Scenario: Canvas without a parent folder

- **WHEN** the loaded canvas has a null `folder` value
- **THEN** the breadcrumb element MUST display the localized string keyed `canvas.chrome.topbar.breadcrumb.myCanvases`

#### Scenario: Share button opens the share dialog for the owner

- **WHEN** the canvas owner clicks the Share button in the TopBar
- **THEN** the system MUST open the `ShareDialog` modal as defined in the `sharing` capability
- **AND** the system MUST NOT display the legacy `canvas.chrome.topbar.sharePlaceholderToast` toast

#### Scenario: Share button is hidden for non-owners

- **GIVEN** the local user is a shared editor, shared viewer, or anonymous public-link visitor (i.e., not the canvas owner)
- **WHEN** the TopBar is rendered
- **THEN** the Share button MUST NOT be present in the DOM

#### Scenario: Read-only badge appears for viewer role

- **GIVEN** the multiplayer-sync handshake resolved the local user's role as `viewer`
- **WHEN** the TopBar is rendered
- **THEN** a "View only" badge MUST be visible whose label comes from the localized key `canvas.chrome.topbar.viewOnlyBadge`

#### Scenario: Title click opens a rename dialog

- **WHEN** the user clicks the canvas title element
- **THEN** the system MUST open a modal rename dialog with focus trapped on a text input pre-filled with the current title
- **AND** pressing Escape or clicking the dialog's cancel button MUST close the dialog without invoking any rename mutation
- **AND** submitting a non-empty new value via Enter or the confirm button MUST invoke the rename mutation supplied by the canvas data layer and close the dialog on success


<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu

The MainMenu component SHALL expose four top-level items: Rename, Duplicate, Delete, and Export. Rename, Duplicate, and Delete SHALL invoke mutations supplied by the canvas data layer. Export SHALL be a submenu containing four items — PNG, SVG, PDF, and JSON — each wired to the export pipeline defined by the canvas-export capability. The PNG and PDF items SHALL each open a nested submenu offering 1×, 2×, and 4× scale factors; the SVG and JSON items SHALL trigger their export action directly. The Export submenu trigger SHALL be rendered only when the editor session is not read-only; for read-only sessions, the entire Export submenu (including its trigger) SHALL NOT be rendered.

#### Scenario: User opens the main menu

- **WHEN** the user activates the main menu trigger
- **THEN** the dropdown MUST render with four items in this order: Rename, Duplicate, Delete, Export — except that Export MUST be omitted when the session is read-only

#### Scenario: User selects Rename

- **WHEN** the user activates the Rename item
- **THEN** the system MUST open the same rename dialog described in the TopBar requirement

#### Scenario: User selects Duplicate

- **WHEN** the user activates the Duplicate item
- **THEN** the system MUST invoke the duplicate mutation supplied by the canvas data layer with the current canvas id

#### Scenario: User selects Delete

- **WHEN** the user activates the Delete item
- **THEN** the system MUST open a confirmation dialog whose confirm button invokes the delete mutation
- **AND** dismissing the confirmation MUST NOT invoke the delete mutation

#### Scenario: Editor user opens the Export submenu

- **WHEN** an editor or owner hovers or activates the Export item
- **THEN** the submenu MUST render four items in this order: PNG, SVG, PDF, JSON
- **AND** the PNG and PDF items MUST each surface a nested submenu of 1×, 2×, and 4× scale factors
- **AND** all four items MUST be in an enabled (interactive) state

#### Scenario: Read-only viewer opens the main menu

- **WHEN** a session whose `isReadOnly` flag is true activates the main menu trigger
- **THEN** the dropdown MUST NOT render the Export submenu trigger
- **AND** keyboard tab navigation MUST NOT visit any export-related element


<!-- @trace
source: add-export
updated: 2026-05-05
code:
  - apps/web/src/canvas/export/export-canvas.ts
  - apps/web/src/canvas/export/slugify.ts
  - bun.lock
  - packages/shared/src/locales/zh-TW.json
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
  - apps/web/src/chrome/index.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/MainMenu.tsx
tests:
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/canvas/export/slugify.test.ts
  - apps/web/src/canvas/export/export-canvas.test.ts
-->

---
### Requirement: Single-page document and custom shape registry are wired at the integration point

The Editor SHALL pass `customShapeUtils` and `customShapeTools` from `packages/shared/src/shape-types.ts` to the tldraw component. The Editor SHALL configure tldraw to a single-page document. In this change, `customShapeUtils` and `customShapeTools` SHALL each be exported as empty arrays.

#### Scenario: customShapeUtils is the integration extension point

- **WHEN** any subsequent change appends a `ShapeUtil` to the `customShapeUtils` array exported by `packages/shared/src/shape-types.ts`
- **THEN** that shape MUST become available in the editor without modifying the Editor component

#### Scenario: tldraw multi-page is disabled

- **WHEN** the Editor is mounted
- **THEN** the rendered tldraw instance MUST NOT expose multi-page UI affordances (page tabs, add-page button)


<!-- @trace
source: add-canvas-editor-shell
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasRenameDialog.tsx
  - packages/shared/src/index.ts
  - packages/shared/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/main.tsx
  - package.json
  - apps/api/src/index.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/.env.example
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - scripts/dev.ts
  - apps/web/src/components/CanvasCard.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/api/package.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/chrome/index.tsx
  - apps/api/src/folder/index.ts
  - packages/shared/src/shape-types.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - scripts/dev-proxy.ts
  - apps/api/src/lib/permission.ts
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/api/src/email/mailpit.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/auth/useAuth.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - apps/web/src/dashboard/useFolderList.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/router.tsx
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/api/src/db/schema.ts
  - apps/web/src/canvas/persistence.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/canvas/index.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/auth/config.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/canvas/Editor.tsx
  - docker-compose.yml
tests:
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/router.test.tsx
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - e2e/account-delete.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/api/src/auth/magic-link.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/account/profile.test.ts
-->

---
### Requirement: All chrome strings are localized in zh-TW and en

Every user-facing string rendered by the TopBar, MainMenu, rename dialog, delete confirmation, persistence toasts, and Share placeholder toast SHALL be sourced from the i18n catalog under the `canvas.chrome.*` and `canvas.title.*` namespaces. Both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json` SHALL contain identical key sets after this change.

#### Scenario: Locale catalogs cover every chrome key in both languages

- **WHEN** an automated check enumerates the keys under `canvas.chrome.*` and `canvas.title.*` in zh-TW.json and en.json after this change is applied
- **THEN** the two key sets MUST be identical (no key present in only one language)

#### Scenario: No chrome component contains a hardcoded display string

- **WHEN** any chrome source file (`apps/web/src/chrome/*.tsx`, `apps/web/src/canvas/CanvasPage.tsx`, `apps/web/src/canvas/Editor.tsx`) is inspected
- **THEN** every user-facing string literal rendered to the DOM MUST come from a `t(...)` call or a JSX child resolved from `t(...)`, and MUST NOT be a raw quoted string literal in JSX text or attribute values such as `aria-label`, `title`, or `placeholder`


<!-- @trace
source: add-canvas-editor-shell
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasRenameDialog.tsx
  - packages/shared/src/index.ts
  - packages/shared/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/main.tsx
  - package.json
  - apps/api/src/index.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/.env.example
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - scripts/dev.ts
  - apps/web/src/components/CanvasCard.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/api/package.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/chrome/index.tsx
  - apps/api/src/folder/index.ts
  - packages/shared/src/shape-types.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - scripts/dev-proxy.ts
  - apps/api/src/lib/permission.ts
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/api/src/email/mailpit.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/auth/useAuth.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - apps/web/src/dashboard/useFolderList.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/router.tsx
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/api/src/db/schema.ts
  - apps/web/src/canvas/persistence.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/canvas/index.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/auth/config.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/canvas/Editor.tsx
  - docker-compose.yml
tests:
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/router.test.tsx
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - e2e/account-delete.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/api/src/auth/magic-link.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/account/profile.test.ts
-->

---
### Requirement: Chrome animations use motion; canvas region uses none

Animations on the MainMenu dropdown, the rename dialog enter/exit, the delete confirmation dialog enter/exit, and the Share placeholder toast SHALL be implemented using the shared `motion` library (Animate UI level). No animation library SHALL wrap or be applied to the tldraw canvas region.

#### Scenario: MainMenu dropdown animates on open and close

- **WHEN** the user opens or closes the main menu dropdown
- **THEN** the dropdown MUST animate via `motion`-driven enter/exit transitions

#### Scenario: Canvas region has no app-level animation wrapper

- **WHEN** the Editor is rendered
- **THEN** the JSX subtree containing `<Tldraw>` MUST NOT be wrapped in `motion`, `AnimatePresence`, or any equivalent animation-wrapping component

<!-- @trace
source: add-canvas-editor-shell
updated: 2026-04-29
code:
  - apps/web/src/components/CanvasRenameDialog.tsx
  - packages/shared/src/index.ts
  - packages/shared/package.json
  - apps/web/src/components/FolderDeleteDialog.tsx
  - apps/web/src/account/ProfilePage.tsx
  - .spectra.yaml
  - apps/api/src/auth/route-guard.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/web/src/main.tsx
  - package.json
  - apps/api/src/index.ts
  - apps/api/drizzle/0001_new_shinko_yamashiro.sql
  - apps/api/.env.example
  - apps/web/src/components/FolderRenameDialog.tsx
  - bun.lock
  - apps/api/drizzle/0000_hesitant_night_nurse.sql
  - scripts/dev.ts
  - apps/web/src/components/CanvasCard.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/drizzle/meta/0000_snapshot.json
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/OAuthCallbackPage.tsx
  - apps/web/src/components/FolderCreateDialog.tsx
  - apps/api/package.json
  - apps/web/src/auth/RouteGuard.tsx
  - apps/web/src/chrome/index.tsx
  - apps/api/src/folder/index.ts
  - packages/shared/src/shape-types.ts
  - apps/api/drizzle/meta/0001_snapshot.json
  - scripts/dev-proxy.ts
  - apps/api/src/lib/permission.ts
  - apps/web/src/auth/MagicLinkVerifyPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/web/src/account/SessionsPage.tsx
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/api/src/auth/rate-limit.ts
  - apps/api/src/email/mailpit.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/api/src/email/templates/magic-link.tsx
  - apps/web/src/auth/useAuth.ts
  - apps/web/src/dashboard/useCanvasList.ts
  - packages/shared/src/email/types.ts
  - apps/api/tsconfig.json
  - apps/web/src/auth/LoginPage.tsx
  - apps/web/package.json
  - apps/web/src/chrome/MainMenu.tsx
  - apps/web/src/components/FolderTree.tsx
  - packages/shared/src/db/auth-schema.ts
  - apps/web/src/dashboard/useFolderList.ts
  - apps/web/src/components/CanvasDeleteDialog.tsx
  - apps/web/src/router.tsx
  - apps/api/src/lib/logger.ts
  - apps/api/src/auth/index.ts
  - apps/api/src/db/schema.ts
  - apps/web/src/canvas/persistence.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/account/profile-validator.ts
  - apps/api/src/auth/session-cookie-parser.ts
  - apps/api/src/canvas/index.ts
  - apps/web/src/components/CanvasCreateDialog.tsx
  - apps/api/src/account/routes.ts
  - apps/api/src/auth/config.ts
  - apps/api/src/account/delete-account-validator.ts
  - apps/web/src/dashboard/DashboardPage.tsx
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/account/DeleteAccountDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/web/src/canvas/Editor.tsx
  - docker-compose.yml
tests:
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/api/src/folder/folder.test.ts
  - apps/api/src/db/schema.test.ts
  - apps/web/src/account/SessionsPage.test.tsx
  - apps/api/src/email/mailpit.test.ts
  - apps/web/src/chrome/MainMenu.test.tsx
  - apps/web/src/account/DeleteAccountDialog.test.tsx
  - apps/api/src/auth/logger-redaction.test.ts
  - apps/web/src/account/ProfilePage.test.tsx
  - apps/api/src/auth/route-guard.test.ts
  - apps/web/src/router.test.tsx
  - e2e/auth-magic-link.spec.ts
  - apps/api/src/auth/rate-limit.test.ts
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - e2e/auth-google-oauth.spec.ts
  - apps/api/src/auth/session-cookie.test.ts
  - apps/web/src/canvas/Editor.no-canvas-animation.test.tsx
  - apps/api/src/account/delete-account.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - e2e/account-delete.spec.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/components/CanvasCard.test.tsx
  - apps/api/src/account/sessions.test.ts
  - apps/api/src/lib/rate-limit-rules.test.ts
  - apps/web/src/components/FolderTree.test.tsx
  - apps/api/src/auth/error-key-contract.test.ts
  - e2e/auth-logout-and-sessions.spec.ts
  - packages/shared/src/locales/locales.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/api/src/auth/google-oauth.test.ts
  - apps/web/src/auth/MagicLinkVerifyPage.test.tsx
  - apps/api/src/auth/logout.test.ts
  - apps/api/src/auth/magic-link.test.ts
  - apps/api/src/lib/permission.test.ts
  - apps/web/src/dashboard/useCanvasList.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/auth/RouteGuard.test.tsx
  - apps/api/src/canvas/canvas.test.ts
  - packages/shared/src/api-contract.test.ts
  - apps/api/src/account/profile.test.ts
-->

---
### Requirement: Editor mounts with a multiplayer-aware sync store

The Editor component SHALL obtain a tldraw sync store via the `useSyncStore(canvasId)` hook (`apps/web/src/canvas/use-sync-store.ts`) and SHALL pass that store to the tldraw `<Tldraw>` component. The Editor SHALL NOT initialize tldraw with a local-only store, SHALL NOT call any client-side `loadSnapshot` or `saveSnapshot` function, and SHALL NOT register a `beforeunload` listener for the purpose of flushing edits.

#### Scenario: Editor mounts with a sync store bound to the current canvas id

- **WHEN** the Editor renders for `/canvas/<canvasId>`
- **THEN** the Editor MUST call `useSyncStore(<canvasId>)` exactly once and pass the returned store to `<Tldraw store={store} />`
- **AND** the Editor MUST NOT pass an `initialState` prop derived from localStorage

#### Scenario: Editor does not mount tldraw before the sync store reports a status

- **WHEN** the sync store hook reports status `connecting` and has not yet received the initial document from the server
- **THEN** the Editor MUST render a loading state instead of `<Tldraw>` so that no premature blank document is displayed

#### Scenario: Editor remounts cleanly when navigating between canvases

- **WHEN** the Editor unmounts and a new Editor mounts for a different canvas id
- **THEN** the previous sync store MUST be disposed and the new mount MUST establish a fresh sync store bound to the new id with no shared state across mounts


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: TopBar displays a real-time connection status indicator

The TopBar SHALL render a connection status indicator that reflects the current state of the sync WebSocket connection. The indicator SHALL display exactly one of four states: `connecting`, `connected`, `reconnecting`, `disconnected`. Each state SHALL use a localized label and SHALL be readable via screen reader through an `aria-label` whose text comes from a localized key. The indicator SHALL NOT use motion-based animation (per CLAUDE.md hard rule #5: multiplayer presence MUST be instant).

#### Scenario: Indicator reflects the active connection state

- **WHEN** the sync store reports state `connected`
- **THEN** the TopBar indicator MUST render with the localized label for `connected`
- **AND** the indicator's `aria-label` MUST come from the localized key for the current state

#### Scenario: Indicator transitions are reflected within one render cycle

- **WHEN** the sync connection transitions from `connected` to `reconnecting`
- **THEN** the indicator MUST update on the next render after the state change without polling

##### Example: state to localized key mapping

| Connection state | Localized label key | aria-label key |
| ---------------- | ------------------- | -------------- |
| connecting | `canvas.chrome.connection.connecting` | `canvas.chrome.connection.connecting` |
| connected | `canvas.chrome.connection.connected` | `canvas.chrome.connection.connected` |
| reconnecting | `canvas.chrome.connection.reconnecting` | `canvas.chrome.connection.reconnecting` |
| disconnected | `canvas.chrome.connection.disconnected` | `canvas.chrome.connection.disconnected` |

#### Scenario: Disconnected state shows a refresh banner

- **WHEN** the sync store transitions to `disconnected` after exhausting reconnect attempts
- **THEN** the TopBar MUST display a banner whose body comes from the localized key `canvas.chrome.connection.disconnectedBanner`
- **AND** the banner MUST contain a refresh action whose label comes from the localized key `canvas.chrome.connection.refresh`


<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: TopBar displays the current collaborator avatar list

The TopBar SHALL render a list of avatars for every user currently connected to the same sync room as the local user. Each avatar SHALL be rendered using the existing `UserAvatar` component (`apps/web/src/components/UserAvatar.tsx`). The list SHALL display up to 4 avatars inline; any additional collaborators SHALL be represented by a single trailing badge with text `+N` where N is the count of collaborators not displayed inline. The list SHALL exclude the local user themselves.

#### Scenario: Single remote collaborator renders one avatar

- **WHEN** one remote user is connected to the same sync room as the local user
- **THEN** the TopBar MUST render exactly one `UserAvatar` element representing the remote user

#### Scenario: Five or more collaborators trigger overflow badge

- **WHEN** five or more remote users are connected to the same sync room
- **THEN** the TopBar MUST render exactly four `UserAvatar` elements followed by a single overflow badge whose text content matches `+N` where N is the count of collaborators not rendered inline

##### Example: avatar list overflow

| Remote collaborators connected | Avatars rendered | Overflow badge |
| ------------------------------ | ---------------- | -------------- |
| 0 | 0 | not rendered |
| 1 | 1 | not rendered |
| 4 | 4 | not rendered |
| 5 | 4 | `+1` |
| 12 | 4 | `+8` |

#### Scenario: Local user is excluded from the avatar list

- **WHEN** the local user is the only user in the sync room
- **THEN** the TopBar MUST render zero `UserAvatar` elements in the collaborator list region

#### Scenario: Collaborator presence updates without reload

- **WHEN** a remote user joins or leaves the sync room
- **THEN** the TopBar collaborator list MUST update on the next render without requiring a page reload or manual refresh

<!-- @trace
source: add-multiplayer-sync
updated: 2026-05-02
code:
  - apps/api/src/lib/rate-limit-rules.ts
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/persistence.ts
  - bun.lock
  - apps/web/src/canvas/use-autosave.ts
  - apps/web/src/canvas/CollaboratorAvatars.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0006-multiplayer-sync-trade-offs.md
  - apps/api/src/sync/rate-limit.ts
  - apps/api/src/index.ts
  - packages/shared/src/locales/en.json
  - apps/web/src/chrome/TopBar.tsx
  - packages/shared/src/api-contract.ts
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/ConnectionStatus.tsx
  - apps/api/package.json
  - apps/api/src/sync/persistence.ts
  - apps/api/src/canvas/index.ts
  - apps/api/src/sync/auth.ts
  - apps/api/src/sync/room.ts
  - apps/web/package.json
  - apps/web/src/canvas/Editor.tsx
tests:
  - apps/api/src/sync/persistence.test.ts
  - apps/api/src/sync/rate-limit.test.ts
  - apps/web/src/canvas/use-autosave.test.ts
  - apps/web/src/canvas/ConnectionStatus.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/sync/index.test.ts
  - apps/api/src/sync/room.test.ts
  - apps/web/src/canvas/persistence.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - e2e/multiplayer-sync.spec.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/CollaboratorAvatars.test.tsx
-->

---
### Requirement: Editor reflects the resolved sync role on the tldraw component

When `useSyncStore` resolves a viewer role for the current canvas (handshake gave back a read-only session), the Editor SHALL pass `isReadonly={true}` to the `<Tldraw>` component so the canvas surface enters tldraw's built-in read-only state (toolbar disabled, shapes not draggable, text not editable). When the resolved role is editor, the Editor SHALL pass `isReadonly={false}` (or omit the prop). The Editor SHALL update the prop reactively when the role changes mid-session (e.g., the owner downgraded the user and reconnect produced a new role).

#### Scenario: Viewer role disables editing in tldraw

- **GIVEN** `useSyncStore` returns `{ status: 'ready', store, role: 'viewer' }`
- **WHEN** the Editor renders
- **THEN** the `<Tldraw>` component MUST be invoked with `isReadonly={true}`

#### Scenario: Editor role does not disable editing

- **GIVEN** `useSyncStore` returns `{ status: 'ready', store, role: 'editor' }`
- **WHEN** the Editor renders
- **THEN** the `<Tldraw>` component MUST be invoked with `isReadonly={false}` or no `isReadonly` prop

<!-- @trace
source: add-sharing
updated: 2026-05-04
code:
  - apps/api/src/lib/permission.ts
  - apps/api/src/share/index.ts
  - apps/web/src/auth/AnonymousCanvasGuard.tsx
  - apps/api/src/sync/index.ts
  - apps/web/src/canvas/Editor.tsx
  - packages/shared/src/locales/zh-TW.json
  - apps/api/drizzle/0002_0002_share.sql
  - apps/api/src/index.ts
  - apps/web/src/components/FolderTree.tsx
  - apps/web/src/router.tsx
  - apps/api/src/db/schema.ts
  - apps/web/src/auth/PostLoginPage.tsx
  - apps/api/src/share/link-token.ts
  - apps/web/src/canvas/useCanvasQuery.ts
  - apps/web/src/canvas/useShareState.ts
  - packages/shared/src/locales/en.json
  - apps/api/src/email/templates/share-invite.tsx
  - apps/api/src/share/invite-token.ts
  - apps/web/src/auth/LoginPage.tsx
  - apps/api/drizzle/meta/0002_snapshot.json
  - apps/api/src/sync/auth.ts
  - apps/web/src/canvas/CanvasPage.tsx
  - apps/api/src/lib/rate-limit-rules.ts
  - apps/api/drizzle/meta/_journal.json
  - apps/web/src/auth/safe-redirect.ts
  - apps/web/src/auth/InviteErrorPage.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - docs/adr/0007-sharing-trade-offs.md
  - apps/web/src/canvas/ShareDialog.tsx
  - apps/web/src/chrome/TopBar.tsx
  - apps/api/src/canvas/index.ts
  - apps/web/src/dashboard/DashboardPage.tsx
tests:
  - e2e/share-public-link.spec.ts
  - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
  - apps/api/src/sync/index.test.ts
  - apps/web/src/auth/LoginPage.test.tsx
  - apps/api/src/lib/permission.test.ts
  - apps/api/src/canvas/canvas-share.test.ts
  - e2e/share-invite.spec.ts
  - apps/api/src/share/invite-token.test.ts
  - apps/api/src/share/link-token.test.ts
  - apps/web/src/canvas/useCanvasQuery.test.ts
  - apps/api/src/sync/auth.test.ts
  - apps/web/src/canvas/ShareDialog.test.tsx
  - apps/web/src/auth/InviteErrorPage.test.tsx
  - apps/web/src/canvas/Editor.test.tsx
  - e2e/sharing-acceptance.spec.ts
  - apps/api/src/canvas/canvas-scope-shared.test.ts
  - apps/web/src/auth/PostLoginPage.test.tsx
  - apps/web/src/canvas/useShareState.test.ts
  - apps/web/src/chrome/TopBar.test.tsx
  - apps/web/src/dashboard/DashboardPage.test.tsx
  - apps/api/src/share/share.test.ts
  - apps/web/src/canvas/CanvasPage.test.tsx
  - apps/web/src/canvas/use-sync-store.test.ts
  - apps/api/src/email/share-invite.test.ts
-->

---
### Requirement: Canvas toolbar exposes four custom shape insertion buttons

The tldraw canvas toolbar SHALL expose four buttons, one per custom shape type defined by the `canvas-shapes` capability: Markdown, Code, Callout, Link card. The buttons MUST appear in the bottom toolbar after the built-in select, draw, and arrow tools, in the order Markdown → Code → Callout → Link card. Each button MUST display a lucide icon (`FileText`, `Code2`, `MessageSquareWarning`, `Link2`) and a localized tooltip via `shapes.<name>.toolbarTooltip`. Clicking a button MUST insert the corresponding shape at a sensible default position (within the current viewport) with the shape's localized default content.

The toolbar implementation MUST live in a new component `apps/web/src/canvas/ShapeToolbar.tsx` and MUST integrate with tldraw's `Tldraw` component via the `overrides` API or equivalent, NOT by editing tldraw's source. The component MUST NOT introduce motion animations on the canvas surface (per the project animation discipline rule).

#### Scenario: Clicking Markdown button inserts a markdown shape

- **WHEN** the user clicks the toolbar's Markdown button
- **THEN** a new markdown shape MUST be created at a position within the current viewport, with default content equal to the localized `shapes.markdown.defaultContent` value, and the shape MUST become the current selection

#### Scenario: Toolbar buttons render in fixed order

- **WHEN** the toolbar is rendered
- **THEN** the four custom shape buttons MUST appear in the order Markdown, Code, Callout, Link card, immediately after the built-in tools

#### Scenario: Tooltips localize per active language

- **WHEN** the active i18n language is `en` and the user hovers the Link card button
- **THEN** the tooltip MUST display the value of the `en.json` `shapes.linkCard.toolbarTooltip` key


<!-- @trace
source: add-custom-shapes
updated: 2026-05-04
code:
  - apps/api/src/og/parse-html.ts
  - apps/web/src/canvas/Editor.tsx
  - apps/api/src/sync/shape-schemas.ts
  - apps/web/src/canvas/shapes/link-card-state.ts
  - docs/adr/0009-shape-edit-lock-vs-crdt.md
  - apps/api/src/index.ts
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - apps/web/src/chrome/index.tsx
  - apps/web/src/canvas/VellumToolbar.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/shapes/use-shape-edit-lock.ts
  - bun.lock
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/src/styles.css
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/canvas/shapes/paste-detect.ts
  - docs/adr/0008-markdown-engine-marked.md
  - apps/web/src/canvas/shapes/code-highlight.ts
  - apps/api/src/og/index.ts
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - apps/web/src/canvas/shapes/markdown-parser.ts
  - docs/adr/0010-link-card-cache-two-tier.md
  - apps/api/package.json
  - apps/web/src/canvas/FloatingShapeToolbar.tsx
  - apps/web/src/canvas/shapes/clipboard.ts
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/package.json
  - apps/api/src/lib/rate-limit-rules.ts
tests:
  - apps/web/src/canvas/shapes/link-card-state.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/shapes/markdown-parser.test.ts
  - apps/api/src/og/parse-html.test.ts
  - apps/web/src/canvas/shapes/markdown-shape.test.tsx
  - apps/web/src/canvas/shapes/code-highlight.test.ts
  - apps/web/src/canvas/shapes/code-shape.test.tsx
  - apps/web/src/canvas/shapes/use-shape-edit-lock.test.ts
  - apps/web/src/canvas/shapes/link-card-shape.test.tsx
  - apps/api/src/og/index.test.ts
  - apps/web/src/canvas/shapes/callout-shape.test.tsx
  - apps/web/src/canvas/shapes/paste-detect.test.ts
  - apps/web/src/canvas/ShapeToolbar.test.tsx
-->

---
### Requirement: Pasting a URL onto an empty canvas region creates a Link card shape

When the user issues a paste action (Cmd+V / Ctrl+V) on the canvas where the clipboard contains exactly one well-formed `http(s)` URL and the paste target is not inside an existing shape's editor, the editor SHALL create a `link-card` shape at the cursor position with the pasted URL as its initial URL prop. The newly created shape MUST immediately enter the `pending` state defined by the link card state machine and trigger an OG fetch.

If the clipboard contains text that is NOT a single URL (multiple lines, mixed content, non-URL text), the paste MUST fall through to tldraw's default text-paste behavior (creating a text shape) and MUST NOT create a link card. If the clipboard contains a URL but the paste target is inside an open shape editor (e.g., Markdown dialog, Code textarea), the paste MUST behave as a text paste into that editor.

#### Scenario: Pasting a single URL on empty canvas creates a Link card

- **WHEN** the clipboard contains exactly `https://example.com/post` (no surrounding whitespace or other content) and the user pastes onto an empty area of the canvas
- **THEN** a link-card shape MUST be created at the cursor position with `url: "https://example.com/post"` and state `pending`

#### Scenario: Pasting multi-line text creates a text shape, not a Link card

- **WHEN** the clipboard contains `https://a.com\nhttps://b.com` and the user pastes on the canvas
- **THEN** the editor MUST create a tldraw text shape (default behavior) and MUST NOT create any link-card shape

#### Scenario: Pasting URL inside Markdown editor inserts text, not a Link card

- **WHEN** the user has the Markdown shape's edit dialog open with focus in the textarea, the clipboard contains `https://example.com`, and the user pastes
- **THEN** the URL string MUST be inserted at the textarea's cursor position and MUST NOT create a link-card shape

<!-- @trace
source: add-custom-shapes
updated: 2026-05-04
code:
  - apps/api/src/og/parse-html.ts
  - apps/web/src/canvas/Editor.tsx
  - apps/api/src/sync/shape-schemas.ts
  - apps/web/src/canvas/shapes/link-card-state.ts
  - docs/adr/0009-shape-edit-lock-vs-crdt.md
  - apps/api/src/index.ts
  - apps/web/src/canvas/shapes/callout-shape.tsx
  - apps/web/src/canvas/shapes/shape-utils.tsx
  - apps/web/src/canvas/use-sync-store.ts
  - apps/web/src/chrome/index.tsx
  - apps/web/src/canvas/VellumToolbar.tsx
  - packages/shared/src/locales/en.json
  - apps/web/src/canvas/shapes/use-shape-edit-lock.ts
  - bun.lock
  - packages/shared/src/locales/zh-TW.json
  - apps/web/src/canvas/ShapeToolbar.tsx
  - apps/web/src/styles.css
  - apps/web/src/canvas/shapes/code-shape.tsx
  - apps/web/src/canvas/shapes/paste-detect.ts
  - docs/adr/0008-markdown-engine-marked.md
  - apps/web/src/canvas/shapes/code-highlight.ts
  - apps/api/src/og/index.ts
  - apps/web/src/canvas/shapes/link-card-shape.tsx
  - apps/web/src/canvas/shapes/markdown-parser.ts
  - docs/adr/0010-link-card-cache-two-tier.md
  - apps/api/package.json
  - apps/web/src/canvas/FloatingShapeToolbar.tsx
  - apps/web/src/canvas/shapes/clipboard.ts
  - apps/web/src/canvas/shapes/markdown-shape.tsx
  - apps/web/package.json
  - apps/api/src/lib/rate-limit-rules.ts
tests:
  - apps/web/src/canvas/shapes/link-card-state.test.ts
  - apps/web/src/canvas/Editor.test.tsx
  - apps/web/src/canvas/shapes/markdown-parser.test.ts
  - apps/api/src/og/parse-html.test.ts
  - apps/web/src/canvas/shapes/markdown-shape.test.tsx
  - apps/web/src/canvas/shapes/code-highlight.test.ts
  - apps/web/src/canvas/shapes/code-shape.test.tsx
  - apps/web/src/canvas/shapes/use-shape-edit-lock.test.ts
  - apps/web/src/canvas/shapes/link-card-shape.test.tsx
  - apps/api/src/og/index.test.ts
  - apps/web/src/canvas/shapes/callout-shape.test.tsx
  - apps/web/src/canvas/shapes/paste-detect.test.ts
  - apps/web/src/canvas/ShapeToolbar.test.tsx
-->