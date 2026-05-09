## 1. Production handler DI 擴展

- [x] 1.1 在 apps/api/src/canvas/index.ts 的 `handleUpdate` 把「load by id 看存在性」那段（目前 line ~329-335）改成優先呼 `deps.loadCanvas?.(canvasId)`，沒提供 deps 才 fallback 既有 `getDb()` 路徑；既有 sharing-related 操作（write 階段的 db.update）保持不變。
- [x] 1.2 在同檔 `handleDelete` 做同樣處理（目前 line ~395 直接 `getDb()`）。
- [x] 1.3 在 apps/api/src/folder/index.ts 新增 `FolderHandlerDeps` interface（`loadFolder?(folderId): Promise<{ id: string; ownerId: string; ... } | null>`），`handleFolderRequest` 加第 4 個 optional 參數 `deps?: FolderHandlerDeps`，把 `handleUpdate` / `handleDelete` 的 not-found 早期返回改成優先用 `deps?.loadFolder?(folderId)`，沒 deps fallback `getDb()`。
- [x] 1.4 確認 apps/api/src/index.ts 對 `handleFolderRequest` / `handleCanvasRequest` 的 caller 不需要改（既有 caller 沒帶 deps 仍然走 fallback path，行為零變更）。

## 2. 補測試 deps stub（canvas）

- [x] 2.1 在 apps/api/src/canvas/canvas.test.ts 加共用 helper `notFoundCanvasDeps: CanvasHandlerDeps = { loadCanvas: async () => null }`，並 import `CanvasHandlerDeps` 型別；對應 spec「Canvas handler not-found path is unit-testable without DB access」。
- [x] 2.2 為「Canvas read by id > non-existent canvas returns 404」test 把第四參數 `notFoundCanvasDeps` 帶上；對應 scenario「GET /api/canvas/:id with a non-existent id returns 404 in unit test」。
- [x] 2.3 為「Canvas update > non-existent canvas returns 404」test 帶上同樣的 `notFoundCanvasDeps`；對應 scenario「PATCH /api/canvas/:id with a non-existent id returns 404 in unit test」。
- [x] 2.4 為「Canvas delete > non-existent canvas returns 404」test 帶上同樣的 `notFoundCanvasDeps`；對應 scenario「DELETE /api/canvas/:id with a non-existent id returns 404 in unit test」。

## 3. 補測試 deps stub（folder）

- [x] 3.1 在 apps/api/src/folder/folder.test.ts 加共用 helper `notFoundFolderDeps: FolderHandlerDeps = { loadFolder: async () => null }`；對應 spec「Folder handler not-found path is unit-testable without DB access」。
- [x] 3.2 為「Folder rename > non-existent folder returns 404」test 帶上 `notFoundFolderDeps` 當第 4 參數；對應 scenario「PATCH /api/folder/:id rename with non-existent id returns 404 in unit test」。
- [x] 3.3 為「Folder delete > non-existent folder returns 404」test 帶上同樣的 `notFoundFolderDeps`；對應 scenario「DELETE /api/folder/:id with non-existent id returns 404 in unit test」。

## 4. Quality gates

- [x] 4.1 從 repo root 跑 `bun test apps/api/src/canvas/canvas.test.ts`，預期所有 test 全綠（原 30 pass / 3 fail → 33 pass / 0 fail）。
- [x] 4.2 從 repo root 跑 `bun test apps/api/src/folder/folder.test.ts`，預期所有 test 全綠（原 2 fail → 0 fail）。
- [x] 4.3 從 repo root 跑 `bun test apps/api`，預期 624/624 全綠（原 619/624）。
- [x] 4.4 執行 `bun run typecheck` 全綠。
- [x] 4.5 在 project_deploy_checklist 記憶把「Test isolation 技術債」段落的 canvas/folder 那條標記為「已修，留 BYOK contract test 那條」。
