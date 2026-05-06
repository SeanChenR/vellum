## Why

Vellum Phase 2（PRD #2）要在 canvas 內加 AI co-pilot；agent runtime 需要呼叫 LLM provider，而 owner 已決定走 BYOK（使用者自帶 API key、應用不代理 / 不 pool key）。在把三家 provider × 九個 model 全部接上之前，先做**單一 provider（Anthropic）的端到端 tracer-bullet**：DB schema、加密 vault、provider adapter、API endpoints、Settings UI、i18n、tests 全部跑通，把加密格式、validation 流程、錯誤翻譯規則、UI layout 一次定下來。M11.2（issue #5）會把這套 pattern 擴張到 OpenAI 與 Google；M14.1（issue #12）才把 AI side panel 接進來消費這些 key。所以先 lock pattern。

## What Changes

涵蓋 PRD US #3（在 Settings 輸入 API key）、US #4（系統 ping provider 驗證）、US #6（刪除已存的 key）的 Anthropic-only 部分（OpenAI / Google 留給 M11.2，定價表留給 M11.3）：

- 新增 Drizzle schema `api_keys` table（`packages/shared/src/db/byok-schema.ts`），欄位 `(user_id text → users.id ON DELETE CASCADE, provider text, encrypted_key text, created_at timestamptz, last_used_at timestamptz nullable)`，並在 `(user_id, provider)` 加 unique constraint。
- 新增 Drizzle migration（`apps/api/drizzle/000X_add_api_keys.sql`，編號由 drizzle-kit generate 決定）建立上述 table 與 index。
- 新增 API Key Vault module（`apps/api/src/byok/vault.ts`），透過 `node:crypto` 的 AES-256-GCM 提供 `encryptApiKey(plaintext)` 與 `decryptApiKey(packed)`。Master key 從 `Bun.env.API_KEY_ENCRYPTION_KEY` 讀（32-byte hex string，啟動時驗長度，缺失或長度錯誤直接 throw 阻擋啟動）；每筆加密產生獨立 random IV（12 bytes）；packed 格式為 `base64(iv ‖ tag ‖ ciphertext)`，認證標籤（auth tag）長度 16 bytes。
- 新增 Provider Adapter module（`apps/api/src/byok/providers/anthropic.ts`），實作 `validateAnthropicKey(plaintextKey): Promise<{ ok: true } | { ok: false, errorKey: string }>`：以最小 messages 請求（1 token output）對 Anthropic API 做一次 ping，5s timeout，並依 HTTP 狀態翻譯 errorKey：401 → `errors.byok.invalidKey`、402 → `errors.byok.outOfCredits`、429 → `errors.byok.rateLimited`、network / 5xx → `errors.byok.unreachable`。
- 新增 provider 抽象介面（`apps/api/src/byok/providers/types.ts`），定義 `ProviderAdapter` interface（`validateKey(plaintext)`），讓 M11.2 加 OpenAI / Google 時直接擴充而不改現有 caller。
- 新增 BYOK API endpoints 在 `apps/api/src/byok/routes.ts`，掛在 `/api/account/byok/*` 路徑（沿用 account 命名 namespace 但邏輯獨立）：
  - `GET /api/account/byok` — 回傳目前已設定的 provider 清單（不含 plaintext，只回 `{ provider, lastUsedAt, createdAt }`）。
  - `POST /api/account/byok/:provider` — 接 candidate key，先呼 Provider Adapter 驗證，**只在驗證成功時** encrypt + upsert（`(user_id, provider)` 衝突即覆蓋）。
  - `DELETE /api/account/byok/:provider` — 刪除該 user × provider 的 row。
- 三條 endpoint 在 `apps/api/src/lib/rate-limit-rules.ts` 同時加 rate-limit 規則：GET 60 次/分鐘 per session、POST 10 次/分鐘 per session（避免被當 oracle 撞別人 key）、DELETE 30 次/分鐘 per session；429 帶 `Retry-After`。
- 新增 zod validators（`apps/api/src/byok/byok-validator.ts`）：`provider` enum 目前只接受 `'anthropic'`（為 M11.2 預留 enum 擴張點），`apiKey` 為非空字串、最小長度 8、最大長度 512。
- API contract 型別在 `packages/shared/src/api-contract.ts` 新增 `BYOKProviderListResponse`、`BYOKSaveRequest`、`BYOKErrorResponse` 等 type；服務端錯誤一律以 `errorKey` 回傳，不送翻譯後字串。
- 新增前端 Settings → API Keys 頁面：`apps/web/src/account/ApiKeysPage.tsx`，包含 Anthropic row（key input、Save 按鈕、Delete 按鈕、儲存後顯示 masked 字串如 `sk-ant-••••••••XXXX`）；錯誤訊息全走 `t(errorKey)`。
- 新增前端 hook `apps/web/src/account/useApiKeys.ts`，封裝 TanStack Query 對 BYOK endpoints 的存取（list / save / delete），失敗時把 `errorKey` 丟給 UI。
- 在 `apps/web/src/router.tsx` 新增 protected route `/account/api-keys`，受既有 auth route guard 保護。
- 在 `packages/shared/locales/zh-TW.json` 與 `packages/shared/locales/en.json` 同步補齊 `account.apiKeys.*` 與 `errors.byok.*` 字串（兩語言同步、不接受任一語言落後）。
- 在 `apps/api/.env.example` 新增 `API_KEY_ENCRYPTION_KEY`（32-byte hex 範例值的「假」值 + 說明 `bunx --bun bun -e "console.log(crypto.randomBytes(32).toString('hex'))"` 怎麼產生）與 `ANTHROPIC_API_BASE_URL`（預設 `https://api.anthropic.com`，方便整合測試覆寫）。
- 加 unit tests（`apps/api/src/byok/vault.test.ts`、`apps/api/src/byok/providers/anthropic.test.ts`、`apps/api/src/byok/byok-validator.test.ts`）：vault encrypt/decrypt round-trip、IV uniqueness（同 plaintext 加密 100 次、IV / ciphertext 全部不同）、master key 長度錯誤時 vault 初始化即 throw、provider adapter 對每個 HTTP 狀態的 errorKey 翻譯、validator 對非法 provider / 過長 key 拒絕。
- 加 integration tests（`apps/api/src/byok/byok-routes.test.ts`）：跑真實 DB（test schema），驗證 401 from Anthropic 不會落 row、200 會落 row 且 `encrypted_key` 不等於 plaintext、DELETE 會移除 row、未登入 401。
- 加 component test（`apps/web/src/account/ApiKeysPage.test.tsx`）：mock useApiKeys，驗證輸入錯 key 時顯示 `errors.byok.invalidKey` 翻譯、儲存成功後顯示 masked 字串、Delete 按鈕呼叫 mutation。

## Capabilities

### New Capabilities

- `byok-keys`: BYOK（Bring Your Own Key）資料模型 + 加密 vault + provider validation adapter + Settings API endpoints + Settings UI（Anthropic-only 為第一個 tracer-bullet provider）；下一個 milestone（M11.2）將擴張同一 capability 加 OpenAI 與 Google。

### Modified Capabilities

(none — 此 change 新增獨立 capability，不修改任何既有 spec 的 requirements)

## Impact

- Affected specs:
  - New: `byok-keys`
- Affected code:
  - New:
    - packages/shared/src/db/byok-schema.ts
    - apps/api/drizzle/000X_add_api_keys.sql (drizzle-kit generated)
    - apps/api/src/byok/vault.ts
    - apps/api/src/byok/vault.test.ts
    - apps/api/src/byok/providers/types.ts
    - apps/api/src/byok/providers/anthropic.ts
    - apps/api/src/byok/providers/anthropic.test.ts
    - apps/api/src/byok/byok-validator.ts
    - apps/api/src/byok/byok-validator.test.ts
    - apps/api/src/byok/routes.ts
    - apps/api/src/byok/byok-routes.test.ts
    - apps/web/src/account/ApiKeysPage.tsx
    - apps/web/src/account/ApiKeysPage.test.tsx
    - apps/web/src/account/useApiKeys.ts
  - Modified:
    - apps/api/src/index.ts (mount /api/account/byok/* routes)
    - apps/api/src/lib/rate-limit-rules.ts (add three BYOK rules)
    - apps/api/.env.example (add API_KEY_ENCRYPTION_KEY, ANTHROPIC_API_BASE_URL)
    - packages/shared/src/api-contract.ts (add BYOK request / response types)
    - apps/web/src/router.tsx (add /account/api-keys route)
    - packages/shared/locales/zh-TW.json (add account.apiKeys.*, errors.byok.*)
    - packages/shared/locales/en.json (mirror)
  - Removed: (none)
- Affected dependencies:
  - 不新增 npm 套件 — AES-256-GCM 走 `node:crypto`（Bun 原生支援）；Anthropic 驗證 ping 用 fetch + 自寫請求，不裝 `@anthropic-ai/sdk`（避免 M11.2 還要再決定要不要扔掉）。
- Affected env vars:
  - New required: `API_KEY_ENCRYPTION_KEY`（32-byte hex；缺失或長度錯誤時 server 啟動失敗）。
  - New optional: `ANTHROPIC_API_BASE_URL`（預設 `https://api.anthropic.com`，整合測試可覆寫）。
