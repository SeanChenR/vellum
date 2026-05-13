## Why

Phase 2 milestone roadmap M15. Vellum 已在 M14 上把 BYOK Vault、Server tldraw Mutator、Tool Registry（11 個 read+write tools）、Permission Guard、Agent Runtime、Streaming SSE、AI Side Panel 全部接通：使用者在 vellum 網頁打開 panel、送 prompt、AI 就會編輯 canvas。

下一個方向是讓**同一份 tool surface 也能被外部 AI 客戶端使用**——使用者在 Claude Desktop / Cursor / Zed 等慣用工具裡對話，「幫我在 vellum 的 canvas xyz 加 5 個流程圖節點」——AI 客戶端透過 Model Context Protocol (MCP) 連到 vellum，呼叫 createShape × 5，canvas 上 shape 自然出現，所有 collaborator 透過既有 tldraw sync 看得到。Vellum 成為「canvas backend」，可串接 user 各種 AI workflow，而不只是一個獨立 web app。

本 milestone 是 **craftsmanship-driven 展示工程**（owner 自用 side project 想把 MCP 端到端走完）——不是回應外部市場需求。這影響 scope：用 Personal Access Token（PAT）而非 OAuth、opaque random token 而非 JWT、無 token 層級 scope、無多租戶顧慮。Schema 與 endpoint 保留升級空間（未來若有真實外部使用者再做 OAuth / fine-grained scope）。

同時收 M14 verification 留下的一條 debt：cursor AI Badge 跨 tab 廣播。M14 為救 runtime crash 把 `aiActive` 寫到 `TLInstance.meta`（local-only），結果其他 tab / collaborator 看不到 ✨ overlay。本 change 一併修正寫到 `TLInstancePresence.meta`，工程量約半天，跟 MCP 主軸獨立但同個 spec change 一次 ship。

## What Changes

- 新增 **MCP Server endpoint** `POST /api/mcp`，stateless Streamable HTTP transport，支援 4 個 JSON-RPC method：`initialize` / `ping` / `tools/list` / `tools/call`。Methods deferred 不做：`resources/*` `prompts/*` `notifications/*` `sampling/*` `roots/*` `logging/*` `sampling/createMessage`。
- 新增 **Personal Access Token (PAT)** 系統：
  - DB 表 `personal_access_tokens`（id ulid / user_id FK / name / token_hash SHA-256 / token_prefix / scope nullable / expires_at nullable / last_used_at / created_at / revoked_at soft delete）
  - Token 格式 `vlm_pat_<32 char base62>`（前綴可被 secret-scanner 掃 leaked token）
  - REST endpoints：`GET /api/account/pat` 列、`POST /api/account/pat` 建（**回 plaintext 一次**）、`DELETE /api/account/pat/:id` revoke
  - Settings UI 加 「MCP Tokens」分頁，跟既有 BYOK keys 同 page 不同 tab
- 既有 `tool-registry.ts` 新加第 12 個 tool **`listCanvases`**：回 user 可存取的 canvas 列表 `[{id, title, role}]`。MCP client 透過此 tool 發現 canvasId（in-process agent 不用，永遠跟某張 canvas 綁）。
- MCP `tools/call` 透過 Permission Guard 強制檢查：MCP request 帶 PAT → 解出 userId → 每個 tool input 必含 `canvasId` → `requireRole(deps, {userId}, canvasId, ["owner","editor"])` 對 write tool / `["owner","editor","viewer"]` 對 read tool。
- 新增 **`MCP_TOOL_CALL_RULE` rate-limit rule**：per-user bucket（key = `mcp:user:<userId>`），60 calls / 60 s。`tools/list` 與 `initialize` 不計入。429 回 `Retry-After` header + JSON-RPC error envelope `{code: -32000, data: {errorKey: "agent.error.rateLimited"}}`。
- **MODIFIED** `ai-side-panel` capability：cursor AI Badge 改寫進 `TLInstancePresence.meta` 走 tldraw sync 廣播；`agent-multi-tab-badge.spec.ts` 翻 skip flag。
- **MODIFIED** `server-mutation-bridge` capability：tool registry 從 11 → 12 個 entry（加 `listCanvases`），description 新加 MCP-aware 提示（提示 user-level discovery）。

## Non-Goals

- **OAuth 2.0 authorization server**：M15 範圍只做 PAT；若未來有真實外部開發者需求再做 authorization code / device flow。
- **Fine-grained token scope**：DB 預留 `scope` column（NULL = unrestricted）但 M15 不啟用；GitHub fine-grained PAT 模式延後。
- **MCP `resources/*` / `prompts/*`**：兩個都是 MCP 的進階機制（讓 client 拉 server 資料 / 提供 prompt template）。Defer 等需求清楚再評估（可能成為 M17 「Vellum as prompt library」獨立 milestone）。
- **MCP `notifications/*` / stateful sessions**：stateless transport 不需要 server push；tool 表在 deploy 之間固定不變。
- **MCP `sampling/createMessage`**：server 反向叫 client LLM 不適用（vellum 自有 BYOK）。
- **`roots/*` / `logging/setLevel`**：vellum 不是檔案系統 server，不需 roots 概念；log 用內部 Pino 已足。
- **Per-token rate limit**：per-user bucket 已能防濫用，per-token bucket 反讓 user 透過建多張 token 突破 quota。
- **Token plaintext reset**：明碼回 user 只一次，之後 delete + create new（GitHub PAT 模式），不允許 reset。
- **Real Claude Desktop / Cursor connection 作為 unit / integration test**：那是 manual smoke 級別；自動化測試走 fake MCP client（直接 POST JSON-RPC body）。
- **MCP server 對外開放（公開 internet）**：vellum 仍是 local-only deployment，M15 endpoint 只在 user 自有 dev / 自架環境上線。
- **Cursor AI Badge spec ai-side-panel 行為大改**：本 change 只修 broadcast 機制（TLInstance → TLInstancePresence），既有 multi-tab visibility scenario 不變動。
- **Phase 1 Out of Scope guard 列出的所有項目**（mobile / comments / AI 對話分享 / 公開 canvas discovery 等）。

## Capabilities

### New Capabilities

- `mcp-server`: Vellum 的 Model Context Protocol server 端能力 — `POST /api/mcp` endpoint、JSON-RPC method dispatch (`initialize` / `ping` / `tools/list` / `tools/call`)、PAT 認證、per-user rate limit、tool input canvasId 強制驗證、12 個 tool（11 既有 + `listCanvases`）暴露給外部 MCP client。
- `personal-access-token`: User 自管的 long-lived API token 能力 — DB 持久化（hash storage / soft delete / `expires_at`）、Settings UI 建 / 列 / 撤銷、明碼一次性顯示、format `vlm_pat_<random>` 含 secret-scanner-friendly prefix。

### Modified Capabilities

- `ai-side-panel`: Cursor AI Badge 從 `TLInstance.meta`（local-only）改寫進 `TLInstancePresence.meta` 走 tldraw sync 廣播；其他 tab / collaborator 都能看到 ✨ overlay。
- `server-mutation-bridge`: tool registry 加第 12 個 entry `listCanvases`（read kind，回 user-accessible canvas list）。

## Impact

- Affected specs:
  - New: openspec/specs/mcp-server/spec.md, openspec/specs/personal-access-token/spec.md
  - Modified: openspec/specs/ai-side-panel/spec.md, openspec/specs/server-mutation-bridge/spec.md
- Affected code:
  - New (api):
    - apps/api/src/mcp/index.ts
    - apps/api/src/mcp/index.test.ts
    - apps/api/src/mcp/dispatch.ts
    - apps/api/src/mcp/dispatch.test.ts
    - apps/api/src/mcp/methods/initialize.ts
    - apps/api/src/mcp/methods/initialize.test.ts
    - apps/api/src/mcp/methods/ping.ts
    - apps/api/src/mcp/methods/ping.test.ts
    - apps/api/src/mcp/methods/tools-list.ts
    - apps/api/src/mcp/methods/tools-list.test.ts
    - apps/api/src/mcp/methods/tools-call.ts
    - apps/api/src/mcp/methods/tools-call.test.ts
    - apps/api/src/mcp/jsonrpc.ts
    - apps/api/src/mcp/jsonrpc.test.ts
    - apps/api/src/mcp/zod-to-json-schema.ts
    - apps/api/src/mcp/zod-to-json-schema.test.ts
    - apps/api/src/pat/routes.ts
    - apps/api/src/pat/routes.test.ts
    - apps/api/src/pat/repo.ts
    - apps/api/src/pat/repo.test.ts
    - apps/api/src/pat/auth.ts
    - apps/api/src/pat/auth.test.ts
    - apps/api/src/pat/token-format.ts
    - apps/api/src/pat/token-format.test.ts
    - apps/api/drizzle/0007_personal_access_tokens.sql
    - apps/api/src/sync/list-canvases-reader.ts
    - apps/api/src/sync/list-canvases-reader.test.ts
  - New (web):
    - apps/web/src/account/PatTokensSection.tsx
    - apps/web/src/account/PatTokensSection.test.tsx
    - apps/web/src/account/usePatTokens.ts
    - apps/web/src/account/usePatTokens.test.ts
  - New (e2e):
    - e2e/mcp-server-roundtrip.spec.ts
  - Modified (api):
    - apps/api/src/index.ts (mount /api/mcp + /api/account/pat routes)
    - apps/api/src/db/schema.ts (add personalAccessTokens table)
    - apps/api/src/db/schema.test.ts
    - apps/api/src/lib/rate-limit-rules.ts (add MCP_TOOL_CALL_RULE)
    - apps/api/src/sync/tool-registry.ts (add listCanvases entry)
    - apps/api/src/sync/tool-registry.test.ts
  - Modified (web):
    - apps/web/src/agent/cursor-ai-badge.ts (TLInstance → TLInstancePresence)
    - apps/web/src/agent/cursor-ai-badge.test.ts
    - apps/web/src/canvas/use-sync-store.ts (presence record round-trip)
    - apps/web/src/canvas/use-sync-store.test.ts
    - apps/web/src/canvas/CollaboratorAvatars.tsx (read aiActive from presence)
    - apps/web/src/account/AccountPage.tsx (mount PatTokensSection tab)
    - packages/shared/src/locales/zh-TW.json (account.pat.* keys)
    - packages/shared/src/locales/en.json
  - Modified (e2e):
    - e2e/agent-multi-tab-badge.spec.ts (flip test.skip → enabled)
  - Removed: (none)
- Affected dependencies: no new npm package — MCP 標準的 JSON-RPC 走自寫實作（小、無 dependency 必要），既有 `zod` 用於 input 驗證。可選用 `zod-to-json-schema` 套件，bundle ~10 KB；若 reject 走自寫 conversion（11 個 tool schema 對應有限轉換規則）。最終由 `apps/api/src/mcp/zod-to-json-schema.ts` 決定。
- Affected runtime: 1 個 SQL migration（personal_access_tokens 表 + 2 索引，純 ADD TABLE 無 backfill）；新增 `/api/mcp` + `/api/account/pat` 兩條 endpoint 群；新增 `MCP_TOOL_CALL_RULE` rate limit 佔 in-process limiter 一個 key 空間；cursor badge broadcast 改走 tldraw presence record（既有 sync room 已有此 channel，0 額外 connection）。
