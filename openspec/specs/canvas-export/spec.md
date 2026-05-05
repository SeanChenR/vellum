# canvas-export Specification

## Purpose

TBD - created by archiving change 'add-export'. Update Purpose after archive.

## Requirements

### Requirement: Editor and owner can export the canvas in four formats

The system SHALL allow any user with edit privilege on a canvas (canvas owner or shared editor) to export the canvas to four file formats: PNG, SVG, PDF, and JSON. PDF SHALL be produced by embedding a rasterized PNG into a single-page PDF document via jsPDF. SVG and JSON SHALL be produced by tldraw's built-in `editor.exportAs` API without rasterization. The PDF and PNG paths SHALL accept a scale factor of 1×, 2×, or 4×; SVG and JSON SHALL be produced at the native (vector / data) representation with no scale factor. JSON SHALL contain the full canvas store snapshot suitable for re-import.

#### Scenario: Editor exports PNG at 2×

- **WHEN** an editor activates Export → PNG → 2× from the main menu
- **THEN** the system MUST invoke `editor.exportAs(selectedShapes, 'png', { scale: 2 })`
- **AND** the resulting Blob MUST be saved to the user's download folder with filename `{slug(title)}.png`

#### Scenario: Owner exports PDF at 4×

- **WHEN** the canvas owner activates Export → PDF → 4× from the main menu
- **THEN** the system MUST first generate a PNG Blob via `editor.exportAs(selectedShapes, 'png', { scale: 4 })`
- **AND** the system MUST embed the PNG into a jsPDF document sized to the PNG's dimensions
- **AND** the resulting PDF MUST be saved as `{slug(title)}.pdf`

#### Scenario: Editor exports SVG

- **WHEN** an editor activates Export → SVG from the main menu
- **THEN** the system MUST invoke `editor.exportAs(selectedShapes, 'svg', {})`
- **AND** the resulting Blob MUST be saved as `{slug(title)}.svg`
- **AND** no scale factor MUST be applied

#### Scenario: Editor exports JSON snapshot

- **WHEN** an editor activates Export → JSON from the main menu
- **THEN** the system MUST invoke `editor.exportAs(selectedShapes, 'json', {})`
- **AND** the resulting Blob MUST be saved as `{slug(title)}.json`

##### Example: format and extension mapping

| Menu choice | tldraw format arg | jsPDF involvement | File extension |
| ----------- | ----------------- | ----------------- | -------------- |
| PNG 1×      | `'png'`, scale 1  | no                | `.png`         |
| PNG 2×      | `'png'`, scale 2  | no                | `.png`         |
| PNG 4×      | `'png'`, scale 4  | no                | `.png`         |
| SVG         | `'svg'`           | no                | `.svg`         |
| PDF 1×      | `'png'`, scale 1  | yes (embed PNG)   | `.pdf`         |
| PDF 2×      | `'png'`, scale 2  | yes (embed PNG)   | `.pdf`         |
| PDF 4×      | `'png'`, scale 4  | yes (embed PNG)   | `.pdf`         |
| JSON        | `'json'`          | no                | `.json`        |


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
### Requirement: Export range follows current selection

The system SHALL determine the export range from the editor's current shape selection. If shapes are selected, the export SHALL contain only the selected shapes. If no shapes are selected, the export SHALL contain the entire canvas (all shapes on the single page).

#### Scenario: Selection drives range

- **WHEN** the user has shapes selected and triggers any export format
- **THEN** the export Blob MUST contain only the selected shapes' bounds and content

#### Scenario: No selection exports full canvas

- **WHEN** the user has no shapes selected and triggers any export format
- **THEN** the export Blob MUST contain all shapes on the canvas


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
### Requirement: Viewer cannot access export controls

The system SHALL hide the entire export submenu from the main menu when the canvas is opened in read-only mode (anonymous public-link viewer, role=viewer). The export submenu trigger MUST NOT be rendered for read-only sessions; export submenu items MUST NOT be reachable via keyboard navigation, screen readers, or programmatic role gates.

#### Scenario: Read-only viewer opens main menu

- **WHEN** a session whose `isReadOnly` flag is true activates the main menu trigger
- **THEN** the dropdown MUST render Rename, Duplicate, and Delete items only if those are themselves permitted, otherwise it MUST omit them as already specified
- **AND** the dropdown MUST NOT render an Export submenu trigger
- **AND** keyboard tab navigation through the menu MUST NOT visit any export-related element

#### Scenario: Editor opens main menu

- **WHEN** a session whose `isReadOnly` flag is false activates the main menu trigger
- **THEN** the dropdown MUST render the Export submenu trigger as a top-level item


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
### Requirement: Export filename derives from canvas title via slugify

The system SHALL produce export filenames using a deterministic slugify utility. The slug SHALL preserve ASCII letters, ASCII digits, and CJK Unified Ideograph characters; SHALL replace any other character (including whitespace, punctuation, and symbols) with a single hyphen `-`; SHALL collapse consecutive hyphens into a single hyphen; SHALL trim leading and trailing hyphens; SHALL lowercase ASCII letters; and SHALL fall back to the literal string `canvas` when the resulting slug is empty.

#### Scenario: Title with mixed CJK and symbols

- **WHEN** the canvas title is `我的 Canvas (草稿)` and the user exports as PNG
- **THEN** the saved filename MUST be `我的-canvas-草稿.png`

#### Scenario: Empty or symbol-only title

- **WHEN** the canvas title is `////` (all symbols) and the user exports as JSON
- **THEN** the saved filename MUST be `canvas.json`

##### Example: slugify boundary cases

| Title input              | Resulting slug      | Filename for `.png`   |
| ------------------------ | ------------------- | --------------------- |
| `My Canvas`              | `my-canvas`         | `my-canvas.png`       |
| `My  Canvas!!!`          | `my-canvas`         | `my-canvas.png`       |
| `我的 Canvas (草稿)`     | `我的-canvas-草稿`  | `我的-canvas-草稿.png`|
| `   ` (whitespace only)  | `canvas` (fallback) | `canvas.png`          |
| `////`                   | `canvas` (fallback) | `canvas.png`          |
| `已存檔-2026`            | `已存檔-2026`       | `已存檔-2026.png`     |


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
### Requirement: Export results trigger localized toasts

The system SHALL surface a localized success toast after a successful export and a localized failure toast when an export throws or yields an empty Blob. Toast strings SHALL come from the i18n namespace `canvas.chrome.mainMenu`. Both Traditional Chinese and English locale files SHALL define the success and failure keys in the same change.

#### Scenario: Successful export shows success toast

- **WHEN** any export format completes and a Blob is downloaded
- **THEN** the system MUST display a toast using the localized key `canvas.chrome.mainMenu.exportSuccess` parameterized with the format name (PNG / SVG / PDF / JSON)

#### Scenario: Failed export shows failure toast

- **WHEN** the export pipeline throws or yields a Blob whose size is zero
- **THEN** the system MUST display a toast using the localized key `canvas.chrome.mainMenu.exportFailed`
- **AND** the system MUST NOT crash the editor or block subsequent export attempts


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
### Requirement: Export pipeline runs entirely in the browser

The system SHALL perform every step of the export pipeline (rasterization, serialization, PDF assembly, file save) inside the browser process. The system MUST NOT issue any HTTP request to the api server, the WebSocket server, or any external host as part of an export action. The system MUST NOT persist export artifacts to the database, log them to the api server, or include them in any analytics signal.

#### Scenario: No network activity during export

- **WHEN** any export format is triggered
- **THEN** no `fetch`, XHR, or WebSocket message MUST be issued by the export pipeline
- **AND** no row MUST be written to any database table as a side effect of the export

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