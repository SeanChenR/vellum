## 1. Foundation — Mutation 介面：保留 M12.1 的 discriminated union 與 `applyOne` switch

- [x] 1.1 在 `packages/shared/src/mutation-types.ts` 加 `updateShapePayloadSchema` / `deleteShapePayloadSchema` / `groupShapesPayloadSchema` / `ungroupShapePayloadSchema` / `connectShapesPayloadSchema` 五個 Zod schema 與對應 TypeScript 型別 [P]
- [x] 1.2 把五個新 variant `updateShapeMutationSchema` / `deleteShapeMutationSchema` / `groupShapesMutationSchema` / `ungroupShapeMutationSchema` / `connectShapesMutationSchema` 加進 `mutationSchema` discriminated union；確認 `Mutation` 型別自動擴展，現有 `applyMutation` caller 不需動
- [x] 1.3 同步加 errorKey 到 `packages/shared/locales/zh-TW.json` 與 `packages/shared/locales/en.json` 在 `errors.fullToolSurface.*` 命名空間：`shapeNotFound`、`groupNotFound`、`invalidViewport`、`sessionNotFound` [P]
- [x] 1.4 把 `applyMutation` 的 `MutationErrorKey` union 擴展加上四個新 errorKey 字串 literal

## 2. Tests First — 寫工具 unit test（TDD red phase）

- [x] 2.1 在 `apps/api/src/sync/mutator.test.ts` 加 `Mutator updateShape variant merges partial props onto an existing shape` 失敗 case：unknown shape id → `errors.fullToolSurface.shapeNotFound`、room 不變
- [x] 2.2 在 `apps/api/src/sync/mutator.test.ts` 加 `updateShape` 成功 case：partial 合併到既有 record（top-level 與 props 合併行為依 spec table）
- [x] 2.3 在 `apps/api/src/sync/mutator.test.ts` 加 `Mutator deleteShape variant removes a shape from the store` 成功 case：`store.delete` 被呼叫；rejection case：unknown id [P]
- [x] 2.4 在 `apps/api/src/sync/mutator.test.ts` 加 `Mutator groupShapes variant creates a group record and reparents children` 成功 case：group record + reparent 在同一 transaction、rejection case：任一子 shape 不存在則整 transaction abort（atomicity）
- [x] 2.5 在 `apps/api/src/sync/mutator.test.ts` 加 `Mutator ungroupShape variant removes a group and re-parents children` 成功 case：children 還原到 group 的 parentId、group record 被 delete；rejection case：target 不是 `type: "group"`
- [x] 2.6 在 `apps/api/src/sync/mutator.test.ts` 加 `Mutator connectShapes variant creates an arrow shape with start and end bindings` 成功 case：arrow shape + 兩個 binding records 在同一 transaction；rejection case：endpoint 不存在 [P]
- [x] 2.7 跑 `bun test apps/api/src/sync/mutator.test.ts`，確認所有新 case 都 RED

## 3. Implementation — 寫工具（TDD green phase）

- [x] 3.1 在 `apps/api/src/sync/mutator.ts` 把 `MutatorStore` 介面從只有 `put` 擴成 `RoomStoreMethods`-shape 子集（加 `get`、`delete`、`getAll`），對齊 tldraw 4.x `RoomStoreMethods` 公開合約（M12.1 已驗用 `updateStore`）
- [x] 3.2 在 `applyOne` switch 加 `case "updateShape"`：`store.get(id)` → 不存在 throw → 合併 partial（top-level 與 props 分別合併）→ `store.put(merged)`
- [x] 3.3 在 `applyOne` switch 加 `case "deleteShape"`：`store.get(id)` 不存在 throw → `store.delete(id)`
- [x] 3.4 實作 `groupShapes` 走「put group record + reparent children」：先驗所有 shapeIds 存在（不存在 throw）→ 用第一個 child 的 parentId 當 group 的 parentId → `put` group record（`type: "group"`）→ 對每個 child get/設 parentId/put（依 design 設計）
- [x] 3.5 實作 `ungroupShape`：`store.get(groupId)` → 不是 group 或不存在 throw → `getAll` 找所有 `parentId === groupId` 的 children → 還原 parentId → `store.delete(groupId)`
- [x] 3.6 實作 `connectShapes` 走「put arrow shape + start/end binding records」：驗 from/to 存在 → put arrow shape（含 label）→ put start binding record → put end binding record（依 design 設計）
- [x] 3.7 在 `applyMutation` 把 `try/catch` 內的錯誤翻譯邏輯擴展：transaction 內 throw 的 `Error` 帶 specific errorKey（例如 `Error("errors.fullToolSurface.shapeNotFound")`），catch 後從 message 萃取 errorKey 回傳；fallback 仍是 `errors.devMutate.mutationFailed`
- [x] 3.8 跑 `bun test apps/api/src/sync/mutator.test.ts`，確認所有 case 都 GREEN

## 4. Tests First — 讀工具 unit test（TDD red phase）

- [x] 4.1 新檔 `apps/api/src/sync/mutator-readers.test.ts`：`getShape` 成功（回 ShapeSummary）+ `getShape` 不存在（回 `data: null`）+ `getShape` 在 room 不存在（errorKey: canvasNotInActiveRoom）[P]
- [x] 4.2 在 `mutator-readers.test.ts` 加 `listShapesInViewport`：spec example 表的「viewport intersection matrix」當 fixture 跑，確認包含/不含/邊界相切都對 [P]
- [x] 4.3 在 `mutator-readers.test.ts` 加 `listShapesInViewport`：invalidViewport（負 w/h、NaN）→ errorKey
- [x] 4.4 在 `mutator-readers.test.ts` 加 `getCanvasBounds`：empty room 回 null；多 shape 回正確 bounding box（min x/y、max x+w/y+h）[P]
- [x] 4.5 在 `mutator-readers.test.ts` 加 `listShapesInSelection` + `getViewport`：成功 case（presence record 存在）+ unknown sessionId case（errorKey: sessionNotFound）
- [x] 4.6 跑 `bun test apps/api/src/sync/mutator-readers.test.ts`，確認所有新 case 都 RED

## 5. Implementation — 讀工具（TDD green phase）— Mutator readers expose snapshot-derived read tools without mutating the room

- [x] 5.1 新檔 `apps/api/src/sync/mutator-readers.ts` — 對應 spec requirement `Mutator readers expose snapshot-derived read tools without mutating the room`：定義 plain 型別 `ShapeSummary` / `Bounds` / `Viewport`、`ReaderResult<T>` envelope（依 design 「讀工具走獨立 module、回 plain 物件、不 leak tldraw record」）
- [x] 5.2 實作 `getShape`：從 `room.getCurrentSnapshot().documents` 找 record id 對應 → 翻譯成 ShapeSummary
- [x] 5.3 實作 `listShapesInViewport`：先驗 viewport（finite + 非負 w/h）→ 對 snapshot 中所有 shape record 計算 bounding box（用 `props.w`/`props.h` 若有，否則 fallback 0）→ 回交集
- [x] 5.4 實作 `getCanvasBounds`：iterate snapshot shape records、accumulate min/max；無 shape 回 null
- [x] 5.5 實作 `listShapesInSelection` + `getViewport`：透過 `room.getPresenceRecords()` 找 sessionId 對應的 instance presence record；不存在 → errorKey: sessionNotFound（依 design 「Viewport / Selection 從 `room.getPresenceRecords()` 衍生」）
- [x] 5.6 跑 `bun test apps/api/src/sync/mutator-readers.test.ts`，確認所有 case 都 GREEN

## 6. Tool Registry — Tool registry enumerates the full agent tool surface

- [x] 6.1 新檔 `apps/api/src/sync/tool-registry.test.ts`：「Registry enumerates exactly eleven entries with correct kinds」spec scenario 翻成 test（`Object.values(toolRegistry).length === 11`、6 write + 5 read）+ 「Write-tool execute routes through applyMutation」test（用 spy/stub 驗 createShape entry 的 execute 真的呼叫 applyMutation 帶單元素 array）+ 「Read-tool execute routes through the corresponding reader」test
- [x] 6.2 跑 `bun test apps/api/src/sync/tool-registry.test.ts`，確認 RED
- [x] 6.3 新檔 `packages/shared/src/tool-types.ts`：定義 `ToolName` 窮舉 union（11 個 string literal）、`WriteToolName` / `ReadToolName` 子 union、`ToolEntry` discriminated union 形狀（依 design 「Tool registry 是 typed lookup table、11 個 entry」）
- [x] 6.4 新檔 `apps/api/src/sync/tool-registry.ts` — 對應 spec requirement `Tool registry enumerates the full agent tool surface`：export `toolRegistry: Record<ToolName, ToolEntry>`，每個 write entry 的 `execute` 是 thin wrapper 呼叫 `applyMutation(deps, canvasId, [{ type, payload: input }])`；每個 read entry 的 `execute` 直接呼叫對應 reader 函式
- [x] 6.5 確認 TypeScript 窮舉檢查：刪掉 `toolRegistry` 任一 entry 編譯錯（型別系統強制覆蓋全部 11 個 ToolName）
- [x] 6.6 跑 `bun test apps/api/src/sync/tool-registry.test.ts`，確認 GREEN

## 7. Integration tests — Server tldraw Mutator exposes applyMutation for server-initiated room edits（涵蓋全部 6 個 variant 的真 sync 廣播）

- [x] 7.1 在 `apps/api/src/sync/mutator-integration.test.ts` 加新 case：`updateShape` round-trip（先 create 一個 shape → updateShape → assert WS client 收到 update message 含 merged record） [P]
- [x] 7.2 在 `mutator-integration.test.ts` 加新 case：`deleteShape` round-trip（create → delete → assert WS client 收到 delete sync update） [P]
- [x] 7.3 在 `mutator-integration.test.ts` 加新 case：`groupShapes` round-trip（create 兩個 shape → groupShapes → assert client snapshot 含 group record + 子 shape 的 parentId 已重指）
- [x] 7.4 在 `mutator-integration.test.ts` 加新 case：`ungroupShape` round-trip
- [x] 7.5 在 `mutator-integration.test.ts` 加新 case：`connectShapes` round-trip（create 兩個 shape → connectShapes → assert client snapshot 含 arrow shape + 兩個 binding records）
- [x] 7.6 對 `Server tldraw Mutator exposes applyMutation for server-initiated room edits` 既有 `createShape` integration test 跑 regression check（M12.1 路徑必須仍通過）
- [x] 7.7 在 `mutator-integration.test.ts` 加 multi-variant batch case 對應 spec 「Mutator applies a multi-variant batch in one transaction」scenario：[createShape, updateShape, connectShapes] 一次套 → assert client 收一個 batch 含三個變更 + 單 Cmd+Z 退回原始狀態
- [x] 7.8 跑 `bun test apps/api/src/sync/mutator-integration.test.ts`，確認所有新 + 既有 case 都 GREEN

## 8. ADR — `groupShapes` 走「put group record + reparent children」+ `connectShapes` 走「put arrow shape + start/end binding records」+ Viewport / Selection 從 `room.getPresenceRecords()` 衍生

- [x] 8.1 新檔 `docs/adr/0014-full-tool-surface-tldraw-record-shapes.md`：紀錄 group 用 `type: "group"` shape + parentId 重指的決策、binding record 形狀（terminal/fromId/toId）、`getPresenceRecords()` `@internal` API 使用風險與升級 canary 策略（沿用 ADR 0013 的格式）
- [x] 8.2 ADR 0014 必須記錄：若 implementation 階段發現 tldraw 4.x 的 group / binding record shape 不符預期，要回 design 重評（沿用 M12.1 的 spike-fail 流程）

## 9. Refactor & verification

- [x] 9.1 跑 `bunx oxlint` 與 `bunx oxfmt`，修任何 lint / format 問題
- [x] 9.2 跑 `bun run typecheck`，修任何 TypeScript 錯誤；特別確認 `applyOne` 對所有 6 個 `Mutation` variant 都覆蓋（窮舉檢查）+ `toolRegistry` 對所有 11 個 ToolName 都有 entry
- [x] 9.3 跑全部 `bun test`，確認所有 unit + integration 測試通過、coverage 仍 ≥ 70%
- [x] 9.4 對 `errors.fullToolSurface.*` 的 zh-TW 與 en 文案做最終 review（口吻沿用既有 errors.canvas.* / errors.devMutate.* 風格） [P]

## 10. 錯誤合約：新增 `errors.fullToolSurface.*` 命名空間 + 不引入 read endpoint、讀工具不走 dev REST — sanity check

- [x] 10.1 確認沒新增任何 HTTP route：`apps/api/src/index.ts` 與 `apps/api/src/dev/` 沒有為讀工具加新 endpoint（依 design「不引入 read endpoint」）
- [x] 10.2 確認沒新增 rate-limit rule：本變更不擴 dev endpoint 入口、共用既有 `dev.mutate` rule（per M12.1 spec）
- [x] 10.3 確認 `applyMutation` 對 fail-fast 行為的 transaction abort 在 integration test 有覆蓋（groupShapes 任一 child 不存在 → 整 transaction 不 commit、client 不收任何 partial 廣播）
