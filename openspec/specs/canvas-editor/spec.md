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

The TopBar component SHALL display, from left to right: the Vellum logo, a folder breadcrumb showing the canvas's parent folder name (or a localized "My canvases" label when the canvas has no folder), the canvas title (clickable to open a rename dialog), a Share button placeholder, and a user menu showing the signed-in user's avatar with a sign-out item.

#### Scenario: Canvas with a parent folder

- **WHEN** the loaded canvas has a non-null `folder.name`
- **THEN** the breadcrumb element MUST display that folder name as a non-interactive label

#### Scenario: Canvas without a parent folder

- **WHEN** the loaded canvas has a null `folder` value
- **THEN** the breadcrumb element MUST display the localized string keyed `canvas.chrome.topbar.breadcrumb.myCanvases`

#### Scenario: Share button placeholder triggers a not-yet-available toast

- **WHEN** the user clicks the Share button in the TopBar
- **THEN** the system MUST invoke the `onShareClick` callback prop
- **AND** the default callback wired by the editor MUST display a toast whose body text comes from the localized key `canvas.chrome.topbar.sharePlaceholderToast`
- **AND** no share dialog or modal MUST open

#### Scenario: Title click opens a rename dialog

- **WHEN** the user clicks the canvas title element
- **THEN** the system MUST open a modal rename dialog with focus trapped on a text input pre-filled with the current title
- **AND** pressing Escape or clicking the dialog's cancel button MUST close the dialog without invoking any rename mutation
- **AND** submitting a non-empty new value via Enter or the confirm button MUST invoke the rename mutation supplied by the canvas data layer and close the dialog on success


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
### Requirement: MainMenu exposes Rename, Duplicate, Delete, and a placeholder Export submenu

The MainMenu component SHALL expose four top-level items: Rename, Duplicate, Delete, and Export. Rename, Duplicate, and Delete SHALL invoke mutations supplied by the canvas data layer. Export SHALL be a submenu containing five disabled items labeled with localized keys for PNG, SVG, PDF, JSON, and Markdown, each accompanied by a localized "coming soon" hint.

#### Scenario: User opens the main menu

- **WHEN** the user activates the main menu trigger
- **THEN** the dropdown MUST render with four items in this order: Rename, Duplicate, Delete, Export

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

#### Scenario: User opens the Export submenu

- **WHEN** the user hovers or activates the Export item
- **THEN** the submenu MUST render five items each in a disabled (non-interactive) state with text from the localized key `canvas.chrome.mainMenu.exportComingSoon` appended


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