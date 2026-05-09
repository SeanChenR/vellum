## Context

M11（add-byok-anthropic / add-byok-multi-provider-and-pricing）+ M12（add-server-tldraw-mutator / add-full-tool-surface / add-permission-guard）已先後落地：

- BYOK Vault（apps/api/src/byok/vault.ts）能存取 OpenAI / Anthropic / Google 三家加密 API key。
- Provider Adapter（apps/api/src/byok/providers/）能驗 key 並回 i18n errorKey。
- Server tldraw Mutator（apps/api/src/sync/mutator.ts）能套 mutation 進 TLSocketRoom 並廣播。
- Tool Registry（apps/api/src/sync/tool-registry.ts）已 zod schema-based，6 write + 5 read tools 都有 deps、payload schema、result type。
- Permission Guard（apps/api/src/lib/permission-guard.ts）已收斂成 `requireRole(deps, allowedRoles, ctx)`。

M13 把這四塊縫起來：LLM agent 透過 BYOK key 呼 provider、用 tool-registry 操 canvas、把過程 stream 給 user。M13 純 server-side，無 UI（M14 才接 Side Panel）。

## Goals / Non-Goals

**Goals:**

- Agent 一輪 run 從 HTTP request 進入到 SSE `done` 事件離開的完整 lifecycle，含取消與雙層 cap。
- Canvas digest 為固定 schema 輕量 header，agent 透過 M12.2 既有 read tools 自取詳細。
- SSE 通道與 tldraw sync WS room 完全分離（一條 per-canvas 多人共用、一條 per-user 私密）。
- Vercel AI SDK 的 `tools` 直接從 M12.2 tool-registry 的 zod schema reuse，不重複定義。
- 失敗路徑全走 i18n errorKey（BYOK 缺 key / provider 4xx / wall-clock 超時 / tool-call cap 用罄 / 沒 canvas 權限 / 內部錯誤）。
- 70% test coverage；headless test 用 Bun 對 endpoint 送 prompt → 收 SSE → 對 sync room snapshot 驗證 shape progressive 出現。

**Non-Goals:**

- UI 不在 M13。任何 React component / Side Panel 元件留給 M14。
- 對話歷史 DB 永久化不在 M13。每個 run stateless；call payload 自帶歷史 messages。
- Token-budget hard enforcement 不做（BYOK 自付，server 用 tool-call 次數做 hard cap）。
- In-flight mutation rollback 不做（取消時保留已套上的 mutation；user 用 M12.1 batch undo Cmd+Z 退一輪）。
- MCP server endpoint 不在 M13（獨立成 M15，v0.6.0）。
- Plan-then-execute 確認步驟、multi-agent 編排、RAG、跨 canvas 記憶、AI 對話分享、token 用量顯示、主動建議、圖片生成、語音輸入、production deploy（PRD #2 Out of Scope 全列）。

## Decisions

### Streaming transport: SSE per-user, not shared WS room

選 Server-Sent Events 而非 WebSocket。

- **AI thread 是 user-private**（PRD #2 明列「AI 對話不分享給 collaborator」）。tldraw sync WS room 是 per-canvas 多人共用，混進 AI text 會 leak。
- AI text 本來就是單向 server→client（client 不會中途插話進來改 prompt——cancel 是另開 HTTP endpoint 處理）。
- Bun.serve 原生支援 SSE：`return new Response(stream, { headers: { "content-type": "text/event-stream" } })`。
- HTTP 友善：用 `curl -N` 即可手動 trace；e2e test 用 fetch + ReadableStream reader 不用 Bun 自家 WS client。
- Permission Guard 從 HTTP session 拿 user→canvas role 比 WS handshake 自然（既有 `requireRole` deps 直接複用）。
- 反方案考慮：另開 per-user WS channel — 比 SSE 多 stateful connection 與序列化 overhead，無功能價值。

### Canvas digest: 輕量 header + 既有 read tools 自取

不送 full snapshot，header 含：

```
{
  canvasId: string
  title: string
  viewport: { x, y, w, h }      // 該 user 目前 viewport
  selection: ShapeRef[]          // ids + types only, 不展開內容
  shapeCounts: Record<ShapeType, number>
  bounds: { x, y, w, h }         // 整張 canvas 內容包圍盒
}
```

詳細靠 agent 自己呼 `listShapesInViewport` / `listShapesInSelection` / `getShape` 等 M12.2 既有 read tool。

- **Token 預算**：full snapshot 一張中型 canvas 容易吃掉整個 context window，BYOK 自付帳單會炸。
- **Reuse**：M12.2 read tools 已實作完整、有 test 覆蓋，不重新發明。
- **Agent 自主性**：讓 LLM 自己決定要看多細，符合 progressive disclosure。
- 反方案考慮：viewport-only snapshot — 對「請列出所有 markdown shape」這類問題就不夠，agent 還是得呼 `listShapesInViewport`，不如不重複塞。

### Cancel semantics: 不主動 rollback

cancel 動作 = 中止 LLM stream + 不再 dispatch 下一輪 tool call；in-flight tool call 跑完且 result 不丟掉（會被 mutator 廣播給 sync room 像正常 mutation）。

- **多人協作體驗**：server 主動 rollback 會讓所有 collaborator 看到「shape 出現後又消失」幽靈動作。
- **既有心智模型**：M12.1 已是 batch undo（一個 mutator call 一個 batch），使用者按 Cmd+Z 退一輪自然。
- **使用者意圖**：按 cancel 的常見動機是「夠了，讓我自己改」而不是「全部抹掉」。
- 反方案考慮：per-tool-call rollback — 與 mutator batch 語意衝突，且需要新 reverse-mutation 概念，複雜度高。

### Timeout: 雙層 cap，不 enforce token budget

```
WALL_CLOCK_TIMEOUT_MS    = 60_000   // 60s per agent run
MAX_TOOL_CALLS_PER_RUN   = 20
```

兩條任一超過即終止 run、發 SSE `error` 事件（errorKey: `agent.error.wallTimeout` / `agent.error.toolCallCap`）。

- **Wall clock**：防止 provider hang / network stall 把 connection 堵死。
- **Tool-call count**：防止 LLM 進入 infinite loop（呼 `getShape` 然後再呼 `getShape`...）。
- **不 enforce token budget**：BYOK 模型自付，且 token 總量取決於 message + digest + tool result 累積，難在 server 端準確計算；交給 provider 端 `max_tokens`。
- 反方案考慮：configurable per-run timeout from client — M13 不需要，常數即可，M14 真有需要再加。

### Cancellation registry: in-memory per-process

```
Map<runId, AbortController>
```

run lifecycle 結束（`done` / `error` / `cancelled` / `timeout`）即從 map 移除。

- **單一 binary 架構**：Bun.serve 一個 process，無跨 instance 同步需求。
- **取消是 best-effort 即時動作**：persist 到 DB 反而引入額外延遲。
- **不持久化是設計選擇**：server 重啟即所有 in-flight run 結束（client SSE 收到 connection close），這是可接受的 phase 2 行為。
- 反方案考慮：Redis pub/sub — 引入新 service，違反 single-binary 原則；M13 不需要。

### Run lifecycle states

```
        ┌─────────┐
        │ pending │  HTTP request 進來、permission 檢查中
        └────┬────┘
             │ permissionOk + rateLimitOk
             ▼
        ┌─────────┐
        │ running │  LLM streaming 中、tool calls dispatching
        └────┬────┘
             ├──── done       (LLM 自然結束 + 沒新 tool call)
             ├──── error      (provider 4xx / 內部錯誤)
             ├──── cancelled  (使用者按 cancel)
             └──── timeout    (wall 60s 或 20 tool calls)
```

每個終態都會發 SSE 對應事件並關閉 stream。

### Tool surface mapping: zod schema reuse

Vercel AI SDK 的 `tools` 結構需要每個 tool：`{ description, parameters (zod), execute }`。直接從 M12.2 `tool-registry` map：

```
toolRegistry → Vercel AI SDK tools
  description    ← tool entry 的 description (M13 補上 LLM-friendly 英文描述)
  parameters     ← entry.payloadSchema (既有 zod)
  execute        ← entry.kind === "write" ? applyMutation 包一層 : reader 函式
```

- **Single source of truth**：tool-registry 既存 zod 直接 reuse，spec 變更時不會雙寫漂移。
- **M13 順手做的 M15 投資**：tool description 寫成 MCP-friendly 英文，M15（Vellum MCP Server）直接複用。

### Permission scope: 寫 tool 要 editor / 讀 tool 要 viewer

agent run 開始即用 `requireRole(deps, ["owner", "editor"], { canvasId, session })`——agent 預設能做寫操作，所以 viewer 不允許開 run。

讀 tool 內部不再二次檢查 role（既然 run 已過 editor 門檻，viewer 不會走到這裡）。M14 若要支援「viewer 也能跑 read-only agent」再放寬。

### Rate limit: AGENT_RUN_RULE = 5 / 60s per user

```
AGENT_RUN_RULE: { maxRequests: 5, windowMs: 60_000, key: (req) => req.session.userId }
```

加在 `apps/api/src/lib/rate-limit-rules.ts` 與既有 BYOK / DEV_MUTATE 規則並列。429 帶 `Retry-After`（既有 RateLimiter 行為）。

cancel endpoint 不加 rate limit（取消屬於使用者主動止損動作，不該被擋）。

### AI SDK 選擇: Vercel AI SDK，三家 provider adapter 套件齊裝

```
ai (>= 5.0.x)
@ai-sdk/anthropic
@ai-sdk/openai
@ai-sdk/google
```

- **PRD #2 已指定 Vercel AI SDK**。
- 三家 adapter 全裝，由 `provider` 欄位 dispatch；BYOK Vault 提供 key。
- 反方案：LangChain — 過於 heavyweight；raw fetch + 自寫 tool loop — 重新發明輪子，且 streaming 解析 SSE 各家格式不一致。

### Error contract: i18n errorKey, server 不 pre-translate

SSE `error` 事件 payload：

```
{
  type: "error",
  errorKey: "agent.error.byokMissing"   // 可被 i18next lookup
  | "agent.error.providerAuth"
  | "agent.error.providerRateLimit"
  | "agent.error.providerServer"
  | "agent.error.wallTimeout"
  | "agent.error.toolCallCap"
  | "agent.error.permissionDenied"
  | "agent.error.cancelled"
  | "agent.error.internal",
  detail?: string  // optional 不含敏感資料的補充
}
```

`error` 事件不含 stack trace、不含 BYOK key、不含 raw provider 訊息（避免 leak）。Pino 結構化 log 才寫 server-side detail。

## Risks / Trade-offs

- BYOK key 進 agent loop 的暴露面 → mitigation: provider call 統一走既有 BYOK Vault decrypt → 立即 zeroise 用完即丟、log 攔截器 scrub `Authorization` 與 `x-api-key` header、agent error 事件不含原文。
- in-memory cancel registry 不跨重啟 → mitigation: 單一 binary 架構接受此限制；server 重啟時所有 SSE 連線會自然 disconnect，client 看到 connection close 視為終止；M14 UI 顯示「server 重啟，請重跑」。
- provider 5xx storm 燒光 BYOK quota → mitigation: agent 內 retry 上限為 2 次（exponential backoff 250ms / 1s），第 3 次直接 emit `agent.error.providerServer` 終止 run。
- LLM tool-call infinite ping-pong → mitigation: 20 tool-call hard cap（超過即 emit `agent.error.toolCallCap`）。
- SSE 經反向代理 buffer 不送出 → mitigation: response header 加 `X-Accel-Buffering: no` + `Cache-Control: no-cache`；每 15s 送 SSE comment heartbeat（`:hb\n\n`）保活。
- 同 user 多 run 並發吃光 BYOK quota → mitigation: AGENT_RUN_RULE 5/60s 限制；M14 UI 預期還會加「single-active run per user-canvas」的 client-side guard。
- Vercel AI SDK breaking change between minor → mitigation: 鎖 minor version；upgrade 走獨立 change（不在 M13 內升）。
- digest header 對某些 prompt 不夠（agent 一直呼 read tools 才湊出脈絡） → mitigation: 接受此 trade-off；M14 收使用者實際 prompt 後若發現某類問題該預送，再回頭微調 digest schema（spec 容許後續 minor 增補）。

## Migration Plan

Greenfield 模組，不動 DB schema、不動 sync room 既有契約、不動 BYOK 既有 API。

部署順序：

1. 安裝依賴（`bun add ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google`）。
2. 寫 zod event schema（packages/shared/src/agent-events.ts）+ test。
3. 寫 cancel registry（apps/api/src/agent/cancel.ts）+ test（純 in-memory，最容易先綠）。
4. 寫 canvas digest builder（apps/api/src/agent/digest.ts）+ test（純讀、無 side effect）。
5. 寫 streaming SSE writer（apps/api/src/agent/streaming.ts）+ test（fake stream 驗證 event 格式）。
6. 寫 agent runtime（apps/api/src/agent/runtime.ts）+ test（fake provider 驗證 tool loop / cancel / timeout / cap）。
7. 寫 SSE endpoint + cancel endpoint（apps/api/src/agent/sse-endpoint.ts）+ test（integration：HTTP → runtime → tool-registry → mutator stub）。
8. 補 i18n keys（zh-TW + en 同步）。
9. 在 apps/api/src/index.ts 掛 endpoint + AGENT_RUN_RULE。
10. Headless e2e：Bun script 對真 endpoint 送 prompt（用 dev BYOK key），驗證 SSE 事件序列 + 對應 sync room snapshot。

Rollback 策略：M13 是純新增模組 + 兩個新 endpoint，rollback = 移除 endpoint 註冊 + 抹掉 agent/ 目錄即可。BYOK / Tool Registry / Mutator 不動。

## Open Questions

下列是 spec 撰寫期可能要再決定的細節：

1. **Heartbeat interval**：15s 是否合適，或要更頻繁（5s）以便 client 及早偵測斷線？傾向 15s（避免不必要流量）。
2. **Run id 格式**：UUID v4 vs ULID。傾向 UUID v4（Bun 原生 `crypto.randomUUID()`，無新依賴）。
3. **Agent 是否能看到所有 collaborator 留下的 shape**：傾向 yes（mutator 已有 full canvas access，不另外 filter；M14 若需 per-user 隱藏層再加）。
4. **Tool result 的回傳順序**：當 LLM 一輪 emit 多個 parallel tool call 時，是否強制序列化執行？傾向 yes（tool-registry 已 stateful 動 sync room，並行可能 race；M13 序列化執行最安全）。
