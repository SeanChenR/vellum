# Vellum

[English](./README.md) · **繁體中文**

以 tldraw SDK 為核心的協作式白板畫布，搭配自訂 chrome、自訂形狀、即時多人協作，以及完整的帳號 / 分享 / 匯出殼層。

匠心打造 · v0.1.0 · © 2026 Sean Chen

---

## 進度

Phase 1 里程碑（詳見 [`docs/PRD.md`](./docs/PRD.md)）：

| 里程碑 | 範圍 | 狀態 |
|---|---|---|
| Day 1 | Bun monorepo 骨架、oxlint / oxfmt / Husky、Tailwind v4 + shadcn 基礎、TanStack 全家桶、Drizzle 設定 | ✅ |
| M1 | 認證 — better-auth、Google OAuth、Magic Link、`/login` → `/dashboard` | ✅ |
| M2 | Canvas + Folder CRUD、Dashboard 列表頁 | ✅ |
| M3 | 畫布編輯器外殼、tldraw 嵌入、自訂 chrome（TopBar、MainMenu） | ✅ |
| M4 | 多人同步 — tldraw sync 跑在 Bun WebSocket，jsonb 持久化 | ✅ |
| M5 | 分享 — Email 邀請、三模式公開連結、Viewer 強制執行 | ✅ |
| M6 | 4 個自訂形狀 — Markdown / Code / Callout / Link card | ✅ |
| M7 | 匯出 — PNG / SVG / PDF / JSON | ✅ |
| M8 | 品牌 + 登陸頁 + 關於頁 + 動畫系統 | ✅ |
| M9 | i18n 稽核 + 無障礙（focus trap、focus-visible、skip-link） | ✅ |
| M10 | 測試覆蓋率收尾 — 5 條 PRD 黃金路徑、README | ✅ |

下一個版號：Phase 2 deploy checklist 全部關閉時 bump 為 **v1.0.0**。

---

## 快速開始

需要 Bun ≥ 1.3、Docker（給 Mailpit），以及一個 Postgres 資料庫（雲端用 Neon；離線開發任何本機 Postgres 都行）。

```bash
# 1. 安裝
bun install

# 2. 環境設定 — 將 .env.example 複製成 .env，填入 DB_URL 等
cp .env.example .env

# 3. 啟動 Mailpit（開發用 Email）
bun run mailpit:up        # 開啟 http://localhost:8025

# 4. 套用 DB schema
bun run db:migrate

# 5. 啟動 dev server（web + api 都在 http://localhost:3002）
bun run dev
```

登入後進入 `/dashboard`。新建畫布的網址在 `/canvas/:id`。

---

## 技術棧

| 層級 | 選用 | 理由 |
|---|---|---|
| Runtime / PM / Test / WS / Bundler | Bun | 一個工具到位，沒有 Node / npm / vitest / ws 的碎裂感。ADR-0001。 |
| Lint / Format | oxlint + oxfmt | 比 ESLint+Prettier 快、規則明確。 |
| Pre-commit | Husky + lint-staged | 標準作法。`pre-commit` 跑 lint-staged；`pre-push` 跑 E2E smoke。 |
| 前端 | React 19 + tldraw 4.5 | tldraw 是畫布核心，我們在外層加 chrome。ADR-0002、ADR-0005。 |
| CSS / UI | Tailwind v4 + shadcn 風格元件 | 品牌 token 宣告於 `apps/web/src/styles.css`。 |
| Routing | TanStack Router | 型別安全、SPA 風格。 |
| Server state | TanStack Query | Dashboard / 分享狀態的真實來源。 |
| Client state | Zustand | 預留給畫布內部 client-only 狀態。 |
| Forms | react-hook-form + zod | 標準作法。 |
| DB / ORM | Postgres + Drizzle | 畫布快照存 jsonb。 |
| Auth | better-auth | Google OAuth + Magic Link。 |
| Email | Mailpit（dev）→ Resend（Phase 2） | React Email 模板。 |
| Realtime | tldraw sync（自架在 Bun.serve WebSocket） | 單一 binary。ADR-0006。 |
| 動畫 | motion（framer-motion 後繼者） | 共用原語在 `apps/web/src/motion/`。 |
| i18n | i18next + react-i18next | zh-TW + en 同步；`apps/web/src/i18n-audit.test.ts` 阻擋 drift。 |
| E2E | Playwright | `e2e/` 下 11 個 spec。 |

---

## 專案結構

```
.
├── apps/
│   ├── api/                    # Bun.serve — HTTP + WebSocket + 靜態資源
│   │   └── drizzle/            # migrations
│   └── web/                    # React + tldraw 前端
│       └── src/
│           ├── a11y/           # focus trap、稽核
│           ├── auth/           # 登入、route guard、hooks
│           ├── account/        # 個人資料、Session、刪除
│           ├── canvas/         # 編輯器、形狀、同步、分享
│           ├── chrome/         # TopBar、MainMenu（畫布內）
│           ├── components/     # dialog、卡片、Avatar
│           ├── dashboard/      # 畫布列表、folder tabs
│           ├── landing/        # 首頁、About、Navbar、Footer
│           └── motion/         # 動畫原語、dialog wrapper
├── packages/
│   └── shared/                 # Drizzle schema、API 型別、locales、zod
├── docs/
│   ├── PRD.md                  # Phase 1 PRD（規範文件）
│   └── adr/                    # 架構決策紀錄
├── e2e/                        # Playwright spec（11 檔）
└── openspec/                   # 規格驅動開發的真實來源
    ├── specs/                  # 13 個 capability
    └── changes/archive/        # 歷史 change proposals
```

---

## 常用指令

| 任務 | 指令 |
|---|---|
| 啟動 dev（web + api） | `bun run dev` |
| 打包 production | `bun run build` |
| 全 workspace 型別檢查 | `bun run typecheck` |
| Lint | `bun run lint` |
| Format（oxlint --fix） | `bun run format` |
| Unit + integration 測試 | `bun test` |
| 覆蓋率報告 | `bun run test:coverage` |
| E2E 全套 | `bun run test:e2e` |
| E2E smoke 子集 | `bun run test:e2e:smoke` |
| DB 產生 migration | `bun run db:generate` |
| DB 套用 migration | `bun run db:migrate` |
| Drizzle Studio | `bun run db:studio` |
| Mailpit 啟動 / 停止 | `bun run mailpit:up` / `mailpit:down` |
| Spectra（規格流程） | `spectra new change` / `spectra archive` |

---

## 測試策略

三層各司其職：

- **Unit / integration**（`bun test`）— 純函式、hook、跑在 happy-dom 的元件。apps/web 線覆蓋率目標 ~70%。
- **靜態稽核** — `apps/web/src/i18n-audit.test.ts` 擋 hardcoded 顯示字串；`apps/web/src/a11y/icon-button-audit.test.ts` 擋沒 `aria-label` 的 icon 按鈕；`apps/web/src/motion/forbidden-imports.test.ts` 擋 `motion` 滲入畫布編輯器。全部跟著 `bun test` 跑。
- **E2E**（`bun run test:e2e`，Playwright）— 11 個 spec，覆蓋 5 條 PRD 黃金路徑（登入 / 畫布 CRUD / 分享 / 多人 / 匯出 PNG）加輔助流程（Google OAuth、登出與 Session、刪除帳號、公開連結分享）。

E2E smoke（3 個 spec：`smoke`、`auth-magic-link`、`canvas-crud`）會在 `git push` 透過 Husky `pre-push` 跑。要繞過時用 `git push --no-verify`，記得是有意識的。完整套件保持 opt-in。

---

## 架構

單一 binary。`apps/api/src/index.ts` 啟動 Bun.serve，一個 process 同時提供 React bundle、JSON HTTP API、WebSocket sync server。tldraw sync 房間以 jsonb 快照持久化在 Postgres。

```
            ┌────────────────────────────┐
 browser ───▶│  Bun.serve（port 3002）    │───▶ Postgres (Neon)
            │   ├─ 靜態資源（React build）│
            │   ├─ /api/*（HTTP）        │
            │   └─ /sync/*（WebSocket）  │
            └────────────────────────────┘
                         │
                         └──▶ Mailpit（dev） / Resend（Phase 2）
```

關鍵跨層 hook：`useAuth`、`useSyncStore`、`useCanvasList`、`useFolderList`、`useShareState`。自訂形狀放在 `apps/web/src/canvas/shapes/`。Chrome 注入透過 tldraw 的 `components` prop 配合 React context（`VellumChromeContext`）。

---

## Capabilities

每個 capability 都對應 `openspec/specs/<name>/spec.md`。spec 是規範性文件，delta 在 archive 時套用回 spec。

| Capability | 一句話 |
|---|---|
| `a11y` | Focus trap、focus-visible-ring 工具、skip-link、icon button 稽核 |
| `account` | 個人資料編輯、Session 列表與撤銷、刪除帳號 |
| `auth` | better-auth 整合、OAuth + Magic Link、route guard |
| `canvas-editor` | tldraw 嵌入 + 自訂 chrome（TopBar、MainMenu）、每畫布獨立房間 |
| `canvas-export` | PNG / SVG / PDF / JSON 匯出，倍率 1× / 2× / 4× |
| `canvas-management` | 畫布 CRUD（建立 / 改名 / 移動 / 刪除） |
| `canvas-shapes` | 4 個自訂形狀 — Markdown / Code / Callout / Link card |
| `folder-management` | Folder CRUD，附非空刪除阻擋 |
| `i18n-audit` | 靜態 AST 掃描，擋 hardcoded 顯示字串 |
| `motion-system` | 4 個動畫原語 + dialog wrapper、`prefers-reduced-motion` |
| `multiplayer-sync` | tldraw sync 跑在 Bun.serve WebSocket、變更驅動的快照寫入 |
| `public-pages` | 首頁 / About / Navbar / Footer / favicon、認證路由的 AppLayout |
| `sharing` | Email 邀請、公開連結三模式（closed / view / edit） |

---

## ADR 索引

架構決策紀錄都在 [`docs/adr/`](./docs/adr/)，一句話重點：

| # | 決策 | 重點 |
|---|---|---|
| 0001 | [Runtime: Bun over Node](./docs/adr/0001-runtime-bun-over-node.md) | 一個工具涵蓋 runtime / PM / bundler / test / WS — 不再碎裂。 |
| 0002 | [Canvas library: tldraw](./docs/adr/0002-canvas-library-tldraw.md) | 站在 tldraw 肩膀上加 chrome 和形狀。 |
| 0003 | [Monorepo: bun workspaces](./docs/adr/0003-monorepo-bun-workspaces.md) | apps/web、apps/api、packages/shared。 |
| 0004 | [Defer hosting decision](./docs/adr/0004-defer-hosting-decision.md) | Phase 1 純本機；Phase 2 再選 host。 |
| 0005 | [tldraw integration depth: custom chrome and shapes](./docs/adr/0005-tldraw-integration-depth-custom-chrome-and-shapes.md) | 我們覆寫 chrome、加 4 個自訂形狀 — 不只是 embed。 |
| 0006 | [Multiplayer sync trade-offs](./docs/adr/0006-multiplayer-sync-trade-offs.md) | 自架 tldraw sync；jsonb 快照；變更驅動 flush 而非 interval。 |
| 0007 | [Sharing trade-offs](./docs/adr/0007-sharing-trade-offs.md) | 每畫布單一 public-link 紀錄、模式切換；無 request-access 流程。 |
| 0008 | [Markdown engine: marked](./docs/adr/0008-markdown-engine-marked.md) | `marked` + DOMPurify 在 Markdown 形狀渲染消毒過的 HTML。 |
| 0009 | [Shape edit lock vs CRDT](./docs/adr/0009-shape-edit-lock-vs-crdt.md) | 每形狀 edit-lock — 比 CRDT 簡單，符合 dialog 編輯模式。 |
| 0010 | [Link card cache: two-tier](./docs/adr/0010-link-card-cache-two-tier.md) | 伺服器快取（長）+ 客戶端快取（短）給 OG metadata。 |
| 0011 | [Image asset Phase 1: data URL](./docs/adr/0011-image-asset-phase1-data-url.md) | jsonb 內以 data URL 內嵌；雲端上傳是 Phase 2。 |
| 0012 | [Mutation-driven snapshot flush](./docs/adr/0012-mutation-driven-snapshot-flush.md) | commit 時 flush，非定時 — WAL 有界、idle 時 DB 不吵。 |

---

## Spectra 工作流

本專案採用 [Spectra](https://github.com/spectra-app/spectra) 進行規格驅動開發。Spec 是真實來源，code 跟著走。

```
discuss?  →  propose  →  apply  ⇄  ingest  →  archive
```

- `discuss?` — 進規格之前可選 `/spectra-discuss <topic>` 對齊方向。
- `propose` — `/spectra-propose <name>` 在 `openspec/changes/<name>/` 建立 `proposal.md`、`design.md`、`specs/<capability>/spec.md`、`tasks.md`。
- `apply` — `/spectra-apply <name>` 走 task list，邊做邊勾。TDD 優先。
- `ingest` — 需求中途有變，用 `/spectra-ingest` 重新對焦並更新計畫。
- `archive` — `/spectra-archive <name>` 把 change 移進 `openspec/changes/archive/YYYY-MM-DD-<name>/`，並把 delta spec 套用回 `openspec/specs/<capability>/`。

專案慣例放在 [`CLAUDE.md`](./CLAUDE.md)。Spec analyzer 規則在 `.spectra.yaml`。

---

## Phase 2 路線圖

v1.0 高層主題：

- 部署選型決策（Vercel / Fly / Railway）與 prod database
- 真實 Email 透過 Resend（或替代）— 取代 Mailpit
- GitHub Actions CI — 跑 unit + E2E 套件 + 覆蓋率閘門
- 監控 — Sentry、結構化日誌轉到雲端 sink
- 行動裝置適配（< 768px）— 目前是優雅的「desktop-only」提示
- 行銷頁面 — 訂價、FAQ、Changelog（目前 out of scope）
- 畫布資產雲端上傳 — 取代 data URL 內嵌

在那之前，Vellum 跑在本機，等耐心的工匠來打磨。
