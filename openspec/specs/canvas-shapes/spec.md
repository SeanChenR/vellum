# canvas-shapes Specification

## Purpose

TBD - created by archiving change 'add-custom-shapes'. Update Purpose after archive.

## Requirements

### Requirement: Canvas exposes four custom shape types — Markdown, Code, Callout, Link card

The canvas SHALL register four custom shape types that can be created, edited, serialized, and synchronized via tldraw sync alongside built-in shapes:

- `markdown` — renders sanitized GFM markdown (table / task-list / strike / autolink); double-click opens a dialog editor
- `code` — renders syntax-highlighted source via Shiki for one of 12 selected languages (JavaScript, TypeScript, Python, Go, Swift, Rust, HTML, CSS, SQL, Bash, Markdown, JSON); inline edit via textarea overlay
- `callout` — renders one of three variants (info / warning / danger) with a lucide icon and a body that supports inline markdown subset
- `link-card` — renders an Open Graph preview (title, description, image, favicon, site name) for a same-origin-validated external URL

Each shape's props MUST be a JSON-serializable object that survives round-trip through tldraw sync and the jsonb snapshot persistence in `apps/api/src/sync/persistence.ts`. The four shape types MUST register through tldraw's `shapeUtils` API in `apps/web/src/canvas/Editor.tsx` and MUST appear in the toolbar entry point defined by the `canvas-editor` capability.

#### Scenario: Markdown shape persists across reload

- **WHEN** a user creates a markdown shape with content `# Hello\n\n- one\n- two`, saves the canvas snapshot, and reloads the page
- **THEN** the canvas MUST re-render the same markdown shape with the same content and the same rendered HTML

#### Scenario: Code shape persists language across reload

- **WHEN** a user creates a code shape with `language: "python"` and source `print("hi")`, saves the snapshot, and reloads
- **THEN** the canvas MUST re-render the code shape with the Python highlight tokens identical to the pre-reload render


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
### Requirement: Markdown shape parses and sanitizes content via a deep module

A pure function `parseMarkdown(input: string): string` in `apps/web/src/canvas/shapes/markdown-parser.ts` SHALL accept any string and return safe HTML. It MUST internally pipe `marked` (with GFM extensions: table, task-list, strikethrough, autolink) followed by `DOMPurify`. It MUST NOT throw for any input — garbage input returns empty or escaped HTML. It MUST strip all `<script>` tags and inline event handlers (`onclick=`, `onload=`, etc.). It MUST NOT enable the `breaks` option or raw HTML pass-through.

##### Example: parser output for sample inputs

| Input | Expected output behavior |
| ----- | ------------------------ |
| `# Title` | output contains `<h1>Title</h1>` |
| `- [x] done\n- [ ] todo` | output contains `<input type="checkbox" checked` and `<input type="checkbox"` |
| `<script>alert(1)</script>hi` | output does NOT contain `<script>`; contains `hi` |
| `<a onclick="x()">x</a>` | output does NOT contain `onclick=` |
| `\| a \| b \|\n\|---\|---\|\n\| 1 \| 2 \|` | output contains `<table>`, `<thead>`, `<tbody>` |
| `` (empty string) | output is empty string or whitespace |

#### Scenario: parser strips script injection

- **WHEN** `parseMarkdown` receives input containing `<script>alert(1)</script>`
- **THEN** the returned HTML MUST NOT contain the `<script>` tag

#### Scenario: parser does not throw on malformed input

- **WHEN** `parseMarkdown` receives input `"<<<not really markdown<<"`
- **THEN** the function MUST return a string without throwing


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
### Requirement: Markdown shape opens a dialog editor on double-click

When a user double-clicks a markdown shape and edit lock allows it (see `multiplayer-sync` shape lock requirement), the editor SHALL open a dialog containing a textarea pre-populated with the raw markdown source. On dialog close (save button or Escape key), the shape props MUST update with the new content and the shape MUST re-render with the new sanitized HTML. While the dialog is open, the shape MUST display a placeholder render of the pre-edit content underneath the dialog (no flicker).

#### Scenario: Editing markdown updates the rendered output

- **WHEN** a user double-clicks a markdown shape, replaces its content with `# Updated`, and clicks Save
- **THEN** the shape MUST re-render with `<h1>Updated</h1>` and the snapshot MUST persist the new source

#### Scenario: Closing dialog without save discards changes

- **WHEN** a user opens the markdown editor dialog, types `# new`, then presses Escape
- **THEN** the shape props MUST remain unchanged and the shape MUST display the pre-edit render


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
### Requirement: Code shape highlights via lazy-loaded Shiki

A function `highlightCode(source: string, lang: string): Promise<{ tokens: HighlightToken[][]; error: string | null }>` in `apps/web/src/canvas/shapes/code-highlight.ts` SHALL lazy-load the Shiki grammar for the requested language, highlight the source, and return token rows. Unknown or unsupported languages MUST return tokens for the source as plain text with `error: "errors.shape.code.unknownLanguage"`. The Shiki theme MUST be a single fixed light theme (no dark mode in M6). Each language grammar MUST load on first use (not bundled with main app).

The 12 supported languages MUST be: `javascript`, `typescript`, `python`, `go`, `swift`, `rust`, `html`, `css`, `sql`, `bash`, `markdown`, `json`.

#### Scenario: Highlighting Python source

- **WHEN** `highlightCode("print('hi')", "python")` is awaited
- **THEN** the result MUST contain at least one token with style coloring for the `print` identifier and the `'hi'` string literal, and `error` MUST be null

#### Scenario: Highlighting unsupported language falls back to plain text

- **WHEN** `highlightCode("source", "klingon")` is awaited
- **THEN** the result MUST contain a single token row with the source as plain text, and `error` MUST equal `"errors.shape.code.unknownLanguage"`


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
### Requirement: Code shape supports inline editing via textarea overlay with viewport-mode resize

The code shape MUST render a textarea overlaid on the highlighted output. When focused, the textarea MUST accept text input including the Tab key (Tab inserts two spaces, does NOT shift focus). On blur or Esc, focus MUST leave the shape and the highlighter MUST re-run with the new source. The shape's resize behavior MUST treat its dimensions as a viewport: the source content MUST NOT auto-wrap; content exceeding the visible width MUST be horizontally scrollable. The shape's minimum dimensions MUST be 240×120 pixels.

The shape header MUST include a Copy button and a language selector (dropdown listing the 12 supported languages). Clicking Copy MUST place the source on the system clipboard via `navigator.clipboard.writeText` and display a transient `shapes.code.copied` localized confirmation.

#### Scenario: Tab key inserts two spaces in code editor

- **WHEN** the user has focus inside the code shape textarea and presses Tab
- **THEN** two space characters MUST be inserted at the cursor position and focus MUST remain in the textarea

#### Scenario: Long lines remain on a single row

- **WHEN** the code shape contains a single line longer than the shape's visible width
- **THEN** the line MUST NOT wrap to a new row; the shape MUST render a horizontal scrollbar


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
### Requirement: Callout shape renders one of three variants with a lucide icon

The callout shape MUST accept a `variant` prop of value `"info"`, `"warning"`, or `"danger"`. Each variant MUST render with a distinct accent color and a corresponding lucide icon: `Info`, `AlertTriangle`, `AlertOctagon` respectively. The body MUST be a single string supporting an inline markdown subset (bold, italic, inline code, links — NO block-level elements like headings, lists, tables, code blocks). The body MUST be rendered through the same `parseMarkdown` deep module restricted to inline output.

#### Scenario: Variant info renders with info icon and color

- **WHEN** the callout shape has `variant: "info"` and body `Hello **world**`
- **THEN** the rendered output MUST contain a lucide `Info` icon, the info accent color, and the text `Hello world` with `world` rendered bold

#### Scenario: Block markdown is escaped in callout body

- **WHEN** the callout body is `# This is a heading`
- **THEN** the rendered output MUST display the literal text `# This is a heading` and MUST NOT contain an `<h1>` element


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
### Requirement: Link card shape transitions through pending / success / error states

A state machine in `apps/web/src/canvas/shapes/link-card-state.ts` SHALL govern link card lifecycle. States are `pending`, `success`, and `error`. Transitions:

- `pending → success` when `POST /api/og` returns 2xx with parsed metadata
- `pending → error` when `POST /api/og` returns 4xx, 5xx, or network failure
- `error → pending` when the user clicks the retry button
- `success → pending` when the URL changes (user edits the URL field)
- `success → pending` when the cached metadata's `fetchedAt` timestamp is older than 24 hours and the shape is rendered

The shape's stored props MUST include the URL, the last successful metadata (or null), and the last `fetchedAt` timestamp. While in `error` state, the shape MUST render a `"Preview unavailable"` placeholder with the URL's favicon (loaded directly from the origin's `/favicon.ico`) and a retry button.

#### Scenario: Successful OG fetch transitions to success and stores metadata

- **WHEN** a link card with URL `https://example.com/post` is created and the `/api/og` response is `{ data: { title: "Post", siteName: "Example", fetchedAt: "..." } }`
- **THEN** the shape state MUST be `success` and the rendered card MUST display the title and site name

#### Scenario: Failed fetch shows fallback placeholder with retry

- **WHEN** the `/api/og` request returns 502
- **THEN** the shape state MUST be `error` and the rendered card MUST contain the localized `shapes.linkCard.previewUnavailable` text and a retry button

#### Scenario: Stale metadata triggers re-fetch

- **WHEN** a link card is rendered with `fetchedAt` set to 25 hours ago
- **THEN** the shape MUST automatically transition to `pending` and call `/api/og` again


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
### Requirement: OG metadata endpoint returns sanitized parsed result with two-tier cache

The endpoint `POST /api/og` SHALL accept a JSON body `{ url: string }` and return one of:

- `{ data: { title, description, image, favicon, siteName, fetchedAt } }` on success
- `{ error: "errors.og.fetchFailed" }` on remote 4xx/5xx, network errors, timeouts, or non-HTML responses
- `{ error: "errors.og.invalidUrl" }` when the URL fails `validateExternalUrl`
- `{ error: "errors.rateLimit" }` (with `Retry-After` header) when the per-user rate limit is exceeded

The endpoint MUST validate the URL through the existing `validateExternalUrl` deep module (rejecting non-http(s), private IPs, loopback, link-local addresses, and capping response size to 5MB / timeout 5s). The endpoint MUST be rate-limited to 30 requests per minute per authenticated user via `RateLimiter` rules in `apps/api/src/lib/rate-limit-rules.ts`. The endpoint MUST require an authenticated session (anonymous-via-public-link visitors get 401 — link card is an editor-tier feature).

The endpoint MUST consult an in-memory LRU cache (30-minute TTL) keyed by the normalized URL before fetching. Cache hits MUST NOT count against the rate limit's outbound burst.

A pure HTML parser `parseHtmlForOg(html: string): OgMetadata` in `apps/api/src/og/parse-html.ts` SHALL extract `og:title`, `og:description`, `og:image`, `og:site_name` meta tags, the document `<title>` (as title fallback), and the `<link rel="icon">` href (as favicon). It MUST NOT throw for any input. Missing fields MUST be omitted from the result (not returned as empty strings).

#### Scenario: Successful OG parse and cache hit on repeat

- **WHEN** the endpoint receives `{ url: "https://example.com" }` for the first time and the remote returns valid HTML with `<meta property="og:title" content="Example">`
- **THEN** the response MUST be `{ data: { title: "Example", ... } }` and a subsequent identical request within 30 minutes MUST return the cached result without a new outbound fetch

#### Scenario: Private IP rejected by SSRF guard

- **WHEN** the endpoint receives `{ url: "http://192.168.1.1/admin" }`
- **THEN** the response MUST be `{ error: "errors.og.invalidUrl" }` with no outbound network request issued

#### Scenario: Rate limit exhaustion returns 429

- **WHEN** the same authenticated user issues a 31st request within 60 seconds
- **THEN** the response MUST be HTTP 429 with body `{ error: "errors.rateLimit" }` and a `Retry-After` header in seconds

##### Example: parseHtmlForOg extracts meta tags

| Input HTML fragment | Expected field |
| ------------------- | -------------- |
| `<meta property="og:title" content="Hi">` | `title: "Hi"` |
| `<meta name="og:description" content="d">` | `description: "d"` |
| `<title>Backup</title>` (no og:title present) | `title: "Backup"` |
| `<link rel="icon" href="/x.ico">` | `favicon: "/x.ico"` |
| (none of the above present) | result is `{}` (empty object) |


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
### Requirement: All shape UI strings use shapes.* i18n namespace

Every user-facing string in the four shapes (button labels, placeholders, tooltips, error messages, language names in the Code selector, callout variant names) MUST be wrapped in `t("shapes.<name>.<key>")` calls. Shared strings (`Edit`, `Copy`, `Cancel`, `Save`, retry, edit-lock badge text, "Preview unavailable") MUST live under `shapes.common.*`. Both `packages/shared/src/locales/zh-TW.json` and `packages/shared/src/locales/en.json` MUST contain the same set of keys in this change. No hardcoded display strings are permitted.

#### Scenario: zh-TW and en have matching shape key sets

- **WHEN** the change is committed
- **THEN** the `shapes` subtree of `zh-TW.json` MUST contain exactly the same set of keys as the `shapes` subtree of `en.json`

#### Scenario: Switching language updates shape UI

- **WHEN** the user changes locale from zh-TW to en while a code shape is selected
- **THEN** the Copy button label, language selector option labels, and all other shape UI strings MUST switch to the en values

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