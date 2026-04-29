## Context

Vellum 在 phase 1 透過 tldraw SDK 取得「無限 canvas + shape 工具 + transform + undo + 鍵盤捷徑 + accessibility」全套（ADR-0002）。整合層級為 ADR-0005 §Decision「客製 chrome + 客製 shape」(level c)。本 change 是這個整合層級的**第一塊落地**：把空殼立起來，讓 chrome 取代 tldraw 預設 UI、tldraw 內建工具仍可用、編輯內容會被自動保存（先用 localStorage，server-side sync 是後續 change 的事）。

當前 scaffolding 狀態（已驗證）：

- `apps/web/` 已有 React 19 + TanStack Router + Tailwind v4 + i18next 骨架；`tldraw` package 尚未安裝。
- `apps/web/src/router.tsx` 目前只有 `/` 一條路由；本 change 會新增 `/canvas/:id`。
- `apps/web/src/styles.css` 已有 Vellum brand tokens（ink-navy / parchment-cream / warm-sepia / off-white / Inter / Newsreader）。
- `packages/shared/` 已是 workspace；可放 `shape-types.ts` 與 `locales/{zh-TW,en}.json`。
- 上游 change `add-auth` 與 `add-canvas-folder-crud` 仍在 propose 階段；本 change 假設兩者完成後提供：(i) `useAuth()` hook、(ii) route guard、(iii) canvas metadata query、(iv) rename / duplicate / delete mutation hooks、(v) 404 / 403 落地。本 change 不重複實作。

stakeholders：

- 唯一使用者＝專案擁有者；review 是主要約束。
- 實作者＝Claude；engineering volume 不是約束。
- 後續 change 維護者：`add-shape-framework`、`add-multiplayer-sync`、`add-sharing`、`add-export` 都會擴充本 change 建立的殼。

constraints：

- CLAUDE.md hard rule 1（TDD-first）：chrome 互動、persistence 模組必須 TDD；tldraw 視覺與 chrome 樣式走預覽迭代。
- CLAUDE.md hard rule 2（i18n）：所有 chrome 字串走 `t('canvas.chrome.*')`；zh-TW + en 同步。
- CLAUDE.md hard rule 5（動畫）：MainMenu 下拉、rename dialog、toast 走 motion；canvas 區內無 motion。
- CLAUDE.md hard rule 8（Out-of-scope）：multi-page、image cloud、mobile、watermark 移除、Sentry、history 全部不做。
- ADR-0005 §Negative：保留 tldraw 浮水印。
- 70% 測試覆蓋目標（PRD §Testing Decisions）；canvas 渲染本身不算入。

## Goals / Non-Goals

**Goals:**

- 讓登入後的使用者點開一張存在的 canvas 後，看到 Vellum chrome（不是 tldraw 預設 chrome）並可使用 tldraw 內建編輯工具創作內容（PRD US #17、US #18）。
- 編輯內容自動持久化到 localStorage，下次回來看得到（PRD US #23 phase 1 解法）；超過 5MB 或 quota exceeded 時 graceful degrade（停寫 + toast）。
- 為後續 4 個 custom shape change 預留乾淨的擴充點（`packages/shared/src/shape-types.ts` 中央 registry）。
- 為後續 `add-multiplayer-sync` 預留乾淨的 swap 點（persistence 是 deep module，介面 `loadSnapshot` / `saveSnapshot`，sync 接管時換實作不換呼叫端）。
- 為後續 `add-sharing` 預留乾淨的接點（TopBar 的 Share 按鈕已存在，是 placeholder；sharing change 只改實作不改 layout）。
- 為後續 `add-export` 預留乾淨的接點（MainMenu 已有「匯出」子選單佔位）。
- chrome 互動邏輯（TopBar dropdown、MainMenu navigation、rename dialog open/close/focus trap、Share placeholder toast 觸發）有單元測試覆蓋。
- 持久化 deep module（`loadSnapshot` / `saveSnapshot`）有單元測試覆蓋 round-trip、缺 key、malformed JSON、quota exceeded、>5MB cap 五種情境。
- chrome 視覺契合 Vellum 品牌語言（ink-navy / parchment-cream / warm-sepia / Newsreader serif accent）；視覺不走 TDD，走 user 在 browser 預覽 review。

**Non-Goals:**

- 不寫任何 custom shape ShapeUtil（屬於 `add-shape-framework` 與 4 個 `add-shape-*`）。
- 不寫任何 server endpoint（持久化純前端 localStorage）。
- 不寫任何 Drizzle schema（canvas 表由 `add-canvas-folder-crud` 負責；snapshot 表由 `add-multiplayer-sync` 負責）。
- 不寫真正的 sharing UI（ShareDialog 邏輯由 `add-sharing` 接手）。
- 不寫真正的 export 邏輯（PNG/SVG/PDF/JSON/Markdown 由 `add-export` 接手）。
- 不寫 multiplayer cursor / presence list（屬於 `add-multiplayer-sync`）。
- 不寫 mobile (<768px) 適配。
- 不寫 canvas 不存在 / 無權限的 404 / 403 落地頁（`add-canvas-folder-crud` 負責）。
- 不申請 tldraw commercial license / 移除 watermark（phase 2 議題）。

## Decisions

### Wrap `<Tldraw>` with `components` prop, not children-based composition

tldraw SDK 提供 `components={{ TopPanel, MainMenu, SharePanel, HelpMenu, ... }}` prop 讓 host app 替換特定 chrome 槽位（ADR-0005 §Decision、tldraw docs）。我們用這個官方 extension point 而**不**用「`<Tldraw />` 旁邊另畫一個自家頂部 bar 蓋上去」這種 hack，理由：

- `components` prop 是 supported API；shouldering chrome 是 tldraw 的設計用途，未來升級 tldraw 比 hack overlay 安全。
- 槽位精確：`TopPanel` 替換頂部、`MainMenu` 替換 File menu、`SharePanel` 槽位顯式設 `null` 隱藏 tldraw 預設 share 入口（避免雙 share 按鈕）。
- 槽位以外的（右側 shape toolbar、底部 zoom toolbar、selection rendering、transform handles）不傳 — 全部沿用 tldraw 預設（ADR-0005 §Decision 第二點）。

替代方案：自畫頂部 bar absolute-position 蓋在 `<Tldraw>` 上面。**拒絕**——會與 tldraw 內部 z-index 與 layout 計算打架，且未來任何 tldraw 版本變更都可能讓蓋層錯位。

### `persistence.ts` 是 deep module；介面以 snapshot 為單位

`apps/web/src/canvas/persistence.ts` 匯出兩個函式：

- `loadSnapshot(canvasId: string): Snapshot | null`
- `saveSnapshot(canvasId: string, snapshot: Snapshot): { ok: true } | { ok: false, reason: 'quota' | 'too_large' }`

`Snapshot` 型別由 tldraw 的 `getSnapshot(editor.store)` 回傳值定型（tldraw 自己已型別好）。整個 localStorage IO 細節（key 命名 `vellum:canvas:<id>:snapshot`、`JSON.stringify` / `JSON.parse`、try/catch、5MB pre-write 檢查、quota error 偵測）封閉在這個檔案內；呼叫端（`Editor.tsx` autosave hook）不接觸 localStorage。

理由：

- CLAUDE.md hard rule 1 + PRD §測試金字塔要求 deep module 嚴格 TDD；本模組正屬此類（純函式邊界、易窮舉測試）。
- 後續 `add-multiplayer-sync` 把 localStorage 換成 tldraw sync provider 時，呼叫端不變，這個檔案可整體被取代成 sync adapter。換句話說，「persistence」是抽象，localStorage 是當前實作。
- 5MB cap 由 `JSON.stringify(snapshot).length` pre-check 後再寫入，不依賴 catch `QuotaExceededError`。原因：不同瀏覽器 quota 不一致（Chrome ~10MB, Safari ~5MB），用 5MB cap 提供跨瀏覽器一致行為，且讓「太大」與「真的滿了」的兩種失敗模式分流（前者使用者可預期、後者非預期）。

替代方案 A：直接呼叫 `localStorage.setItem` 而不寫 deep module。**拒絕**——違反 CLAUDE.md hard rule 1（deep module TDD），且 swap 時要改多處呼叫端。

替代方案 B：用 IndexedDB（更大 quota）。**拒絕**——增加 async 複雜度、phase 1 5MB 對單張 canvas 已是極大量（tldraw 一個 snapshot 通常 < 1MB），且 phase 1 這條路就是要被 tldraw sync 取代。

### autosave 用 800ms debounce + tldraw `store.listen`

訂閱 `editor.store.listen((entry) => ...)` 後 debounce 800ms 才寫一次 localStorage。

理由：

- tldraw store 變更是高頻（drag 一個 shape 每 frame 都會通知）；無 debounce 會讓 main thread 卡在 `JSON.stringify`。
- 800ms 取自業界經驗值（自動儲存常見區間 500ms–1s）；user 短暫思考停頓後即可保證寫入。
- debounce 的 trailing edge 寫入 + `beforeunload` flush 兩道保險，避免 user 立刻關 tab 漏寫。

替代方案：throttle 而非 debounce。**拒絕**——throttle 會在持續編輯時間隔寫，但 user 期待是「停下來就保證已存」，debounce trailing 更符合直覺。

### `customShapeUtils` 與 `customShapeTools` 放在 `packages/shared/src/shape-types.ts`

雖然本 change 不實作任何 custom shape，仍在 shared package 預先建立空 registry：

```ts
// packages/shared/src/shape-types.ts
export const customShapeUtils: ShapeUtil[] = []
export const customShapeTools: StateNode[] = []
```

`Editor.tsx` import 後傳入 `<Tldraw shapeUtils={customShapeUtils} tools={customShapeTools} />`。

理由：

- 之後 `add-shape-framework` 不需要再改 `Editor.tsx`，只 append 到這個 registry 即可——擴充封閉於一處。
- 把 type registry 放在 `packages/shared` 而非 `apps/web` 是因為 server side 的 `add-multiplayer-sync` 也會需要 ShapeType definitions 做 schema 驗證（雖然不在本 change 範圍，但結構先預留正確）。

替代方案：放在 `apps/web/src/canvas/shape-registry.ts`。**拒絕**——後續 server-side 也要用時要重新搬，現在預先放對位置。

### MainMenu 的 export submenu 顯示「敬請期待」而非隱藏

MainMenu 預先有 4 個項目：Rename / Duplicate / Delete / Export(submenu)。前 3 個本 change 就讓他們可用（接 `add-canvas-folder-crud` 的 mutation hook）；Export submenu 顯示 disabled 的「PNG / SVG / PDF / JSON / Markdown 敬請期待」。

理由：

- 結構先齊，避免 `add-export` 改動 MainMenu 結構（變動 = 風險）。
- 對 user 透明：使用者看到完整結構就知道「殼是齊的，功能還沒上」，不會誤以為產品設計就漏了 export。
- 佔位 i18n 字串走 `canvas.chrome.mainMenu.exportComingSoon`，正式上線時刪這個 key、改填具體匯出 trigger。

### 動畫分區

- Chrome 區（TopBar dropdown、MainMenu 下拉、rename dialog、Share placeholder toast）：用 motion（Animate UI）做 enter/exit。
- Canvas 區（`<Tldraw>` 內部）：完全不加 motion（CLAUDE.md hard rule 5 + ADR-0005 §Decision 保留 tldraw 預設行為）。

執行細節：rename dialog 用 shadcn `Dialog` + motion `AnimatePresence`；MainMenu 用 shadcn `DropdownMenu`（內建 Radix 動畫）+ 必要時補 motion；toast 用 sonner（或 Animate UI 的 toast 元件，後續決定）。

### Share button 是 placeholder：`onShareClick` callback prop

TopBar 元件的 Share 按鈕暴露 `onShareClick: () => void` prop。本 change 在 `Editor.tsx` 中傳入一個顯示 toast「分享功能尚未啟用」的 callback。`add-sharing` 接手時換成「打開 ShareDialog」的 callback，TopBar 元件本身不動。

理由：

- 元件接 callback 而非自己決定打開什麼 — open/close 控制權在父層，TopBar 只是 dumb 元件，符合單一職責。
- `add-sharing` 不需要動 TopBar 程式碼，只新增 `ShareDialog` 元件 + 改 `Editor.tsx` 的 callback。

## Risks / Trade-offs

- [tldraw 升級時 `components` prop API 變動] → Mitigation：pin tldraw 版本到具體 minor（不用 caret 範圍）；CHANGELOG 列為固定 review 項；任何升級都跑完整 chrome 互動測試 suite。
- [localStorage 在 incognito / Safari ITP / iOS 標籤頁回收後可能被清空] → Mitigation：本 change 已標明這是 phase 1 暫時方案，phase 1 開發環境不擔心；`add-multiplayer-sync` 上線後 server snapshot 才是 source of truth。但 README / 路由載入錯誤訊息要明示「phase 1 僅本機儲存」。
- [5MB cap 對重度使用者偏緊] → Mitigation：tldraw 典型 snapshot 大小 < 1MB；超過 5MB 的 canvas 在 phase 1 是極端 case，已透過 toast 與「請匯出後清理」訊息引導。長期解法是 sync server。
- [TopBar Share 按鈕看似可用但只 toast 提示] → Mitigation：toast 文案明確（「分享功能尚未啟用，將於後續版本上線」）；review 階段確認沒有誤導 user。
- [autosave debounce trailing 可能在 tab close 時漏寫最後一筆] → Mitigation：在 `Editor.tsx` 註冊 `beforeunload` listener flush debounce（同步寫一次）；單元測試 cover「立刻 unmount → 應 flush」場景。
- [tldraw 浮水印破壞 Vellum 品牌觀感] → Mitigation：ADR-0005 已接受 phase 1 帶浮水印；phase 2 若申請 free commercial license 通過即可移除。
- [`customShapeUtils` 空陣列在 review 時可能被誤認為 bug] → Mitigation：檔案頂部明確註解 `// Populated incrementally by add-shape-* changes; intentionally empty in add-canvas-editor-shell.`。
- [route `/canvas/:id` 在 `add-canvas-folder-crud` 尚未完成時無法 E2E 跑通] → Mitigation：本 change 的 task 明示假設前置 change 完成；單元 / 元件測試用 mock route data 即可，無需依賴真資料庫。
