# CLAUDE.md — Vellum Project Instructions

This file is automatically loaded by Claude Code into every conversation in this repo. It is the **canonical source of truth** for project conventions; if anything here conflicts with general training, follow this file.

For the full background, read [`docs/PRD.md`](./docs/PRD.md). For per-decision rationale, see [`docs/adr/`](./docs/adr/).

---

## What is Vellum

A canvas-based collaborative web app — Whimsical-clone aesthetic — built on tldraw SDK with custom chrome, custom shapes, real-time multiplayer, and a complete account / sharing / export shell.

**Owner motivation:** "不想做一半"（craftsmanship-driven, not user-acquisition-driven）. Phase 1 is local-only; deployment is deferred.

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
| Logging | Pino → stdout (structured JSON) |
| i18n | i18next + react-i18next (zh-TW + en) |

**Single binary architecture:** Bun.serve handles HTTP API + WebSocket + static frontend in one process.

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
│   └── api/               # Bun.serve (HTTP + WS + static serve)
│       └── drizzle/       # migrations
├── packages/
│   └── shared/            # Drizzle schema, API types, shape types, locales, zod
├── docs/
│   ├── PRD.md             # full Phase 1 PRD
│   └── adr/               # architecture decision records
├── e2e/                   # Playwright tests
└── asset/                 # logo, brand assets
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

These are **explicitly Phase 2+** and must not be added to Phase 1 work:

Mobile (<768px) · Comments / @mentions · Multi-page canvas · Mind-map / Voting / Table shapes · Wireframe components · AI integration · Image cloud upload · Embed iframe API · Activity log / version history · Sentry · Analytics · Real email via Resend · Custom domain · Offline / PWA · Public canvas discovery

If a request seems to require any of these, surface the conflict before proceeding.

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
- **ADRs:** `docs/adr/`
- **Auto memory (cross-conversation):** `.claude/projects/-Users-seanchen-Sean-MySideProject-vellum/memory/MEMORY.md`
- **Phase 1 Milestones:** `project_milestones.md` in memory
- **Deploy checklist (phase 1 → 2 transition):** `project_deploy_checklist.md` in memory

---

## When in Doubt

1. **Defer to user when scope is ambiguous** — don't expand or contract Phase 1 silently.
2. **Prefer "完整" over "minimal"** when choosing between two complete-feeling options. The user has stated this preference clearly.
3. **Engineering volume is not a cost** — don't suggest skipping work to save time. Suggest skipping only when it harms review quality or violates an Out-of-Scope Guard.
4. **Ask for visual approval before declaring UI work done** — TDD covers logic, not look. The user must see it in a browser.
