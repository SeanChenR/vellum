## Problem

Active multiplayer editing 期間，任何非 graceful 重啟都會丟資料。User demo 已踩到一次：跟朋友共編幾分鐘後我 commit 一個 server-side fix，`bun --hot` reload API process，整段 demo 期間的編輯（題目圖片、批改紅字、勾選等）全部 lost — DB 裡的 snapshot 仍停在 demo 開始前最後一次 flush 的時間點 (`updated_at: 2026-05-05 12:20:30`)。

不只 dev hot-reload 會踩到。Production 部署遇到 OOM kill / k8s pod evict / container crash / 任何非 SIGTERM 終止，同樣會丟掉「最後一次 graceful flush 之後到 crash 之前」的所有 mutations。在 phase 2 開始接受真實流量前必須修。

## Root Cause

`apps/api/src/sync/persistence.ts:46` 的 `SnapshotPersister`（debounce 2s + cap window 10s 的 trailing-edge 寫入器）寫好了，`apps/api/src/sync/persistence.test.ts` 也有完整 unit test 跑綠，但 **production 從未 instantiate 它**。`apps/api/src/index.ts` 的 sync wiring 只把 `saveSnapshotToDb` 接到 `RoomRegistry.opts.saveSnapshot`，而 `RoomRegistry` 內部只在兩個 path 呼叫它：

1. `disposeIdle()` — 連線數歸零、idle timer 跑滿 `idleReleaseMs: 60_000` 才 fire
2. `closeAll()` — `shutdownGracefully` (SIGTERM) 才 fire

Active editing 期間 connectionCount > 0，idle timer 永遠不 fire；非 graceful 重啟跑不到 closeAll；於是兩條 path 同時不 work。M4 multiplayer-sync 階段該把 `SnapshotPersister` wire 起來作為第三條（mutation-driven）path 但漏了。

## Proposed Solution

在 `apps/api/src/index.ts` instantiate 既有的 `SnapshotPersister`，把 `RoomRegistry` 的 `createRoom` 改成幫每個新 room 設定 `TLSocketRoom.onDataChange` callback，callback 內呼叫 `persister.notifyDirty(canvasId, () => room.getCurrentSnapshot())`。`shutdownGracefully` 在 `syncServer.shutdown()` / `syncRegistry.closeAll()` 之前先 `await persister.flushAll()` 把任何 in-flight debounce 的 snapshot 強制寫進 DB。

`SnapshotPersister.notifyDirty` 已有 trailing-edge debounce + cap window 邏輯，重複 mutation 會 reset debounce timer，但 cap window (10s) 保證持續活動下也最多每 10 秒 flush 一次 — 跟 idleReleaseMs 互補：

- mutation-driven debounce/cap：active editing 期間每 ≤ 10 秒 flush 一次
- idleReleaseMs：room 連線歸零後 60 秒釋放（再 flush 一次保險）
- shutdownGracefully：SIGTERM 時 closeAll + flushAll 兩個 path 各跑一次

純 wiring，沒有新邏輯需要設計、沒有新模組要建，現有 unit test (persistence.test.ts) 已涵蓋 SnapshotPersister 行為；本 change 補一個 wiring test 確保 production code path 真的 invoke 了 notifyDirty。

## Non-Goals

- **多實例水平擴展時的 persister 一致性**：phase 1 single-instance Bun.serve，每個 canvas 只在一個 process 裡有 room；多實例分散到多個 persister 是 phase 2 / cluster mode 的問題（會需要 Redis-backed persister 或 leader election），本 change 不處理。
- **Backoff / 重試上限**：`SnapshotPersister` 現有「DB write 失敗保持 dirty 並等下個 trigger 重試」的行為已足夠 phase 1；exponential backoff、永久失敗 alarming、Sentry 事件等留給 deploy checklist。
- **SnapshotPersister 內部邏輯改動**：debounceMs / capMs / 重試行為 都不動，只接線。
- **dev hot-reload 對 SIGTERM 友善化**：bun --hot 不送 SIGTERM 是 dev tooling 設計，本 change 不去 fight 它；mutation-driven flush 已足以把資料 loss window 從「整段 demo」壓到「最後 ≤ 2 秒（debounce 內未 fire 的部分）」+「最後 ≤ 10 秒（cap window 內未 fire 的 worst case）」。
- **Snapshot 增量寫入 / 版本控管**：仍 overwrite 整份 jsonb，跟現狀一致。

## Success Criteria

1. Vellum dev 啟動後跟另一 browser 在同一 canvas 連續編輯 30 秒，`bun --hot` reload API process（任意修改 `apps/api/src/index.ts` 的 comment 觸發），重整後 canvas 的 `documentClock` 跟 `updated_at` 反映 reload 之前的最後一筆 mutation（誤差容忍 ≤ 2 秒 debounce + ≤ 10 秒 cap window）。
2. 同上場景，整段 30 秒持續編輯期間從未 idle，DB `canvases.snapshot` 的 `documentClock` 隨時間單調遞增（每 ≤ 10 秒至少更新一次），證明 mutation-driven flush 真的有 fire。
3. 既有的 `RoomRegistry` idle release flush 行為**不退化**：room 連線歸零 + 60s 後仍會 flush（保險網），相關 sync.test 仍通過。
4. `SIGTERM` 觸發 `shutdownGracefully` 時，`persister.flushAll()` 在 `syncServer.shutdown()` 之前完成，避免 race。
5. 全套既有 unit test (`apps/api/src/sync/persistence.test.ts`、`apps/api/src/sync/room.test.ts`、`apps/api/src/sync/index.test.ts` 等) 全綠 + 新增 wiring 整合 test 通過。
6. 修完後 user 重複 demo 場景：在 active editing 期間任意 reload API process，丟失資料的 worst case ≤ 10 秒（之前是「整段 demo」）。

## Impact

- 受影響程式碼:
  - 修改:
    - apps/api/src/index.ts（instantiate SnapshotPersister；createRoom 設 TLSocketRoom.onDataChange；shutdownGracefully 加 persister.flushAll）
    - apps/api/src/sync/room.ts（如需要把 onDataChange callback 從 RoomRegistry layer 往下傳給 createRoom factory；保留現有 idle release flush 不動）
  - 新增:
    - apps/api/src/sync/persistence-wiring.test.ts（wiring 整合 test：mock SnapshotPersister，確認 createRoom 註冊的 onDataChange callback 真的 invoke notifyDirty；確認 shutdownGracefully 順序：persister.flushAll → syncRegistry.closeAll）
    - docs/adr/0012-mutation-driven-snapshot-flush.md（記錄三層 flush path：mutation-driven debounce/cap、idle release、graceful shutdown，及為何 phase 1 的 SnapshotPersister wiring 對單實例足夠、phase 2 cluster 時的升級點）
  - 受影響 specs:
    - openspec/specs/multiplayer-sync/spec.md (modified)：原「Sync server flushes snapshots on a debounced cadence」requirement 補齊「mutation-driven trailing-edge debounce + cap window」這條 path 的具體 cadence (debounceMs 2_000、capMs 10_000) 與「shutdown ordering: persister.flushAll() before syncRegistry.closeAll()」
