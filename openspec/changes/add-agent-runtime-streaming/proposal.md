## Why

Phase 2 PRD #2 的核心：使用者用自然語言請 server-side agent 編輯 canvas（ghost-ai 模式）。M11（BYOK Foundation）+ M12（Server Mutator + Tool Surface + Permission Guard）已分別把「能用 BYOK 呼叫 LLM」與「能從 server 端套 mutation 進 sync room 並廣播」兩段下層 plumbing 做完；目前缺的是把 LLM 的 tool-call 結果黏到 tool-registry、把 agent 的思考過程 stream 給使用者、並對 agent 跑一輪設下取消與時間/呼叫次數上限。M13 就是補這一段 agent runtime + streaming，跑通後即可在 headless test 看到「prompt → streaming text + shape progressive 出現」。

## What Changes

- 新增 **Agent Runtime**（apps/api/src/agent/runtime.ts）：用 Vercel AI SDK 跑 tool loop，把 M12.2 `tool-registry` 包成 LLM 可呼叫的 tool；每輪呼叫透過 BYOK Vault 拿 key、對選定 provider/model 發 request；支援 cancel（停止 LLM stream + 不再 dispatch 下一輪 tool call，in-flight tool call 跑完不主動 rollback）；雙層 cap：60 秒 wall-clock + 20 tool calls per run。
- 新增 **Canvas Digest Builder**（apps/api/src/agent/digest.ts）：每次 agent run 開頭組一份輕量 system context — viewport bounds、selection（shape ids + types）、shape count by type、canvas overall bounds — 不送 full snapshot；agent 想看詳細時透過既有 read tools (`getShape` / `listShapesInViewport` / `listShapesInSelection` / `getCanvasBounds` / `getViewport`) 自取，由 LLM 自己決定要看多細。
- 新增 **Streaming SSE Channel**（per-user，apps/api/src/agent/sse-endpoint.ts）：HTTP POST `/agent/canvas/:id/run`（建立 run + 啟動 SSE）、HTTP POST `/agent/run/:runId/cancel`（取消）；事件型別：`text` / `tool_call` / `tool_result` / `error` / `done`；不混進 tldraw sync WS room（AI thread 是 user-private，PRD #2 明確 "AI 對話不分享給 collaborator"）。
- 新增 **Cancellation Registry**（apps/api/src/agent/cancel.ts）：per-run AbortController in-memory map；run lifecycle 結束（done / error / cancel / timeout）即釋放。
- 新增 **Agent event 型別**（packages/shared/src/agent-events.ts）：discriminated union zod schema，client 與 server 共用。
- 新增 **Rate limit rule**（apps/api/src/lib/rate-limit-rules.ts 加 `AGENT_RUN_RULE`）：per-user token bucket，預設 5 runs / 60s，避免使用者誤觸發狂跑。
- 新增 i18n error keys（agent 相關錯誤訊息：BYOK 缺 key / provider 4xx / wall-clock timeout / tool-call cap / canvas 沒權限 / 內部錯誤）；zh-TW + en 同步落地。
- 走 TDD：每個檔案先寫 .test.ts、目標 70% coverage；headless test：CLI 對 `/agent/canvas/:id/run` 送 prompt → 觀察 SSE stream 與 sync room 上 shape progressive 出現。

## Non-Goals (optional)

- **不做 UI**（Side Panel / Chat / Cursor AI Badge 都在 M14）。M13 純 headless 驗證。
- **不做 AI Thread 永久儲存**（per-user 對話歷史 DB schema 在 M14）。M13 每次 run 是獨立 stateless。
- **不做 plan-then-execute 確認步驟**（PRD #2 Out of Scope 明列）。Tool call 直接執行。
- **不主動 rollback in-flight mutation**（取消時保留已套上的 mutation；使用者用 M12.1 batch undo Cmd+Z 退一輪）。理由：rollback 會讓多人協作看到「shape 出現後又消失」幽靈動作，且打破既有 undo 心智模型。
- **不 hard-enforce token budget**（BYOK 自付，server 用 tool-call count cap 防失控 loop；token budget 交給 provider 端 `max_tokens`）。
- **不暴露成 MCP server**（M15 獨立做，v0.6.0；in-process agent 走 MCP 純加序列化開銷無功能價值；tool-registry 已 zod schema-based，未來開 MCP wrapper trivial）。
- **不做 multi-agent 編排 / RAG / 跨 canvas 記憶 / 主動建議 / 圖片生成 / 語音輸入**（PRD #2 Out of Scope 明列）。
- **不用 WebSocket 跑 streaming**（評估後選 SSE：AI text 是單向 server→client、Bun.serve 原生支援、HTTP 友善 curl 可測；Permission Guard 從 HTTP session 拿 user→canvas role 比 WS handshake 自然）。

## Capabilities

### New Capabilities

- `agent-runtime`: server-side LLM tool loop。封裝 Vercel AI SDK + BYOK provider call + tool-registry dispatch + cancel/timeout 語意；對外暴露「啟動 run / 取消 run / 接收 SSE stream」三個能力。
- `canvas-digest`: agent system-prompt 用的 canvas 脈絡建構器。輸出固定 schema 的輕量 header（viewport / selection / shape counts / overall bounds），讓 agent 透過既有 read tools 取詳細。
- `streaming-channel`: per-user SSE endpoint 與 agent event 型別契約。定義 run/cancel HTTP 介面、SSE 事件 discriminated union、connection lifecycle。

### Modified Capabilities

- `byok-keys`: OpenAI validator 端點從 `POST /v1/chat/completions` 改成 GET `/v1/models`（token-free、payload-free、跟 Google 同模式）。原因：M11 選定的驗證模型 `gpt-5-nano` 屬於 reasoning-style 系列，要求 `max_completion_tokens` 並先燒 thinking-token，cap=1 連 thinking 都不夠就 400；改 endpoint 後不再依賴 model 規格。M13 e2e 驗證時暴露。
- `server-mutation-bridge`: 兩處 spec-level 行為變更：(1) `createShapePayloadSchema` 的 `props` 從 optional 改成 required（callers 真的沒 props 時必須明示 `props: {}`）。原因：OpenAI strict tool calling 把 optional 欄位整個跳過，markdown / code / callout / link-card 四個 vellum custom shape 都需要 type-specific props，optional 變成 LLM footgun。(2) `tool-registry` 的 ToolEntry 加 `description: string` 必填欄位，agent runtime 將 description 傳進 LLM provider tool surface，LLM 才知道每個 tool（特別是 createShape）每個 type 該帶什麼 props 鍵名。

## Impact

- Affected specs: 新增 `agent-runtime`、`canvas-digest`、`streaming-channel` 三份 capability spec。
- Affected code:
  - New:
    - apps/api/src/agent/runtime.ts
    - apps/api/src/agent/runtime.test.ts
    - apps/api/src/agent/digest.ts
    - apps/api/src/agent/digest.test.ts
    - apps/api/src/agent/streaming.ts
    - apps/api/src/agent/streaming.test.ts
    - apps/api/src/agent/cancel.ts
    - apps/api/src/agent/cancel.test.ts
    - apps/api/src/agent/sse-endpoint.ts
    - apps/api/src/agent/sse-endpoint.test.ts
    - apps/api/src/agent/wiring.ts
    - apps/api/src/agent/integration.test.ts
    - packages/shared/src/agent-events.ts
    - packages/shared/src/agent-events.test.ts
  - Modified:
    - apps/api/src/index.ts (掛 agent endpoint + 套 rate-limit rule)
    - apps/api/src/lib/rate-limit-rules.ts (新增 AGENT_RUN_RULE)
    - packages/shared/locales/zh-TW.json (agent error keys)
    - packages/shared/locales/en.json (agent error keys)
    - apps/api/package.json (引入 ai SDK + provider adapters：@ai-sdk/anthropic / @ai-sdk/openai / @ai-sdk/google)
    - bun.lock
    - apps/api/src/byok/providers/openai.ts (將驗證請求的 `max_tokens` 改為 `max_completion_tokens`，對齊 gpt-5-nano reasoning-model 規格)
    - apps/api/src/byok/providers/openai.test.ts (對齊新欄位 + 加 contract 斷言)
  - Removed: (none)
- Affected dependencies: 新增 `ai` (Vercel AI SDK) + `@ai-sdk/anthropic` + `@ai-sdk/openai` + `@ai-sdk/google`；BYOK 已經處理 provider 認證資料流。
- Affected runtime: 單一 Bun.serve process 內新增 SSE 路由與 in-memory cancellation registry；不引入新 service / queue / worker。
