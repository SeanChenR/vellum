# ADR-0001: Use Bun as Runtime, Package Manager, Test Runner, WebSocket Server, and Bundler

**Status:** Accepted
**Date:** 2026-04-29
**Decider:** project owner (grill-me)

## Context

Vellum is a real-time collaborative canvas app requiring a long-lived WebSocket server, a Postgres client, a React frontend bundle pipeline, and a fast test runner. The candidate runtimes were Node.js, Bun, and Deno. Within the Node ecosystem, the bundler/dev-server question (Vite, Vite Plus, Webpack, esbuild, Turbopack, etc.) is its own decision tree.

The owner explicitly does not want to integrate AI services into the product (the AI is in Claude Code, not in Vellum itself), so Bun's lack of first-class AI SDK support is irrelevant.

## Decision

Use **Bun** as the single binary across:

- Runtime (replacing `node`)
- Package manager (replacing `npm`/`pnpm`)
- Test runner (replacing `vitest`/`jest`)
- HTTP + WebSocket server (`Bun.serve`, replacing `express`/`hono` for the hot path and `ws`/`socket.io` for WebSocket)
- Bundler (`bun build`, replacing `vite`/`webpack`/`rolldown`)

We initially evaluated **Vite Plus** as a unifying CLI on top of the Node ecosystem, then rejected it (see Alternatives).

## Consequences

### Positive

- One binary, one mental model. No `node_modules` of bundler+test+lint each fighting peer-dep version drift.
- Bun's native WebSocket support is a perfect match for tldraw sync's persistent-connection model.
- `bun test` is fast, has built-in mocking, and has React Testing Library support via `happy-dom`.
- Built-in Postgres driver (Bun.SQL) and S3 client (Bun.S3Client) reduce dependency surface area when those are needed.
- Aligns with owner's preference for Bun-native APIs (Bun.file, Bun.password, etc.).

### Negative / Trade-offs

- Some npm packages assume Node-only APIs. Bun's Node compat layer covers most cases but occasionally surfaces edge cases.
- Bun's ecosystem maturity for SDKs (e.g., AWS SDK, Google Cloud SDK) is improving but not equal to Node's. Mitigated by avoiding cloud SDKs in phase 1.
- Cannot run on Vercel / Cloudflare Workers / other Node-only edge platforms. Hosting choices narrowed to: Fly.io, Railway, Render, VPS — accepted (see ADR-0004).
- TLDraw sync's Node reference implementation runs on Bun via `bun --bun` Node-compat mode; works but not officially stamped.

## Alternatives Considered

### A. Node.js + Vite Plus

Initially the working assumption. Rejected after the owner reviewed Vite Plus's documentation and confirmed:

- Vite Plus locks the runtime to Node.js (does not support running on Bun).
- The unifying value of Vite Plus is mainly toolchain consolidation (vite + vitest + oxc via one CLI), but Bun already offers test + bundle natively, leaving Vite Plus's CLI value-add small.
- Bun + oxc gives the same toolchain consolidation without Node's overhead.

### B. Node.js + Vite + vitest + Express + ws

Standard stack. Rejected because the owner specifically wants to use Bun's native features and avoid running multiple binaries for what Bun gives in one.

### C. Deno

Considered briefly. Rejected: smaller npm ecosystem compatibility, no real practical advantage over Bun for this use case.
