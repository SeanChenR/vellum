## 1. Tests First — wiring + shutdown ordering（TDD）

- [x] 1.1 寫 apps/api/src/sync/persistence-wiring.test.ts，用 mock SnapshotPersister + spy `notifyDirty`：(a) 驗證 createRoom factory 註冊的 TLSocketRoom.onDataChange callback 在每次 mutation 觸發 `notifyDirty(canvasId, getSnapshot)` (覆蓋 spec「Sync server flushes snapshots on every mutation via a debounced + cap window writer」) (b) 驗證 shutdownGracefully 在 syncServer.shutdown 之前先 await persister.flushAll，且 flushAll 失敗時 shutdown 仍繼續 (覆蓋 spec「Graceful shutdown flushes the persister before disposing rooms」兩個 scenario)

## 2. Implementation — wire SnapshotPersister into production sync server（GREEN）

- [x] 2.1 在 apps/api/src/index.ts instantiate `SnapshotPersister`：debounceMs 2_000、capMs 10_000、saveSnapshot 用既有 `saveSnapshotToDb`、setTimer/clearTimer 用 globalThis.setTimeout/clearTimeout、now 用 Date.now、log 用既有 logger
- [x] 2.2 修改 RoomRegistry 的 createRoom factory（在 apps/api/src/index.ts 內）：建立 TLSocketRoom 時把 `onDataChange: () => persister.notifyDirty(canvasId, () => room.getCurrentSnapshot())` 加進 TLSocketRoomOptions；保留 schema、initialSnapshot 等既有 options 不動
- [x] 2.3 修改 shutdownGracefully：在 `await syncServer.shutdown()` 之前先 `try { await persister.flushAll(); } catch (err) { logger.error(...) }` 確保 spec「shutdown ordering: persister.flushAll before syncRegistry.closeAll」+「persister flush failure does not block shutdown」兩個 scenario 都成立
- [x] 2.4 跑 1.1 的 test 確認全綠，typecheck 全綠，既有 `apps/api/src/sync/persistence.test.ts`、`apps/api/src/sync/room.test.ts`、`apps/api/src/sync/index.test.ts` 全綠不退化

## 3. ADR

- [x] 3.1 寫 docs/adr/0012-mutation-driven-snapshot-flush.md，記錄三層 flush path（mutation-driven debounce/cap、idle release、graceful shutdown）、為何單實例 phase 1 SnapshotPersister wiring 足夠、phase 2 cluster mode 升級點（Redis-backed persister or leader election），對應 proposal Non-Goals 的 cluster 一條

## 4. 手動驗收

- [x] 4.1 啟 dev server + 開兩個 browser tab 連同一 canvas，連續編輯 30 秒（不要 idle）；觀察 Postgres `canvases.snapshot` 的 `updated_at` 應每 ≤ 10 秒更新一次（覆蓋 spec scenario「continuous editing flushes within the cap window」）
- [x] 4.2 同上場景觸發 `bun --hot` reload（修改 apps/api/src/index.ts 加一行 comment）；reload 完重整 canvas，最後一筆 mutation（reload 前 ≤ 2 秒）應仍存在於 DB（覆蓋 proposal Success Criteria #1）
- [x] 4.3 關所有 tab 等 60 秒，確認 idle release 還會 flush 一次（保險網不退化，覆蓋 spec scenario「idle release path is preserved」）
