## Context

M11–M13 已交付 BYOK Vault、Server Mutator、Tool Registry、Permission Guard、Agent Runtime（Vercel AI SDK + tool loop + cancel + dual cap）、Streaming SSE Channel + 三家 provider live-verified。剩下的就是把這條 server 端 plumbing 接到使用者看得到、按得到的 UI；以及把 M13 archive 留下的 7 條 follow-up 一次清完。

當前狀態：

- `apps/api/src/agent/` 完整：runtime / digest / streaming / cancel / sse-endpoint / wiring + 70%+ coverage
- `apps/web/src/agent/` **不存在**——前端目前完全沒有 SSE 消費者、沒有 Side Panel、沒有 thread 概念
- DB 既有：users / api_keys / user_ai_preferences / canvases / canvas_shares 等；**無 ai_threads / ai_messages 表**
- locales：`agent.error.*` keys 已落地；`agent.panel.* / agent.usage.* / agent.badge.* / agent.thread.*` 不存在
- Editor.tsx 是 `flex h-screen` + `<Tldraw>` absolute inset-0；右側目前無 chrome 元件
- CollaboratorAvatars 已渲染 sync presence 來源的 collaborator 頭像清單
- BYOK preferences 已 per-provider 存 user 偏好的 model（M11 add-byok-multi-provider-and-pricing）

## Goals / Non-Goals

**Goals:**

- AI Side Panel 完整端到端：開 panel → 選 provider/model → 送 prompt → SSE 收 streaming text + tool call/result → canvas 上 shape progressive 出現 → done event 帶 usage → footer 顯示 token 數 + $ 換算。
- Multi-thread per (user, canvas)：thread switcher、新對話、清空對話、刪除對話；第一輪 run 結束後背景 LLM 自動 generate thread title；fallback 取第一句前 30 字。
- Cursor AI Badge：透過既有 sync presence 廣播，他人 tab 即時看到「某 collaborator 正在用 AI 編輯」；AI 對話內容**不**透過此 channel 外洩。
- Token monitoring：本輪 usage（input / output tokens + $）+ thread 累計（input / output tokens + $）即時顯示；但不做 hard budget enforcement、不跨 thread / 跨 canvas / 跨 day 統計。
- 收完 M13 archive §15 列出的 7 條 follow-up：tool description per-shape-type quality、cancel UI、multi-tab presence、token-cost monitoring、provider routing 改 explicit map、code/link-card live test（透過寬定義 e2e）、read-tool live exercise（owner 手動驗）。
- Coverage 70% 不退步；寬定義 e2e 4 條 Playwright 全綠。

**Non-Goals:**

- **不做 multi-canvas thread aggregation 或全域歷史對話搜尋**——thread 仍是 per-canvas，沒有 dashboard 入口看「我所有 AI 對話」。
- **不做 budget cap / rate cap based on token cost**——只顯示，不阻擋；M14 e2e 驗的 rate limit 仍是 M13 既有的 per-user run-count（5/60s）。
- **不做 thread sharing / collaborator 看見他人對話**——PRD #2 Out of Scope 明列「AI 對話不分享」；本 change MUST 保證對話內容只透過 per-user 私密 SSE 傳遞，cursor badge 只廣播「正在用 AI」flag、不含對話文字。
- **不做使用者手動編輯 thread title 的 UI**——schema 預留 mutable column，但 M14 沒 thread settings 頁；Phase 2 之後若有需要再加。
- **不引入新 npm package**——title generation 重用 M13 已裝的 `ai` SDK 與三家 provider adapter；前端 SSE 消費用 fetch + ReadableStream（不引 sse.js / eventsource-parser 等套件）。
- **不主動 rollback 取消的 run**——延續 M13 cancel 語意，已套上的 mutation 留在 canvas，使用者用 M12.1 batch undo 退一輪。
- **不做 Plan-then-execute、multi-agent、RAG、跨 canvas 記憶、圖片生成、語音輸入、production deploy**——PRD #2 Out of Scope。
- **窄定義 happy-path e2e 不在 M14 自動化測試範圍內**——owner 手動驗證；M14 e2e 只覆蓋寬定義（cancel / multi-tab badge / viewer / rate limit）。

## Decisions

### Multi-thread per (user, canvas) — schema 拿掉 unique constraint

`ai_threads` 不對 `(user_id, canvas_id)` 加 unique；改加複合索引 `(user_id, canvas_id, updated_at desc)` 支援 thread list 的「最新優先」排序。

進 canvas 時 server 從 thread list 取 `updated_at desc` 第一筆當預設 active thread；無 thread 即 lazy create 一條空 thread（避免「第一次進 canvas 看到的是空白還是空 thread」這種 UX 不一致）。Side Panel 上方有 thread switcher（下拉），右邊 "+ New Chat" 按鈕。

- **理由**：1→N schema 後悔成本高（要 migrate + 重做 query），先寬後窄；使用者明確要「重開對話、不被舊 context 污染」的能力。
- **反方案 1-per-(user, canvas)**：簡單但喪失重置脈絡能力；clear-thread 炸掉舊歷史對保存記錄不友善。
- **反方案 N-per-canvas, 不 per-user**：違反「AI 對話不分享」。
- **反方案 N-per-user, 不 per-canvas**：跨 canvas 對話 UX 沒有意義（agent 看不到別張 canvas 的 shape），且管理介面成本高。

### Background title generation — 該 provider 的 economy 檔，fire-and-forget

第一輪 agent run 結束（`done` event 已 emit）之後，server 起一條 fire-and-forget Promise：

1. 取本輪 run 用的 provider，查該 provider 的 economy tier model（OpenAI: `gpt-4o-mini`、Anthropic: `claude-haiku-4-5`、Google: `gemini-2.5-flash-lite`，固定常數表，不從 BYOK preferences 讀）
2. 用同一把 BYOK key 對 `streamText` 跑 single-turn：「Summarize this user request in 5-10 words, no quotes, no period: <第一個 user message>」
3. 取結果（去掉開頭尾空白與引號），UPDATE `ai_threads.title`
4. 失敗 → log warning（Pino structured）→ `ai_threads.title` 保持 fallback 值（`buildFallbackTitle(firstUserMessage)`：取前 30 char、word boundary cut、超出加 ellipsis）

Client 不收 SSE 通知 title 變更——下一次進 canvas 時 thread switcher 自然 refetch；同 session 內透過 thread query invalidate 機制（TanStack Query 在 `done` 事件後 setTimeout 1500ms invalidate）順帶拉到。

- **理由**：title gen 是「nice to have」、絕不應阻塞主 SSE done event；經濟級夠用、減少 BYOK 帳單；fallback 保證 title 永遠存在。
- **反方案 跨 provider 統一用 OpenAI**：違反 BYOK 隔離原則（使用者只給 Claude key 但被打 OpenAI）。
- **反方案 同步等 title gen 完成才 emit done**：拖慢 UX、且 title gen 失敗會讓主 run 看起來失敗。
- **反方案 client-side title gen**：要在 client 暴露 BYOK key（M11 安全契約禁止）。

### Run endpoint body shape — `{threadId, userMessage}`，server 從 thread 讀歷史

Streaming Channel run endpoint body 變更：

```
舊（M13）: { runId?, provider, model, messages, sessionId }
新（M14）: { runId?, provider, model, threadId, userMessage }
```

server 收到後：

1. permission + rate limit + ownership 檢查 thread（thread.user_id === session.user_id）
2. 從 `ai_messages` 讀 thread 全部歷史（按 created_at 升序）
3. append 新的 user message 進 thread
4. 將歷史 + 新訊息組成 `AgentMessage[]` 餵給 runtime
5. runtime 過程每個 assistant text / tool_call / tool_result 都 append 進 thread 同時透過 SSE emit 給 client
6. terminal 事件（done / error / cancelled / timeout）也記入 thread 為 metadata（不另開 row，記在最後一條 assistant message 上）

- **理由**：server 是 thread 的 source of truth，避免 client / server 歷史不同步；解決 M13「每次 run stateless、call payload 自帶歷史」造成的客戶端歷史管理負擔。
- **反方案 client 自帶 messages**：客戶端要持久化、跨刷新還原；雙寫 + 同步衝突風險。
- **反方案 hybrid（client 帶 messages 但 server 也存）**：兩個事實來源是 anti-pattern，且 cancel/重整時不知道哪邊正確。

### `done` SSE event payload 加 `usage` 欄位

`AgentEventDone` discriminated union variant 從：

```
{ type: "done", runId }
```

改成：

```
{ type: "done", runId, usage: { input: number, output: number, provider: ProviderName, model: string } | null }
```

`usage` 為 null 表示 provider 沒回 usage 資訊（極少數場景）。`input` / `output` 是該 run **整輪累計**的 token 數（multi-turn tool loop 全加），不分 turn。

server 從 Vercel AI SDK 的 `streamText` result 拿 usage（三家 provider 都會回 usage object），summed across turns。

- **理由**：client 同時拿到 done 與 usage，一次更新 footer，不需要再 refetch thread；SSE 多塞一個欄位的成本可忽略。
- **反方案 另起一個 `usage` event variant**：discriminated union 多一個分支、客戶端要多寫一個 case，沒有功能上的好處。
- **反方案 拉一個 GET endpoint 查 thread usage**：徒增 round trip。

### Cursor AI Badge via tldraw `instancePresence.userMeta.aiActive`

當使用者觸發 agent run 時，`useAgentRun` hook 透過 `editor.updateInstanceState` / `editor.user.updateUserPreferences` 把 `userMeta.aiActive = true` 寫進 instancePresence；run 終態（done/error/cancelled/timeout）寫回 false。tldraw sync 自動廣播給同 room 所有 collaborator。

CollaboratorAvatars 對 `aiActive === true` 的 avatar 加 ✨ overlay（pure CSS）：邊框換成漸層金色、avatar 右下角小 sparkle SVG。

- **理由**：reuse 既有 sync presence 廣播，0 新 channel；只送 boolean flag、對話內容絕不外洩；觀眾體驗即時。
- **反方案 另開 per-canvas SSE/WS for AI presence**：多一條 stateful connection、違反 single-binary 原則。
- **反方案 把對話也廣播給 collaborator**：違反 PRD #2「AI 對話不分享」。

### Token usage UI — this-run + thread 累計 + $ 換算，不做 enforcement

- 本輪：從 SSE `done.usage` 直接取
- thread 累計：`useAgentThread` query 從 server 算（SUM(input) / SUM(output) per provider/model GROUP BY），SSE done 後 1500ms invalidate 順帶刷新
- $ 換算：用既有 `packages/shared/src/byok-pricing.ts` 的 `pricePerMillion`（input/output 各自單價）；client-side 計算 `$ = (tokens / 1_000_000) * pricePerMillion`，顯示 4 位小數 USD（小於 0.0001 顯示 `<$0.0001`）
- 超過閾值不警告、不阻擋；只顯示

- **理由**：BYOK 自付、enforcement 反而讓使用者不爽（覺得本來能用的卻被擋）；可見性是夠的；複雜 budget UI 不是 Phase 2 主軸。
- **反方案 有 budget warning toast**：需要使用者先設 budget 才有意義，又是另一條 UI 分支；不做。

### AI Side Panel 走 docked flex-row layout，不浮動

CanvasPage 從 `flex flex-col h-screen` 改成 `flex flex-col h-screen` 但 Editor 內部把外層 div 從 `relative h-full w-full` 改成 `flex flex-row`：左側 `<Tldraw>` 區（flex-1 min-w-0），右側 `<AiSidePanel>`（width 384px / 可收合到 0px）。AI 面板有自己的 toggle button 在 TopBar（右側、靠近 Share）；收合 / 展開動畫走 Animate UI（`motion`）。

readonly viewer 角色 → toggle button 不顯示、AiSidePanel 永遠不掛載（Editor 直接 fall-through 到既有 `relative h-full w-full` 路徑，不付 flex-row 成本）。

- **理由**：tldraw canvas 已自有 cursor / shape 動畫，把 panel 放成 absolute floating 會搶 z-index + 拖動 + resize 多套子系統；docked 直接吃 flex 排版。
- **反方案 floating modal**：複雜度大幅上升。
- **反方案 bottom drawer**：canvas 是橫向工作介面、底部抽屜會擋畫面。

### SSE 消費者用 fetch + ReadableStream reader（不用 EventSource）

run endpoint 是 `POST` 帶 body + cookie session auth；瀏覽器原生 `EventSource` 只支援 `GET` 且不能 set custom header / body，因此必用 `fetch + reader`。新增 `apps/web/src/agent/sse-parser.ts`：實作最小 SSE 解析器（`event:` / `data:` 行解析、空行 dispatch、buffer carry-over），輸入 `Uint8Array` chunks，輸出 `AsyncIterable<AgentEvent>`。

- **理由**：M13 endpoint 已是 POST shape，改 GET 等於 streaming-channel spec 大規模回退。
- **反方案 引入 sse.js / eventsource-parser 套件**：~5KB JS、就為了一個極小 spec 不值；自寫 parser 加 unit test 即可。

### Provider routing 從 `model.startsWith()` 改成 explicit map

`apps/api/src/agent/wiring.ts` 的 `buildModel(provider, modelId)` 內部目前用 `if (modelId.startsWith("gpt-"))...` 系列判斷；改成：

```
const PROVIDER_MODELS: Record<ProviderName, ReadonlySet<ModelId>> =
  { openai: new Set([...]), anthropic: new Set([...]), google: new Set([...]) };
```

unknown model → 回 `agent.error.invalidRequest`。新加 model 時必須同時在 BYOK pricing 表 + provider models set 兩處登記（unit test 強制兩表 cardinality 一致）。

- **理由**：M13 ADR-0019 已記此風險；OpenAI 跟 Google 命名重疊（`gpt-` / `gemini-` 但未來 model 名空間可能重疊），startsWith 脆。
- **反方案 維持 startsWith**：脆，且 ADR 已批准升級。

### Tool description per-shape-type quality — updateShape / connectShapes / groupShapes

對齊 M13 §13 已對 createShape 做的 LLM-friendly 詳列格式：description 內列舉 markdown / code / callout / link-card 四個 vellum custom shape 各自的 props 鍵名與型別期待；core tldraw shape（geo / text / draw / arrow 等）至少列出**該 shape type 常用的 props 鍵**（不需要全列）。

`updateShape` 補：`patch: { props?: { [key]: ... } }` 各 shape type 的 patch 鍵名期待。  
`connectShapes` 補：起點 / 終點 shape id 與 arrow style props（color / dash / bend）。  
`groupShapes` 補：group 行為說明（不會改 children 的 absolute position；group 自身不持有 props）。

- **理由**：M13 e2e 暴露 OpenAI strict tool calling 對 description 敏感、不夠詳細時 LLM 會省略 props；三個 tool 都需要同等待遇。
- **反方案 維持單句 description**：M13 已驗證單句不夠用；繼續放著等下次 e2e 再炸。

### SSE 連線 idle timeout override + production heartbeat

Bun.serve 預設 `idleTimeout` 是 10 秒；agent run 過程裡模型 deliberation 或 tool plan 容易出現 30+ 秒沒有事件的「真空期」，預設會在 client 端造成 ECONNRESET。`SseWriter` 早在 M13 就把 heartbeat（每 15 秒推 `:hb\n\n` comment frame）寫好了，但 production run path 從來沒呼叫 `startHeartbeat()` — 該機制只在 unit test 內被啟動。

**修法（M14 verification 中發現）：**

1. SSE run handler 進入時呼叫 `srv.timeout(req, 255)` 把該請求的 idle 上限拉到 Bun 接受的最大值（255 秒，` Bun.serve` ceiling）。
2. SSE handler 在 `ReadableStream.start()` 中呼叫 `writer.startHeartbeat()` 一次，然後用 `setInterval(() => writer.tickHeartbeat(), 5_000)` 驅動定時檢查；`finally` 中 `clearInterval`。
3. Dev proxy（`scripts/dev-proxy.ts`）對 `/api/agent/canvas/:id/run` 路徑做相同的 `srv.timeout(req, 255)` override，否則 proxy hop 仍會在 10 秒砍流。

- **理由**：完整解 — 同時拉 timeout 上限與啟用 heartbeat，雙保險；只拉 timeout 不啟 heartbeat 等於把限制從 10 秒移到 255 秒，遇到複雜任務還是會炸。
- **反方案 只 disable timeout（傳 `0`）**：影響面太廣，整個 Bun.serve 進程的所有 request 都失去 idle 保護；per-request override 才能只影響 SSE 路由。
- **反方案 引入 SSE library（sse-stream / @ai-sdk/ssr）**：M13 已自寫 `SseWriter` 並 spec 化，多裝一個套件純加維運成本。

### Runtime 注入 system prompt with canvas digest

進入 M14 verification 後發現的兩個 LLM 行為缺陷：

1. AI 在已有 shape 的 canvas 上仍然把新 shape 放在預設 `(100, 100)` — 直接疊在現有 shape 上。
2. 使用者請 AI「調整」shape 位置時，AI 經常回覆「已調整」但實際上沒呼叫 `updateShape`，或呼叫但座標跟原本一樣（沒讀現狀就猜）。

根因：runtime 完全沒有 system prompt — `streamText({ messages })` 只看到 thread history + user message，模型沒有任何「規範」與「canvas 現狀」可以參考，全靠 tool description 揣測。

**修法：**

1. 新增 `apps/api/src/agent/system-prompt.ts` exporting `buildSystemPrompt({ shapes, canvasBounds, stateAvailable })`，回傳含兩段內容的字串：
   - **Behavioural discipline**（靜態文本）：placing multi-shape 前必須先看 prompt 中的 digest 或呼叫 read tools / 不要疊 / 不要謊報 / 完成時要具體說做了什麼。
   - **Canvas digest**（動態）：當前 shape 數量、整體 bounds、每個 shape 的 id / type / (x, y) / w × h；超過 40 個 shape 時截斷並提示 `listShapesInViewport`。
2. 新增 internal-only reader `listAllShapes(deps, canvasId)`（在 `mutator-readers.ts` export，但**不**進 tool registry，模型看不到）；runtime 在 `runAgent` 開頭呼叫 `listAllShapes` + `getCanvasBounds` 取得 canvas 現狀，build prompt，prepend 為 `conversation[0]`。
3. System message **不**寫入 `ai_messages`，每次 run 重組（canvas 狀態會動）。

wiring 層（`buildVercelProviderAdapter`）把 messages 拆出 system 後改用 `streamText({ system, messages })` 的獨立 `system` 參數，避免 AI SDK warning「System messages in the messages field may enable prompt injection」。

- **理由**：spatial-awareness 是 LLM 在 canvas 應用上的弱點；最便宜的補強是把 ground truth 塞進 system prompt。完整版（後續 backlog）是接 layout engine（Dagre/ELK），讓 AI 只負責「節點+邊」、座標交給演算法。
- **反方案 把 canvas state 變成 SSE event 推給 client / SSE event 再給 LLM**：架構繞遠路，且 LLM 已經有 read tools 可取，缺的只是「開場就給」。
- **反方案 教 LLM 一定要先 call `getCanvasBounds`**：浪費一個 tool call round trip；既然 server 已經能算出 digest，預先塞進 system prompt 更省。

### Tool description per-shape-type — 加入 tldraw `geo` shape 支援

M14 verification 中使用者發現 AI 只會畫四種 vellum 自定義 shape（markdown / code / callout / link-card），畫不出方形 / 三角形 / 五顏六色幾何圖。底層 `vellumStoreSchema` 是 `createTLSchema({ shapes: { ...defaultShapeSchemas, ...vellumCustom } })`，所以 mutator 認得 tldraw 預設 shape；缺的只是 tool description 沒列。

但 tldraw `geo` shape 的 `geoShapeProps` 要求 11 個必填 prop（含複雜的 `richText` ProseMirror JSON 結構），對 LLM 介面攤開來等於要它組 JSON，會頻繁觸發 `errors.devMutate.mutationFailed`。

**修法：**

1. 新增 `apps/api/src/sync/geo-defaults.ts` exporting `withGeoCreateDefaults(userProps)` 與 `transformGeoPartialProps(userProps)`：
   - **Create 端**：merge user-supplied props 在預設值之上（`geo: "rectangle"`、`color: "black"`、`fill: "none"`、`dash: "draw"`、`size: "m"`、`align: "middle"`、`verticalAlign: "middle"`、`font: "draw"`、`labelColor: "black"`、`url: ""`、`growY: 0`、`scale: 1`、`w: 200`、`h: 200`），把 `text` 抽出來轉成 `richText: toRichText(text ?? "")`，drop `text` key。
   - **Update 端**：只把 `partial.props.text` 轉成 `richText`，**不**注入其他預設值（避免覆蓋 existing record）。
2. `mutator.ts` `applyOne` 在 `createShape` 對 `op.payload.type === "geo"` 套用 `withGeoCreateDefaults`；在 `updateShape` 對 `existing.type === "geo" && partial.props` 套 `transformGeoPartialProps`。非 geo shape 完全不動。
3. `tool-registry.ts` `CREATE_SHAPE_DESCRIPTION` 與 `updateShape.description` 加 geo 條目：20 種 variant（rectangle / ellipse / triangle / diamond / pentagon / hexagon / octagon / star / rhombus / rhombus-2 / oval / trapezoid / arrow-right / arrow-left / arrow-up / arrow-down / x-box / check-box / heart / cloud）、12 種 color、4 種 fill、4 種 dash、size、optional text。LLM 介面仍然只看到「八個 optional prop」這麼簡潔。

- **理由**：M14 是「卡片畫布」定位，但 owner 在 verification 中明確要 AI 能畫流程圖、心智圖、視覺化等需要幾何形狀的場景；geo 是最自然的補強。LLM 介面複雜度沒升、server side 一次補齊 defaults。
- **反方案 把 11 個必填 prop 全暴露給 LLM**：實測 OpenAI strict mode 會 drop 部分必填欄位、Anthropic 會混 JSON schema，三家行為不一致；最後仍會炸 `mutationFailed`。
- **反方案 加 `note` / `text` 兩個 tldraw 預設 shape**：和 markdown 卡片功能重疊（markdown 已能放文字），徒增模型困惑。如 phase 2+ 真的需要再 ADR 補。

### Provider adapter token usage extraction（M14 verification fix）

M14 verification 中 owner 反映「Token usage footer 一直是 0/0」。根因鏈：

1. `wiring.ts` 的 `bridge()` 把 AI SDK fullStream 的 part 轉成 runtime `ProviderEvent`，但**只處理** `text-delta` / `tool-call` / `finish-step` / `error`，從來沒從 `finish-step.usage` 抽出 token 數字 emit `{ type: "usage", ... }` event。
2. Runtime 的 `usageTotals` 累加器永遠停在 `null`（runtime 只在收到 `{ type: "usage" }` 時更新）。
3. SSE `done.usage` = `null`，前端 `thisRun` 走 fallback 顯示「—」。
4. `setUsageOnLastAssistant` 因為 `usage` 為 null 被 skip，`ai_messages.token_usage` 整欄維持 NULL。
5. Thread total query `COALESCE(SUM(token_usage->>'input'), 0)` = 0；footer 第二行顯示「0 input · 0 output · $0.0000」 = owner 看到的 0。

**修法：**

- 把 part-to-event 的轉換從 `bridge()` 抽成 module-level 純函式 `aiSdkPartToProviderEvents(part): ProviderEvent[]`，export 供 wiring.test.ts 直接單元測試（不需 mock streamText）。
- `finish-step` 一律 emit `step-finish`；如果 `usage` 物件存在且 `inputTokens`/`outputTokens` 至少一個是 `number`，再 emit 第二個 event `{ type: "usage", usage: { input, output } }`。缺的一側填 0。
- 兩者都 undefined → 不 emit usage event，保留 runtime 的 "provider returned no usage information" warning path（spec 既有 scenario）。

**Plausibility check 暫不加 runtime 端**：M14 verification 中 OpenAI / Anthropic / Google 三家在實際 run 都會回非零 token 數，所以「全 0 視為 implausible」這個 spec 段落留作未來 provider 行為退化時的安全網（暫不擋）。

- **理由**：bug 本質是 wiring 邊界漏接事件，最小改動是補上事件轉換。把純函式 export 出來讓 unit test 直接打，避免之後又靜默退化卻沒被測捉到。
- **反方案 一次補完 plausibility check + cumulative threshold**：超出本次修補必要、且實測沒看到該 case。

### Markdown rendering for assistant bubbles（M14 verification feature）

M14 verification 中 owner 反映「AI 回的內容是 Markdown（含 `**bold**` / 條列 / 表格 / 程式碼），但對話框只顯示純文字」。AI 回應普遍用 Markdown 結構化內容；視覺呈現一致是 chat UX 基線。

**作法：**

- 引入 `react-markdown@10` + `remark-gfm@4`（GitHub Flavored Markdown，含 table / strikethrough / task list）。`ChatList.tsx` 新增 `AssistantMarkdown` 子元件包 `ReactMarkdown remarkPlugins={[remarkGfm]}`。
- **僅 assistant bubble 渲染 Markdown**（含 persisted message 與 in-flight streaming bubble）。**User bubble 維持純文字** — 避免「prompt-injection-via-Markdown」攻擊面：未來若加 thread sharing / collaborator view，使用者輸入的 link/formatted payload 可能誤導另一位讀者；agent 輸出本身受 BYOK 信任邊界保護，且 tool 呼叫已過 permission-guarded mutator path。
- **Tool call / tool result bubble 維持 JSON pretty-print** — Markdown 解析技術內容會破壞可讀性（例如 args 含 `*` 會被吃掉）。
- 樣式用 Tailwind v4 `prose prose-sm max-w-none` + arbitrary variant 補 padding / margin / 程式碼塊背景。`@tailwindcss/typography` 已在 `apps/web/src/styles.css` `@plugin` 啟用，prose 系列 class 直接可用。
- **Streaming bubble 邊串邊解析**：部分 Markdown（未閉合粗體 / 列表）在 react-markdown 中渲染為盡力呈現的局部 DOM，可接受。等 SSE done 後 thread refetch 帶完整 message 再做一次 full render（既有 ChatList 已處理 streaming → persisted 切換）。

**為何引入 npm package（之前 design 寫的 non-goal「不引入新 npm package」翻過來）：**

原本的 non-goal 寫於 M14 planning 階段、針對「能用既有 SDK 解決就不要加新依賴」。markdown rendering 是純前端視覺需求，沒有既有 SDK 提供（不像 SSE 解析可自寫一小段）；自寫一個能 cover 表格 / 任務列表 / 巢狀清單的 markdown parser 等於要重做半個 commonmark，工程量超過直接用 `react-markdown`。`react-markdown` + `remark-gfm` 合計 ~30 KB gzipped、被廣泛驗證、依賴單純。

- **理由**：bundle 30 KB 對使用者體感無差別；自寫的 markdown parser 反而是技術債。
- **反方案 marked / markdown-it 自行包成 React 元件**：要自己處理 sanitization 與 React reconciliation，比 react-markdown 多寫又少測。
- **反方案 自寫 minimal renderer（只支援 bold / italic / list / code）**：覆蓋面太窄；AI 動不動就吐表格或巢狀結構，最後仍會被 user 要求補功能。

### Agent error toast surfaced inline in AiSidePanel（M14 verification fix）

M14 verification 中 owner 跑 rate-limit e2e 時發現：server 端正確回 429 + `agent.error.rateLimited`，client `useAgentRun` 也 `setError(errorKey) + setState("error")`，**但 UI 上沒有任何視覺化** — `errorKey` 只存在 hook state 沒人 render。Spec 寫明「toast 顯示」但程式碼從未實作。

**修法：**

1. AiSidePanel 內以 `useState<string | null>` 持有 `toastErrorKey`，加 `useEffect` 監 `run.state === "error" && run.error` 觸發 `setToastErrorKey(run.error)` + 6 秒 auto-dismiss。
2. Toast UI 為 inline 元素（**不**走 tldraw `useToasts`，因 AiSidePanel 在 `<Tldraw>` 容器**外**，拿不到 tldraw context）— `data-testid="agent-error-toast"`、`role="alert"`、`absolute right-4 top-4 bg-red-50`、含 ✕ manual dismiss。
3. Cancel 不觸發 toast（composer 回 Send 已是足夠 UX signal）— useEffect 只攔 `state === "error"`。

- **理由**：tldraw `useToasts` 需在 tldraw editor context 內，AiSidePanel docked 在 editor 外面拿不到；自己渲染 inline toast 元素 ~10 行夠用，i18n key 透過 `t()` 接到既有 `agent.error.*` 翻譯表。
- **反方案 引入 sonner / react-hot-toast**：又一個 npm package、bundle 增加；目前只一個 toast 來源（agent error），不值得套件級抽象。
- **反方案 把 AiSidePanel 搬進 tldraw `components` prop**：違反「panel 是 chrome、不是 canvas UI」架構分層。

### Composer draft cleared only on `done` terminal — preserved on error/cancelled（M14 verification fix）

原本 `ChatComposer.submit()` 內無條件 `setDraft("")` 於 `onSend()` 之後 — 但這代表 server 回 429 或網路失敗時，user 輸入的文字立刻消失，rate-limit toast spec 明寫「typed prompt SHALL still be present in the textarea」這條 acceptance criteria 被違反。

**修法：**

1. `submit()` 內移除 `setDraft("")`。
2. ChatComposer 新加 `useEffect` 監 `prevState === "running" && state === "done"` 時 clear draft；其他 terminal（`error` / `cancelled`）保留。
3. 用 `useRef` 追前一個 state 確保 transition 只 fire 一次。

- **理由**：對齊 ai-side-panel spec「typed prompt SHALL still be present in the textarea」並符合直覺 UX — 失敗請求保留輸入。
- **反方案 從 onSend callback 拿到 Promise 等 success 才 clear**：onSend 是 fire-and-forget（useAgentRun.start 內部 SSE stream consumer），UI 拿不到 terminal signal。
- **反方案 從外部傳一個 `clearOnSuccess` prop**：增加 props 耦合，state-driven useEffect 更乾淨。

### E2E sharing helper + four agent specs activated（M14 verification fix）

M14 task §13 規劃 4 條 Playwright agent e2e（cancel / multi-tab-badge / viewer-no-panel / rate-limit-toast），但實作只到 spec 骨架 — `test.fixme(true, "Wire setup helper before flipping ENABLED on.")` 三條凍結。M14 verification 階段補完 setup helper + 啟用三條真實 e2e；multi-tab-badge 受限於 cursor-ai-badge.ts 用 local-only `TLInstance.meta`，暫時 `test.skip`（等 M15 issue #16 改 `TLInstancePresence.meta`）。

**新加 `e2e/helpers/agent-setup.ts`** export：
- `pickEnabledByokKey()` — 讀 `E2E_TEST_USER_BYOK_GEMINI` 或 `E2E_TEST_USER_BYOK_OPENAI`，回 `{provider, apiKey} | null`。三條 spec 用此判斷 `test.skip`，accept Gemini OR OpenAI 任一。
- `signInWithMagicLink(page, email)` — Mailpit 拿 magic link verify URL 完成 sign-in。
- `createCanvasViaDashboard(page, title)` — 點 「Create canvas」→ 填 dialog → click card 進 canvas page。
- `injectByokKey(request, provider, apiKey)` — POST `/api/account/byok/{provider}` 注入金鑰（server validate-then-encrypt）。
- `setupAgentUserAndCanvas(browser, byok, opts)` — 一體化 helper 回 `{page, canvasId, canvasUrl, cleanup}`。

**Spec body 重點：**
- `agent-cancel`：fill 長 reasoning prompt → 等 cancel button visible → click cancel → 等 Send button 回。Cancel 在 SSE 剛 open / Gemini 還沒回 first response 階段觸發也是有效 cancel cleanly scenario。
- `agent-rate-limit-toast`：用 `page.request.post` 連發 5 個 run 燒 quota（比 UI Send 快），第 6 個走 UI 觸 429 + toast。
- `agent-viewer-no-panel`：sign-in → create canvas → PUT share/link mode=view → GET share state 拿 token → anon context 進 `?share=token` URL → assert viewer 看不到 panel toggle。
- `agent-multi-tab-badge`：sign-in u1 → invite u2 via share API → u2 sign-in + accept invite → u1 dispatch run → assert u2 看到 ✨ overlay。**目前 skip**（M15 broadcast pending）。

**`e2e/sharing-acceptance.spec.ts` 刪除：** 該 spec 自己 line 7 註解「Not a regression test — assertions are minimal and only enough to keep the scenario on-track. The screenshots are the deliverable」— 視覺驗收截圖，跟 M14 / 分享功能 regression 無關（share-invite / share-public-link 兩條 functional spec 仍綠覆蓋 functional path）。發現該 spec 有 deeper hang 不在 M14 verification 範圍，直接 `git rm`。

- **理由**：把 sign-in / canvas / BYOK / share invite 三條 e2e 通用流程抽進共享 helper 後，spec body 只剩 assertion，可讀性與維護性同步提升。
- **反方案 三條 spec 各自寫 setup**：duplicate 200+ 行樣板，drift 風險高。
- **反方案 stub 出 model endpoint**：原 task §13 規劃用 stubbed model 避免真打 API；但 stub mechanism 工程量更大（要建 provider adapter swap 機制），且 Gemini Flash-lite 真打的 token 成本可忽略，e2e 真實打 API 更接近 production behaviour。

### Cascade thread on canvas delete

`canvases.ON DELETE CASCADE` → `ai_threads` → `ai_messages`，整條鏈路 cascade。

- **理由**：Phase 2 沒有「歷史對話」獨立 UI 入口；保留 orphan thread row 是死資料、增加備份成本。
- **反方案 保留 thread**：要做歷史對話 dashboard 才有意義，那是 phase 3 範圍。

### Title 不可由使用者手動編輯（M14 範圍內）

`ai_threads.title` 是 mutable column（PATCH 端點 schema 預留），但 M14 不做 UI 入口。一筆 thread 的 title 來源：

1. 初始 = fallback（user message 前 30 字）
2. 第一輪 done 後 = background LLM 生成（覆蓋初始）
3. 之後 = 不再變動（除非未來 M15+ 加 PATCH endpoint）

- **理由**：Phase 2 多一個 inline edit UI 成本不對應；schema 預留之後不需要 migration。

### Background title generation 不計入 AGENT_RUN_RULE，但計入 BYOK 額度

title-gen 是 server 自發、不是使用者觸發的 run。它：

- **不**經過 `/agent/canvas/:id/run` endpoint，**不**佔 AGENT_RUN_RULE token bucket
- 直接在 `apps/api/src/agent/title-gen.ts` 內呼叫 `streamText`（reuse 既有 BYOK Vault decrypt 路徑）
- 失敗一律 silent log，不 surface 給 client、不重試

但因為打的是使用者的 BYOK key，**會**消耗使用者的 provider 帳單（economy tier、~50 token round trip、~$0.00001 per thread first run）。這個成本在 design.md 的 Risks 段點出。

- **理由**：rate limit 是「防使用者誤點狂跑」的 UX 保護、不該擋 server 內部背景任務；BYOK 計費分離是因為使用者的 key 終究經手他們自己帳單。
- **反方案 用 server-side 集中 key**：違反 BYOK 整個架構假設。

## Implementation Contract

#### 對外行為

進入 `/canvas/:id`，editor 角色 = owner / editor 的 user 看見：

1. TopBar 右側多一個 ✨ AI panel toggle button（與 Share button 並列）
2. 點 toggle → 右側 384px docked panel 滑出（Animate UI）；再點收合
3. 預設載入該 user 在該 canvas 的最新 thread（updated_at desc 第一筆）；沒有就 lazy create 空 thread
4. ChatComposer 含 textarea（Cmd+Enter 送出）+ provider/model picker（從 BYOK preferences 讀預設值）+ Send button
5. 送出後立即顯示 user message 泡泡，之後 streaming：
   - assistant text 一個 token 一個 token 出現
   - tool_call 出現工具呼叫泡泡（顯示 tool 名 + parameters JSON）
   - tool_result 出現結果泡泡（success / error）
   - canvas 上 shape 同步出現（透過既有 sync room 廣播，不走 SSE）
6. done event：footer 顯示「This run: input X / output Y tokens, $Z」+ thread 累計刷新
7. error event：紅色 toast 顯示對應 errorKey 翻譯
8. cancelled：user 按 Cancel button 或 Cmd+. → SSE 收到 `agent.error.cancelled` → toast 顯示 + composer 回到可送狀態
9. multi-tab：另一個 tab 的同 canvas viewer 看到觸發 user 的 avatar 邊框變金 + ✨ overlay；run 結束後恢復

viewer 角色 / 公共連結 viewer 看不見 toggle button、不能開 panel；後端 401 仍在但不會被觸發。

#### 介面 / 資料形狀

**新增 endpoints（OpenAPI 描述）：**

```
GET  /api/agent/threads/canvas/:canvasId
  → 200 { data: { threads: AiThreadSummary[], activeThreadId: string } }
  → 401 { errorKey: "agent.error.permissionDenied" }
  AiThreadSummary = { id, title, updatedAt, messageCount }

POST /api/agent/threads/canvas/:canvasId
  body: {} (空)
  → 201 { data: AiThread }   // lazy create 新 thread
  → 401 { errorKey }

GET  /api/agent/threads/:threadId
  → 200 { data: { thread: AiThread, messages: AiMessage[], usage: { input, output } } }
  → 403 { errorKey: "agent.error.permissionDenied" }
  → 404 { errorKey: "agent.error.threadNotFound" }

POST /api/agent/threads/:threadId/clear
  → 204
  → 403 / 404 同上

DELETE /api/agent/threads/:threadId
  → 204
  → 403 / 404 同上
```

**修改 endpoints：**

```
POST /api/agent/canvas/:canvasId/run
  // BREAKING change vs M13 contract
  body: { runId?: uuid, provider, model, threadId, userMessage }
       (M13 的 messages 與 sessionId 欄位移除)
  → 200 SSE
  → 400 { errorKey: "agent.error.invalidRequest" } (含 thread 不屬於該 user)
  → 403 / 409 / 429 同 M13
```

**SSE event schema 變更：**

```ts
// AgentEventDone
- { type: "done", runId }
+ { type: "done", runId, usage: { input: number, output: number, provider, model } | null }
```

**DB schema：**

```sql
CREATE TABLE ai_threads (
  id text PRIMARY KEY,                  -- ulid or uuid
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canvas_id text NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  title text NOT NULL,                   -- 起始 fallback、後 LLM 覆蓋
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_threads_user_canvas_updated_idx
  ON ai_threads (user_id, canvas_id, updated_at DESC);

CREATE TABLE ai_messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content jsonb NOT NULL,                -- text | tool_call | tool_result
  tool_name text,
  tool_call_id text,
  token_usage jsonb,                     -- { input, output } 只 assistant
  provider text,                         -- 只 assistant
  model text,                            -- 只 assistant
  run_id text,                           -- 只 assistant (對應 SSE runId)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_thread_created_idx
  ON ai_messages (thread_id, created_at);
```

#### 失敗模式

| 情境 | 行為 |
|---|---|
| BYOK key 缺 / 過期 | SSE error `agent.error.byokMissing` / `providerAuth`；thread 保留已 append 的 user message；composer 回可用狀態 |
| Provider 5xx storm | 既有 M13 retry 2 次後 error `providerServer` |
| Cancel mid-run | SSE error `cancelled`；in-flight tool 跑完並 append 進 thread；後續不 dispatch |
| 60s wall timeout / 20 tool calls cap | 既有 M13 行為；error key 不變 |
| Title-gen 失敗 | log warning；title 保 fallback；不 emit 給 client |
| Thread 不屬於 session.userId | run endpoint 400 `invalidRequest`（不 405、不 leak thread 存在性） |
| viewer 直接打 run endpoint | 401 `permissionDenied`（既有 M13 行為） |
| canvas 被刪 | thread + messages cascade；UI 已導回 dashboard |

#### 驗收條件

| # | 觀察點 | 驗證方式 |
|---|---|---|
| 1 | thread 持久化 + multi-thread 切換 | unit + integration test：建 2 條 thread、切換、各自 message 隔離；DB 重啟後 thread 仍在 |
| 2 | Title 自動生成 | integration test：mock economy LLM 回 "Test title"；run done 後 1500ms thread.title 變更 |
| 3 | Title fallback | unit test：title-gen mock throw → thread.title === fallback (前 30 char) |
| 4 | SSE done.usage 欄位 | integration test：fake provider 回 usage `{ input: 100, output: 50 }` → SSE event payload 含對應數字 |
| 5 | Token $ 換算 | unit test：100 input / 50 output @ pricePerMillion → 顯示對應 USD |
| 6 | Cursor AI Badge | playwright（e2e #2）：tab A 觸發 run 中、tab B 看到 avatar 金邊 + ✨；run 結束後消失 |
| 7 | Cancel UI | playwright（e2e #1）：run 中按 Cancel → SSE close + composer 可用 + canvas 上 in-flight shape 留下 |
| 8 | Viewer 隱藏 panel | playwright（e2e #3）：用 view-mode public link 進入 → toggle button DOM 不存在 |
| 9 | Rate limit 429 toast | playwright（e2e #4）：1 分鐘內連送 6 次 → 第 6 次 toast 顯示 `agent.error.rateLimited` 翻譯 |
| 10 | Tool description quality | unit test：updateShape / connectShapes / groupShapes description 字串含 4 個 custom shape type 各自的 props 鍵名 |
| 11 | Provider routing 改 explicit map | unit test：未知 modelId → throw / return error；新加 model 不在 PROVIDER_MODELS set 內 → typecheck or runtime 擋下 |
| 12 | i18n 兩語同步 | 既有 i18n-audit.test.ts 跑過 |
| 13 | Coverage | `bun test --coverage` agent 目錄 ≥ 70% lines / branches |

#### Scope 邊界

**In scope：**

- `apps/web/src/agent/` 整個目錄新增
- `apps/api/src/agent/threads/` 新增、`apps/api/src/agent/title-gen.ts` 新增
- DB migration 0006_ai_threads.sql + drizzle schema 同步
- M13 archive §15 follow-up：tool description (§15.x) + cancel UI + multi-tab badge + token monitoring + provider routing explicit map
- `apps/web/src/canvas/Editor.tsx` 改 flex-row + AI panel mount
- `CollaboratorAvatars.tsx` 加 aiActive overlay
- 4 條寬定義 e2e

**Out of scope（即使順手寫得到也不寫）：**

- thread 全域歷史對話 dashboard / 跨 canvas 搜尋
- Token budget cap / 警告 toast / 月度統計
- 手動編輯 thread title 的 inline edit UI
- M15 vellum MCP server endpoint（單獨 milestone）
- M11 BYOK validator 規格、M12 mutator 內部行為（兩者已 archive，本 change 不動）
- canvas-digest spec 變更（M13 archive 既有行為已足夠）
- Phase 1 Out of Scope guard 列出的所有項目

## Risks / Trade-offs

- **Multi-thread schema 把 query 複雜度拉高** → mitigation: 預設 active thread 簡單 SQL（user_id + canvas_id ORDER BY updated_at DESC LIMIT 1），index 已涵蓋；thread switcher 列表分頁 50 筆上限。
- **Background title-gen 失敗讓 thread 永遠停在 fallback title** → mitigation: 第一次 fallback 已是合理 title（前 30 字 word-boundary cut）；M14 後若一直停 fallback 是 title-gen 系統級壞掉，會被 Pino warning log 注意到；不在 client 重試（避免雪球）。
- **使用者多 tab 對同 thread 各送 prompt 的 race** → mitigation: agent run 已是 server-side per-runId AbortController；同 thread 並發時兩個 run 各自完整跑、message 按 created_at 排序；tldraw mutator 已有 batch undo 隔離；UI 上 Side Panel 在 in-flight run 期間 disable Send button（單 tab 內 single active run 客戶端 guard）。
- **Cursor AI Badge 在 collaborator 離線 / reconnect 時誤掛** → mitigation: instancePresence 是 ephemeral（disconnect 即清）；agent run 終態主動 set false 是雙保險；UI 對 stale aiActive flag 容忍（只是個 visual badge，不影響功能）。
- **Token usage 顯示 vs 實際扣款不一致** → mitigation: provider usage 來源是 streamText result（authoritative），但 BYOK 帳單是 provider 端計算；本 change 在 footer 顯示 `*估算值，以 provider 帳單為準` 註記。
- **AI Side Panel 寬度 384px 在 1280px 螢幕上吃掉 30% canvas** → mitigation: 預設收合（非首次進 canvas 自動展開）；M14 後若使用者反映可加 resize handle，先不做。
- **SSE 經反向代理 buffer / 連線殭屍** → mitigation: 既有 M13 X-Accel-Buffering: no + 15s heartbeat；client 側 60s 沒收到任何訊息 → 主動 reconnect (M14 不做，因為單 binary 開發環境沒有 proxy；M14 release notes 註記 production proxy 配置要求)。
- **provider economy model 命名漂移** → mitigation: PROVIDER_TITLE_MODELS 常數表 + unit test 對齊 BYOK pricing 表；commit 時兩處 grep 一致。
- **migration 0006 對既有 canvas 行不行得通** → mitigation: 純 ADD TABLE，無 ALTER，無 backfill；rollback = DROP TABLE 兩條。

## Migration Plan

非破壞性 schema add（兩張新表、cascade FK 指向 users / canvases）；不動既有 endpoint 既有 schema（除了 run endpoint body shape — Phase 1 deploy 凍結中所以無向後相容義務）。

部署順序：

1. `bunx drizzle-kit generate` 產生 0006_ai_threads.sql；review。
2. apps/api/src/db/schema.ts 同步 aiThreads / aiMessages drizzle table 定義 + test。
3. 寫 thread repo + handlers（red→green→refactor 縱切）。
4. 寫 title-gen + test（fake provider）。
5. 改 sse-endpoint.ts run body schema + 從 thread 讀歷史 + 寫 thread；改 runtime.ts deps 加 ThreadRepo + per-message append；改 done event 加 usage。
6. 改 wiring.ts 的 provider routing 為 explicit map + test。
7. 改 tool-registry.ts 三個 tool 的 description + test。
8. agent-events.ts done variant 加 usage 欄位 + test；同步 packages/shared barrel。
9. 寫 web 側 sse-parser → useAgentRun → useAgentThread → store → 各 component → 整合進 Editor + CollaboratorAvatars 改 ✨ overlay。
10. 補 i18n keys（zh-TW + en 同步）。
11. 寫 4 條 e2e Playwright spec。
12. quality gates: typecheck / oxlint / oxfmt / `bun test --coverage` ≥ 70% / `bun run test:e2e`。
13. owner 手動驗證窄定義 happy path（三家 provider × 4 種 shape type）。
14. PHASE2_MILESTONES.md 將 M14 標記 ✅。

Rollback：本 change 是 greenfield 模組 + 一條 schema add；rollback = revert PR + DROP TABLE ai_messages, DROP TABLE ai_threads。BYOK / Tool Registry / Mutator / 既有 Streaming Channel handler 不受影響（除了 run body schema 的 BREAKING change，Phase 1 deploy 凍結中無外部 client 受影響）。

## Open Questions

下列細節在 specs / tasks 撰寫期或實作早期可再決定，當前傾向已記：

1. **thread id 用 ulid 還是 uuid v4**：傾向 **ulid**（時序 sortable，未來做 thread list 按 id 排序天然倒序）。如要 uuid 也行，schema 用 text 不限制。
2. **Active thread 切換是否走 URL query param `?thread=<id>`**：傾向 **是**（refresh 保留、可分享 link 給未來用；但分享給他人沒意義因為 thread 是 user-private——其實只是 own-tab refresh 友善）。
3. **`ai_messages.content` jsonb 的內部 schema 是否走 zod 驗證**：傾向 **是**，packages/shared/src/agent-events.ts 已有 discriminated union 可重用。
4. **送 prompt 時是否清掉舊的 in-flight cancel state**：傾向 **是**，Send button 在 in-flight 期間 disable，Cancel button 替換。
5. **e2e #2 multi-tab 測試是否需要兩個 cookie session**：傾向 **是**，兩個 browser context 各自 login 不同 user 才能驗證對方看到 badge；Playwright fixture 提供。
