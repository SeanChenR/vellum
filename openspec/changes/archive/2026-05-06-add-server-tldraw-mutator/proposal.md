## Why

Phase 2 PRD（Issue #2）要把 AI agent 加進 Vellum，但整個架構最高風險的模組是「server 端如何把 mutation 套到 tldraw sync 的 active room、再透過既有 WS 通道廣播給所有 client」。在這條路徑被驗證可行之前，agent runtime / tool surface / streaming 等上層模組都建立在未證實的假設上。本變更（M12.1）是 Phase 2 的技術 spike：用一個 deep module — Server tldraw Mutator — 把這個能力孤立出來、寫好行為合約、配 dev-only REST 端點與 integration 測試證明它真的會跑，後續 M12.2（完整 tool surface）和 M13.x（agent runtime）才能安心往上疊。

只實作 `createShape` 一條 mutation 路徑就夠 de-risk；其他 op type（updateShape / deleteShape / connectShapes 等）留給 M12.2。

## What Changes

- 新增 Server tldraw Mutator 模組，介面為 `applyMutation(canvasId, mutation)`：吃結構化 mutation operation、把它套進 active 的 `TLSocketRoom`、回傳 commit 結果；commit 後既有 sync server 自動把變更廣播給所有連線 client（PRD US 10、US 21 的伺服器端基礎）
- 新增 mutation 類型 `createShape`（M12.1 唯一支援的 op type）；module 的型別系統設計為可擴展的 discriminated union，後續 op type 在 M12.2 加進來時不需要改介面形狀
- 跨 server-client bridge 保留 `editor.batch(...)` 語意：同一個 batch 內的多筆 mutation 套用後，client 端 Cmd+Z 回退視為單一 undo entry（PRD US 12）
- 新增 dev-only REST 端點 `POST /dev/canvas/:id/mutate`：吃 `createShape` payload、呼叫 mutator、回 200；端點本身用 `Bun.env.NODE_ENV !== "production"` gate 起來，正式環境路由不註冊（不只回 404，是物理上不存在）
- 新增 dev-only 端點專用 rate-limit rule `DEV_MUTATE_RULE`（per-user）並登錄到 `apps/api/src/lib/rate-limit-rules.ts`；429 帶 `Retry-After` header
- 新增 integration 測試：對真 sync server 開 WebSocket client、POST 到 dev 端點、斷言 WS client 收到對應的 sync update（不 mock sync 層；mock 等於沒測）
- 新增 ADR 0013（檔名暫定）：記錄選用的 TLSocketRoom 內部 API、batch 語意如何被保留、若使用任何 tldraw sync 的非 public API 也在這裡記下風險與替代方案
- i18n：dev 端點不在 production UI 出現，但 mutator 拋出的錯誤回 errorKey（沿用 server 慣例），zh-TW + en 同步加 `errors.devMutate.invalidPayload` / `errors.devMutate.canvasNotInActiveRoom` 兩個 key

## Capabilities

### New Capabilities

- `server-mutation-bridge`: server-side 對 active TLSocketRoom 套 mutation、保留 batch 語意、透過既有 sync 通道廣播；包含 dev-only REST 端點作為 spike 的可觸發入口

### Modified Capabilities

(無 — 既有 multiplayer-sync 的 requirements 不變；mutator 是新獨立模組，sync server 對它而言是被使用的內部依賴。)

## Impact

- Affected specs: 新增 `server-mutation-bridge`
- Affected code:
  - New:
    - apps/api/src/sync/mutator.ts
    - apps/api/src/sync/mutator.test.ts
    - apps/api/src/sync/mutator-integration.test.ts
    - apps/api/src/dev/mutate-endpoint.ts
    - apps/api/src/dev/mutate-endpoint.test.ts
    - packages/shared/src/mutation-types.ts
    - docs/adr/0013-server-tldraw-mutator-trade-offs.md
  - Modified:
    - apps/api/src/sync/index.ts
    - apps/api/src/index.ts
    - apps/api/src/lib/rate-limit-rules.ts
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
