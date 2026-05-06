## Context

M12.1（archived 2026-05-06）把 Server tldraw Mutator 模組立起來：`applyMutation(deps, canvasId, mutations[])` 簽名、`Mutation` discriminated union、`commitBatch` 把整個陣列包進一個 `room.updateStore(...)` transaction、TLSocketRoom 廣播管線把變更推給所有 client。整條垂直管道在 spike 期被 integration 測試（真 Bun.serve + 真 TLSocketRoom + 真 WS client）驗成可用，並產出 ADR 0013 紀錄選用的 `updateStore` 進入點與 batch 語意保留方式。

但 M12.1 只 wire 了 `createShape` 一條 variant — agent runtime（M13.1）一開始呼叫 update / delete / group / connect / read 等工具就會撞到「unsupported mutation type」、卡在 `tool_result { is_error: true }` 自我修正死循環。Issue #6 acceptance criteria 直接列了 11 個 tool 全綁完才算做完。本變更（M12.2）的責任是把 mutator 的工具表面一次填滿，讓 M13.1 進來時 agent loop 已經有完整的 surface 可呼叫。

工程量本身不是難題（pattern 已立、進入點已驗、batch 已過 spike），但仍有兩個 spike-tier 的不確定性需要 design 階段先標記：

1. **`groupShapes` 的 tldraw 表示方式：** tldraw 的 group 是 `parentId` 重指 + 一個 `shape:` record with `type: "group"`，還是另有獨立 record type？需要在 implementation 時對齊 tldraw 4.x 的 schema、確認是否能用 `RoomStoreMethods.put` 直接表達。若 group 必須走 client-side `editor.groupShapes(...)` 的高階呼叫才能正確 commit，這個 variant 就要靠「server 直接 put group record + reparent children」手刻實作（仍走同一個 `updateStore` transaction）。
2. **`connectShapes` 的 binding 表示：** tldraw 4.x 的 arrow binding 走獨立 `binding:` record，不是 arrow shape 上的 prop。我們在 server 端需要同時 put arrow shape + 兩條 binding records — 都在同一個 `updateStore` 內，client 收到視為單一 batch。

兩條風險都不會 block design — 兩者都能用 `RoomStoreMethods.put` 表達，最壞情況是要 put 多筆 record，仍在同一個 transaction 內。但 implementation 時要 cross-check tldraw 4.x 的 schema、寫 integration 測試確認 client 端視覺呈現正確；若發現任何 record 必須走 `room.handleSocketMessage`（client 連線推進來）才能正確 commit，就要回 design 重評（M12.1 design 已立場「不採該路線」）。

讀工具不動 room、純從 `room.getCurrentSnapshot()` 與 `room.getPresenceRecords()` 衍生。`getCurrentSnapshot()` 已是公開 API；`getPresenceRecords()` 標 `@internal`，要在 ADR 0014 紀錄使用風險（同 M12.1 對 `updateStore` 的處理 — tldraw 升級時當 canary）。

並行的 `add-permission-guard`（M12.3 / issue #7）會新增 PermissionGuard 模組、攔 dev endpoint。本變更跟它路徑無交集（mutator + readers + registry vs. permission-guard），merge 順序任意；唯一交集在 dev endpoint 註冊處，但本變更不動 dev endpoint 的 router 形狀。

## Goals / Non-Goals

**Goals:**

- 把 `Mutation` discriminated union 從 1 個 variant 擴成 6 個（createShape 留著 + updateShape / deleteShape / groupShapes / ungroupShape / connectShapes 新增）
- 每個寫 variant 在 `applyOne` 加 switch arm、走同一個 `commitBatch` → 自動繼承 M12.1 已驗的 batch undo 語意，不需重新驗
- 新增 5 個讀工具（`listShapesInViewport` / `listShapesInSelection` / `getShape` / `getCanvasBounds` / `getViewport`），從 `room.getCurrentSnapshot()` + `room.getPresenceRecords()` 衍生 plain 物件
- 新增 ToolRegistry：typed lookup table，11 個 entry（6 寫 + 5 讀），每個 entry 含 `{ name, kind, schema, execute }`，給 M13.1 agent runtime 枚舉用
- 新增 ADR 0014 紀錄 `groupShapes` / `connectShapes` 的 tldraw record 形狀選擇 + `getPresenceRecords()` internal API 使用風險
- 完整 TDD：每個 variant + 每個 reader + registry 都先 failing test 再 implement

**Non-Goals:**

- Permission Guard 對 mutator / readers / registry 的整合（屬 issue #7 / `add-permission-guard`）
- Agent runtime / Vercel AI SDK / `streamText` loop（屬 M13.1）
- Canvas Digest Builder / pull tools（屬 M13.2 — 那一層消費讀工具的輸出）
- WS streaming channel for agent events（屬 M13.3）
- Production AI mutation endpoint — 本變更維持 dev endpoint only
- E2E（Playwright）覆蓋 — 沿用 M12.1 結論，integration tier 足夠
- 任何 client-side 改動（client 透過既有 sync 通道收 update，不需特殊處理）

## Decisions

### Mutation 介面：保留 M12.1 的 discriminated union 與 `applyOne` switch

不另開 `applyUpdateShape` / `applyDeleteShape` 等專用 entry point。所有寫 variant 都走 `applyMutation(deps, canvasId, mutations[])` → `commitBatch` → `applyOne(store, op)` switch。

理由：
- M12.1 設計時就把 `Mutation` 設成 discriminated union 是為了這次擴充。多開 entry point 會拆裂介面、迫使 caller 做型別 narrowing。
- `applyOne` 加 switch arm 後 TypeScript 的窮舉檢查會自動把所有 variant 強制覆蓋（漏寫 case 編譯就掛）。
- Batch 語意（單 `updateStore` transaction = 單客戶端 undo）對所有 variant 一視同仁，不需要每個 variant 重新驗。
- M13.1 agent runtime 看到的 entry point 仍是 `applyMutation` — 一次學一個介面。

### 讀工具走獨立 module、回 plain 物件、不 leak tldraw record

讀工具放 `apps/api/src/sync/mutator-readers.ts`，每個函式：

```ts
listShapesInViewport(deps, canvasId, viewport): Promise<Result<ShapeSummary[]>>
listShapesInSelection(deps, canvasId, sessionId): Promise<Result<ShapeSummary[]>>
getShape(deps, canvasId, shapeId): Promise<Result<ShapeSummary | null>>
getCanvasBounds(deps, canvasId): Promise<Result<Bounds | null>>
getViewport(deps, canvasId, sessionId): Promise<Result<Viewport | null>>
```

`ShapeSummary` / `Bounds` / `Viewport` 是專案自定義的 plain TypeScript 物件，不是 tldraw `TLShape` 直接 leak：

```ts
type ShapeSummary = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number | null; // null when shape has no explicit width
  h: number | null;
  parentId: string;
  rotation: number;
  meta: Record<string, unknown>;
  props: Record<string, unknown>; // shape-type-specific, opaque at this layer
};

type Bounds = { x: number; y: number; w: number; h: number };

type Viewport = Bounds; // alias for clarity at call sites
```

理由：
- tldraw 4.x → 5.x 升級若改 `TLShape` 形狀（例如把 `props.w` 拆成 props.width / props.height），讀工具必須在 readers 層做翻譯，agent prompt 不會被波及
- ShapeSummary 故意保留 `props` 為 opaque record — 4 個 Vellum custom shape 與 tldraw 內建 shape 共用同一個 summary 形狀，agent runtime 自己決定要不要往下挖
- `getCanvasBounds` 對「empty room」回 `null`（不是 `{ x: 0, y: 0, w: 0, h: 0 }`）— `null` 對 agent 更明確、避免「面積 0 的矩形」這種誤導

### Viewport / Selection 從 `room.getPresenceRecords()` 衍生

tldraw 4.x 的 viewport 與 selection 都存在 instance presence 記錄裡（per-`sessionId`），不在 document store。要拿這兩個值唯一公開的入口是 `room.getPresenceRecords()`，但這個方法標 `@internal`。

決策：用，但在 ADR 0014 紀錄 — 跟 M12.1 對 `updateStore` 的處理一致（公開合約被 deprecation 標記但實際是專案賴以為生的入口）。tldraw 升級時 readers 的 integration 測試當 canary：升級後若 presence 結構改了，這條測試先掛、再決定是否 block 升級。

替代方案：
- **要求 client 主動 push viewport：** Phase 2 PRD 的 digest 機制是 server-side derivation；要 client push 就把 digest 從 deep module 變成 shallow forwarder，違背 PRD 模組劃分。否決。
- **fork tldraw sync：** 太重，spike 期就否決過。否決。

### `groupShapes` 走「put group record + reparent children」

tldraw 的 group 表示是一個 `shape:` record with `type: "group"`，加上所有子 shape 的 `parentId` 重指到 group id。`groupShapes` mutator variant 在同一個 `updateStore` transaction 內：

1. `put` 新 group shape record（用 caller 提供的 `groupId`）
2. 對每個 `shapeIds` 中的 shape：`get` → 修改 `parentId` → `put`

整段在一個 transaction 內、客戶端視為一個 batch、單一 Cmd+Z 退掉整個 group 操作。

`ungroupShape` 反向：

1. `get(groupId)` 拿 group record；不是 `type: "group"` 就 reject
2. `getAll()` 找所有 `parentId === groupId` 的子 shape，把 `parentId` 還原成 group 的 `parentId`
3. `delete(groupId)`

ADR 0014 紀錄：實作時 cross-check tldraw 4.x schema 確認 `type: "group"` 是正確的 record type。若 tldraw 把 group 改成獨立 record type（`group:` 而非 `shape:`），這個 variant 要重做。

### `connectShapes` 走「put arrow shape + start/end binding records」

tldraw 4.x 的 arrow binding 是獨立 `binding:` record（不是 arrow shape 的 prop）。`connectShapes` mutator variant 在同一個 `updateStore` transaction 內：

1. `put` 新 arrow shape record（`type: "arrow"`，包含 caller 提供的 `arrowId` + `label?`）
2. `put` start binding：`{ id: "binding:...", type: "arrow", fromId: <arrowId>, toId: <fromShapeId>, props: { terminal: "start" } }`
3. `put` end binding：同上、`terminal: "end"`、`toId: <toShapeId>`

理由：
- 跟 client `editor.createBindings(...)` 對應的最低階 record 寫法
- Binding 與 arrow shape 在同一個 transaction 內 commit、客戶端 atomic 看到「箭頭 + 兩個端點都已連」，不會看到「箭頭飄著、binding 還沒到」的中間狀態
- ADR 0014 紀錄 binding record 形狀（schema 與 tldraw 4.x 對齊；升級時當 canary）

### Tool registry 是 typed lookup table、11 個 entry

`apps/api/src/sync/tool-registry.ts` exports：

```ts
type ToolEntry =
  | { name: WriteToolName; kind: "write"; schema: ZodSchema; execute: WriteFn }
  | { name: ReadToolName;  kind: "read";  schema: ZodSchema; execute: ReadFn };

export const toolRegistry: Record<ToolName, ToolEntry> = { ... };
```

`ToolName` 是窮舉 union（11 個 string literal），M13.1 agent runtime `Object.values(toolRegistry)` 拿全部、把 schema 餵 Vercel AI SDK 的 `tools` 參數。

理由：
- M13.1 需要的是「枚舉 + by-name lookup」兩個操作，map 是最自然的形狀
- Type-safe iteration（沒有字串拼接、沒有 runtime registry build-up），新增 tool 漏掛 entry 編譯掛
- `kind` discriminator 讓 agent runtime 區分「哪個 tool 要走 mutator」「哪個 tool 走 reader」— write/read 的 execute 簽名不同（write 回 MutationResult、read 回 Result<T>），用 union 表達
- 寫工具的 `execute` 是 thin wrapper：呼叫 `applyMutation(deps, canvasId, [{ type, payload }])` 並回傳結果。Registry 不重複實作邏輯、也不洩漏 `Mutation[]` 介面

### 錯誤合約：新增 `errors.fullToolSurface.*` 命名空間

新增 errorKey：

- `errors.fullToolSurface.shapeNotFound` — updateShape / deleteShape / groupShapes / connectShapes 任一 endpoint shape 不存在
- `errors.fullToolSurface.groupNotFound` — ungroupShape 給的 groupId 不是 group 或不存在
- `errors.fullToolSurface.invalidViewport` — 讀工具的 viewport 矩形不合法（負寬高、NaN）
- `errors.fullToolSurface.sessionNotFound` — listShapesInSelection / getViewport 的 sessionId 在 presence 中沒記錄

不重用 `errors.devMutate.*`（那是 M12.1 跟 dev endpoint 綁的；新工具失敗模式語意不同 — 不是「dev 入口問題」是「tool 內部驗證問題」）。zh-TW + en locale 兩語言同步加。

### 不引入 read endpoint、讀工具不走 dev REST

讀工具有兩種可能 caller：
1. M13.1 agent runtime（in-process、由 `streamText` 的 tool dispatcher 直呼）
2. M12.2 自己的測試

兩者都不是 HTTP caller。新增 `GET /dev/canvas/:id/shape/:shapeId` 等讀路徑等於多開 production 攻擊面（M12.1 design 已立場 dev endpoint 必須 production 完全不註冊；新增任何 dev endpoint 都同樣 bound）。維持讀工具 in-process only、不開 HTTP 入口。

替代方案：把讀工具 wrap 成 HTTP — 否決，理由如上。

## Risks / Trade-offs

- **`groupShapes` / `connectShapes` 的 tldraw record 形狀沒對齊 4.x schema** → ADR 0014 紀錄選用的 record shape；integration 測試對真 sync server + 真 client 跑、確認 client 端視覺正確（group 子 shape 拖移時整組動、arrow 兩端 binding 跟 endpoint 移動）。tldraw 升級時這條測試當 canary。
- **`getPresenceRecords()` 標 `@internal`、tldraw 升級可能改形狀或移除** → ADR 0014 紀錄；readers 的 integration 測試含「presence record 結構斷言」、升級先掛這條再決定是否 block。替代方案（fork / 要求 client push）已在 Decisions 否決。
- **讀工具的 `ShapeSummary` plain 形狀洩漏不夠的資訊給 agent** → 故意保留 `props` 為 opaque record；agent 真的需要 shape-type-specific 細節時可加新 reader（例如 `getShapeProps`）— 不擋 M13.1，但留作將來擴充點。
- **新增 errorKey 命名空間 `errors.fullToolSurface.*` 可能跟並行 `add-permission-guard` 撞** → 兩 namespace 不重疊（permission-guard 用 `errors.permission.*`），merge 時 zh-TW.json / en.json 在 errors top-level 各加自己的子物件。
- **Tool registry 的 `execute` 簽名 mismatch agent runtime 預期** → M13.1 是本變更的 caller；本變更先定義 registry interface，M13.1 進來時若簽名要調，registry 是淺薄 lookup table、改動範圍只在這一個檔案 + adapter 層，agent runtime 自己加 wrapper 不需重寫 mutator。
- **`groupShapes` 不存在的 shape 在 transaction 內被 reject、其他 shapes 已 put** → 走 fail-fast：`groupShapes` 在 `applyOne` 開頭先用 `store.get` 驗所有 shapeIds、任一不在就 throw、整個 transaction abort（updateStore 是 atomic）。`updateStore` 在 throw 後不 commit，client 看不到中間狀態。
- **大批 mutation 在同一 transaction 內可能撐爆 memory** → 沿用 M12.1 既有 rate-limit；本變更不改 limit。Agent 一輪的 tool call 上限（PRD「自我修正 loop 天花板 = 同一 tool 連續 3 次失敗 abort 整輪」）天花板在 agent runtime 層實現，不是 mutator 的責任。

## Migration Plan

純加法 change：

- 新增寫 variant、新增讀模組、新增 registry、新增 ADR 0014、新增 errorKey + 兩語言 locale
- 不動 schema、不動既有 spec requirement 的合約形狀（M12.1 spec 的 createShape 行為原封保留）
- 不改 dev endpoint 的 router 形狀
- 不改 production routing
- Rollback：revert commit。零 data migration、零 idempotency 需求。
- M12.1 既有 integration 測試（`apps/api/src/sync/mutator-integration.test.ts` 的 createShape 路徑）必須繼續通過 — 本變更只擴增測試、不改既有測試斷言

## Open Questions

- 實作階段才能 100% 確認 tldraw 4.x 的 group record shape 與 binding record shape；ADR 0014 在 implementation 真的決定後補完。預期是「`type: "group"` shape + `parentId` 重指」+「`binding:` record」沒問題，但若 tldraw 對 group / binding 採非 record-level 表示（例如 client-only 動作），就要回 design 重評那兩個 variant。
- M13.1 agent runtime 對 `ToolEntry.execute` 的真實簽名需求要等 M13.1 進來才會 100% 對齊；本變更先以「最小通用」的形狀定義（write 回 MutationResult、read 回 Result<T>），M13.1 若要加 streaming hook、telemetry hook 等可以以 wrapper 形式接入、不動 mutator。
