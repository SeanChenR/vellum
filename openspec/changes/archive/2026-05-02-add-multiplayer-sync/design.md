## Context

Vellum 目前的 canvas 編輯資料只活在客戶端：tldraw 文件由 `apps/web/src/canvas/Editor.tsx` 內 local store 持有，`apps/web/src/canvas/use-autosave.ts` 透過 `apps/web/src/canvas/persistence.ts` 定期 PATCH 整包 snapshot 進 `canvases.snapshot` jsonb 欄位。任何兩個 client 看到的是各自獨立的世界，無法滿足 PRD US 24–28（即時共編、cursor、選取、協作者列表、斷線重連）。

本變更導入 tldraw sync 自架方案：在現有 Bun.serve process 內加開 WebSocket sync server（不另起 service），把客戶端切到 sync store 連回 server，由 server 維護權威 room state 並以 debounce 寫回 `canvases.snapshot`。落地後同一張 canvas 的所有合法成員看到同一個世界，server 重啟後 room 還原。

**現存可重用模組**

- `apps/api/src/lib/permission.ts`（PermissionChecker）— HTTP 路由已用，WS 握手沿用
- `apps/api/src/lib/rate-limiter.ts`（RateLimiter，LRU + token bucket）— 加 WS 規則即可
- `apps/api/src/lib/rate-limit-rules.ts` — 規則中央表
- `apps/api/src/db/schema.ts`（`canvases.snapshot` jsonb 欄位）— 已存在，不需要 migration
- `apps/api/src/auth/session-cookie-parser.ts` — 解析 better-auth session cookie，WS 握手沿用
- 客戶端 `apps/web/src/components/UserAvatar.tsx`（profile UI 已用）— 協作者頭像列表沿用
- `apps/api/src/lib/logger.ts`（Pino structured） — 連線生命週期事件全走它

**Tech stack 限制（CLAUDE.md hard rule #6 Bun-native preference）**

- 不引入 `ws` / `socket.io`；tldraw sync server 必須跑在 Bun.serve 的 `websocket` handler 上
- 不另起 process；同一個 Bun.serve 同時負責 HTTP API、WS、static frontend
- 測試走 `bun test` + happy-dom；E2E 走 Playwright

## Goals / Non-Goals

**Goals:**

- 兩個（含）以上已登入使用者開同一張 canvas，畫筆、shape 增減、變形、移動、刪除、undo / redo 全部即時同步（< 200ms 在 localhost）
- Cursor 位置與選取狀態以 tldraw 內建 awareness 通道傳遞，無動畫、無延遲
- 協作者頭像列表（顯示當前 room 內所有 presence）顯示在 TopBar 右側
- 短暫斷線（< 30s）重連後自動恢復編輯，不丟工作
- Server 重啟時從 DB 還原最後一次 flush 的 snapshot；重啟後第一個連線進來能看到上次的東西
- 沒有 owner / shared editor / shared viewer 任一身份的連線一律拒絕
- 同一 user 連線數、同一 IP 新建連線速率受 rate limiter 控管

**Non-Goals:**

- 匿名（未登入）訪客透過 public-link-edit 加入 — 屬 M5 範圍
- 公開 link viewer-mode 唯讀 socket — 屬 M5
- 跨 process / 跨機器 room 拓撲（Redis pub/sub）— Phase 1 單機
- 真正的 server-side CRDT / 衝突解決演算 — 沿用 tldraw sync 內建
- 切外部 sync provider — Phase 1 自架原則
- 版本歷史 / activity log / undo across sessions — PRD 已明列 Out-of-Scope
- 圖片上傳到 cloud storage — phase 2

## Decisions

### tldraw Sync Server 架構：Bun.serve upgrade() + tldraw TLSocketRoom

採 tldraw 官方 self-hosting 範例的核心模式：每張 canvas 對應一個 server-side `TLSocketRoom` 實例（tldraw sync 套件提供），包住該 canvas 的 store + awareness。Bun.serve 的 `fetch` handler 偵測到 `/sync/:canvasId` 的 Upgrade 請求時呼叫 `server.upgrade(req, { data: { userId, canvasId } })` 升級為 WebSocket，再在 `websocket.open` 時把連線交給對應 room。

**為什麼這個方案：**

1. 與既有 Bun.serve single-binary 架構相容（CLAUDE.md hard rule #6）
2. tldraw 官方支援 self-hosting，不需要自寫 CRDT
3. `TLSocketRoom` 處理掉所有衝突合併、awareness 廣播、訊息序列化

**替代方案考量：**

- **partykit / liveblocks / tldraw cloud（hosted）** — 違反 Phase 1 自架原則，且引入外部依賴與帳號
- **自寫 CRDT（Yjs 自接）** — 可行但 tldraw 對外推薦的就是 tldraw sync，多寫一層適配是負擔
- **HTTP long-poll** — 延遲過高，無法滿足 cursor / presence 需求

`TLSocketRoom` 與 Bun.serve 的 binary frame 相容性需在實作首日驗證 — 排在 tasks 第 1 項作為 spike。

### Room 生命週期與 idle 釋放策略

每張 canvas 有 0 或 1 個 room（lazy create）：

- 第一個連線進來時 server 建立 room，從 DB 讀 snapshot 載入 store
- 連線數歸零後啟動 60 秒 idle timer；timer 到期前若有新連線進來則取消 timer
- timer 到期後執行最後一次 flush（若 dirty）→ 釋放 room 物件 → 釋放記憶體
- 進程內維護 `Map<canvasId, Room>` 作為 room registry

**為什麼選 60 秒 idle：**

太短會在切 tab、reload 等行為下頻繁 reload snapshot from DB（DB 壓力 + 開銷）；太長會在閒置時佔用記憶體。60s 對齊使用者切回來的常見區間，且「最後 flush 後 60s 才釋放」確保不會丟資料。

**替代方案考量：**

- **不釋放（直到 server 重啟）** — Phase 1 單機 + 單人開發 OK，但記憶體 leak 模式；Phase 2 會痛
- **0 秒立即釋放** — 退出再進去要重新從 DB 拉 snapshot，慢

### Snapshot 持久化：debounce 寫入時機與重啟還原

Server-authoritative：room 收到任何使 store dirty 的 op 後啟動 debounce — 2 秒沒新 op 就 flush，或自上次 flush 起累積 10 秒強制 flush（避免持續打字永遠不寫）。Flush 動作是「整包 snapshot 取代」（`UPDATE canvases SET snapshot = $1, updated_at = now() WHERE id = $2`）— Phase 1 不做 incremental delta（tldraw snapshot 不大，整包寫足夠）。

Server 啟動或 room 第一個連線時 `SELECT snapshot FROM canvases WHERE id = $1`，把 jsonb 反序列化進新建立的 `TLSocketRoom`。snapshot 為 `{}`（建 canvas 時的預設值）時 `TLSocketRoom` 初始化為空 store。

**為什麼選「2s idle / 10s 強制」：**

- 2 秒 idle 對齊「一個動作做完」的人類停頓（畫一筆、停手、想下一步），避免每筆 op 都打 DB
- 10 秒強制上限避免使用者持續輸入時資料 100% 在記憶體（伺服器 crash 會丟）
- 完整 snapshot 一次寫的成本 ~10ms（jsonb），單張 canvas 每 10 秒一次寫，DB 壓力小

**替代方案考量：**

- **每筆 op 即時寫** — DB 寫入過頻（高頻畫筆每秒幾十筆），不可接受
- **只在 room idle release 時寫** — 中途 server crash 丟 60 秒以內所有變更，太多
- **incremental jsonb patch** — 可省頻寬但 Phase 1 snapshot 不大、複雜度不划算

**Crash recovery boundary：** server 強制 kill 時最多丟「上次 flush 之後到 crash 之間」（< 10 秒）的編輯。這個 trade-off 寫進 `docs/adr/`。

### WebSocket 握手驗證：session cookie + PermissionChecker

WebSocket Upgrade 請求由瀏覽器自動帶 cookie。Server 在 `fetch` handler 內：

1. 用 `apps/api/src/auth/session-cookie-parser.ts` 解析 better-auth session cookie → 拿到 `userId`，失敗則回 HTTP 401（不升級）
2. 從 URL 解析 `canvasId`，呼叫 `PermissionChecker.canAccess(userId, canvasId, 'edit')` 或 `'view'`
3. 沒有任何身份（owner / shared editor / shared viewer）→ HTTP 403 不升級
4. 通過 → 呼叫 `server.upgrade(req, { data: { userId, canvasId, role } })` 升級並把身份夾進 ws context

**WS 連線中途權限變動：** Phase 1 不主動踢人；下一次 reconnect 才會重檢。M5 sharing 加 share-mode 切換時補「權限降級主動 close」。

**為什麼不另起 token：** session cookie 是 better-auth 標準路徑，前端不需要額外取 token；瀏覽器原生 WebSocket 會自動帶 same-origin cookie。

**替代方案考量：**

- **Bearer token in URL query param** — 會被 access log 記錄，並且不能直接重用 better-auth session
- **第一筆 ws message 才驗證** — 升級成功後才拒絕浪費資源；握手期間驗證更乾淨

**Close code 對應：**

- `4401` 未登入
- `4403` 沒有此 canvas 權限
- `4404` canvas 不存在
- `4429` rate limit 超限
- `4001` server 主動關閉（room idle release / server shutdown）— 用 4xxx 而非標準 1001 因為 Bun 會把顯式呼叫的 `ws.close(1001)` normalize 成 1000

### WebSocket 連線層 rate limit

`apps/api/src/lib/rate-limit-rules.ts` 加兩條 WS 規則：

- `ws.connect.per_user_canvas`：同一 user 對同一 canvas 的同時連線數上限 **5**（防使用者開十幾個 tab 把 server 拖垮）
- `ws.connect.per_ip`：同一 IP 每分鐘新 WS 連線上限 **30**（防快速重連腳本攻擊）

握手通過 PermissionChecker 後在 upgrade 前檢查兩條規則；任一超出 → HTTP 429 with `Retry-After` header（升級前還是 HTTP 流程），同時不升級。

連線數的「現有計數」由 room registry 內維護（連線進來 +1、close 事件 -1）；per-IP 速率走既有 RateLimiter token bucket。

**為什麼選 5 / 30：**

- 5 個 tab 已涵蓋常見多視窗工作流，再多通常是 bug 或濫用
- 30/min/IP 對應「每 2 秒重連一次」的 worst-case 重連節奏 × 5 倍緩衝

### 客戶端重連策略：exponential backoff with jitter

Sync store hook（`apps/web/src/canvas/use-sync-store.ts`）監聽連線事件：

- 連線斷開（close code 1006 等）→ 顯示 reconnecting UI，啟動重試
- 重試間隔：1s / 2s / 4s / 8s / 16s（最多 5 次），每次再加 ±20% jitter 避免雷群
- 5 次失敗 → 進入 disconnected 狀態，顯示 banner「Lost connection. Refresh to retry.」（i18n）
- 重連成功 → tldraw sync 自動 reconcile，使用者操作不會丟（local pending ops 由 sync 套件 buffer）

連線狀態用 Zustand store（`useSyncConnectionStore`）持有；TopBar 的 `ConnectionStatus.tsx` 訂閱顯示。

**為什麼用 Zustand 不用 React Context：**

- TopBar 與 future ShareDialog 等不同子樹都要讀，Zustand 跨組件共享較直接
- 與 CLAUDE.md 「Zustand 補位 client-only state」原則一致

**Permanent 4xxx close codes 不重試：** 4401 / 4403 / 4404 是 server 明確拒絕，重試無意義 → 直接顯示 disconnected + 對應錯誤 banner，不啟動 backoff。

### 客戶端持久化遷移：移除 client autosave，改由 sync 為唯一資料路徑

舊路徑（移除）：

- `apps/web/src/canvas/persistence.ts` — 直接呼叫 `PATCH /api/canvas/:id`
- `apps/web/src/canvas/use-autosave.ts` — debounce 觸發 persistence
- `apps/web/src/canvas/use-autosave.test.ts`

新路徑：`apps/web/src/canvas/use-sync-store.ts` 用 tldraw sync client API 連 `WS /sync/:canvasId`，回傳 sync store 給 `Editor.tsx` 用 `<Tldraw store={syncStore} />`。Server 端的 room 自己負責 debounced flush。

**Server-side `PATCH /api/canvas/:id` snapshot 路徑保留還是移除？** 保留，但只允許 owner（不需要 active room）— 用於匯出 / import 等場景。Sync server 啟動時讀的也是這個欄位的最新值。Owner 透過 HTTP PATCH 寫入時若該 canvas 有 active room，server 拒絕（HTTP 409 `errors.canvas.activeRoom`）以避免覆蓋 in-memory 狀態。

**為什麼選 server-authoritative + 拒絕 active-room HTTP write：**

- 唯一寫入路徑大幅降低 race condition
- HTTP 寫入只在無 room 時生效，邏輯清晰
- 替代「LWW」「version 欄位」等都引入更多複雜度，Phase 1 不划算

## Risks / Trade-offs

- **tldraw sync server API 演進** → 在 `package.json` 鎖死 tldraw minor version；升版時跑 E2E multiplayer.spec.ts 為 regression gate
- **Bun.serve WebSocket 與 tldraw sync 二進位 frame 相容性未知** → 第一週前兩天做 spike：開 minimal Bun.serve WS + tldraw 範例驗證雙邊能 connect / 同步 / 互傳；如失敗則 fallback 用 tldraw 提供的 Cloudflare Workers / Node 範例移植
- **Server crash 損失最多 10 秒編輯** → 寫進 ADR，phase 2 再評估降到 1-2 秒
- **Idle release 期間若有 race（最後 client 剛斷、新 client 剛連）** → idle timer cancel 設計處理；但 timer fire 與新連線同時發生會走 lock：room registry 的 get-or-create 用 mutex 包
- **Better-auth session cookie 在 cross-origin WebSocket 上不送** → Phase 1 同 origin（`localhost:3000` frontend + `localhost:3001` API 走 dev-proxy 變同 origin）；phase 2 部署時要驗證 cookie domain
- **In-memory rate limiter 重啟歸零** → 與 HTTP rate limiter 同樣的 trade-off，Phase 1 接受
- **協作者頭像列表 awareness 資料延遲** → 沿用 tldraw sync awareness 通道（已是 instant push），不另加 polling

## Migration Plan

Phase 1 沒有 production 使用者，無 zero-downtime 需求：

1. 實作完成後跑 `bun test` 全綠 + E2E multiplayer.spec.ts 通過
2. 本地手動驗證：開 Chrome + Firefox 兩個視窗 → 編輯 → 雙邊看到變更 / cursor / 頭像
3. 移除 `apps/web/src/canvas/persistence.ts` 與 `apps/web/src/canvas/use-autosave.ts` 與其 test，並從 `Editor.tsx` 移除 import
4. PATCH `/api/canvas/:id` snapshot 路徑加 active-room check
5. Commit 走「先加新功能 → 再移除舊路徑」兩個 commit 方便 review

`canvases.snapshot` jsonb 欄位已存在，不需要 DB migration。

## Open Questions

- TopBar 連線狀態 UI 是 icon-only（不佔空間）還是 icon + label（清楚）？— 預設 icon-only with tooltip，等 visual review
- 協作者頭像列表的最大顯示數（4 個 + overflow `+N`？全部？）— 預設 4 + overflow，等 visual review
- 重連失敗 5 次後是否自動 reload 頁面？— 預設**不自動** reload（避免覆蓋 client unsaved local awareness），顯示 banner 讓使用者點 Refresh

