# Vellum

**English** · [繁體中文](./README.zh-TW.md)

A canvas-based collaborative whiteboard built on the tldraw SDK with custom chrome, custom shapes, real-time multiplayer, and a full account / sharing / export shell.

Made with care · v0.1.0 · © 2026 Sean Chen

---

## Status

Phase 1 milestone roadmap (see [`docs/PRD.md`](./docs/PRD.md)):

| Milestone | Scope | Status |
|---|---|---|
| Day 1 | Bun monorepo scaffolding, oxlint / oxfmt / Husky, Tailwind v4 + shadcn skeleton, TanStack stack, Drizzle config | ✅ |
| M1 | Auth — better-auth, Google OAuth, Magic Link, `/login` → `/dashboard` | ✅ |
| M2 | Canvas + Folder CRUD, dashboard list views | ✅ |
| M3 | Canvas editor shell, tldraw embed, custom chrome (TopBar, MainMenu) | ✅ |
| M4 | Multiplayer — tldraw sync over Bun WebSocket, jsonb persistence | ✅ |
| M5 | Sharing — email invite, public link with three modes, viewer enforcement | ✅ |
| M6 | 4 custom shapes — Markdown / Code / Callout / Link card | ✅ |
| M7 | Export — PNG / SVG / PDF / JSON | ✅ |
| M8 | Branding + Landing + About + motion system | ✅ |
| M9 | i18n audit + a11y (focus trap, focus-visible, skip-link) | ✅ |
| M10 | Test coverage closing — 5 PRD happy paths, README | ✅ |

Next planned bump: **v1.0.0** when the Phase 2 deploy checklist is closed.

---

## Quick Start

Requires Bun ≥ 1.3, Docker (for Mailpit), and a Postgres database (Neon for hosted; any local Postgres for offline dev).

```bash
# 1. install
bun install

# 2. environment — copy .env.example to .env and fill in DB_URL etc.
cp .env.example .env

# 3. start mailpit (dev email)
bun run mailpit:up        # open http://localhost:8025

# 4. apply DB schema
bun run db:migrate

# 5. start dev servers (web + api on http://localhost:3002)
bun run dev
```

After login, you land on `/dashboard`. New canvases live at `/canvas/:id`.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime / PM / Test / WS / Bundler | Bun | One tool, no Node / npm / vitest / ws fragmentation. ADR-0001. |
| Lint / Format | oxlint + oxfmt | Faster than ESLint+Prettier, opinionated rules. |
| Pre-commit | Husky + lint-staged | Standard. `pre-commit` runs lint-staged; `pre-push` runs E2E smoke. |
| Frontend | React 19 + tldraw 4.5 | tldraw is the canvas core; we add chrome around it. ADR-0002, ADR-0005. |
| CSS / UI | Tailwind v4 + shadcn-style components | Brand tokens declared in `apps/web/src/styles.css`. |
| Routing | TanStack Router | Type-safe, SPA-style. |
| Server state | TanStack Query | Source of truth for dashboard / share state. |
| Client state | Zustand | Reserved for canvas-local client state. |
| Forms | react-hook-form + zod | Standard. |
| DB / ORM | Postgres + Drizzle | jsonb for canvas snapshots. |
| Auth | better-auth | Google OAuth + Magic Link. |
| Email | Mailpit (dev) → Resend (Phase 2) | React Email templates. |
| Realtime | tldraw sync (self-hosted on Bun.serve WebSocket) | Single binary. ADR-0006. |
| Animation | motion (framer-motion successor) | Reusable primitives in `apps/web/src/motion/`. |
| i18n | i18next + react-i18next | zh-TW + en synced; `apps/web/src/i18n-audit.test.ts` blocks drift. |
| E2E | Playwright | 11 specs under `e2e/`. |

---

## Repo Layout

```
.
├── apps/
│   ├── api/                    # Bun.serve — HTTP + WebSocket + static
│   │   └── drizzle/            # migrations
│   └── web/                    # React + tldraw frontend
│       └── src/
│           ├── a11y/           # focus trap, audit
│           ├── auth/           # login, route guard, hooks
│           ├── account/        # profile, sessions, delete
│           ├── canvas/         # editor, shapes, sync, share
│           ├── chrome/         # TopBar, MainMenu (in-canvas)
│           ├── components/     # dialogs, cards, avatar
│           ├── dashboard/      # canvas list, folder tabs
│           ├── landing/        # Homepage, About, Navbar, Footer
│           └── motion/         # primitives, dialog wrapper
├── packages/
│   └── shared/                 # Drizzle schema, API types, locales, zod
├── docs/
│   ├── PRD.md                  # Phase 1 PRD (canonical)
│   └── adr/                    # architecture decision records
├── e2e/                        # Playwright specs (11 files)
└── openspec/                   # Spec-driven development source of truth
    ├── specs/                  # 13 capabilities
    └── changes/archive/        # historical change proposals
```

---

## Common Commands

| Task | Command |
|---|---|
| Start dev (web + api) | `bun run dev` |
| Build production bundle | `bun run build` |
| Type check all workspaces | `bun run typecheck` |
| Lint | `bun run lint` |
| Format (oxlint --fix) | `bun run format` |
| Unit + integration tests | `bun test` |
| Coverage report | `bun run test:coverage` |
| E2E full suite | `bun run test:e2e` |
| E2E smoke subset | `bun run test:e2e:smoke` |
| DB generate migration | `bun run db:generate` |
| DB apply migration | `bun run db:migrate` |
| Drizzle Studio | `bun run db:studio` |
| Mailpit up / down | `bun run mailpit:up` / `mailpit:down` |
| Spectra (spec workflow) | `spectra new change` / `spectra archive` |

---

## Test Strategy

Three layers, each with a clear purpose:

- **Unit / integration** (`bun test`) — pure functions, hooks, components rendered in jsdom-style happy-dom. ~70% line coverage target on the apps/web codebase.
- **Static audits** — `apps/web/src/i18n-audit.test.ts` blocks hardcoded display strings; `apps/web/src/a11y/icon-button-audit.test.ts` blocks icon-only buttons without `aria-label`; `apps/web/src/motion/forbidden-imports.test.ts` blocks `motion` from leaking into the canvas-editor surface. All run as part of `bun test`.
- **E2E** (`bun run test:e2e`, Playwright) — 11 specs covering the 5 PRD happy paths (login / canvas CRUD / sharing / multiplayer / export PNG) plus auxiliary flows (Google OAuth, logout & sessions, account delete, public-link share).

E2E smoke (3 specs: `smoke`, `auth-magic-link`, `canvas-crud`) runs on `git push` via Husky `pre-push`. Bypass with `git push --no-verify` when intentional. Full suite stays opt-in.

---

## Architecture

Single binary. `apps/api/src/index.ts` boots Bun.serve, which serves the React bundle, the JSON HTTP API, and the WebSocket sync server in one process. tldraw sync rooms are persisted as jsonb snapshots in Postgres.

```
            ┌────────────────────────────┐
 browser ───▶│  Bun.serve  (port 3002)    │───▶ Postgres (Neon)
            │   ├─ static (React build)  │
            │   ├─ /api/* (HTTP)         │
            │   └─ /sync/* (WebSocket)   │
            └────────────────────────────┘
                         │
                         └──▶ Mailpit (dev) / Resend (Phase 2)
```

Key cross-cutting hooks: `useAuth`, `useSyncStore`, `useCanvasList`, `useFolderList`, `useShareState`. Custom shapes live in `apps/web/src/canvas/shapes/`. Chrome injection uses tldraw's `components` prop with a React context (`VellumChromeContext`).

---

## Capabilities

Each capability has a spec under `openspec/specs/<name>/spec.md`. Specs are normative; deltas are applied at archive time.

| Capability | One-liner |
|---|---|
| `a11y` | Focus trap, focus-visible-ring utility, skip-link, icon-button audit |
| `account` | Profile edit, session listing & revoke, delete account |
| `auth` | better-auth integration, OAuth + Magic Link, route guard |
| `canvas-editor` | tldraw embed + custom chrome (TopBar, MainMenu), per-canvas room |
| `canvas-export` | PNG / SVG / PDF / JSON export, scale 1× / 2× / 4× |
| `canvas-management` | Canvas CRUD (create / rename / move / delete) |
| `canvas-shapes` | 4 custom shapes — Markdown / Code / Callout / Link card |
| `folder-management` | Folder CRUD with non-empty delete guard |
| `i18n-audit` | Static AST scanner blocking hardcoded display strings |
| `motion-system` | 4 motion primitives + dialog wrapper, `prefers-reduced-motion` |
| `multiplayer-sync` | tldraw sync over Bun.serve WebSocket, mutation-driven snapshot flush |
| `public-pages` | Homepage / About / Navbar / Footer / favicon, AppLayout for authenticated routes |
| `sharing` | Email invite, public link three modes (closed / view / edit) |

---

## ADR Index

Architecture decision records live under [`docs/adr/`](./docs/adr/). One-line takeaways:

| # | Decision | Takeaway |
|---|---|---|
| 0001 | [Runtime: Bun over Node](./docs/adr/0001-runtime-bun-over-node.md) | Single tool covers runtime / PM / bundler / test / WS — no fragmentation. |
| 0002 | [Canvas library: tldraw](./docs/adr/0002-canvas-library-tldraw.md) | Standing on tldraw's shoulders; build chrome and shapes on top. |
| 0003 | [Monorepo: bun workspaces](./docs/adr/0003-monorepo-bun-workspaces.md) | apps/web, apps/api, packages/shared. |
| 0004 | [Defer hosting decision](./docs/adr/0004-defer-hosting-decision.md) | Phase 1 is local-only; pick host in Phase 2. |
| 0005 | [tldraw integration depth: custom chrome and shapes](./docs/adr/0005-tldraw-integration-depth-custom-chrome-and-shapes.md) | We override chrome and add 4 custom shapes — not just an embed. |
| 0006 | [Multiplayer sync trade-offs](./docs/adr/0006-multiplayer-sync-trade-offs.md) | Self-host tldraw sync; jsonb snapshots; flush on mutation, not interval. |
| 0007 | [Sharing trade-offs](./docs/adr/0007-sharing-trade-offs.md) | One public-link record per canvas with mode toggle; no request-access flow. |
| 0008 | [Markdown engine: marked](./docs/adr/0008-markdown-engine-marked.md) | `marked` + DOMPurify for sanitised HTML in the Markdown shape. |
| 0009 | [Shape edit lock vs CRDT](./docs/adr/0009-shape-edit-lock-vs-crdt.md) | Edit-lock per shape — simpler than CRDT, fits dialog-based editing. |
| 0010 | [Link card cache: two-tier](./docs/adr/0010-link-card-cache-two-tier.md) | Server cache (long) + client cache (short) for OG metadata. |
| 0011 | [Image asset Phase 1: data URL](./docs/adr/0011-image-asset-phase1-data-url.md) | Inline as data URL in jsonb; cloud upload is Phase 2. |
| 0012 | [Mutation-driven snapshot flush](./docs/adr/0012-mutation-driven-snapshot-flush.md) | Flush on commit, not on a timer — bounded WAL, no idle DB chatter. |

---

## Spectra Workflow

This repo uses [Spectra](https://github.com/spectra-app/spectra) for spec-driven development. Specs are the source of truth; code follows.

```
discuss?  →  propose  →  apply  ⇄  ingest  →  archive
```

- `discuss?` — optional `/spectra-discuss <topic>` to align on direction before formalising.
- `propose` — `/spectra-propose <name>` creates `proposal.md`, `design.md`, `specs/<capability>/spec.md`, `tasks.md` under `openspec/changes/<name>/`.
- `apply` — `/spectra-apply <name>` walks the task list, marking each as it's implemented. TDD-first.
- `ingest` — if requirements change mid-work, `/spectra-ingest` re-syncs the change with a new plan.
- `archive` — `/spectra-archive <name>` moves the change under `openspec/changes/archive/YYYY-MM-DD-<name>/` and applies delta specs to `openspec/specs/<capability>/`.

Project conventions in [`CLAUDE.md`](./CLAUDE.md). Spec analyzer rules in `.spectra.yaml`.

---

## Roadmap

| Phase | Theme | Status |
|---|---|---|
| **Phase 1** | Local-only canvas foundation — auth · CRUD · multiplayer · sharing · custom shapes · export · branding · i18n+a11y · test coverage | ✅ Shipped — see [docs/PHASE1_MILESTONES.md](./docs/PHASE1_MILESTONES.md) |
| **Phase 2** | AI co-pilot integration — server-side agent · BYOK (9 models across Anthropic / OpenAI / Google) · low-level tool primitives · progressive streaming | 🚧 Planning — see [docs/PHASE2_MILESTONES.md](./docs/PHASE2_MILESTONES.md) |
| **Pre-deploy** (before v1.0) | Hosting decision · Resend (real email) · GitHub Actions CI · Sentry · CSP headers · secrets store migration | ⏳ Deferred per [ADR-0004](./docs/adr/0004-defer-hosting-decision.md) |
| **Phase 3+** | Mobile responsive · canvas asset cloud upload · cross-canvas memory · multi-agent orchestration · marketing surfaces | ⏳ Backlog |

Until **v1.0**, Vellum runs locally and is ready for the patient builder.
