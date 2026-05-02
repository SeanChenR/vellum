## Why

Phase 1 PRD User Stories 24–28 要求兩個（含）以上已登入使用者能即時共編同一張 canvas、看見彼此 cursor 與選取狀態、看到當前協作者頭像列表，並在網路短暫斷線後恢復。目前 canvas 編輯資料只活在客戶端 local store（`apps/web/src/canvas/persistence.ts` + `apps/web/src/canvas/use-autosave.ts`），任何兩個 client 看到的都是各自獨立的世界——多人協作、即時光標、共同 undo 完全不可能。

本變更導入 tldraw sync 自架方案：在現有 Bun.serve process 內加開 WebSocket sync server（單 binary 不引入新 process），把客戶端 store 切到 sync store 連回 server，由 server 維護權威狀態（room state）並以 debounce 寫回 `canvases.snapshot` jsonb 欄位。落地後同一張 canvas 的所有合法成員看到的是同一個世界，server 重啟後 room state 還原。

## What Changes

- 新增 WebSocket sync 端點 `WS /sync/:canvasId`，由 Bun.serve 在現有 HTTP server 同 process 內提供（不另起 service）
- 新增 server-side room state 管理：每張 canvas 一個 room，記錄連線清單、當前 tldraw 共享文件狀態、多人 awareness（cursor / 選取 / presence）；最後一個連線離開後 1 分鐘 idle 才釋放 room
- 新增 server-side debounced snapshot persistence：room 狀態變更後 2 秒 idle 或最多每 10 秒寫一次到 `canvases.snapshot`；server 啟動 / room 第一個連線時從 DB 讀回 snapshot
- 新增 WebSocket 連線握手驗證：握手時必須帶 better-auth session cookie，後端解析 user 後呼叫 `apps/api/src/lib/permission.ts` 的 PermissionChecker；無 owner / shared editor / shared viewer 任一身份的連線一律拒絕（close code 4403）
- 新增 WebSocket 連線層 rate limit：同一 user 對同一 canvas 同時連線數上限 5、每 IP 每分鐘新建連線上限 30；超出回 close code 4429
- **BREAKING** 客戶端編輯持久化路徑從「local store + 定期 PATCH /api/canvas/:id snapshot」改為「sync store ↔ WebSocket ↔ server 內 room ↔ debounced DB flush」；Editor 不再直接寫 `canvases.snapshot`
- 新增前端連線狀態 UI：TopBar 旁顯示 connecting / connected / reconnecting / disconnected 四態（i18n 字串 zh-TW + en 同步加），斷線時自動重試 5 次（1s / 2s / 4s / 8s / 16s exponential backoff）
- 新增前端協作者頭像列表（PRD US27）：複用既有的 UserAvatar 元件，把當前 room 內所有 presence 顯示在 TopBar 右側
- 多人 cursor 與選取顯示沿用 tldraw sync 內建 awareness API（不額外動畫，必須 instant）
- E2E 加 1 條 Playwright happy-path：兩個 browser context 同時開同一張 canvas → A 畫一筆 B 看到 → A 移動 cursor B 看到 cursor → A 關掉 tab B 看到 presence 消失

## Non-Goals

- 匿名訪客（透過 public-link-edit 進入但未登入）支援、tldraw sync 內建動物名 — 屬 M5 Sharing 範圍
- 公開 link 三檔切換（closed / view / edit）的 viewer-mode 唯讀 socket — 屬 M5
- 切到外部 sync provider（tldraw cloud / partykit / liveblocks 等付費或 hosted 服務）— Phase 1 自架原則
- 真正的 server 端衝突 / 合併演算邏輯 — 沿用 tldraw sync 內建 CRDT，不自寫
- 跨 process / 跨機器 room sharding（Redis pub/sub 等）— Phase 1 單機，phase 2 才考慮
- 版本歷史 / activity log / undo across sessions — 明確列在 PRD Out-of-Scope
- 圖片上傳到 cloud storage — 沿用 tldraw 內建 base64 / object URL，phase 2 才動

## Capabilities

### New Capabilities

- `multiplayer-sync`: WebSocket sync server、room state 生命週期、debounced snapshot 持久化、WS 握手驗證、WS 連線 rate limit、前端 sync store 切換 + 連線狀態 UI + 協作者頭像列表

### Modified Capabilities

- `canvas-editor`: 編輯持久化模型從「客戶端 local store + 定期 client PATCH」改為「sync store ↔ WS server ↔ debounced server flush」；新增 TopBar 連線狀態指示與協作者頭像列表

## Impact

- Affected specs: 新增 `multiplayer-sync`；修改 `canvas-editor`
- Affected code:
  - New:
    - apps/api/src/sync/index.ts
    - apps/api/src/sync/room.ts
    - apps/api/src/sync/persistence.ts
    - apps/api/src/sync/auth.ts
    - apps/api/src/sync/rate-limit.ts
    - apps/api/src/sync/index.test.ts
    - apps/api/src/sync/room.test.ts
    - apps/api/src/sync/persistence.test.ts
    - apps/api/src/sync/auth.test.ts
    - apps/api/src/sync/rate-limit.test.ts
    - apps/web/src/canvas/use-sync-store.ts
    - apps/web/src/canvas/use-sync-store.test.ts
    - apps/web/src/canvas/ConnectionStatus.tsx
    - apps/web/src/canvas/ConnectionStatus.test.tsx
    - apps/web/src/canvas/CollaboratorAvatars.tsx
    - apps/web/src/canvas/CollaboratorAvatars.test.tsx
    - packages/shared/src/sync-protocol.ts
    - e2e/multiplayer-sync.spec.ts
  - Modified:
    - apps/web/src/canvas/Editor.tsx
    - apps/web/src/chrome/TopBar.tsx
    - apps/api/src/index.ts
    - apps/api/src/lib/rate-limit-rules.ts
    - apps/api/src/lib/permission.ts
    - packages/shared/src/api-contract.ts
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
  - Removed:
    - apps/web/src/canvas/persistence.ts
    - apps/web/src/canvas/use-autosave.ts
    - apps/web/src/canvas/use-autosave.test.ts
