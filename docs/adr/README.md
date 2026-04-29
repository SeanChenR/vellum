# Architecture Decision Records (ADR)

ADRs capture *why* significant architectural decisions were made — preserving context that would otherwise be lost as the codebase evolves.

Use `0000-template.md` when creating a new ADR.

## Index

- [ADR-0001](./0001-runtime-bun-over-node.md) — Use Bun as Runtime / PM / Test / WS / Bundler
- [ADR-0002](./0002-canvas-library-tldraw.md) — Use tldraw SDK for the Canvas Engine
- [ADR-0003](./0003-monorepo-bun-workspaces.md) — Bun Workspaces Monorepo
- [ADR-0004](./0004-defer-hosting-decision.md) — Defer Hosting Decision Until Phase 1 Complete
- [ADR-0005](./0005-tldraw-integration-depth-custom-chrome-and-shapes.md) — tldraw Integration: Custom Chrome + Custom Shapes

## When to Add an ADR

Add an ADR when a decision:

- Has multiple viable alternatives that were seriously considered
- Will be hard to reverse later
- Affects multiple modules or future contributors' assumptions
- Could plausibly be questioned by a reviewer 6 months from now ("why did we do it this way?")

A decision that is purely tactical (a single function's algorithm, a UI label) does not need an ADR.
