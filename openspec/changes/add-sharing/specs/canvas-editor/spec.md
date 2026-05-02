## MODIFIED Requirements

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

## ADDED Requirements

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
