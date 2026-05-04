## ADDED Requirements

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
