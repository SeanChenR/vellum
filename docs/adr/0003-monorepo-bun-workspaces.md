# ADR-0003: Bun Workspaces Monorepo (apps/web + apps/api + packages/shared)

**Status:** Accepted
**Date:** 2026-04-29
**Decider:** project owner (grill-me)

## Context

Vellum has three logical code areas:

1. React frontend (Vite-like dev server, browser bundle)
2. Bun.serve backend (HTTP API + WebSocket + serve static frontend in production)
3. Shared types & schema (Drizzle table definitions, API contract types, custom shape type defs, locale JSON, zod schemas)

The structural question is whether to organize these as a **single package** with subdirectories (`src/client`, `src/server`, `src/shared`) or as a **monorepo** with separate `package.json` files per area.

## Decision

Use a **Bun workspaces monorepo**:

```
vellum/
├── apps/
│   ├── web/      # React frontend
│   └── api/      # Bun.serve backend
└── packages/
    └── shared/   # Drizzle schema, API types, shape types, locales, zod
```

Root `package.json` declares `workspaces: ["apps/*", "packages/*"]`. Cross-package imports use workspace protocol (`"@vellum/shared": "workspace:*"`).

In **production**, `apps/web` is built to static assets (`apps/web/dist/`) and served by `apps/api`'s `Bun.serve` — still a single process at runtime.

## Consequences

### Positive

- Clear architectural boundaries: web has no direct access to server-only code (DB drivers, secrets); server has no DOM-dependent imports.
- Shared types are a *first-class package* with its own `package.json`, lint config, etc.
- Future-proofs publishing: if any module (e.g., the SSRF validator, the OG parser) is later worth releasing as an open-source library, it already has its own boundary.
- Standard pattern that contributors recognize on day one.
- Bun workspaces are lightweight (no Turborepo / nx infrastructure required).

### Negative / Trade-offs

- More configuration upfront: 3 `package.json` files instead of 1, root `tsconfig` with path aliases, workspace protocol semantics.
- The "single Bun process serves everything" production model requires explicit build orchestration: `bun run build` in `apps/web` produces `dist/`, then `apps/api` reads from there at runtime.
- Slight friction for cross-package refactors (TS path alias must be configured correctly to avoid IDE surprises).
- For a single-developer side project, monorepo overhead is real but not catastrophic.

## Alternatives Considered

### A. Single package with `src/{client,server,shared}/` subdirs

Considered seriously. Bun's killer feature is single-binary full-stack and a single-package layout shows it off most cleanly: `bun run server.ts` could import from anywhere with zero config.

Rejected because:

- The owner explicitly preferred the "more structured" monorepo for the *completeness* feel ("符合現代的開發邏輯").
- For a 9-week phase 1 with multiple deep modules, package boundaries help reviewers (incl. future Claude sessions) reason about what depends on what.
- The trade-off is small: Bun workspaces add ~30 minutes of upfront config.

### B. Two repos (vellum-web, vellum-api)

Rejected. No upside for a solo project: no independent release cadence, no separate teams. Adds version-coordination pain across boundary changes (every shape type or API contract change requires synchronized PRs in two repos).

### C. Turborepo / nx

Rejected. These exist to orchestrate large monorepos with build caching and task graphs. Vellum has 3 packages and a single deployable; the orchestration value-add is negative at this size.
