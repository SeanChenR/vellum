## Summary

擴充 M12.1 已立的 Server tldraw Mutator，把剩下的 5 個寫工具（`updateShape` / `deleteShape` / `groupShapes` / `ungroupShape` / `connectShapes`）+ 5 個讀工具（`listShapesInViewport` / `listShapesInSelection` / `getShape` / `getCanvasBounds` / `getViewport`）+ 工具註冊表（`ToolRegistry`）一次補齊，讓 mutator 能支撐 agent 一整輪呼叫，而不只是 `createShape`。

## Motivation

M12.1（archived 2026-05-06）只 wire 了 `createShape` 一條路徑、把 TLSocketRoom 的 `updateStore` 進入點驗成可用，但這只夠當 spike。M13.1 agent runtime 一旦接 Vercel AI SDK 的 `streamText`，模型在一輪內就會呼叫 update / delete / group / connect / read 等多種 tool — 缺任何一個 agent 就會 throw、卡在 `tool_result { is_error: true }` 自我修正死循環。Issue #6 的 acceptance criteria 直接列了 11 個工具全綁完才算做完，所以這次必須把整個 tool surface 一口氣補齊，才能讓 M13.1 安全進來。

`Mutation` discriminated union 跟 `applyMutation(canvasId, mutations[])` 簽名在 M12.1 設計時就預留擴充點 — 加新 variant 不會破壞 caller 型別。讀工具是新增模組（不走 `applyMutation`、不動 room）；註冊表是新增模組（不動既有 dev endpoint 形狀）。整體是純加法，零 breaking。

## Proposed Solution

### 寫工具（擴 `Mutation` discriminated union + `applyOne` switch）

在 `packages/shared/src/mutation-types.ts` 加 5 個 variant，每個附 Zod schema：

- `updateShape` — `{ type, payload: { id, partial } }`：透過 `RoomStoreMethods.get(id)` 拿現有 record、合併 `partial` 後 `store.put`；shape 不存在 → `errors.fullToolSurface.shapeNotFound`
- `deleteShape` — `{ type, payload: { id } }`：透過 `RoomStoreMethods.delete(id)`；shape 不存在 → `errors.fullToolSurface.shapeNotFound`
- `groupShapes` — `{ type, payload: { shapeIds, groupId } }`：建立 tldraw `group` shape、把所有 `shapeIds` 的 `parentId` 設為新 group id；任一 shape 不存在 → `errors.fullToolSurface.shapeNotFound`
- `ungroupShape` — `{ type, payload: { groupId } }`：把 group 子 shape 的 `parentId` 還原成 group 的 `parentId`，再 `store.delete(groupId)`；group 不存在或非 group type → `errors.fullToolSurface.groupNotFound`
- `connectShapes` — `{ type, payload: { fromId, toId, label?, arrowId } }`：建立 tldraw `arrow` shape，含 start/end binding 指向兩個 endpoint；任一 endpoint 不存在 → `errors.fullToolSurface.shapeNotFound`

每個 variant 在 `apps/api/src/sync/mutator.ts` 的 `applyOne` 加一條 switch arm，全程仍包在同一個 `commitBatch` 的 `room.updateStore(...)` transaction 內 — M12.1 已驗的 batch undo 語意自動套到所有新 variant。

### 讀工具（新模組 `apps/api/src/sync/mutator-readers.ts`）

讀工具不走 `applyMutation`、不動 room。從 `room.getCurrentSnapshot()` 與 `room.getPresenceRecords()` 衍生 plain TypeScript 物件回 caller。簽名：

- `listShapesInViewport(deps, canvasId, viewport: { x, y, w, h }): Promise<Result<ShapeSummary[]>>`
- `listShapesInSelection(deps, canvasId, sessionId): Promise<Result<ShapeSummary[]>>`
- `getShape(deps, canvasId, shapeId): Promise<Result<ShapeSummary | null>>`
- `getCanvasBounds(deps, canvasId): Promise<Result<Bounds | null>>`
- `getViewport(deps, canvasId, sessionId): Promise<Result<Viewport | null>>`

`ShapeSummary` / `Bounds` / `Viewport` 都是專案自定義的 plain shape — 不直接 leak tldraw record 型別，這樣 tldraw schema 改了不會 ripple 到 agent prompt。

### 工具註冊表（新模組 `apps/api/src/sync/tool-registry.ts`）

`ToolRegistry` 是一個淺薄的 lookup table：每個 entry 是 `{ name, kind: "write" | "read", schema: ZodSchema, execute: Fn }`。M13.1 agent runtime 用它枚舉所有 11 個工具給 Vercel AI SDK；本變更只定義介面 + 註冊所有 11 條 entry，不接 agent runtime。

### Dev endpoint 不需改

`POST /dev/canvas/:id/mutate` 已經吃 `Mutation[]`；新 variant 加進 union 後自動被 dev endpoint 的 schema 接受。讀工具**不**透過 dev endpoint 暴露（讀沒有 mutation、agent runtime 在 process 內直接呼叫）。

### 測試

- 單元測試（mock store stub）：每個寫 variant + 每個讀 fn 各一個成功 case + 一個 reject case
- Integration 測試（`apps/api/src/sync/mutator-integration.test.ts` 擴充）：每個寫 variant 至少一個 round-trip（真 Bun.serve + 真 TLSocketRoom + 真 WS client，不 mock）
- TDD：每個工具一定先寫 failing test、再 implement。沿用 M12.1 的 prior art

## Non-Goals

- Permission Guard（屬 issue #7、並行的 `add-permission-guard`，本變更不動）
- Agent runtime / Vercel AI SDK / `streamText` loop（屬 M13.1）
- Canvas Digest Builder / pull tools 的 RAG 化（屬 M13.2）
- Streaming WS channel for agent events（屬 M13.3）
- Production AI mutation endpoint（`POST /api/agent/...`）— 本變更只擴 dev mutator，不加 production 入口
- E2E（Playwright）覆蓋 — 本變更走 unit + integration tier，沿用 M12.1 結論

## Alternatives Considered

- **每個 tool 寫成獨立檔案、每個 variant 一個 `applyXxx` 函式：** 破壞 M12.1 設計的 `Mutation` discriminated union → `applyOne` switch 的單一進入點，型別系統失去窮舉檢查能力。否決。
- **讀工具走 dev endpoint（`GET /dev/canvas/:id/...`）：** 讀工具不會在 production 出現（agent runtime 在 process 內直接呼叫），多開一條 HTTP 路徑等於多一個攻擊面。否決。
- **Tool registry 用字串 enum + 大 switch：** 輸了 type-safe iteration（M13.1 要枚舉 schema 餵 Vercel AI SDK）。改用 typed lookup table。
- **讀工具直接回 tldraw record 型別：** tldraw 升級時 record shape 改了會 ripple 到 agent prompt 重訓。改用專案自定義 plain shape，tldraw 換版只動 readers 層。

## Impact

### Affected specs

- **Modified:** `server-mutation-bridge`
  - **MODIFIED Requirement:** 「Server tldraw Mutator exposes applyMutation for server-initiated room edits」— 把支援的 `Mutation` variant 從只有 `createShape` 擴成 6 種寫 variant
  - **ADDED Requirements:**
    - Mutator updateShape variant
    - Mutator deleteShape variant
    - Mutator groupShapes variant
    - Mutator ungroupShape variant
    - Mutator connectShapes variant
    - Mutator readers expose snapshot-derived read tools
    - Tool registry enumerates the full agent tool surface

### Affected code

- New:
  - apps/api/src/sync/mutator-readers.ts
  - apps/api/src/sync/mutator-readers.test.ts
  - apps/api/src/sync/tool-registry.ts
  - apps/api/src/sync/tool-registry.test.ts
  - packages/shared/src/tool-types.ts
- Modified:
  - packages/shared/src/mutation-types.ts
  - apps/api/src/sync/mutator.ts
  - apps/api/src/sync/mutator.test.ts
  - apps/api/src/sync/mutator-integration.test.ts
  - packages/shared/src/locales/zh-TW.json
  - packages/shared/src/locales/en.json
