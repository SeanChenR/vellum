# Phase 1 Milestones

**Status:** ✅ Complete (2026-04-29 → 2026-05-06)
**Released:** [v0.1.0](https://github.com/SeanChenR/vellum/releases/tag/v0.1.0)
**Reference PRD:** [#1](https://github.com/SeanChenR/vellum/issues/1)

Phase 1 ships the local-only foundation — auth, canvas, multiplayer, sharing,
4 custom shapes, 5 export formats, branding, i18n, a11y, test coverage.
Strategy was **mixed milestone**: Day 1 lays the full scaffolding once, then
each milestone is a vertical slice (frontend + backend + tests) that ships
something demoable.

| # | Scope | Spectra change | Status |
|---|---|---|---|
| **Day 1** | Bun monorepo · oxlint+oxfmt · Husky · Tailwind v4+shadcn · TanStack Router/Query · Zustand · i18next · Pino · Drizzle config · Mailpit · bun test+Playwright · rate-limit + SSRF skeleton | (scaffolding, no archive) | ✅ |
| **M1** | Auth — better-auth + Google OAuth + Magic Link · `/login` → `/dashboard` · settings stub · login E2E happy path | [`add-auth`](../openspec/changes/archive/2026-04-30-add-auth/) | ✅ |
| **M2** | Canvas + Folder CRUD — schema · My Canvases / Shared with me 兩區 · CRUD UI · TDD 從這裡開始嚴格 | [`add-canvas-folder-crud`](../openspec/changes/archive/2026-04-29-add-canvas-folder-crud/) | ✅ |
| **M3** | Canvas editor shell — `/canvas/:id` · tldraw embed · 客製 chrome (TopBar + MainMenu) · localStorage 暫存 | [`add-canvas-editor-shell`](../openspec/changes/archive/2026-04-29-add-canvas-editor-shell/) | ✅ |
| **M4** | Multiplayer — WS server · tldraw sync · jsonb persistence · 兩 browser 同步 E2E | [`add-multiplayer-sync`](../openspec/changes/archive/2026-05-02-add-multiplayer-sync/) | ✅ |
| **M5** | Sharing — Email invite · Public link 三檔切換 · WS room auth · viewer-mode read-only | [`add-sharing`](../openspec/changes/archive/2026-05-04-add-sharing/) | ✅ |
| **M6** | 4 Custom shapes — Markdown / Code / Callout (Tier 1) + Link card + OG scrape with SSRF | [`add-custom-shapes`](../openspec/changes/archive/2026-05-04-add-custom-shapes/) | ✅ |
| **M7** | Export — JSON / PNG / SVG / PDF / Markdown，1× / 2× / 4× | [`add-export`](../openspec/changes/archive/2026-05-05-add-export/) | ✅ |
| **M8** | Branding + 動畫 + Landing — logo · 色票 · 字型 · MagicUI hero · Animate UI 微動畫 · About 頁 | [`add-landing-and-branding`](../openspec/changes/archive/2026-05-05-add-landing-and-branding/) · [`unify-navbar`](../openspec/changes/archive/2026-05-05-unify-navbar/) | ✅ |
| **M9** | i18n 補完 + a11y — 所有 string 都有 key · en 翻譯完整 · 鍵盤導航 · ARIA · focus trap | [`audit-i18n-and-a11y`](../openspec/changes/archive/2026-05-06-audit-i18n-and-a11y/) | ✅ |
| **M10** | Test 補位 — coverage 70% · 5 條 E2E happy path · pre-push smoke gate · README 雙語 | [`add-test-coverage`](../openspec/changes/archive/2026-05-06-add-test-coverage/) | ✅ |

### Mid-flight fixes（不算 milestone，但 Phase 1 期間 archive）

| Spectra change | Why |
|---|---|
| [`fix-image-asset-inline`](../openspec/changes/archive/2026-05-05-fix-image-asset-inline/) | 圖片 asset 在 jsonb snapshot 中 inline 化的修正（ADR-0011） |
| [`fix-sync-snapshot-flush`](../openspec/changes/archive/2026-05-05-fix-sync-snapshot-flush/) | tldraw sync 從定時 flush 改為 mutation-driven flush（ADR-0012） |

---

**節奏實況**：原規劃 ≈ 9 週，實際 ≈ 8 天連跑（Claude 寫 + user review，user 高密度投入）。
