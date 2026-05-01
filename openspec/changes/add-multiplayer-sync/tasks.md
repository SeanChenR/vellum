## 1. Spike + Setup

- [x] 1.1 Spike：以 minimal `apps/api/src/sync/index.ts` 起一個 Bun.serve `websocket` handler 跑 tldraw 官方 self-hosting 範例的 `TLSocketRoom`，再以 minimal browser client 連線並互傳 sync 套件的 binary frame，驗證雙邊能 connect / 同步 / awareness / close 而不互相打架（依 design「tldraw Sync Server 架構：Bun.serve upgrade() + tldraw TLSocketRoom」）；spike 失敗則改採 tldraw Cloudflare Workers / Node 範例移植路徑後再回頭續做後續 task
- [x] 1.2 [P] 安裝 tldraw sync 套件（client + server side parts）並在 `package.json` / `apps/web/package.json` / `apps/api/package.json` 鎖死 minor version 與既有 tldraw SDK 版本對齊
- [x] 1.3 [P] 在 `packages/shared/src/locales/zh-TW.json` 與 `packages/shared/src/locales/en.json` 兩邊同步加入 `canvas.chrome.connection.{connecting,connected,reconnecting,disconnected,disconnectedBanner,refresh}`、`canvas.chrome.collaborators.overflow`、`errors.canvas.{notFound,forbidden,activeRoom}` keys，並移除舊的 `canvas.chrome.persistence.quotaExceededToast`

## 2. Tests First — Backend Sync (TDD red)

- [x] 2.1 寫 `apps/api/src/sync/auth.test.ts` 蓋「WebSocket handshake authenticates the user via session cookie」與「WebSocket handshake authorizes the user against the canvas」（cookie missing/expired/invalid 一律 401、無 role 403、owner / shared editor / shared viewer 三種對應 role 正確掛上 ws context、未存在 canvasId 回 404）
- [x] 2.2 [P] 寫 `apps/api/src/sync/rate-limit.test.ts` 蓋「WebSocket handshake enforces connection rate limits」（同一 user 對同 canvas 第 6 條連線 429 + Retry-After、同 IP 60 秒內第 31 條新連線 429、close 後槽位釋放使下一條被允許）
- [x] 2.3 [P] 寫 `apps/api/src/sync/room.test.ts` 蓋「Sync rooms are created lazily and released after idle」（first connect lazy create + DB hydrate、count 歸零起 60s timer、timer 期間新連線取消 timer 不重 hydrate、timer 到期 flush dirty 後 dispose）
- [x] 2.4 [P] 寫 `apps/api/src/sync/persistence.test.ts` 蓋「Sync server flushes snapshots on a debounced cadence」（單筆 op 約 t=2s 寫一次、burst 10 ops 1 秒內合成單次寫、持續 25 秒 op 期間每 10 秒至少寫一次、寫失敗 log error 並保持 dirty 等下一輪重試）
- [x] 2.5 [P] 寫 `apps/api/src/sync/index.test.ts` 蓋「Server hydrates rooms from DB and resists overwrites by HTTP」與「Sync server uses defined close codes for protocol-level failures」（cold start 第一條連線從 DB hydrate；active room 期間 PATCH `/api/canvas/:id` snapshot 回 409 `errors.canvas.activeRoom`；無 room 時 PATCH 回 200；canvas 刪除 broadcast 4404；server graceful shutdown 全 close 1001 並先 flush）

## 3. Implementation — Backend Sync (TDD green)

- [x] 3.1 實作 `apps/api/src/sync/auth.ts`（沿用 `apps/api/src/auth/session-cookie-parser.ts` 與 `apps/api/src/lib/permission.ts` PermissionChecker，依 design「WebSocket 握手驗證：session cookie + PermissionChecker」），使 2.1 通過
- [x] 3.2 [P] 實作 `apps/api/src/sync/rate-limit.ts` 並在 `apps/api/src/lib/rate-limit-rules.ts` 註冊 `ws.connect.per_user_canvas`（concurrent 5）與 `ws.connect.per_ip`（30/min token bucket）兩條規則（依 design「WebSocket 連線層 rate limit」），使 2.2 通過
- [x] 3.3 [P] 實作 `apps/api/src/sync/room.ts` room registry（lazy create + 60s idle timer + flush-on-dispose，依 design「Room 生命週期與 idle 釋放策略」）並包含 `TLSocketRoom` 包裝層使其與 Bun.serve websocket handler 對接（依 design「tldraw Sync Server 架構：Bun.serve upgrade() + tldraw TLSocketRoom」），使 2.3 通過
- [x] 3.4 [P] 實作 `apps/api/src/sync/persistence.ts` 處理 2 秒 idle debounce + 10 秒上限強制 flush，整包 `canvases.snapshot` 取代式寫入，失敗用 `apps/api/src/lib/logger.ts` 寫結構化 log 並保留 dirty 重試（依 design「Snapshot 持久化：debounce 寫入時機與重啟還原」），使 2.4 通過
- [x] 3.5 實作 `apps/api/src/sync/index.ts` 整合 fetch handler（401 / 403 / 404 / 429 / upgrade 五路）+ websocket handler（open/message/close）+ 各種 close code 路徑（4401 / 4403 / 4404 / 4429 / 1001），把 sync server 掛進既有 `apps/api/src/index.ts`；同步在 `apps/api/src/canvas/index.ts` 的 PATCH `/api/canvas/:id` 加上 active-room 409 邏輯，使 2.5 通過

## 4. Tests First — Frontend Sync (TDD red)

- [x] 4.1 寫 `apps/web/src/canvas/use-sync-store.test.ts` 蓋「Client reconnects with exponential backoff and stops on permanent failures」（transient close 1s/2s/4s/8s/16s 含 ±20% jitter、permanent 4401/4403/4404/4429 直接 disconnected 不重試、5 次失敗轉 disconnected、reconnect 成功 reset counter、Zustand `useSyncConnectionStore` 訂閱可讀四態）
- [x] 4.2 [P] 寫 `apps/web/src/canvas/ConnectionStatus.test.tsx` 蓋「TopBar displays a real-time connection status indicator」（四種 state 對應 localized 標籤 + aria-label、disconnected banner + refresh action、不使用 motion）
- [x] 4.3 [P] 寫 `apps/web/src/canvas/CollaboratorAvatars.test.tsx` 蓋「TopBar displays the current collaborator avatar list」（0/1/4/5/12 collaborator 數的 avatar 與 +N 顯示、本人從 list 排除、presence 變動下次 render 即時反映）
- [x] 4.4 [P] 改寫 `apps/web/src/canvas/Editor.test.tsx` 蓋「Editor mounts with a multiplayer-aware sync store」（store ready 前 render loading state、`useSyncStore(canvasId)` 被呼叫一次、`<Tldraw store=...>` 拿到 sync store、不再讀 localStorage、canvas id 切換時舊 store dispose 新 store 重建）

## 5. Implementation — Frontend Sync + 客戶端持久化遷移 (TDD green)

- [x] 5.1 實作 `apps/web/src/canvas/use-sync-store.ts` 與 Zustand `useSyncConnectionStore`，含 exponential backoff with jitter 重連邏輯（依 design「客戶端重連策略：exponential backoff with jitter」），使 4.1 通過
- [x] 5.2 [P] 實作 `apps/web/src/canvas/ConnectionStatus.tsx`（純 SVG / 文字、無 motion 動畫，依 hard rule #5 multiplayer presence MUST be instant），並接進 `apps/web/src/chrome/TopBar.tsx`，使 4.2 通過
- [x] 5.3 實作 `apps/web/src/canvas/CollaboratorAvatars.tsx`（複用 `apps/web/src/components/UserAvatar.tsx`、最多 4 + overflow `+N`、排除本人），並接進 `apps/web/src/chrome/TopBar.tsx`（5.2 已動過 TopBar，這裡接續編輯），使 4.3 通過
- [x] 5.4 [P] 改 `apps/web/src/canvas/Editor.tsx`：移除 `useAutosave` import 與 call、改用 `useSyncStore(canvasId)` 把 sync store 傳給 `<Tldraw store={...} />`、加上 store 未 ready 的 loading state（依 design「客戶端持久化遷移：移除 client autosave，改由 sync 為唯一資料路徑」），使 4.4 通過
- [x] 5.5 [P] 刪除 `apps/web/src/canvas/persistence.ts`、`apps/web/src/canvas/persistence.test.ts`、`apps/web/src/canvas/use-autosave.ts`、`apps/web/src/canvas/use-autosave.test.ts`，並從 `apps/web/src/canvas/Editor.tsx` 移除相關 import；對應 spec 的「Persistence module loads and saves snapshots in localStorage with a 5MB cap」與「Editor autosaves snapshots on a debounced cadence and on page unload」兩條 REMOVE

## 6. E2E + 收尾

- [x] 6.1 寫 `e2e/multiplayer-sync.spec.ts` happy path：兩個 browser context 用不同帳號開同張 canvas（owner + shared editor）→ A 畫一筆 B 看到 → A 移動 cursor B 看到 cursor → B 看到自己 + A 在 collaborator avatar 列表 → A 關 tab B 看到 presence 消失（涵蓋 E2E 行為「WebSocket sync endpoint accepts upgrades at a canvas-scoped path」與「Sync rooms broadcast cursor and presence via tldraw awareness」）
- [x] 6.2 [P] 跑 `bun test` 全綠 + `bunx oxlint` + `bunx oxfmt --check` + `bun run typecheck`；coverage 至少 70% 對 `apps/api/src/sync/**` 與 `apps/web/src/canvas/use-sync-store.ts` / `ConnectionStatus.tsx` / `CollaboratorAvatars.tsx` 達標
- [x] 6.3 [P] 在 `docs/adr/` 新增 ADR 紀錄兩個 trade-off：「server crash 最多丟 10 秒以內編輯」與「Phase 1 single-process room registry，跨進程 Redis pub/sub 延後到 Phase 2」
- [x] 6.4 [P] 開 Chrome + Firefox 兩個 browser 跑同帳號 / 跨帳號雙人手動驗收：編輯同步 / cursor / 頭像列表 / 斷網重連 4 條 happy path，給 user 視覺驗證 multiplayer 感受
