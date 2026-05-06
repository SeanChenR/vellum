## 1. Setup 與 shared 型別

- [x] 1.1 在 `packages/shared/src/mutation-types.ts` 新增 `Mutation` discriminated union 型別與對應的 Zod schema（M12.1 只 export `createShape` variant；其他 variant 留 type-level 擴充點）。對應 design 章節「Mutation 介面：accept 陣列、保留 batch 語意」。 [P]
- [x] 1.2 在 `apps/api/src/lib/rate-limit-rules.ts` 加入 `DEV_MUTATE_RULE: { windowMs: s(60), max: 30 }` 常數。對應 design 章節「Rate limit rule」與 spec requirement「Dev mutator endpoint enforces a per-user rate limit」。 [P]
- [x] 1.3 在 `packages/shared/src/locales/zh-TW.json` 與 `packages/shared/src/locales/en.json` 同步新增 `errors.devMutate.invalidPayload` / `errors.devMutate.canvasNotInActiveRoom` / `errors.devMutate.mutationFailed` 三個 key（對應 design 章節「錯誤合約與 i18n」）。

## 2. Tests First — Mutator 單元測試（紅）

- [x] 2.1 在 `apps/api/src/sync/mutator.test.ts` 寫紅測試：呼叫 `applyMutation` 對 stub `TLSocketRoom`、傳入合法 `[createShape]` → 預期解出 `{ ok: true, appliedCount: 1 }`、stub 的 batch / write API 被呼叫一次。對應 spec requirement「Server tldraw Mutator exposes applyMutation for server-initiated room edits」。
- [x] 2.2 寫紅測試：`applyMutation` 傳入 schema 不合法的 createShape payload → 預期 `{ ok: false, errorKey: "errors.devMutate.invalidPayload" }`，stub room 完全沒被觸碰。對應 spec requirement「Server tldraw Mutator exposes applyMutation for server-initiated room edits」。
- [x] 2.3 寫紅測試：room registry `getRoom(canvasId)` 回 `undefined` → `applyMutation` 解出 `{ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" }`。對應 spec requirement「Server tldraw Mutator exposes applyMutation for server-initiated room edits」。
- [x] 2.4 寫紅測試：傳入 `[createShapeA, createShapeB]` 時 mutator 走的是單一 batch / transaction 入口（用 spy 驗證 batch fn 只開一次、收兩個 op）— 驗 spec requirement「Mutator preserves batch undo semantics across the server-client bridge」與 design 章節「TLSocketRoom 內部 API 選擇 — 由 spike 決定，紀錄到 ADR」。
- [x] 2.5 寫紅測試：mutator 內部 throw 不會把 exception 透到 caller — 任何 unexpected error 被包成 `{ ok: false, errorKey: "errors.devMutate.mutationFailed" }`。對應 design 章節「錯誤合約與 i18n」。

## 3. Implementation — Mutator 模組（綠）

- [x] 3.1 在 `apps/api/src/sync/mutator.ts` 實作 `applyMutation(canvasId, mutations)`：注入 room registry、用 1.1 的 Zod schema 驗 input、對 active room 走單一 batch 套所有 mutation（為 spec requirement「Server tldraw Mutator exposes applyMutation for server-initiated room edits」與「Mutator preserves batch undo semantics across the server-client bridge」綠化）。
- [x] 3.2 在 mutator 內把 TLSocketRoom 的 server-side write 進入點封裝在一個 `commitBatch(room, ops)` 私有 function 裡（spike 期 try `room.updateStore` → fallback `room.store.put`）— 為 design 章節「TLSocketRoom 內部 API 選擇 — 由 spike 決定，紀錄到 ADR」綠化。
- [x] 3.3 將所有 TLSocketRoom 互動包在 try/catch、未預期 throw 統一回 `{ ok: false, errorKey: "errors.devMutate.mutationFailed" }`，補齊 2.5 紅測試。
- [x] 3.4 跑 `bun test apps/api/src/sync/mutator.test.ts` 驗 2.1–2.5 全綠。

## 4. Tests First — Dev endpoint 單元測試（紅）

- [x] 4.1 在 `apps/api/src/dev/mutate-endpoint.test.ts` 寫紅測試：以 `NODE_ENV` unset、stub mutator 回 `{ ok: true, appliedCount: 1 }` → POST 合法 body 預期 HTTP 200 + `{ ok: true, appliedCount: 1 }`。對應 spec requirement「Dev-only REST endpoint POST /dev/canvas/:id/mutate triggers the mutator」。
- [x] 4.2 寫紅測試：mutator 回 `{ ok: false, errorKey: "errors.devMutate.invalidPayload" }` → endpoint 回 HTTP 400 + 同一個 errorKey。同上 spec requirement。 [P]
- [x] 4.3 寫紅測試：mutator 回 `{ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" }` → endpoint 回 HTTP 409 + 同一個 errorKey。同上 spec requirement。 [P]
- [x] 4.4 寫紅測試：以 `NODE_ENV=production` 啟動 server wiring → 對 `/dev/canvas/:id/mutate` 任何請求一律 HTTP 404，且 server 的 routes 表中該 path 不存在（用 introspection 驗）。對應 design 章節「Dev endpoint 的物理隔離 — production 完全不註冊」與 spec requirement「Dev-only REST endpoint POST /dev/canvas/:id/mutate triggers the mutator」。
- [x] 4.5 寫紅測試：同一 user 在 60 秒內第 31 次 POST 預期 HTTP 429 + body `{ ok: false, errorKey: "errors.rateLimit", retryAfter: <number> }` + `Retry-After` header。對應 spec requirement「Dev mutator endpoint enforces a per-user rate limit」。
- [x] 4.6 寫紅測試：endpoint wiring 時若 `dev.mutate` rate-limit rule 未註冊，server 啟動 throw（startup 失敗）。對應 spec requirement「Dev mutator endpoint enforces a per-user rate limit」。

## 5. Implementation — Dev endpoint（綠）

- [x] 5.1 在 `apps/api/src/dev/mutate-endpoint.ts` 實作 handler：用 1.1 的 Zod 驗 body、呼叫 `applyMutation`、依 errorKey 對應 status code（invalid → 400、canvasNotInActiveRoom → 409、其它 → 500）。為 4.1–4.3 綠化。
- [x] 5.2 在 `apps/api/src/index.ts` 條件式註冊路由 — 只在 `Bun.env.NODE_ENV !== "production"` 時 mount `POST /dev/canvas/:id/mutate`；production build 路由表中物理不存在這條 path。對應 design 章節「Dev endpoint 的物理隔離 — production 完全不註冊」，為 4.4 綠化。
- [x] 5.3 在 endpoint 中走既有 `RateLimiter`（key = `api:dev.mutate:<userId>`）+ session-cookie 解出 userId；達上限回 429 + `Retry-After`。為 4.5 綠化。
- [x] 5.4 在 wiring 加 startup-time 檢查：dev endpoint 必須對應 registered rate-limit rule，否則 throw。為 4.6 綠化。
- [x] 5.5 跑 `bun test apps/api/src/dev/mutate-endpoint.test.ts` 驗 4.1–4.6 全綠。

## 6. Tests First — Sync 包裝（紅）

- [x] 6.1 在 `apps/api/src/sync/index.ts`（或新增 `apps/api/src/sync/mutator-wiring.ts`）暴露 `getRoomRegistry()` getter，讓 mutator 拿到 registry instance。先寫紅測試驗 getter 回的 instance 跟 `createSyncServer` 內部用的是同一個。
- [x] 6.2 寫紅測試：sync server 起動時若沒有提供 mutator wiring（mutator 拿不到 registry）、`applyMutation` 對任何 canvasId 都回 `{ ok: false, errorKey: "errors.devMutate.canvasNotInActiveRoom" }`。

## 7. Implementation — Sync 包裝（綠）

- [x] 7.1 把 mutator 與 sync server 用 dependency injection 串起來（mutator 拿 `RoomRegistry`），為 6.1–6.2 綠化。

## 8. Integration test — 真 sync broadcast 路徑

- [x] 8.1 在 `apps/api/src/sync/mutator-integration.test.ts` 寫紅測試：起真 Bun.serve（含 sync server + dev endpoint）+ insert fixture canvas + 用 Bun WebSocket client 連 `/sync/<id>`。對應 spec requirement「Mutator integration test exercises the real sync broadcast path」與 design 章節「Integration 測試走真 sync server，不 mock」。
- [x] 8.2 寫紅測試：等 WS client 拿到 initial snapshot → POST `/dev/canvas/<id>/mutate` 一個 createShape → 等待 WS client 收到含新 record 的 sync update message（用 promise + 5s timeout）→ assert record id 與 type 正確。對應 spec requirement「Mutator integration test exercises the real sync broadcast path」。
- [x] 8.3 寫紅測試：POST `[createShapeA, createShapeB]` → assert WS client 收到的 update 把兩筆 record 包在同一個 batch / message 裡（不是兩個獨立 message）— 補強 spec requirement「Mutator preserves batch undo semantics across the server-client bridge」的 wire-level 證據。
- [x] 8.4 在 cleanup 區塊刪 fixture canvas、清 snapshot row、shutdown sync server。
- [x] 8.5 跑 `bun test apps/api/src/sync/mutator-integration.test.ts` 驗 8.1–8.3 全綠。

## 9. ADR 與文件

- [x] 9.1 撰寫 `docs/adr/0013-server-tldraw-mutator-trade-offs.md`：記錄選用的 TLSocketRoom 進入點、batch 語意保留方式、若使用 internal / undocumented API 的升級風險與 canary 策略。對應 design 章節「TLSocketRoom 內部 API 選擇 — 由 spike 決定，紀錄到 ADR」。

## 10. Refactor + 驗收

- [x] 10.1 跑 `bunx oxlint` + `bunx oxfmt` 全 green。 [P]
- [x] 10.2 跑 `bun run typecheck` 全 green。 [P]
- [x] 10.3 跑全套 `bun test` — mutator 單元 + dev endpoint 單元 + integration 全綠，覆蓋率 ≥ 70%。
- [x] 10.4 視覺驗收：開瀏覽器連同一張 canvas → 用 `curl POST /dev/canvas/<id>/mutate` 送 createShape → 確認 shape 在瀏覽器即時冒出（PRD US 21 的 server-bridge 證據）。
- [x] 10.5 reviewer pass：對照 spec 五個 requirement、design 六個 `###` 章節、issue #4 的 6 條 acceptance criteria 逐項勾完。
