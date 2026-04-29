# Vellum

Canvas-based collaborative web app — built on tldraw SDK with custom chrome, custom shapes, real-time multiplayer, and a full account / sharing / export shell.

## Status

Phase 1 — local-only development. See [`docs/PRD.md`](./docs/PRD.md) for the full Phase 1 spec.

## Stack

Bun (runtime, package manager, test runner, WebSocket server, bundler) · React + tldraw SDK · Tailwind v4 + shadcn/ui · TanStack Router + TanStack Query · Drizzle ORM + Postgres on Neon · better-auth (Google OAuth + Magic Link) · tldraw sync (self-hosted) · oxlint + oxfmt · Pino · i18next · Mailpit (dev) → Resend (prod).

See [`CLAUDE.md`](./CLAUDE.md) for project conventions and [`docs/adr/`](./docs/adr/) for architecture decision records.

## Layout

```
apps/
  web/       React + tldraw frontend
  api/       Bun.serve backend (HTTP + WebSocket + static)
packages/
  shared/    Drizzle schema, API types, shape types, locales, zod
docs/        PRD + ADRs
e2e/         Playwright tests
```

## Getting started

Requires Bun ≥ 1.3 and Docker (for Mailpit).

```bash
bun install
bun run mailpit:up        # start local Mailpit container
bun run db:migrate        # apply Drizzle migrations
bun run dev               # start web + api concurrently
```

## Common commands

| Task | Command |
|---|---|
| Run dev (web + api) | `bun run dev` |
| Type check all packages | `bun run typecheck` |
| Lint | `bun run lint` |
| Format (oxlint --fix) | `bun run format` |
| Unit + integration tests | `bun test` |
| Coverage | `bun run test:coverage` |
| E2E (Playwright) | `bun run test:e2e` |
| Drizzle Studio | `bun run db:studio` |

## License

To be decided before Phase 1 wrap.
