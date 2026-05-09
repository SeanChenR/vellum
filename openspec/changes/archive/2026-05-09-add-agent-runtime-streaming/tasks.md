## 1. 前置準備（Setup）

- [x] 1.1 在 apps/api/package.json 安裝 Vercel AI SDK 與三家 adapter（`bun add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google`），鎖 minor version；對應 design 決策「AI SDK 選擇: Vercel AI SDK，三家 provider adapter 套件齊裝」。
- [x] 1.2 建立 apps/api/src/agent/ 目錄骨架（建空檔 runtime.ts / digest.ts / streaming.ts / cancel.ts / sse-endpoint.ts / wiring.ts 與對應 .test.ts，留 `// red` 占位即可）。

## 2. Agent event 型別 schema（TDD 縱切）

- [x] 2.1 [P] 在 packages/shared/src/agent-events.test.ts 撰寫 RED 測試：每個 event variant（text / tool_call / tool_result / error / done）皆 round-trip 通過 zod parse；不在 union 內的 type 字串 parse 失敗；對應 spec 「SSE event types are a closed discriminated union」。
- [x] 2.2 在 packages/shared/src/agent-events.ts 實作 discriminated union zod schema 與 TypeScript 型別 export，使 2.1 測試 GREEN。
- [x] 2.3 將 agent-events 匯出加入 packages/shared 的 barrel（如已有），並執行 `bun test packages/shared` 驗證沒打到無關檔案。

## 3. Cancellation registry（TDD 縱切）

- [x] 3.1 在 apps/api/src/agent/cancel.test.ts 撰寫 RED 測試：register 回傳 AbortController；abort by runId 觸發 controller.signal.aborted；terminal release 後 lookup 為 undefined；對應 spec「Cancellation registry releases resources on terminal state」與 design 決策「Cancellation registry: in-memory per-process」。
- [x] 3.2 在 apps/api/src/agent/cancel.ts 實作 in-memory `Map<runId, AbortController>` 與 register / abort / release API，使 3.1 GREEN。
- [x] 3.3 Refactor cancel registry：將 Map 包成 `CancellationRegistry` deep module 介面，導出 deps interface 供 runtime 注入。

## 4. Canvas digest builder（TDD 縱切）

- [x] 4.1 在 apps/api/src/agent/digest.test.ts 撰寫 RED 測試：fake snapshot 12 markdown / 3 code / 5 link 對應 shapeCounts；selection 只含 id+type 不含內容；shape body 不出現在 digest；單一 run 不重新計算；reuse `MutatorReadersDeps`；分別對應 spec「Digest header has fixed lightweight schema」「Digest never contains full snapshot」「Digest is computed once per run」「Builder reuses existing readers」與 design 決策「Canvas digest: 輕量 header + 既有 read tools 自取」。
- [x] 4.2 在 apps/api/src/agent/digest.ts 實作 `buildCanvasDigest(deps, ctx)` 純函式（接收 `MutatorReadersDeps`），使 4.1 GREEN。
- [x] 4.3 Refactor digest：將 schema 抽到 packages/shared/src/agent-digest.ts 與 zod 驗證共用，server / client 雙向 reuse。

## 5. Streaming SSE writer（TDD 縱切）

- [x] 5.1 在 apps/api/src/agent/streaming.test.ts 撰寫 RED 測試：fake `ReadableStreamDefaultController` 驗證 `text` / `tool_call` / `tool_result` / `error` / `done` 各事件序列化格式；heartbeat 每 15s 推 `:hb\n\n`；header 物件含 `Cache-Control: no-cache, no-transform` / `Connection: keep-alive` / `X-Accel-Buffering: no` / `Content-Type: text/event-stream; charset=utf-8`；對應 spec「Heartbeat every 15 seconds while streaming」「SSE response sets buffering-defeating headers」與 design 決策「Streaming transport: SSE per-user, not shared WS room」。
- [x] 5.2 在 apps/api/src/agent/streaming.ts 實作 `SseWriter` class（writeEvent / startHeartbeat / close）與 `buildSseHeaders()` 函式，使 5.1 GREEN；time source 透過 deps 注入便於測試。
- [x] 5.3 Refactor SseWriter：把 connection close 後拒寫的不變式放進 internal state machine，避免 caller 誤用。

## 6. Agent runtime（TDD 縱切，最大塊）

- [x] 6.1 在 apps/api/src/agent/runtime.test.ts 撰寫 RED 測試組 A — 生命週期：fake provider stream + fake tool registry，驗證 pending → running → done / cancelled / timeout / error 五狀態轉移皆對應正確終態事件；對應 spec「Agent run lifecycle states」與 design 決策「Run lifecycle states」。
- [x] 6.2 撰寫 RED 測試組 B — Tool 分派：LLM 一輪 emit `createShape` 透過 `applyMutation` 派出、結果回填；同步驟多 tool call 序列化執行；payload schema 直接 reuse tool-registry zod；對應 spec「Tool surface dispatch via M12.2 tool-registry」與 design 決策「Tool surface mapping: zod schema reuse」。
- [x] 6.3 撰寫 RED 測試組 C — 雙層 cap：fake clock 推進 60_001ms 觸發 wallTimeout；累計 20 tool calls 第 21 次拒派觸發 toolCallCap；對應 spec「Wall-clock timeout 60 seconds」「Tool-call count cap 20 per run」與 design 決策「Timeout: 雙層 cap，不 enforce token budget」。
- [x] 6.4 撰寫 RED 測試組 D — Cancel 不 rollback：in-flight applyMutation 跑完且 mutation 仍廣播；cancel 後不再派下一輪；不發 reverse mutation；對應 spec「Cancel does not roll back in-flight mutation」與 design 決策「Cancel semantics: 不主動 rollback」。
- [x] 6.5 撰寫 RED 測試組 E — Permission gate：viewer 角色直接拒；對應 spec「Permission gate requires editor or owner role」與 design 決策「Permission scope: 寫 tool 要 editor / 讀 tool 要 viewer」。
- [x] 6.6 撰寫 RED 測試組 F — BYOK 與 retry：fake BYOK Vault 拿 key 進 provider call；503 重試 2 次後成功；4xx 不重試；2 次重試失敗轉 providerServer error；對應 spec「Provider request via BYOK Vault」「Provider 5xx retry with bounded backoff」。
- [x] 6.7 撰寫 RED 測試組 G — Error 事件不洩漏：provider 4xx body 含 prompt 內容也只 emit `errorKey` + 可選非敏感 detail；BYOK key 不出現在 log/event；對應 spec「Error events emit i18n errorKey only」與 design 決策「Error contract: i18n errorKey, server 不 pre-translate」。
- [x] 6.8 在 apps/api/src/agent/runtime.ts 實作 `runAgent(deps, request)` 主迴圈：使用 Vercel AI SDK `streamText` + `tools` map（從 tool-registry 投影）+ AbortController + clock + tool-call counter + retry policy + BYOK Vault decrypt + permission guard + error 攔截；逐步使 6.1–6.7 全 GREEN。
- [x] 6.9 Refactor runtime：把 BYOK key 即用即丟（呼叫後 nullify）、log 攔截器掛在 Pino child logger 上 redact `Authorization` / `x-api-key`；確認 6.7 仍 GREEN。

## 7. SSE endpoint + cancel endpoint（TDD 整合）

- [x] 7.1 在 apps/api/src/agent/sse-endpoint.test.ts 撰寫 RED 測試：`POST /agent/canvas/:canvasId/run` 接受 `provider/model/messages/runId?`；body 驗證失敗 → 400 + invalidRequest；非 UUIDv4 → 400 + invalidRequest；client 沒帶 runId 自動產生 UUIDv4；server-side `crypto.randomUUID()`；對應 spec「Run endpoint accepts POST with model selection」「Run id format」。
- [x] 7.2 撰寫 RED 測試：`POST /agent/run/:runId/cancel` idempotent（unknown id 回 204）、本人才能取消（其他 user 403）、cancel 後 SSE channel emit cancelled error；對應 spec「Cancel endpoint accepts POST by runId」。
- [x] 7.3 撰寫 RED 測試：AGENT_RUN_RULE 第 6 個 run / 60s 觸發 429 + Retry-After + rateLimited errorKey；cancel endpoint 不被限流；對應 spec「Run endpoint enforces AGENT_RUN_RULE rate limit」與 design 決策「Rate limit: AGENT_RUN_RULE = 5 / 60s per user」。
- [x] 7.4 撰寫 RED 測試：terminal 後 100ms 內 stream close；同 runId 重用回 409 + runIdReused；對應 spec「Connection close on terminal state」。
- [x] 7.5 在 apps/api/src/agent/sse-endpoint.ts 實作兩個 handler（run + cancel）並接到 Permission Guard、RateLimiter、CancellationRegistry、Runtime；使 7.1–7.4 GREEN。
- [x] 7.6 Refactor endpoint：把 handler 邏輯拆成 `parseRequest` / `dispatch` 兩階段函式，便於將來 M15 MCP wrapper 直接 reuse `dispatch`。

## 8. Wiring & i18n

- [x] 8.1 在 apps/api/src/lib/rate-limit-rules.ts 新增 `AGENT_RUN_RULE = { maxRequests: 5, windowMs: 60_000, keyBy: "userId" }`；run 對應的 rate-limit 串接覆蓋 design 決策「Rate limit: AGENT_RUN_RULE = 5 / 60s per user」。
- [x] 8.2 在 apps/api/src/index.ts 透過 `apps/api/src/agent/wiring.ts` 掛載 run + cancel endpoint，注入 BYOK Vault、Permission Guard deps、Tool Registry、CancellationRegistry、RateLimiter、Pino child logger。
- [x] 8.3 [P] 在 packages/shared/locales/zh-TW.json 新增 agent error key 群組（byokMissing / providerAuth / providerRateLimit / providerServer / wallTimeout / toolCallCap / permissionDenied / cancelled / internal / invalidRequest / runIdReused / rateLimited）。
- [x] 8.4 [P] 在 packages/shared/locales/en.json 同步新增上述 agent error key 翻譯。

## 9. Headless E2E 驗證

- [x] 9.1 撰寫 e2e/agent-headless.test.ts 或 apps/api/src/agent/integration.test.ts：以真 BYOK dev key 對 `/agent/canvas/:id/run` 送固定 prompt（例如「create a markdown shape with text 'hello'」），驗證 SSE 事件序列含至少一個 tool_call + tool_result + done。
- [x] 9.2 在同支 e2e 驗證 sync room snapshot：mutation 透過 tool-registry 廣播後，從 sync room 讀回的 snapshot 含新 markdown shape；證明 progressive mutation broadcast OK 且不需要前端介入。

## 10. Quality gates

- [x] 10.1 [P] 執行 `bun run typecheck` 全綠；確認 agent 目錄無 any、所有 deps interface 顯式宣告。
- [x] 10.2 [P] 執行 `bunx oxlint apps/api/src/agent packages/shared/src/agent-events.ts` 與 `bunx oxfmt --check` 全綠。
- [x] 10.3 執行 `bun test --coverage`；agent 目錄目標 70% lines / branches；補測 gap 至達標。
- [x] 10.4 review tasks.md：勾選確認所有 task 對應 design.md 的 11 個 ### 決策標題（Streaming transport / Canvas digest / Cancel semantics / Timeout / Cancellation registry / Run lifecycle states / Tool surface mapping / Permission scope / Rate limit / AI SDK 選擇 / Error contract）皆有 task 引用，且 23 個 spec requirement name 皆出現在 task 描述中。

## 11. BYOK OpenAI validator 修正（M13 e2e 測試暴露的 M11 bug）

- [x] 11.1 在 apps/api/src/byok/providers/openai.test.ts 將既有「happy path POSTs to /v1/chat/completions with Bearer auth and gpt-5-nano body」測試改為斷言 body 含 `max_completion_tokens: 1` 且 NOT 含 `max_tokens`；新增一條「validation body uses max_completion_tokens, not max_tokens」測試（明確對應 spec「Validation body uses max_completion_tokens」），先期待 RED。
- [x] 11.2 在 apps/api/src/byok/providers/openai.ts 將 validation 請求 body 中的 `max_tokens: 1` 改為 `max_completion_tokens: 1`，使「OpenAI key validation via vendor ping」spec 行為對齊新 contract；確認 11.1 測試 GREEN；同步更新檔頭 doc-comment 提到的 "max_tokens=1"。
- [x] 11.3 ~~Live-verify OpenAI~~ — 11.2 修法（max_completion_tokens=1）live-test 失敗：OpenAI 回 HTTP 400 「Could not finish the message because max_tokens or model output limit was reached」。原因：gpt-5-nano 是 reasoning model，emit response token 前要先燒 thinking token，cap=1 連 thinking 都不夠。修法升級成 §12「改 endpoint 為 GET /v1/models」，task 由 12.5 取代。
- [x] 11.4 ~~Live-verify Anthropic~~ — 取消，由 12.6 取代（規格沒變，只是換到新 §12 一起跑）。
- [x] 11.5 ~~Live-verify Google~~ — 取消，由 12.7 取代（規格沒變，只是換到新 §12 一起跑）。
- [x] 11.6 ~~Quality gates~~ — 取消，由 12.8 取代。

## 12. BYOK OpenAI validator 升級成 GET /v1/models（取代 §11）

§11 修「max_tokens → max_completion_tokens」的方向錯了——gpt-5-nano reasoning thinking-token 預算讓任何小 cap 都會 400。改採 GET `/v1/models`：零 token、無 payload、跟 Google 同模式、未來 reasoning model thinking 量增加也不會再炸。

- [x] 12.1 在 apps/api/src/byok/providers/openai.test.ts 用 happy-path 測試斷言請求是 `GET ${BASE}/v1/models`，header 含 `Authorization: Bearer <plaintext>` 且不含 `x-api-key`，**沒有 body**（覆蓋 spec 「Validation request is GET with no body」scenario）；既有 `max_completion_tokens` 那條測試刪掉並加 `max_tokens` / `max_completion_tokens` / `model` / `messages` 全部 NOT in body 的反向斷言；先期待 RED。
- [x] 12.2 在 apps/api/src/byok/providers/openai.ts 將 validator 改為 GET `${baseUrl}/v1/models`，移除 `body` / `content-type` header，更新檔頭 doc-comment 反映新 endpoint 形狀；確認 12.1 GREEN，使「OpenAI key validation via vendor ping」spec 行為對齊新 contract。
- [x] 12.3 對齊 status → errorKey 對映測試：401/402/429 不變，移除/改寫任何依賴 chat-completions body 的 case；新增「200 OK」happy path 測試。
- [x] 12.4 確認 anthropic.ts 與 google.ts 規格未變、現有測試仍 GREEN（無預期改動）。
- [x] 12.5 Live-verify OpenAI：用真實 OpenAI key 透過 web UI 重新存一次，預期 200 + 「✓ 已儲存」、不再出現「無法連到供應商」。
- [x] 12.6 [P] Live-verify Anthropic：用真實 Anthropic key 透過 web UI 存一次，預期 ok（sanity check，規格沒動）。
- [x] 12.7 [P] Live-verify Google：用真實 Google API key 透過 web UI 存一次，預期 ok（sanity check，規格沒動）。
- [x] 12.8 執行 `bun test apps/api/src/byok` 全綠；執行 `bun run typecheck` 全綠；確認 lint 無新增 error。

## 13. M13 e2e 暴露：tool surface 缺 LLM-friendly description

§12 修完 BYOK 後 e2e 還是失敗：M13 plumbing 全部跑通（auth → BYOK → AI SDK → tool dispatch → mutator），但 LLM 給的 createShape args 缺 `props`，markdown shape 在 tldraw schema validation 被擋。原因：tool-registry 沒 description 欄位、props 又是 optional——OpenAI strict mode 把 optional 欄位整個跳過。修法是在 M12.2 tool-registry 加 description 欄位 + 把 createShapePayloadSchema 的 `props` 改成 required，這樣 LLM 一定會送、descriptions 告訴它各 shape type 該送什麼鍵。

- [x] 13.1 在 apps/api/src/sync/tool-registry.test.ts 撰寫 RED 測試：每個 ToolEntry 必須有非空 `description: string` 欄位；createShape 描述含「markdown / code / callout / link-card」四個 shape type 各自的 required props 鍵名；對應「Tool surface dispatch via M12.2 tool-registry」spec。
- [x] 13.2 在 apps/api/src/sync/tool-registry.ts 為每個 ToolEntry 補 description（11 個 tool），其中 createShape 詳列 4 個 custom shape 的 props 鍵名與型別；ToolEntry interface 加 `description: string` 必填欄位；對應 spec「Tool registry enumerates the full agent tool surface」MODIFIED delta。
- [x] 13.3 在 packages/shared/src/mutation-types.ts 將 createShapePayloadSchema 的 `props: z.record(z.string(), z.unknown()).optional()` 改成 required；同步更新對應測試；對應 spec「Server tldraw Mutator exposes applyMutation for server-initiated room edits」MODIFIED delta。
- [x] 13.4 在 apps/api/src/agent/runtime.ts 的 buildToolDefs 把 entry.description 傳進 ProviderToolDef.description（取代當前 hard-coded `undefined`）。
- [x] 13.5 Live-verify：用簡單 prompt（例如「create a markdown shape that says hello」）跑 smoke script，預期 LLM 自行帶 `props.content` + `w` + `h`，最終 SSE 序列含 `tool_result {ok: true}` + `done`，回到 web canvas 看到 markdown shape 自己冒出來。
- [x] 13.6 執行 `bun test apps/api` 全綠；`bun run typecheck` 全綠；lint 無 error。

## 14. Live-verify 三家 provider 跑通完整 SSE 序列 + 補測 cancel / rate limit / multi-tab / DB 持久化

OpenAI live-verify 過了之後，Gemini 觸發第二輪 tool-result message format bug（`function_response.name: Name cannot be empty`，OpenAI 寬鬆放過、Gemini 嚴格擋下）。要把 toolName 沿 conversation 帶下去，並補測 cancel / rate limit / 多 tab 可見性 / DB 持久化幾個 unit test 過、live 沒驗的點。

- [x] 14.1 在 apps/api/src/agent/runtime.ts 的 AgentMessage interface 加 `toolName?: string`；synthetic tool message 帶 `toolName: call.name`。
- [x] 14.2 在 apps/api/src/agent/wiring.ts toModelMessages 的 tool case 把 `toolName: ""` 換成 `m.toolName ?? ""`，附 doc-comment 解釋為何 Gemini 嚴格而 OpenAI 寬鬆。
- [x] 14.3 Live-verify Gemini：跑 createShape (callout / code) 兩種 shape，確認 SSE `tool_call → tool_result {ok: true} → text → done` 完整序列。
- [x] 14.4 Live-verify Anthropic：用 `claude-haiku-4-5` 跑 createShape（task block 直到 user 存 Anthropic key）。預期跟 OpenAI / Gemini 同樣 GREEN。
- [x] 14.5 Live-verify cancel：跑一輪會 emit 多個 tool_call 的 prompt，半途 POST `/agent/run/:runId/cancel`，預期：`tool_result` 已 dispatched 那筆完成、後續不再 dispatch、SSE 收到 `errorKey: agent.error.cancelled` 且 stream close、canvas 上已建立的 shape 不被 rollback（M12.1 batch undo 由 user 自己決定）。
- [x] 14.6 Live-verify rate limit：1 分鐘內連送 6 個 run，第 6 個預期 HTTP 429 + `Retry-After` header + `errorKey: agent.error.rateLimited`。
- [x] 14.7 Live-verify multi-tab visibility：兩個瀏覽器 tab 開同一張 canvas，agent 編輯時非觸發 user 的 tab 應該即時看到 shape 出現（透過既有 sync room 廣播）；確認 mutation 走 sync room 不走 SSE。
- [x] 14.8 Live-verify DB 持久化：agent 建立 shape 後等 60s+（idle release window），重啟 api、重開 canvas tab，shape 應該還在（snapshot 真的寫進 DB jsonb 而不是只在 sync room 記憶體）。

## 15. M13 archive 前的 risk register（document-only，不一定修）

下列為 M13 e2e 過程中發現的脆弱點與不確定性，整理成風險登記。修法可能跨 M13/M14/M15、也可能進 deploy checklist。

- [x] 15.1 在 docs/adr/ 新增 ADR 紀錄 M13 e2e 找到的五個關鍵 bug 與修法（OpenAI validator endpoint、proxy /agent/* 路由、AI SDK tool schema 形狀、tool description for LLM、tool-result toolName 三家差異），保留歷史脈絡。
- [x] 15.2 在 docs/adr/ 評估 wiring.ts buildModel 的 `model.startsWith()` provider detection（脆、未來 model id 命名變動就掛）—— 決定要重構成 explicit provider map 還是維持現狀。
- [x] 15.3 評估 reasoning model（o1 / o3 / gpt-5 系列）的 thinking-token budget 是否要在 agent runtime 設參數，記錄結論在 ADR。
- [x] 15.4 評估 BYOK 三家 validator 是否該加 contract test（不是 unit test 用 fake fetch，而是 dev-only `bun run smoke:byok` 直打三家驗 endpoint shape 沒漂移）。
- [x] 15.5 在 project_deploy_checklist 記憶補 M2 canvas/folder test DB 隔離技術債（`bun test apps/api` 從 root 跑時 DATABASE_URL 沒載入、5 個 404 case fail）；fix 不在 M13 scope 但 deploy 前要解。
- [x] 15.6 評估 §13 將 createShape `props` 改 required 的 M12.1 spec 影響——dev-mutate endpoint 如果有 caller 期待 props 可省略會 break，需要對 M12.1 spec 補 MODIFIED delta（不在當前 change 內、留給 archive 後新 change 處理）。
- [x] 15.7 在 PHASE2_MILESTONES.md 把 M14 範圍補：tool description quality (per-shape-type) / read-tool live exercise / code+link-card live test / token-cost monitoring / better-than-startsWith provider routing / cancel UI / multi-tab presence。所有現在發現的 follow-up 都明列。
- [x] 15.8 評估 `bun --hot` 對 wiring.ts 的可靠性。本 session 出現「改了沒生效」兩次、proxy 也壞掉一次。決定要不要在 dev.ts 加 watcher restart（vs. 全交給 --hot）。

## 16. dev.ts shutdown race fix (14.8 暴露)

14.8 持久化測試暴露：`scripts/dev.ts` 的 `shutdown()` 對 children 送 SIGTERM 後立即 `process.exit(0)`，沒等 children 完成 graceful flush（api 的 `flushThenShutdown` 是 async）。debounce 視窗內的 mutation 在重啟時會丟失（即先前 cancel test 6 個 shape 沒進 DB 的 root cause）。修 dev.ts 等 children 真正 exit（最多 5s timeout）。

- [x] 16.1 在 scripts/dev.ts 把 `shutdown(code)` 改成 async；對每個 child 送 SIGTERM 後等 `proc.exited` 或 5s timeout 才 `process.exit`；確保 api 的 `flushThenShutdown` 有時間 flush dirty snapshot 進 DB。
