# ADR-0005: tldraw Integration Depth — Custom Chrome + Custom Shapes

**Status:** Accepted
**Date:** 2026-04-29
**Decider:** project owner (grill-me)

## Context

When embedding tldraw SDK, four levels of integration are possible:

- **(a) Embed-only:** Drop `<Tldraw />` into a layout; use tldraw's default chrome (toolbar, menus, share button) unchanged.
- **(b) Custom chrome:** Replace tldraw's top bar / share button / menus with the host app's own UI; keep tldraw's canvas + shape tools.
- **(c) Custom chrome + custom shapes:** (b) plus host-app-specific shape definitions registered via tldraw's shape API.
- **(d) Heavy fork:** Significantly modify tldraw's UI components, possibly replacing the side toolbar or shape tool palette.

Vellum's brand and feature set diverge from tldraw's default app: Vellum has its own folder hierarchy, sharing semantics (Email invite + Public link with 3-state mode), its own auth, and four product-defining custom shapes (Markdown, Code, Callout, Link card).

## Decision

Adopt **integration level (c): Custom chrome + Custom shapes**.

Concretely:

- Replace tldraw's top bar, main menu, and share button with Vellum's `TopBar`, `MainMenu`, `ShareDialog`.
- Keep tldraw's right/bottom shape toolbar, transform handles, alignment guides, undo/redo, keyboard shortcuts, multi-select.
- Register four custom shapes (Markdown / Code / Callout / Link card) via tldraw's shape API.
- Phase 1 keeps the tldraw watermark (free license compliance).

## Consequences

### Positive

- Vellum-branded chrome means users do not see "Made with tldraw" text on share dialogs, menus, or in-canvas overlays — the product feels like Vellum, not "tldraw with login".
- Custom shape API gives a clean extension point for product-specific shape behavior (Markdown rendering, syntax-highlighted Code, OG-fetched Link cards, styled Callouts).
- Keeps tldraw's deep value (canvas behavior, transforms, accessibility, performance optimization) untouched.
- Lower risk than (d) heavy fork: any tldraw upgrade pulls in upstream improvements without merge conflicts.

### Negative / Trade-offs

- The tldraw watermark in the corner is visible to all users in Phase 1. Acceptable: (i) no commercial use during Phase 1, (ii) Phase 2 plans evaluate applying for free commercial license.
- Custom Share dialog must implement the full sharing semantics — invite flow, link mode toggle, link rotation — replacing tldraw's simpler default dialog. Estimated effort included in Phase 1 M5.
- Each new custom shape is ~1–2 days of Claude work + user review (per Tier 1) for visual + behavior + persistence + collab compatibility.
- Internationalization of the chrome is on Vellum (i18n keys for every chrome string); tldraw's own UI is partially behind tldraw's i18n system — split concern accepted.

## Alternatives Considered

### A. Embed-only (level a)

Rejected. Triggers the owner's "looks like a half-finished product" detector: users would see tldraw's default Share dialog with tldraw's wording, tldraw's File menu opening tldraw's flow, etc. The brand boundary leaks badly.

### B. Custom chrome only, no custom shapes (level b)

Considered. Acceptable as a Phase 1 minimum, but rejected in favor of (c) because:

- The owner is comfortable with the engineering volume (Claude writes the implementation, owner reviews).
- Four custom shapes establish a "shape factory" pattern in the codebase, making future shape additions in Phase 2 cheap.
- Markdown / Code / Callout / Link card form a coherent product story: "Vellum is a canvas where text content lives well", which is differentiation versus pure tldraw.

### C. Heavy fork (level d)

Rejected. Replacing tldraw's shape toolbar or selection rendering would require deep SDK knowledge, slow down upgrades, and add no Phase 1 user-visible value. Reserved as a Phase 3+ option if a specific need arises.
