## ADDED Requirements

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

### Requirement: Persistence module loads and saves snapshots in localStorage with a 5MB cap

The system SHALL provide a `persistence` deep module that exposes exactly two functions: `loadSnapshot(canvasId)` returning a tldraw snapshot or null, and `saveSnapshot(canvasId, snapshot)` returning a discriminated result. The module SHALL store snapshots under the localStorage key pattern `vellum:canvas:<canvasId>:snapshot` as a JSON string. The module SHALL reject writes whose serialized payload exceeds 5,242,880 bytes (5 MiB) before attempting `localStorage.setItem`.

#### Scenario: Round-trip succeeds for a typical snapshot

- **WHEN** `saveSnapshot(id, s)` is called and `JSON.stringify(s)` is below the 5 MiB cap
- **THEN** the function MUST return `{ ok: true }`
- **AND** a subsequent `loadSnapshot(id)` MUST return a structurally equal snapshot

##### Example: round-trip with a small payload

| Input | Expected Output | Notes |
| ----- | --------------- | ----- |
| saveSnapshot("c1", { v: 1, foo: "bar" }) | { ok: true } | payload ~25 bytes |
| loadSnapshot("c1") | { v: 1, foo: "bar" } | structural equality |
| loadSnapshot("c2") | null | unrelated id |

#### Scenario: Missing key returns null

- **WHEN** `loadSnapshot(id)` is called for an id that has no entry in localStorage
- **THEN** the function MUST return null and MUST NOT throw

#### Scenario: Malformed JSON returns null

- **WHEN** the localStorage entry for a canvas id contains a string that is not valid JSON
- **THEN** `loadSnapshot(id)` MUST return null and MUST NOT throw

#### Scenario: Payload exceeding 5 MiB is rejected before write

- **WHEN** `saveSnapshot(id, s)` is called and `JSON.stringify(s).length` exceeds 5,242,880
- **THEN** the function MUST return `{ ok: false, reason: "too_large" }`
- **AND** the function MUST NOT call `localStorage.setItem`

#### Scenario: Quota exceeded during write is reported gracefully

- **WHEN** `saveSnapshot(id, s)` is called with a payload under the 5 MiB cap and `localStorage.setItem` throws a `QuotaExceededError` (or a DOMException with name "QuotaExceededError")
- **THEN** the function MUST return `{ ok: false, reason: "quota" }`
- **AND** the function MUST NOT throw to the caller

##### Example: failure reason mapping

| Pre-condition | Call | Expected Output |
| ------------- | ---- | --------------- |
| payload size 6 MiB | saveSnapshot(id, s) | { ok: false, reason: "too_large" } |
| payload size 1 MiB, localStorage full | saveSnapshot(id, s) | { ok: false, reason: "quota" } |
| payload size 1 MiB, localStorage healthy | saveSnapshot(id, s) | { ok: true } |

### Requirement: Editor autosaves snapshots on a debounced cadence and on page unload

The Editor component SHALL subscribe to the tldraw store's change stream and SHALL invoke `saveSnapshot` with a trailing-edge debounce of 800 milliseconds. The Editor SHALL also flush any pending debounced write synchronously when the browser fires `beforeunload`. The Editor SHALL load any existing snapshot via `loadSnapshot` exactly once during mount and pass it to tldraw as the initial store contents.

#### Scenario: Initial mount hydrates from localStorage when a snapshot exists

- **WHEN** the Editor mounts for canvas id `c1` and `loadSnapshot("c1")` returns a non-null snapshot
- **THEN** the tldraw store MUST be initialized from that snapshot

#### Scenario: Initial mount with no prior snapshot starts blank

- **WHEN** the Editor mounts for canvas id `c1` and `loadSnapshot("c1")` returns null
- **THEN** the tldraw store MUST initialize empty (default tldraw initial state)

#### Scenario: Burst of edits coalesces into a single save

- **WHEN** the user performs multiple store mutations within an 800 ms window
- **THEN** `saveSnapshot` MUST be invoked exactly once for that window, on the trailing edge, with the latest snapshot

##### Example: debounce coalescing

- **GIVEN** the Editor mounted for canvas id `c1`
- **WHEN** the store fires 5 change events at t=0, 100, 200, 300, 400 ms and no further events follow
- **THEN** `saveSnapshot("c1", latest)` MUST be invoked exactly once at approximately t=1200 ms

#### Scenario: beforeunload flushes a pending write

- **WHEN** a debounced save is pending and the browser fires `beforeunload`
- **THEN** the Editor MUST invoke `saveSnapshot` synchronously with the latest snapshot before the page unloads

#### Scenario: Quota exceeded surfaces a one-shot toast and stops further writes

- **WHEN** `saveSnapshot` returns `{ ok: false, reason: "quota" }` or `{ ok: false, reason: "too_large" }`
- **THEN** the Editor MUST display a toast whose body text comes from the localized key `canvas.chrome.persistence.quotaExceededToast`
- **AND** subsequent debounced saves for the same Editor instance MUST be suppressed until the page is reloaded
- **AND** the toast MUST NOT be displayed more than once per Editor instance lifecycle

### Requirement: Single-page document and custom shape registry are wired at the integration point

The Editor SHALL pass `customShapeUtils` and `customShapeTools` from `packages/shared/src/shape-types.ts` to the tldraw component. The Editor SHALL configure tldraw to a single-page document. In this change, `customShapeUtils` and `customShapeTools` SHALL each be exported as empty arrays.

#### Scenario: customShapeUtils is the integration extension point

- **WHEN** any subsequent change appends a `ShapeUtil` to the `customShapeUtils` array exported by `packages/shared/src/shape-types.ts`
- **THEN** that shape MUST become available in the editor without modifying the Editor component

#### Scenario: tldraw multi-page is disabled

- **WHEN** the Editor is mounted
- **THEN** the rendered tldraw instance MUST NOT expose multi-page UI affordances (page tabs, add-page button)

### Requirement: All chrome strings are localized in zh-TW and en

Every user-facing string rendered by the TopBar, MainMenu, rename dialog, delete confirmation, persistence toasts, and Share placeholder toast SHALL be sourced from the i18n catalog under the `canvas.chrome.*` and `canvas.title.*` namespaces. Both `packages/shared/locales/zh-TW.json` and `packages/shared/locales/en.json` SHALL contain identical key sets after this change.

#### Scenario: Locale catalogs cover every chrome key in both languages

- **WHEN** an automated check enumerates the keys under `canvas.chrome.*` and `canvas.title.*` in zh-TW.json and en.json after this change is applied
- **THEN** the two key sets MUST be identical (no key present in only one language)

#### Scenario: No chrome component contains a hardcoded display string

- **WHEN** any chrome source file (`apps/web/src/chrome/*.tsx`, `apps/web/src/canvas/CanvasPage.tsx`, `apps/web/src/canvas/Editor.tsx`) is inspected
- **THEN** every user-facing string literal rendered to the DOM MUST come from a `t(...)` call or a JSX child resolved from `t(...)`, and MUST NOT be a raw quoted string literal in JSX text or attribute values such as `aria-label`, `title`, or `placeholder`

### Requirement: Chrome animations use motion; canvas region uses none

Animations on the MainMenu dropdown, the rename dialog enter/exit, the delete confirmation dialog enter/exit, and the Share placeholder toast SHALL be implemented using the shared `motion` library (Animate UI level). No animation library SHALL wrap or be applied to the tldraw canvas region.

#### Scenario: MainMenu dropdown animates on open and close

- **WHEN** the user opens or closes the main menu dropdown
- **THEN** the dropdown MUST animate via `motion`-driven enter/exit transitions

#### Scenario: Canvas region has no app-level animation wrapper

- **WHEN** the Editor is rendered
- **THEN** the JSX subtree containing `<Tldraw>` MUST NOT be wrapped in `motion`, `AnimatePresence`, or any equivalent animation-wrapping component
