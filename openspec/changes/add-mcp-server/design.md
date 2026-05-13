## Context

M11-M14 已交付 BYOK Vault、Server tldraw Mutator、Tool Registry（11 個 read+write tools）、Permission Guard、Agent Runtime（Vercel AI SDK tool loop + cancel + dual cap）、Streaming SSE per-user channel、AI Side Panel UI + multi-thread persistence。所有「user 在 vellum 網頁打開 panel 用 AI 編輯 canvas」的路徑都在 production code，由本人 daily use。

M15 把同一份 tool surface 延伸到 vellum 網頁之外：使用者在 Claude Desktop / Cursor / Zed 等慣用 AI client 對話，AI 透過 Model Context Protocol 連到 vellum 呼叫 tools 編輯 canvas。具體 user journey 範例：

- 在 Cursor 寫程式時：「幫我把這段架構畫到 vellum 的 canvas xyz」→ Cursor 對話帶 vellum tools → AI 呼叫 createShape 系列 → vellum 網頁打開時 shape 已在
- 在 Claude Desktop 整理對話時：「把剛剛這段討論存成 markdown cards 到 vellum」→ 同上

當前狀態：

- `apps/api/src/sync/tool-registry.ts` 11 個 tool 已完整、wired into agent runtime via `applyMutation` + `mutator-readers`
- `apps/api/src/lib/permission-guard.ts` 已有 `requireRole(deps, session, canvasId, allowedRoles)`，agent / sharing / sse 三條 endpoint 都重用
- `apps/api/src/lib/rate-limiter.ts` token bucket（LRU + capacity 10k），既有 `AGENT_RUN_RULE` `SHARE_INVITE_RULE` `MAGIC_LINK_IP_RULE` etc.
- `apps/api/src/byok/` 已是 user-token-style 存取模式（per-provider 一張 key、validate-then-encrypt-then-upsert），PAT schema/handler 可借鏡形狀
- `apps/web/src/agent/cursor-ai-badge.ts` 用 `editor.updateInstanceState({meta})` 寫 `TLInstance.meta.aiActive`（M14 verification 緊急 patch）— TLInstance record 不會透過 tldraw sync 廣播

涉及人員：本人 single developer side project；沒外部 stakeholder；沒對外公開 deployment（local-only stage，凍結中）。

## Goals / Non-Goals

**Goals:**

- 外部 MCP client（Claude Desktop / Cursor / Zed / 任何支援 MCP 標準的 AI 工具）可透過 `POST /api/mcp` 連到 vellum，呼叫既有 11 個 tool + 新加 `listCanvases` 共 12 個。
- PAT 系統完整：user 在 Settings 建 / 列 / 撤銷 token；token 明碼一次性顯示；DB 存 SHA-256 hash + optional `expires_at` + soft delete；既有 permission-guard / rate-limiter 完全 reuse。
- 既有 in-process agent runtime（M14 AiSidePanel）路徑 **完全不動** — 同一份 tool-registry 兩個入口（in-process + MCP），share 同一份 mutator / permission / read-tool logic。
- Cursor AI Badge 修成跨 tab / 跨 collaborator 廣播（`TLInstance.meta` → `TLInstancePresence.meta`）；既有 `agent-multi-tab-badge.spec.ts` e2e 翻 skip 後直接綠。
- Coverage 70% 不退步；新加 mcp / pat / list-canvases 三個目錄達 70%。

**Non-Goals:**

- **不做 OAuth 2.0 / authorization server / device flow / refresh token**：PAT 涵蓋本 milestone，OAuth 等真實外部開發者出現再做。
- **不做 fine-grained token scope**：DB 預留 `scope text NULL` 欄位但 M15 不啟用；token 權限完全 inherit user 在該 canvas 的 role。
- **不做 MCP resources / prompts / notifications / sampling / roots / logging methods**：四個核心 method（initialize / ping / tools/list / tools/call）已涵蓋「外部 AI 編輯 canvas」需求；進階 method defer。
- **不做 stateful MCP session**：server 無 session state，每個 POST 獨立處理；tools list 在 deploy 之間固定，不需 `notifications/tools/list_changed` push。
- **不做 per-token rate-limit bucket**：per-user bucket（key `mcp:user:<userId>`）統一防濫用；per-token bucket 反讓 user 透過建多張 token 突破 quota。
- **不做 token plaintext reset**：明碼回 user 只一次（POST 建立時），之後 delete + create new。
- **不做真實 Claude Desktop / Cursor 自動化連線測試**：那是 manual smoke 級別；自動化 e2e 用 Playwright `request.post()` 直接 send JSON-RPC body 模擬 MCP client。
- **不對外公開 endpoint 給網際網路存取**：本 milestone 仍是 local-only deployment 階段；M15 endpoint 預設只在 user 自有 dev / 自架環境上線。
- **不做 PAT plaintext 在前端 localStorage / sessionStorage 暫存**：建立後立刻顯示 + copy，user 自負「現在 copy 或永不再見」責任。
- **不修 in-process agent runtime（M14 路徑）任何行為**：含 system prompt / tool description / wiring / event sequence — 全部不動。
- **不重做 cursor-ai-badge unit test / spec design**：本 change 只動 broadcast 機制（寫入位置），既有 spec multi-tab visibility scenario 與測試 fixture 完全保留。

## Decisions

### Authentication via Personal Access Token (PAT), opaque random token + DB hash

選 PAT 而非 OAuth 2.0；token 用 opaque random 而非 JWT。Format：`vlm_pat_<32 char base62>`（總長 40 char）。Storage：SHA-256 hash + 前 12 char prefix（UI 顯示 + secret scanner 用）。

**理由：**

- Vellum M15 是「自用 + 信任 collaborator」side project 規模，OAuth 的 authorization server / consent UI / refresh rotation 工程量（~1 週）遠超本 milestone 取得的 user value。
- 業界 PAT scheme（GitHub `ghp_`、Stripe `sk_live_`、AWS `AKIA`）都用 opaque random + DB hash — prior art 多。
- JWT 的 stateless verify 優勢在「PAT 長存」場景下用不到（revoke 要 DB blocklist 仍是 stateful），純 JWT 反而讓 revoke 複雜化。
- `vlm_pat_` 前綴可被 GitHub Secret Scanning / TruffleHog 等工具自動掃 leaked token，是 prefix scheme 的 added value。
- DB 預留 `scope text NULL` 欄位 — 未來想加 fine-grained scope 或 OAuth 升級，schema 不需 migration。

**反方案：**

- **OAuth 2.0**：工程量 ~1 週、UI / token rotation / authorization server 全要做；本 milestone 沒外部 client base 撐起這成本。延後到「真實外部使用者出現」再做。
- **純 JWT**：stateless verify 1 ms 不是瓶頸；revoke 要 DB blocklist 反而抵消 stateless 優勢；exp 短違反 PAT 「長存」使用模式。
- **Bcrypt hash**：PAT entropy 32 char base62 已遠超 brute-force 可行範圍，SHA-256 已足；bcrypt 反而拖慢每 request hash latency。

### Per-user token, canvasId on every tool call (GitHub PAT model)

Token 認證 user，**不**綁定 canvas；每個 `tools/call` JSON-RPC body 帶 `canvasId` 參數，server 透過既有 `requireRole(deps, {userId}, canvasId, allowedRoles)` 即時檢查。

**理由：**

- 對應 GitHub PAT 模式：一張 token 對所有 repo，server 依 repo permission check — vellum 11 個 tool 對應 GitHub repo level API。
- 維持「user 對 canvas 的 permission 在 request 時 evaluate」mental model — permission-guard 同一條 path，agent / sharing / sse 三條 endpoint 已驗證的邏輯重用。
- MCP client UX 簡單：user 在 Claude Desktop 對話中明說「edit canvas abc-123」就行，不必每張 canvas 換 token。
- Collaborator 機制天然兼容：被 share 為 viewer 的 user 自己的 PAT 對該 canvas 自然 read-only。

**反方案：**

- **Per-(user, canvas) token**：洩漏 blast radius 小，但 user 要管 N 張 token、切 canvas 換 token，UX 糟。`expires_at` + soft delete 已部分緩解洩漏風險。
- **MCP resources URI（`mcp://vellum/canvas/<id>`）**：MCP spec 推薦但 Claude Desktop / Cursor 等 client UI 對 resource picker UX 還沒成熟；user 要懂 mcp:// URI；tool input + resource 兩條 context path 過度複雜。

### Per-user rate-limit bucket, MCP_TOOL_CALL_RULE = 60/60s

新增 `MCP_TOOL_CALL_RULE: RateLimitRule = { windowMs: 60_000, max: 60 }`，key `mcp:user:<userId>` — 該 user 名下所有 PAT 共享一個 bucket。`tools/list` / `initialize` / `ping` 不計入；只 `tools/call` 消耗 token。

**理由：**

- 60/60s 對應「正常 AI agent 編輯流程圖需 20-40 個 tool call、1 分鐘內跑完」是合理上限。
- Per-user 防 user 建多張 token 突破 quota；同 user 在 vellum 網頁 in-process + Claude Desktop MCP 「概念上是同個人對 canvas 的操作」應共享配額（雖然兩個 rule 分開 — see 下一條 trade-off）。
- 跟既有 `AGENT_RUN_RULE` 不共享 bucket — 兩條 rule 分開，因 MCP background automation 自然 burst 高於 UI 點 Send。

**反方案：**

- **Per-token bucket**：兩張 token 各獨立 quota，洩漏隔離但讓 user 透過建 token 突破上限。違反 rate-limit 本意。
- **Hybrid (per-token short + per-user long)**：兩層 enforcement、複雜度上升；本 milestone 沒實際需求。
- **共享 AGENT_RUN_RULE = 5/60s**：太緊，MCP client 多 tool call 場景立刻撞牆；分開設置才合理。

### Stateless Streamable HTTP, single endpoint POST /api/mcp

整個 MCP server 在 `POST /api/mcp` 一條 endpoint 收所有 JSON-RPC method；server 無 session state；不支援 `notifications/*` server-push。

**理由：**

- 「edit canvas from external AI client」use case 完全是 client-driven（client 發 tool call、server 回 result）— 沒 server-push 需求。
- Stateless 簡化 server 端 reasoning：每個 request 獨立 verify PAT + dispatch method，無需 session id / capabilities 管理。
- Bun.serve 對 stateless POST 路徑是最佳優化方向（既有 endpoint 多走這條）。
- 未來想加 stateful（push notifications）也不破壞既有 stateless endpoint — 可加新路徑 `/api/mcp/session`。

**反方案：**

- **Stateful sessions + SSE push**：要 maintain session table、handle client reconnect、push `tools/list_changed` — vellum tool surface deploy 之間固定，需求未明確時 over-engineer。
- **多個 endpoint 對應 method**（如 `POST /api/mcp/tools/call`）：違反 MCP spec 標準（單一 endpoint + body method discrimination）；client SDK 不認。

### M15 MVP methods: initialize / ping / tools/list / tools/call

四個 method 涵蓋「外部 AI 編輯 canvas」核心 path。其他全 defer。

**加 `ping`** ：5 行 code，client side reliability up — Claude Desktop / Cursor 在 connection lifecycle 中會 periodic ping 確認 server 活著。零成本獲得 standard MCP compliance。

**Deferred：**

- `resources/list` + `resources/read`：暴露 canvas snapshot 為 readable resource。語意正確但跟 `listCanvases` tool 重疊；Claude Desktop 對 resource UI 還沒成熟。M17 「Vellum as canvas resource provider」獨立 milestone 評估。
- `prompts/list` + `prompts/get`：戰略性 feature（Vellum 提供「summarize canvas」「plan redesign」prompt template 給 client）— 工程量 ~3-4 天，跟 M15 主軸獨立，開 M17 思考。
- `notifications/*` `sampling/*` `roots/*` `logging/*`：要 stateful、或 vellum 用不到、或內部 Pino 已足。

### 12th tool: listCanvases (read kind), exposed only via MCP entry point in the sense that in-process never calls it

新加第 12 個 tool entry 在 `tool-registry.ts`：

```ts
listCanvases: {
  name: "listCanvases",
  kind: "read",
  description: "List canvases this user can access (own + shared as editor/viewer). Returns array of {id, title, role}. Use this BEFORE other tools when the user doesn't specify which canvas to operate on.",
  schema: z.object({}).strict(),
  execute: async (deps, _canvasId, _input) => listCanvasesForUser(deps, deps.session.userId),
}
```

In-process agent runtime永遠跟某張 canvas 綁，不會呼叫 `listCanvases`（call 也 ignore canvasId，沒副作用）。MCP server 透過此 tool 給 client discover canvas 列表。

**理由：**

- 同一份 tool-registry source of truth — MCP server 透過 `tools/list` 暴露時，listCanvases 跟其他 11 個一起 serialize 出去。
- 走 tool 而非 MCP resource：tool 在 Claude Desktop chat 中顯示明確（「執行了 listCanvases」）；resource 是 picker UX，user 不一定熟。
- `schema: z.object({}).strict()` 表示無 input（跟 `getCanvasBounds` 同模式）。
- Execute signature 收 `canvasId` 但 ignore — 維持 tool entry 介面一致；MCP `tools/call` 將 client 傳的 canvasId（或 placeholder）丟給 execute，read 邏輯走 `deps.session.userId`。

**反方案：**

- **加 MCP resource 端 endpoint 取代 tool**：tool 是 widely supported lowest common denominator；resource 等 UI 成熟。
- **不加 listCanvases，要 user 手動 paste canvasId**：UX 太差，client 拿不到 canvas 列表 → 無法做事。
- **`canvasResourceUri` 命名替代 `id`**：留 forward compatibility 但 M15 內 user 看不到 URI 差別，過度設計。

### Permission check for tools/call: user role + tool kind 雙條件

`tools/call` dispatch 內 enforce：

| Tool kind | Allowed canvas roles |
| --- | --- |
| write (6 個 + listCanvases call from canvas context — see below) | owner, editor |
| read (5 個) | owner, editor, viewer |
| listCanvases | 不檢查 canvas role（這個 tool 是 user-level，不對應單一 canvas） |

對 `tools/call` 收到的 `canvasId`：

1. 先 check tool kind — listCanvases 直接 dispatch（不檢查 canvas）。
2. 其他 tools：
   - canvas 不存在 → JSON-RPC error `-32000` + `{errorKey: "agent.error.invalidRequest"}`（不洩漏存在性，跟 thread endpoint 同模式）
   - canvas 存在但 user 無 role → 同上 errorKey
   - canvas 存在且 role 對 → dispatch 既有 tool entry execute path

**理由：**

- Reuse `requireRole(deps, {userId}, canvasId, allowedRoles)` — 同 agent / sharing / sse 三條 endpoint 走的 permission-guard。
- 不洩漏 canvas 存在性遵循既有 thread / share endpoint 模式。
- listCanvases 不對應單一 canvas 邏輯特殊化在 dispatch 層處理（不污染 permission-guard 通用介面）。

**反方案：**

- **403 vs 400 區分**：對 valid token 但 wrong role 應該 403 — 但 MCP JSON-RPC spec 內統一用 error code，HTTP status 200 + JSON-RPC error 是 protocol idiom；403 vs 400 在 JSON-RPC envelope 不可見。

### JSON-RPC error mapping: -32700/-32600/-32601 protocol, -32000 application + errorKey data

MCP server 回 error 用 JSON-RPC 2.0 envelope `{jsonrpc, id, error: {code, message, data}}`，**HTTP status 一律 200**（除了 401 PAT auth / 429 rate limit 走 HTTP-level error，因為 MCP request 還沒進 JSON-RPC dispatch）。

| Layer | Error | HTTP | JSON-RPC code | data |
| --- | --- | --- | --- | --- |
| HTTP | 無 / 過期 PAT | 401 | (no body) | (no body) |
| HTTP | rate limit | 429 | (no body) | (no body, but `Retry-After` header) |
| JSON-RPC protocol | malformed JSON | 200 | -32700 (parse error) | (none) |
| JSON-RPC protocol | invalid request shape | 200 | -32600 | (none) |
| JSON-RPC protocol | method not found | 200 | -32601 | (none) |
| Application | permission denied / invalid canvas / tool unknown / tool args fail | 200 | -32000 | `{errorKey: "agent.error.*"}` |
| Application | tool execution error from mutator | 200 | -32000 | `{errorKey: "errors.devMutate.*" / "errors.fullToolSurface.*"}` |

**理由：**

- 對齊既有 i18n errorKey 系統（`agent.error.*` / `errors.devMutate.*` / etc）— Claude Desktop 可 surface translated message 給 user。
- HTTP 401 / 429 對 MCP client SDK 是 standard handling（reconnect / backoff）；放進 JSON-RPC envelope 反讓 client 端 retry logic 複雜。
- Application error 統一 -32000「server-defined」code + data 區分 — 不發明新 code（避免跟 future JSON-RPC ext spec 衝突）。

**反方案：**

- **所有 error 都進 JSON-RPC envelope（連 401/429 都 200 + JSON-RPC error）**：違反 HTTP idiom，client SDK 不易判斷；rate limit `Retry-After` header 也 surface 不出。
- **各 application error 用不同 code (-32001/-32002/...)**：JSON-RPC spec 留 `-32000` to `-32099` 給 server-defined；分散 code 增加 client 端 switch 數量，data 對應 errorKey 更彈性。

### Zod-to-JSON-Schema conversion: 自寫小型 converter

`tools/list` response 需要 JSON Schema（MCP spec 要求）— 從既有 `tool-registry.ts` 的 11 + 1 個 Zod schema 動態 convert。

選擇：**自寫小型 converter** in `apps/api/src/mcp/zod-to-json-schema.ts`，只 support 12 個 tool 用到的 Zod feature：

- `z.object({...}).strict()`、required fields auto-detection
- `z.string()` / `z.string().regex(...)` / `z.string().min(n)`
- `z.number().finite()` / `z.number().int()`
- `z.literal(...)`、`z.enum([...])`、`z.array(...)`、`z.record(z.string(), z.unknown())`
- `z.optional(...)`、`z.nullable(...)`
- `z.discriminatedUnion(...)`（updateShape payload 用）

不引入 `zod-to-json-schema` npm package — 11+ KB bundle、處理大量 vellum 用不到的 Zod feature（ZodEffects, ZodPipeline, ZodLazy, etc.）。自寫 ~150 行覆蓋實際需求 + unit test 全 12 個 schema 都能正確 convert。

**理由：**

- 對齊既有「Bun-native preference」+「不引入新 npm package」hard rule。
- Vellum tool schema 用到的 Zod feature 範圍有限 + 穩定（M14 archive 後不太可能變），自寫成本 < 維護 dependency。
- Unit test 對 12 個 tool schema 做 snapshot match 直接 catch 漂移。

**反方案：**

- **`zod-to-json-schema` npm**：~11 KB bundle、處理 100+ Zod feature 但只用 ~10 個。
- **手動寫 12 個 schema 對應的 JSON Schema literal**：DRY violation；schema 改動兩處要同步。
- **`@valibot/to-json-schema` 或其他**：要先 migrate Zod → Valibot，超出 scope。

### Cursor AI Badge: 寫進 TLInstancePresence.meta via editor.store.put + InstancePresenceRecordType.createId(userId)

M14 verification 留下的 debt — `cursor-ai-badge.ts` 改寫成：

```ts
import { InstancePresenceRecordType } from "tldraw";

export function useCursorAiBadge(editor: AiBadgeEditor | null, state: AgentRunState): void {
  useEffect(() => {
    if (!editor) return;
    const aiActive = state === "running";
    const userId = editor.user.getId();
    const presenceId = InstancePresenceRecordType.createId(userId);
    const existing = editor.store.get(presenceId);
    if (!existing) return;
    editor.store.put([{ ...existing, meta: { ...existing.meta, aiActive } }]);
  }, [editor, state]);
}
```

`AiBadgeEditor` interface 從「`updateInstanceState({ meta })`」改成「`store.get` + `store.put` + `user.getId`」narrow surface。

`CollaboratorAvatars.tsx` 從 `instancePresence.meta.aiActive` 讀（既有 tldraw sync 已透過 `getPresenceRecords()` 廣播 presence 給 collaborator）。

**理由：**

- TLInstancePresence record 透過 tldraw sync 廣播給 room 內所有 collaborator — 本來就是 sync 該走的 channel。
- 只廣播 boolean flag，**不**廣播對話內容；對齊 PRD #2「AI 對話不分享」原則。
- `editor.store.put` 是 tldraw 標準 API，無需 user.updateUserPreferences 那種 schema-restricted path。
- `use-sync-store.ts` 已 round-trip presence record，不需動。

**反方案：**

- **保留 TLInstance.meta 路徑**：local-only 對 single-tab user 仍能看到自己 ✨ — 但完全違背 multi-tab visibility scenario 設計，且 e2e `agent-multi-tab-badge` 永遠 skip。
- **新開一條 cursor-badge channel（per-canvas SSE / WS）**：違反「reuse sync presence」原則，多一條 stateful connection。
- **寫進 user record 而非 presence record**：user record 是 cross-room 持久化，不適合「現在這次 run 中 aiActive」這種 ephemeral state。

### Token last_used_at: throttled write, max once per 60 seconds

每次 PAT 通過 auth 時更新 `last_used_at`，但 throttle 到「每 token 每 60 s 最多 1 次」（in-memory LRU map 紀錄上次 update 時間 + 60 s skip）。

**理由：**

- 「Last used 顯示」對 user 是 minute-级 precision 就夠（Settings UI 顯示「2 hours ago」非「7 minutes 13 seconds ago」）。
- 避免每個 MCP request 觸發一次 DB UPDATE — 100+ tool call / minute 場景就是 100 UPDATE，純寫入熱點。
- LRU map 跟 in-memory rate limiter 同層級，capacity 10k key（同 RateLimiter 預設）。

**反方案：**

- **每 request UPDATE**：寫入熱點，本 stage 不需要。
- **完全不追蹤 last_used_at**：Settings UI 看不到「token 是否還在用」，UX 退步。
- **DB-side trigger / async queue**：over-engineer。

## Implementation Contract

#### 對外行為

**MCP server lifecycle（外部 client 角度）：**

1. User 在 Settings → API Keys → MCP Tokens 點「New token」按鈕，輸入 name + 選 expires_at (30/90/never)。
2. POST `/api/account/pat` body `{name, expiresInDays?}` 回 `{token: "vlm_pat_xxx" (plaintext, only this time), id, prefix, name, expiresAt, createdAt}`。
3. User copy 該明碼進 Claude Desktop / Cursor 的 MCP 配置（通常是 `~/.config/claude/mcp.json` 或對應位置）：

   ```json
   {
     "mcpServers": {
       "vellum": {
         "transport": "streamable-http",
         "url": "http://localhost:3000/api/mcp",
         "headers": { "Authorization": "Bearer vlm_pat_xxx" }
       }
     }
   }
   ```

4. Claude Desktop 啟動 → `POST /api/mcp` body `{jsonrpc:"2.0", id:"1", method:"initialize", params:{...}}` → server 回 `{result: {protocolVersion, capabilities:{tools:{}}, serverInfo:{name:"vellum-mcp-server", version}}}`。
5. Client 拉 `tools/list` → server 回 12 個 tool 的 JSON Schema + description + annotations (`readOnlyHint` for 5 read tools)。
6. User 在 Claude Desktop 對話「列我所有 canvas」→ AI 呼叫 `tools/call` `{name:"listCanvases", arguments:{}}` → server 回 `[{id, title, role}, ...]`。
7. User「在 canvas <id> 加 5 個流程圖節點」→ AI 呼叫 `tools/call createShape` × 5 → server 對每個 dispatch `applyMutation` → tldraw sync 廣播 → user 之後打開 vellum 網頁看到 shape。
8. User 在 Settings → 看到 token last_used_at = "a few seconds ago"；想 revoke 點 trash icon → `DELETE /api/account/pat/:id` → token 立即失效。

**Cursor AI Badge（vellum web 角度）：**

User A 在 tab 1 觸發 AI run → useCursorAiBadge 寫進 A 的 instancePresence.meta.aiActive = true → tldraw sync 廣播 → User A 的 tab 2、Collaborator B 都在 ~500 ms 內看到 A 的 avatar 有 ✨ overlay。Run 終態 → meta.aiActive = false → ✨ 消失。

#### 介面 / 資料形狀

**MCP server endpoint：**

```
POST /api/mcp
  Headers:
    Authorization: Bearer vlm_pat_<random>
    Content-Type: application/json
  Body (JSON-RPC 2.0):
    { jsonrpc: "2.0", id: <string | number>, method: <string>, params?: <object> }

  Errors before JSON-RPC dispatch:
    401 (empty body) if PAT missing / invalid / revoked / expired
    429 (empty body, Retry-After header) if rate-limited

  JSON-RPC responses (HTTP 200):
    Success: { jsonrpc:"2.0", id, result: <method-specific shape> }
    Error:   { jsonrpc:"2.0", id, error: { code, message, data? } }
```

**Method shapes（M15 MVP）：**

```
initialize:
  params: { protocolVersion, capabilities, clientInfo }
  result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name, version, instructions? } }

ping:
  params: (none)
  result: {}

tools/list:
  params: (none)
  result: { tools: [{ name, description, inputSchema: JSONSchema, annotations: { readOnlyHint? } }, ...] }

tools/call:
  params: { name: string, arguments: object }
  result: { content: [{ type: "text", text: <JSON-stringified result> }], isError?: boolean }
  // 對應 既有 tool execute return：成功 → MutationResult / ReaderResult 包進 content；失敗 → JSON-RPC error
```

**PAT REST endpoints：**

```
GET /api/account/pat
  → 200 { data: [{ id, name, prefix, expiresAt, lastUsedAt, createdAt }, ...] }
  → 401 if no session

POST /api/account/pat
  body: { name: string (1..64), expiresInDays?: 30 | 90 | null }
  → 201 { data: { token: "vlm_pat_xxx" (plaintext, only response), id, name, prefix, expiresAt, createdAt } }
  → 400 invalidPayload
  → 401 if no session

DELETE /api/account/pat/:id
  → 204
  → 401 / 403 / 404 (403/404 NOT distinguished — leak avoidance)
```

**DB schema：**

```sql
CREATE TABLE personal_access_tokens (
  id text PRIMARY KEY,                          -- ulid
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,                            -- user-supplied label
  token_hash text NOT NULL UNIQUE,               -- SHA-256 of plaintext
  token_prefix text NOT NULL,                    -- first 12 chars of plaintext (e.g. "vlm_pat_a3f2")
  scope text,                                    -- reserved for future fine-grained scope; NULL = unrestricted
  expires_at timestamptz,                        -- NULL = never expires
  last_used_at timestamptz,                      -- throttled, updated max once per 60 s
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz                         -- soft delete; hard delete after 30 days via background job (not part of M15)
);
CREATE INDEX pat_user_idx ON personal_access_tokens (user_id, created_at DESC);
CREATE UNIQUE INDEX pat_hash_active_idx
  ON personal_access_tokens (token_hash)
  WHERE revoked_at IS NULL;
```

#### 失敗模式

| 情境 | 行為 |
| --- | --- |
| PAT 過期 / revoked / wrong hash / missing | 401 HTTP（不進 JSON-RPC dispatch；不洩漏細節） |
| `tools/call` rate-limited | 429 HTTP + `Retry-After` header（不進 JSON-RPC dispatch） |
| Malformed JSON body | 200 + JSON-RPC error -32700 |
| Invalid JSON-RPC envelope（缺 jsonrpc / method） | 200 + -32600 |
| Unknown method | 200 + -32601 |
| `tools/call` 對 canvasId 不存在 / user 無 role | 200 + -32000 `{errorKey:"agent.error.invalidRequest"}` (混合「不存在」與「無權限」避免存在性洩漏) |
| `tools/call` arguments 不符 Zod schema | 200 + -32000 `{errorKey:"agent.tool.invalidArgs"}` |
| `tools/call` tool 不存在 | 200 + -32000 `{errorKey:"agent.tool.unknown"}` |
| Mutator throw（既有 tool execute path 的 error） | 200 + -32000 `{errorKey: <既有 errors.devMutate.* / errors.fullToolSurface.*>}` |
| Cursor badge — collaborator 離線重連 | tldraw sync presence 自動清 record；reconnect 後 round-trip 重建 |
| Cursor badge — meta 寫入失敗（極小機率） | useCursorAiBadge useEffect 不 throw，下次 state change 再試 |

#### 驗收條件

| # | 觀察點 | 驗證方式 |
| --- | --- | --- |
| 1 | PAT plaintext 一次性顯示 | unit test：POST /api/account/pat 回 plaintext；GET 不含 plaintext 任何形式 |
| 2 | Token hash storage | unit test：DB 內 token_hash 是 plaintext 的 SHA-256 hex |
| 3 | Token prefix 顯示 | unit test：POST 回 prefix === plaintext.slice(0, 12) |
| 4 | Expires_at enforcement | unit test：token expires_at 過去 → auth 拒；NULL → 永不過期 |
| 5 | Soft delete revoke | unit test：DELETE → revoked_at IS NOT NULL；後續 auth 拒 |
| 6 | `last_used_at` throttle | unit test：fake clock 連 2 個 request 在 30 s 內 → 只 1 個 DB UPDATE |
| 7 | MCP `initialize` | unit test：合法 body → 回 capabilities.tools = {} + serverInfo |
| 8 | MCP `ping` | unit test：回 {} |
| 9 | MCP `tools/list` schema | unit test：12 個 tool 都在；listCanvases 在；JSON Schema 對 createShape 含 props 必填 |
| 10 | MCP `tools/call createShape` | integration test：合法 PAT + owner role → applyMutation 收到 mutation；canvas record 落地 |
| 11 | MCP `tools/call` cross-user canvas | integration test：U2 PAT 對 U1 canvas → -32000 invalidRequest（不洩漏存在性） |
| 12 | MCP `tools/call` viewer role on write tool | integration test：viewer PAT 對 write tool → -32000 invalidRequest |
| 13 | MCP rate limit | integration test：MCP_TOOL_CALL_RULE max 60 → 61st request 429 + Retry-After |
| 14 | `listCanvases` 列 user 所有 owned + shared canvas | unit test：seed U1 own 3 張 + share 進 U2 own 2 張為 viewer → listCanvases as U1 回 5 張（含 role 欄位） |
| 15 | Cursor AI Badge cross-tab broadcast | playwright e2e（既有 agent-multi-tab-badge.spec.ts 翻 skip → 綠）：tab A 觸發 run → tab B / collaborator 500 ms 內 ✨ visible |
| 16 | JSON-RPC -32700/-32600/-32601 protocol error | unit test：malformed JSON → -32700；invalid envelope → -32600；unknown method → -32601 |
| 17 | i18n 兩語同步 | i18n-audit.test.ts pass — `account.pat.*` keys 雙語 |
| 18 | Coverage | `bun test --coverage` mcp / pat / list-canvases 目錄 ≥ 70% |

#### Scope 邊界

**In scope：**

- `apps/api/src/mcp/` 整個新目錄（index / dispatch / methods/* / jsonrpc / zod-to-json-schema）
- `apps/api/src/pat/` 整個新目錄（routes / repo / auth / token-format）
- `apps/api/drizzle/0007_personal_access_tokens.sql` 純 ADD TABLE 無 backfill
- `apps/api/src/sync/list-canvases-reader.ts` 新加
- `tool-registry.ts` 第 12 個 entry listCanvases
- `rate-limit-rules.ts` 加 MCP_TOOL_CALL_RULE
- `apps/web/src/agent/cursor-ai-badge.ts` 改寫進 TLInstancePresence
- `apps/web/src/canvas/CollaboratorAvatars.tsx` 讀 presence.meta.aiActive
- Settings UI 新 「MCP Tokens」分頁
- i18n keys `account.pat.*` 雙語
- 1 條 Playwright e2e mcp-server-roundtrip + 翻 `agent-multi-tab-badge.spec.ts` skip

**Out of scope（即使順手寫得到也不寫）：**

- OAuth / authorization code flow / refresh token
- Fine-grained token scope（DB column 預留但不啟用）
- MCP resources / prompts / notifications / sampling / roots / logging methods
- Stateful MCP sessions / server-push notifications
- Per-token rate-limit bucket
- Token plaintext reset
- Token hard delete background job（M15 留 soft delete only；30-day cleanup job 後續 milestone）
- 真實 Claude Desktop / Cursor 連 vellum 自動化測試（manual smoke only）
- In-process agent runtime 任何變更
- Phase 1 Out of Scope guard 列出的所有項目

## Risks / Trade-offs

- **PAT plaintext 洩漏（user 不慎 commit 到 GitHub / paste 到聊天室）** → mitigation: `vlm_pat_` prefix 被 GitHub Secret Scanning / TruffleHog 等工具自動掃 +「明碼只顯示一次」UX warning + user 可隨時 revoke。production 端可加 push protection hook（M15+ 後續）。

- **Per-user rate-limit bucket 對 in-process agent 與 MCP 分開** → 兩個 rule 分桶（AGENT_RUN_RULE 5/60s vs MCP_TOOL_CALL_RULE 60/60s）。user 在 vellum 網頁跑爆 5/60s 仍能在 MCP 跑 60/60s — 概念上是「同人對 canvas 的編輯能量」分兩個 channel。**接受 trade-off：當前防濫用目標是「防各 channel 內 burst」，跨 channel 合併防 user 整體濫用是未來 enterprise 顧慮**。

- **`listCanvases` 對大量 canvas user 一次回全部 (`O(N)`)** → vellum 規模目前每個 user 數十張 canvas 上限，無 pagination 需求；list endpoint 內部加 `limit 100` 保險上限。超過 100 張 user 屬 phase 3+ enterprise tier 顧慮。

- **JSON-RPC `id` 可任意（string / number / null）** → 不做 id collision 偵測，純照 client 回傳 — 與 JSON-RPC spec 一致；client 端確保 id 唯一是其責任。

- **MCP spec `protocolVersion` 漂移** → `initialize` response 固定回 `"2024-11-05"`（M15 動工時 MCP spec stable 版本）；client 若 `params.protocolVersion` 不符 server 仍盡力 work（不 hard reject 跨版本），有需要再 M15 後 patch。

- **PAT auth route 跟 BYOK auth route 共用 session middleware** → 兩條 endpoint 都過既有 `getSession(req)`（better-auth 解 cookie）— PAT auth 走 `Authorization: Bearer` header 是**新**邏輯，不撞 cookie session；在 `apps/api/src/pat/auth.ts` 內單獨 `authenticatePat(req)` 分離邏輯，不污染既有 session middleware。

- **Cursor badge broadcast 在 `editor.store.put` 寫入時序的潛在 race** → tldraw store 是 reactive，連續 put 在同個 tick 內會被 batch；useEffect 對 state change 只 fire 一次；對 multi-tab badge e2e 已驗 cross-tab visibility 應 robust。

- **Zod-to-JSON-Schema 自寫 converter 漂移** → 12 個 tool schema 都進 unit test snapshot — 任何新加 Zod feature 不對應 converter rule 立即 catch；schema 改動 + converter rule 同 PR 改。

- **token_hash UNIQUE index 衝突（SHA-256 collision）** → 理論上 2^128 操作 — vellum 規模可忽略；任何 INSERT 在 UNIQUE index 衝突情況下 retry 一次（極小機率）。

## Migration Plan

非破壞性 schema add（一張新表 + 2 索引 + cascade FK 指向 users）；不動既有 endpoint / 不動 in-process agent / 不動既有 tool-registry execute path。

部署順序：

1. `bunx drizzle-kit generate` 產 `0007_personal_access_tokens.sql`；review。
2. `apps/api/src/db/schema.ts` 加 `personalAccessTokens` drizzle table 定義 + test。
3. `apps/api/src/pat/` 整個目錄（auth / repo / routes / token-format）紅綠重構縱切。
4. `apps/api/src/mcp/` 整個目錄（jsonrpc / zod-to-json-schema / methods/* / dispatch / index）紅綠重構縱切。
5. `apps/api/src/sync/list-canvases-reader.ts` + `tool-registry.ts` 第 12 個 entry。
6. `apps/api/src/lib/rate-limit-rules.ts` 加 `MCP_TOOL_CALL_RULE`。
7. `apps/api/src/index.ts` 掛載 `/api/mcp` + `/api/account/pat` 兩條路由。
8. `apps/web/src/agent/cursor-ai-badge.ts` rewrite + test；`use-sync-store.ts` round-trip test；`CollaboratorAvatars.tsx` 讀 presence meta；翻 e2e skip。
9. `apps/web/src/account/PatTokensSection.tsx` + `usePatTokens.ts` + `AccountPage.tsx` mount。
10. i18n keys（zh-TW + en 同步）。
11. 1 條 Playwright e2e mcp-server-roundtrip.spec.ts。
12. Quality gates: typecheck / oxlint / oxfmt / `bun test --coverage` ≥ 70% / `bun run test:e2e` 4 條 agent e2e 不退步 + 既有 happy path 不退步。
13. Owner manual smoke：用 Claude Desktop 配置一個 PAT 真連 vellum dev → 在對話中跑 listCanvases + 3 個 createShape + 1 個 updateShape 驗證 canvas 更新。
14. `docs/PHASE2_MILESTONES.md` 把 M15 標 ✅ v0.6.0。

Rollback：純 ADD TABLE + 純 ADD route，rollback = revert PR + `DROP TABLE personal_access_tokens`。既有 in-process agent / sharing / sse 完全不受影響。

## Open Questions

下列細節在 specs / tasks 撰寫期或實作早期可再決定，當前傾向已記：

1. **`initialize` response `instructions` field 內容**：MCP spec 允許 server 在 initialize result 加 `instructions: string` 提示 client 該 server 怎麼用。傾向加一段「Vellum is a canvas-native co-pilot backend. Call `listCanvases` first to discover available canvases, then use canvas-scoped tools with `canvasId` in arguments. All write tools require owner/editor role on the target canvas」。
2. **PAT `name` 唯一性**：要不要對 (user_id, name) 加 UNIQUE constraint？傾向不加 — user 可建多張 name 重複的 token，無 cross-table query 需要。
3. **Settings UI token list 排序**：傾向 `created_at DESC` — last created 最上；revoked 過的不在 active list 內。
4. **`tools/call` content 包 JSON-stringified result vs `text` 純文字**：傾向 JSON-stringified 包進 `text` field（MCP spec 標準），client 端 parse；不另開 `application/json` content type。
5. **Token DB hard delete cleanup job**：30 天後從 DB 移除 `revoked_at IS NOT NULL` rows — 不在 M15 範圍；後續 milestone 或 manual SQL。
