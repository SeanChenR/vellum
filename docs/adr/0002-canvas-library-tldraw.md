# ADR-0002: Use tldraw SDK for the Canvas Engine

**Status:** Accepted
**Date:** 2026-04-29
**Decider:** project owner (grill-me)

## Context

Vellum needs an infinite canvas with: shape primitives (rect, ellipse, arrow, sticky, text), pan/zoom, multi-select with rotate/transform, smart connectors (arrows that bind to shapes and follow them), undo/redo, keyboard shortcuts, real-time collaboration scaffolding, and a custom-shape extension API.

Building this from scratch (e.g., on Konva or PixiJS) would take 3–6 months for a single developer to reach feature parity. The PRD's phase 1 scope assumes ~9 weeks total.

Two mature React-based canvas SDKs exist: **tldraw** and **Excalidraw**.

## Decision

Use **tldraw SDK** as the canvas engine. Embed `<Tldraw>` and replace its chrome (toolbar, share button, menus) with Vellum's own UI components. Keep tldraw's built-in canvas + shape tools intact. Register 4 custom shapes via tldraw's shape API. Use **tldraw sync** for real-time collaboration.

Phase 1 keeps the tldraw watermark (free license compliance). Phase 2 evaluates applying for a free commercial license once the project is publicly visible.

## Consequences

### Positive

- Zero work to get an industry-grade canvas: pan/zoom, marquee select, transforms, alignment, undo/redo, keyboard shortcuts, accessibility, mobile gestures, performance optimization.
- **Smart connectors via the bindings API**: arrows attach to shapes and follow them on move. Excalidraw lacks this and it's a Whimsical-defining feature.
- **tldraw sync is a self-hostable Yjs-based CRDT layer**: durable state, conflict resolution, presence (cursors, selections), reconnection — all handled.
- Custom shape API is first-class: shape definition + props + render component + indicator + utility hooks.
- Active development (maintained by tldraw GmbH); used in production by Vercel v0, "Make Real", and others.

### Negative / Trade-offs

- **License is not pure MIT.** The "tldraw license" requires a watermark for commercial use unless a commercial license is purchased. Mitigated for phase 1 (no commercial use; watermark accepted).
- Larger bundle size than Excalidraw or a hand-rolled alternative.
- Customizing chrome is straightforward, but customizing the canvas itself (e.g., changing how selection rendering works) requires deeper SDK knowledge.
- We are coupled to tldraw's development pace and architectural decisions.

## Alternatives Considered

### A. Excalidraw

Rejected. Reasons:

- Visual style is hand-drawn / sketchy via rough.js — opposite of Whimsical's clean aesthetic that Vellum is aiming for.
- Excalidraw is built as an *application*, not a *toolkit*. Its npm package is the app embedded; deep customization requires forking.
- No equivalent of tldraw's bindings API — arrows do not follow shapes natively.
- Self-hosted multiplayer requires significant additional engineering.

### B. Build from scratch on Konva / PixiJS / SVG

Rejected. Reasons:

- 3–6 months of canvas-engine-only work before any Vellum-specific feature can be touched.
- Reinventing well-solved problems (transforms, selection rendering, undo/redo, accessibility).
- Phase 1 scope of 9 weeks is incompatible with this path.

### C. Fabric.js / Excalibur / other 2D engines

Rejected. None offer the React-native shape API + collaboration story of tldraw, and most are general-purpose 2D engines (game / drawing) without infinite-canvas + smart-connector semantics.
