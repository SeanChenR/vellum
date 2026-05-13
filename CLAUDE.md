<!-- SPECTRA:START v1.0.2 -->

# Spectra Instructions

This project uses Spectra for Spec-Driven Development(SDD). Specs live in `openspec/specs/`, change proposals in `openspec/changes/`.

## Use `/spectra-*` skills when:

- A discussion needs structure before coding → `/spectra-discuss`
- User wants to plan, propose, or design a change → `/spectra-propose`
- Tasks are ready to implement → `/spectra-apply`
- There's an in-progress change to continue → `/spectra-ingest`
- User asks about specs or how something works → `/spectra-ask`
- Implementation is done → `/spectra-archive`
- Commit only files related to a specific change → `/spectra-commit`

## Workflow

discuss? → propose → apply ⇄ ingest → archive

- `discuss` is optional — skip if requirements are clear
- Requirements change mid-work? Plan mode → `ingest` → resume `apply`

## Parked Changes

Changes can be parked（暫存）— temporarily moved out of `openspec/changes/`. Parked changes won't appear in `spectra list` but can be found with `spectra list --parked`. To restore: `spectra unpark <name>`. The `/spectra-apply` and `/spectra-ingest` skills handle parked changes automatically.

<!-- SPECTRA:END -->

# CLAUDE.md — Vellum Project Instructions

This file is automatically loaded by Claude Code into every conversation in this repo. It is the **canonical source of truth** for project conventions; if anything here conflicts with general training, follow this file.

For the full background, read [`docs/PRD.md`](./docs/PRD.md). For per-decision rationale, see [`docs/adr/`](./docs/adr/).

---

## What is Vellum

A canvas-based collaborative web app — Whimsical-clone aesthetic — built on tldraw SDK with custom chrome, custom shapes, real-time multiplayer, a complete account / sharing / export shell, an in-canvas AI side panel (BYOK across Anthropic / OpenAI / Google), and an MCP server so external AI clients (Claude Desktop, Cursor) can drive canvas edits.

**Owner motivation:** "不想做一半"（craftsmanship-driven, not user-acquisition-driven）. Phase 1 (local canvas foundation, M1–M10) and Phase 2 (AI co-pilot + MCP, M11–M15) are both shipped. Deployment is the next milestone gate (pre-v1.0).

**Implementation model:** Claude writes; user reviews. Engineering volume is not a cost; review/decision quality is.

---

## Tech Stack (Pinned)

| Layer | Choice |
|---|---|
| Runtime / PM / Test / WS / Bundler | **Bun** (no Node, no npm, no vitest, no ws) |
| Lint / Format | **oxlint** + **oxfmt** (no eslint, no prettier) |
| Pre-commit | Husky + lint-staged |
| Frontend | React + tldraw SDK |
| CSS / UI | Tailwind v4 + shadcn/ui + MagicUI + Animate UI (shared `motion`) |
| Routing | TanStack Router |
| Server state | TanStack Query |
| Client-only state | Zustand |
| Form | react-hook-form + zod |
| Fonts | Inter (UI) + Newsreader (serif accent) |
| DB / ORM | Postgres on Neon + Drizzle ORM (snapshots in jsonb) |
| Auth | better-auth (Google OAuth + Magic Link) |
| Email | Mailpit (dev, local Docker) → Resend (prod, phase 2) |
| Email template | React Email |
| Realtime | tldraw sync, self-hosted on Bun.serve WebSocket |
| AI agent | Vercel AI SDK (`ai` + per-provider adapters) with cancel + timeout |
| AI providers (BYOK) | `@ai-sdk/anthropic` + `@ai-sdk/openai` + `@ai-sdk/google` — user supplies the key, server encrypts at rest |
| AI surface | In-canvas Side Panel + per-canvas threads + SSE streaming + cursor AI badge |
| MCP transport | Stateless Streamable HTTP JSON-RPC at `POST /api/mcp`, PAT-authenticated |
| Logging | Pino → stdout (structured JSON) |
| i18n | i18next + react-i18next (zh-TW + en) |

**Single binary architecture:** Bun.serve handles HTTP API + WebSocket + static frontend + MCP endpoint in one process.

---

## Repository Layout

```
vellum/
├── package.json           # workspace root
├── tsconfig.json          # path aliases for cross-package imports
├── bun.lock
├── biome.json | oxlint.json
├── .husky/
├── docker-compose.yml     # Mailpit
├── apps/
│   ├── web/               # React + tldraw frontend
│   │   └── src/
│   │       ├── agent/     # AI Side Panel, ChatComposer, ThreadSwitcher, useAgentRun, cursor-ai-badge
│   │       ├── account/   # Profile, Sessions, API Keys, MCP Tokens panel
│   │       └── canvas/    # Editor, sync store, shape utils, CollaboratorCursorWithBadge
│   └── api/               # Bun.serve (HTTP + WS + MCP + static serve)
│       ├── drizzle/       # migrations
│       └── src/
│           ├── agent/     # runtime, streaming, threads, title-gen, wiring
│           ├── byok/      # vault (encrypt-at-rest), providers, routes
│           ├── mcp/       # JSON-RPC dispatch, methods (initialize/ping/tools.list/tools.call)
│           ├── pat/       # PAT repo, token format, authenticator, routes
│           ├── lib/       # permission-guard, rate-limit-rules, validate-external-url
│           └── sync/      # mutator, mutator-readers, tool-registry, list-canvases-reader
├── packages/
│   └── shared/            # Drizzle schema, API types, shape types, locales, zod
├── docs/
│   ├── PRD.md             # full Phase 1 PRD
│   ├── PHASE2_MILESTONES.md  # M11–M15 status
│   └── adr/               # architecture decision records
├── e2e/                   # Playwright tests (incl. mcp-server-roundtrip, agent-multi-tab-badge)
└── asset/                 # logo, brand assets, demo video
```

---

## Hard Rules (Override Defaults)

### 1. TDD-first — Logic走TDD, 視覺走預覽

When implementing any new feature or fix:

1. **Show user a test plan FIRST** (what you'll test, what shapes the assertions take).
2. **Write failing tests** before implementation.
3. **Implement minimum code to pass**.
4. **Refactor with tests green**.

**Where TDD applies (strict):**
- Pure functions / utilities
- Drizzle schema + validators
- All API endpoints
- Custom shape *behavior* (Markdown parsing, Code highlighting logic, Link card OG parsing)
- Chrome component *interaction logic* (TopBar / MainMenu / ShareDialog open/close, focus, state transitions)
- Multiplayer convergence / CRDT semantics (E2E)
- Auth flows (E2E with test-mode magic link)

**Where TDD does NOT apply (use browser-preview iteration):**
- Custom shape *visual* (layout, fonts, spacing)
- Chrome *visual* styling
- tldraw's built-in behavior (already tested upstream)
- Landing page visuals
- Brand tokens / locale JSON (declarative, no logic)

**Coverage target:** 70% (not 80% — canvas rendering tests have low ROI).

### 2. i18n — Day 1 Discipline, Two-Language Sync

**Every UI string must go through `t('key')`.** Never hardcode display strings in components.

When adding a feature with new strings, **always add both zh-TW and en translations in the same change**. Letting one language drift behind is forbidden.

Server returns `errorKey` strings (i18n keys) — never pre-translated text. The client looks up the key.

Locale files: `packages/shared/locales/{zh-TW,en}.json`. Key naming: dot.notation (e.g., `canvas.share.invitePlaceholder`).

### 3. SSRF — All External Fetches Must Pass `validateExternalUrl()`

Any server-side `fetch(url)` to an external URL (OG scrape for Link card, future webhook integrations, etc.) MUST go through the shared `validateExternalUrl(url)` utility, which:

- Rejects non-`http(s)` protocols
- Resolves DNS and rejects RFC1918 / loopback / link-local addresses
- Caps response size (5MB) and timeout (5s)

Never call `fetch(userProvidedUrl)` directly without the validator. This is a hard architectural rule, not a guideline.

### 4. Rate Limiting — All Endpoints

Every API endpoint and the WebSocket connection have rate limit rules applied. New endpoints must declare their rate limit at definition time (not retrofitted later). Use the shared in-process `RateLimiter` (LRU + token bucket) — no external Redis dependency.

429 responses always include `Retry-After` header.

### 5. Animation Discipline

- ✅ **Use motion (MagicUI / Animate UI):** Landing page, Dashboard, Dialog enter/exit, Toast, Sidebar slide, Empty states, Loaders.
- ❌ **No motion:** Inside the canvas (tldraw owns animation timing — competing animations break UX). Multiplayer cursor / presence updates (must be instant).

### 6. Bun-Native Preference

When solving a problem, prefer Bun built-ins over npm packages:

- `Bun.file` / `Bun.write` over `node:fs`
- `Bun.SQL` (via Drizzle adapter) over `pg` directly
- `Bun.password` over `bcryptjs`
- `Bun.serve({ fetch, websocket })` for HTTP + WS (do not install `ws`, `socket.io`, `express`, `hono` for the server hot path)
- `bun test` for unit tests (no vitest, no jest)
- `Bun.S3Client` if S3 access is added in phase 2

### 7. Sharing Semantics (Reference)

- Owner cannot leave their own canvas (must transfer or delete)
- Public link is per-canvas with a single record per canvas, switching `mode: closed | view | edit`
- Anonymous editors via public-link-edit get tldraw's auto-assigned anonymous animal names
- No "request access" flow — if you don't have the link / weren't invited, you don't see it

### 8. Out-of-Scope Guard

Phase 1 + Phase 2 are shipped (canvas foundation + AI co-pilot + MCP). The following remain **explicitly out of scope** until they reach an approved milestone:

Mobile (<768px) · Comments / @mentions · Multi-page canvas · Mind-map / Voting / Table shapes · Wireframe components · Image cloud upload · Embed iframe API · Activity log / version history · Sentry · Analytics · Real email via Resend · Custom domain · Offline / PWA · Public canvas discovery · Cross-canvas memory · Multi-agent orchestration · Plan-then-execute confirmation steps · In-app token usage billing surfaces

If a request seems to require any of these, surface the conflict before proceeding.

### 9. MCP Tool Surface Discipline

When changing the tool registry (`apps/api/src/sync/tool-registry.ts`):

- The MCP `tools/list` handler injects `canvasId` into every canvas-scoped tool's schema. Canvas-scoped schemas SHALL NOT declare `canvasId` themselves; the in-process agent runtime supplies it out-of-band.
- The MCP `tools/call` dispatcher strips `canvasId` from args before Zod validation; tool schemas remain `.strict()`-compatible.
- Tool description is part of the contract — LLM-facing chain hints (e.g. "call `listShapes` first before placing new shapes") belong in the description, not in code comments.
- `listCanvases` is user-scoped: it ignores `canvasId` and resolves the user from the authenticated session.

---

## Common Commands

```bash
# Install
bun install

# Dev (web + api concurrently)
bun run dev

# Type check
bun run typecheck

# Lint / format
bunx oxlint
bunx oxfmt

# Tests
bun test                          # unit + component + integration
bun test --coverage               # with coverage
bun run test:e2e                  # Playwright

# DB
bunx drizzle-kit generate         # generate migration from schema diff
bunx drizzle-kit migrate          # apply migrations
bunx drizzle-kit studio           # GUI

# Mailpit (dev email)
docker compose up -d mailpit      # then visit http://localhost:8025
```

(These commands assume scaffolding is complete. During Day 1 scaffolding, the actual scripts are being established.)

---

## Memory & Documentation

- **PRD (canonical):** `docs/PRD.md` and GitHub Issue #1
- **Phase 1 milestone log:** `docs/PHASE1_MILESTONES.md`
- **Phase 2 milestone log:** `docs/PHASE2_MILESTONES.md` (M11–M15 ✅ v0.6.0)
- **ADRs:** `docs/adr/` (latest: 0019 — M13 e2e five-bug postmortem)
- **Specs (canonical):** `openspec/specs/<capability>/spec.md` — 24 capabilities as of M15
- **Auto memory (cross-conversation):** `.claude/projects/-Users-seanchen-Sean-MySideProject-vellum/memory/MEMORY.md`
- **Deploy checklist (pre-v1.0):** `project_deploy_checklist.md` in memory

---

## When in Doubt

1. **Defer to user when scope is ambiguous** — don't expand or contract Phase 1 silently.
2. **Prefer "完整" over "minimal"** when choosing between two complete-feeling options. The user has stated this preference clearly.
3. **Engineering volume is not a cost** — don't suggest skipping work to save time. Suggest skipping only when it harms review quality or violates an Out-of-Scope Guard.
4. **Ask for visual approval before declaring UI work done** — TDD covers logic, not look. The user must see it in a browser.
