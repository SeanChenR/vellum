## 1. Schema and migration — Decision: api_keys schema uses `text` user_id (not uuid) to align with better-auth

- [x] 1.1 [P] 在 `packages/shared/src/db/byok-schema.ts` 新增 Drizzle table `apiKeys`（complies with **Encrypted storage of provider API keys** requirement）：欄位 `userId text → users.id ON DELETE CASCADE`、`provider text`、`encryptedKey text`、`createdAt timestamptz default NOW()`、`lastUsedAt timestamptz nullable`；複合 PK on `(userId, provider)`。export `ApiKey` type（`typeof apiKeys.$inferSelect`）。
- [x] 1.2 在 `packages/shared/src/db/index.ts` 加上 `export * from './byok-schema'`（如該檔案存在；否則改 import 點）。
- [x] 1.3 跑 `bunx drizzle-kit generate` 產出 `apps/api/drizzle/000X_<slug>.sql`；review SQL 確認 PK / FK / cascade 正確。
- [x] 1.4 寫 schema 單元測試（`packages/shared/src/db/byok-schema.test.ts`）：`apiKeys.$inferSelect` 與 `$inferInsert` 型別存在、必要欄位列表正確（用 `Object.keys(apiKeys)` 比對）。

## 2. Vault — Tests First — Decision: AES-256-GCM via node:crypto, packed as base64(iv ‖ tag ‖ ciphertext)

- [x] 2.1 [P] 寫失敗測試 `apps/api/src/byok/vault.test.ts`：`encryptApiKey` + `decryptApiKey` round-trip 對任意 plaintext byte-for-byte 相等（complies with **AES-256-GCM API Key Vault** requirement）。
- [x] 2.2 [P] 寫失敗測試：同 plaintext 加密 100 次，packed string 集合 cardinality === 100 且 IV 段全唯一（IV uniqueness scenario）。
- [x] 2.3 [P] 寫失敗測試：tampered ciphertext（修改 packed 中 ciphertext 段任一 byte 後）`decryptApiKey` throw。
- [x] 2.4 [P] 寫失敗測試：vault 初始化（`initVault`）在 `API_KEY_ENCRYPTION_KEY` 未設、非 hex、長度非 32 byte 時 throw（complies with **Master key sourced from environment with startup validation** requirement）；用 dependency-injection 把 env 值傳入而非直接讀 `Bun.env`，這樣測試可注入。

## 3. Vault — Implementation — Decision: Master key from `Bun.env.API_KEY_ENCRYPTION_KEY`, fail-fast on startup

- [x] 3.1 在 `apps/api/src/byok/vault.ts` 實作 `initVault(envValue: string | undefined): { encryptApiKey, decryptApiKey }`：驗 `envValue` 為 64-char hex、`Buffer.from(envValue, 'hex').length === 32`；不過 throw `Error('API_KEY_ENCRYPTION_KEY is required and must be 32 bytes hex')`。
- [x] 3.2 實作 `encryptApiKey(plaintext)`：`crypto.randomBytes(12)` 為 IV、`createCipheriv('aes-256-gcm', key, iv)`、`final` 後拿 `getAuthTag()`；packed = `Buffer.concat([iv, tag, ct]).toString('base64')`。
- [x] 3.3 實作 `decryptApiKey(packed)`：`Buffer.from(packed, 'base64')` 切 `[0..12)` IV、`[12..28)` tag、`[28..)` ct；`createDecipheriv` + `setAuthTag` + `final`；錯誤路徑 throw。
- [x] 3.4 在 `apps/api/src/index.ts` 啟動流程（top-level）呼叫 `initVault(Bun.env.API_KEY_ENCRYPTION_KEY)`，把回傳的 vault instance 注入 routes / DI container；缺失 / 錯誤時 server fail-fast。
- [x] 3.5 跑 `bun test apps/api/src/byok/vault.test.ts` — 全綠。

## 4. Provider Adapter — Tests First — Decision: ProviderAdapter strategy interface; one file per provider

- [x] 4.1 [P] 寫失敗測試 `apps/api/src/byok/providers/anthropic.test.ts`：mock `fetch`，驗 200 → `{ ok: true }`（complies with **Anthropic key validation via vendor ping** requirement）。
- [x] 4.2 [P] 寫表格測試對 401 / 402 / 429 / 500 / 503 / 400（other 4xx）/ network error 各對應 errorKey（`errors.byok.invalidKey` / `outOfCredits` / `rateLimited` / `unreachable` ×3）。
- [x] 4.3 [P] 寫失敗測試：fetch 5 秒沒回應 → AbortSignal 觸發、回 `errors.byok.unreachable`（用 fake timer 或 mock fetch resolve 在 6s）。
- [x] 4.4 [P] 寫失敗測試：driver 用 `ANTHROPIC_API_BASE_URL` 環境變數覆寫 vendor URL（用 dependency-injection / module factory，不直接讀 process env）。

## 5. Provider Adapter — Implementation — Decision: Anthropic validation ping uses minimal messages request, 5s timeout

- [x] 5.1 在 `apps/api/src/byok/providers/types.ts` 定義 `ProviderId = 'anthropic'`、`ProviderAdapter` interface（complies with **Provider Adapter strategy interface** requirement）。
- [x] 5.2 在 `apps/api/src/byok/providers/anthropic.ts` 實作 `createAnthropicAdapter(baseUrl, fetchImpl)` factory，回傳 `ProviderAdapter`；`validateKey` 發 POST `${baseUrl}/v1/messages`、headers `x-api-key` + `anthropic-version: 2023-06-01`、body `{model: 'claude-haiku-4-5', max_tokens: 1, messages: [{role: 'user', content: 'hi'}]}`、`AbortSignal.timeout(5000)`。
- [x] 5.3 實作 status → errorKey mapping 表（per spec scenario）。
- [x] 5.4 在 `apps/api/src/byok/providers/index.ts` 組合 `adapters: Record<ProviderId, ProviderAdapter>`，從 env 讀 `ANTHROPIC_API_BASE_URL`（預設 `https://api.anthropic.com`）。
- [x] 5.5 跑 `bun test apps/api/src/byok/providers/anthropic.test.ts` — 全綠。

## 6. Validators and API contract types

- [x] 6.1 [P] 寫失敗測試 `apps/api/src/byok/byok-validator.test.ts`：zod schema 對 `apiKey` 空字串、< 8 字元、> 512 字元、非字串拒絕；`provider` enum 限 `'anthropic'`。
- [x] 6.2 在 `apps/api/src/byok/byok-validator.ts` 實作 `byokSaveBodySchema`（zod object `{ apiKey: string min 8 max 512 }`）與 `byokProviderParamSchema`。
- [x] 6.3 在 `packages/shared/src/api-contract.ts` 新增 `BYOKProviderListItem`、`BYOKProviderListResponse`、`BYOKSaveRequest`、`BYOKSaveResponse`、`BYOKErrorResponse` 型別（complies with **Server returns errorKey, never translated text** requirement — 確保 `BYOKErrorResponse` 為 `{ error: { errorKey: string } }`）。
- [x] 6.4 在 `packages/shared/src/api-contract.test.ts` 加上 BYOK type 結構斷言。

## 7. Routes — Tests First — Decision: Validate-before-persist with single transaction window

- [x] 7.1 [P] 寫整合測試 `apps/api/src/byok/byok-routes.test.ts`：spin up test server + test DB（沿用既有 account routes 測試的 helper）；fixture：建立 user + session。
- [x] 7.2 [P] 寫失敗測試：`GET /api/account/byok` 未登入 → 401 + `errors.byok.notAuthenticated`（complies with **List configured BYOK providers** requirement）。
- [x] 7.3 [P] 寫失敗測試：`GET` 已登入 + 無 row → 200 `{ data: [] }`；已登入 + 一筆 anthropic row → 200 `{ data: [{ provider: 'anthropic', createdAt, lastUsedAt: null }] }`，response 不含 `encryptedKey`。
- [x] 7.4 [P] 寫失敗測試：`POST /api/account/byok/anthropic` 已登入 + adapter mock 回 `{ ok: false, errorKey: 'errors.byok.invalidKey' }` → 400、DB row count 不變（complies with **Save BYOK provider key with validate-before-persist** requirement — 驗證失敗就不落 DB）。
- [x] 7.5 [P] 寫失敗測試：`POST` 成功路徑 → adapter mock `{ ok: true }` → DB 出現一筆 row、`encrypted_key !== plaintext`、回 200 `{ data: { provider, createdAt } }`。
- [x] 7.6 [P] 寫失敗測試：`POST` 第二次（同 user 同 provider）→ row 數仍為 1（upsert）、`encrypted_key` 變成新 ciphertext、`createdAt` 更新。
- [x] 7.7 [P] 寫失敗測試：`POST` body 缺 apiKey / 過短 / 過長 → 400、adapter 從未被呼叫。
- [x] 7.8 [P] 寫失敗測試：`DELETE /api/account/byok/anthropic` 有 row → 204、row 移除（complies with **Delete BYOK provider key** requirement）；無 row → 仍 204（idempotent）。
- [x] 7.9 [P] 寫失敗測試：`DELETE` 跨 user 隔離 — user A 的 DELETE 不影響 user B 的 row。
- [x] 7.10 [P] 寫失敗測試：unknown provider（path param 不在 enum 中）→ 400 + `errors.byok.providerUnknown`，adapter 從未被查找。

## 8. Routes — Implementation

- [x] 8.1 在 `apps/api/src/byok/routes.ts` 實作 `mountByokRoutes(app, deps)`：依賴注入 `vault`、`adapters`、`db`；handlers 使用 `byokSaveBodySchema` 驗 body、`adapters[provider]` 查 adapter、validate-before-persist 流程。
- [x] 8.2 實作 GET handler — query `select { provider, createdAt, lastUsedAt } from api_keys where user_id = session.userId`。
- [x] 8.3 實作 POST handler — 流程：(1) zod validate body；(2) `adapters[provider].validateKey(plaintext)`；(3) `ok: false` → 400 `{ error: { errorKey } }`；(4) `ok: true` → `vault.encryptApiKey(plaintext)` → Drizzle `insert ... onConflictDoUpdate({ target: [userId, provider], set: { encryptedKey, createdAt: sql\`NOW()\` } })`；(5) 回 200。
- [x] 8.4 實作 DELETE handler — Drizzle `delete from api_keys where user_id = session.userId and provider = :provider`；總是回 204。
- [x] 8.5 在 `apps/api/src/index.ts` 把 `/api/account/byok/*` route 掛上（用同一個 vault + adapters instance）。
- [x] 8.6 跑 `bun test apps/api/src/byok/byok-routes.test.ts` — 全綠。

## 9. Rate limits — Decision: Rate limits — 60 / 10 / 30 per minute per session for GET / POST / DELETE

- [x] 9.1 [P] 寫失敗測試 `apps/api/src/lib/rate-limit-rules.test.ts`：新增 BYOK rules 在 lookup 中可被找到（key prefix `byok:list`、`byok:save`、`byok:delete`）、limits 為 60 / 10 / 30。
- [x] 9.2 在 `apps/api/src/lib/rate-limit-rules.ts` 加上三條 BYOK rules（per-session bucket，用 userId 當 key suffix）。
- [x] 9.3 在 routes 層串接 rate limiter：每個 handler 進入時 `rateLimiter.check(rule, userId)`；超過時 res 429 + `Retry-After` header（秒數，向上取整）。
- [x] 9.4 [P] 寫整合測試：第 11 次 POST 在同分鐘內 → 429 + `Retry-After`、adapter 沒被呼叫；第 61 次 GET / 第 31 次 DELETE 同樣。

## 10. i18n — Decision: i18n keys — `account.apiKeys.*` for UI, `errors.byok.*` for errors

- [x] 10.1 [P] 在 `packages/shared/locales/en.json` 加入 `errors.byok.*`（invalidKey / outOfCredits / rateLimited / unreachable / providerUnknown / notAuthenticated）與 `account.apiKeys.*`（title / subtitle / providers.anthropic.{label,placeholder,helpUrl} / actions.{save,delete,replace} / status.{saving,saved} / confirm.{deleteTitle,deleteBody}）— complies with **BYOK i18n catalog populated for both supported locales** requirement。
- [x] 10.2 [P] 在 `packages/shared/locales/zh-TW.json` 加入相同 key tree 的繁體中文翻譯（兩 file 同 PR、零落差）。
- [x] 10.3 [P] 寫失敗測試 `packages/shared/locales/byok-i18n.test.ts`：對比 `errors.byok` 與 `account.apiKeys` 兩 subtree 在 zh-TW.json 與 en.json 的 key 集合相等（用既有 i18n-audit pattern）。
- [x] 10.4 跑 `bun test packages/shared/locales/byok-i18n.test.ts` — 全綠。

## 11. Frontend — Tests First — Decision: Settings UI — single Anthropic row, masked-when-stored, key never re-fetched

- [x] 11.1 [P] 寫失敗 component test `apps/web/src/account/ApiKeysPage.test.tsx`：用 `useApiKeys` mock 回 `{ keys: [], isLoading: false }`，渲染後 input 為 password type、Save button disabled、placeholder 等於 i18n value（complies with **Settings API Keys page UI** requirement）。
- [x] 11.2 [P] 寫失敗測試：useApiKeys.list 回 `[{ provider: 'anthropic', createdAt, lastUsedAt: null }]` → row 顯示 masked indicator、Delete + Replace buttons 出現。
- [x] 11.3 [P] 寫失敗測試：mutation 失敗 errorKey `'errors.byok.invalidKey'` → 訊息渲染為對應 i18n 翻譯、input value 不被清空。
- [x] 11.4 [P] 寫失敗測試：mutation 成功 → row 進入 saved state（masked 顯示）。
- [x] 11.5 [P] 寫失敗測試：Delete confirm + 204 → row 回到 empty state（input + disabled Save）。
- [x] 11.6 [P] 寫失敗測試：route guard — 未登入訪問 `/account/api-keys` → redirect `/login`。

## 12. Frontend — Implementation

- [x] 12.1 在 `apps/web/src/account/useApiKeys.ts` 實作 TanStack Query hooks：`useApiKeysList()`、`useSaveApiKey()`、`useDeleteApiKey()`；錯誤從 response `error.errorKey` 抽出來。
- [x] 12.2 在 `apps/web/src/account/ApiKeysPage.tsx` 實作頁面：shadcn `Card` 包單一 row、`Input type="password"` + `Button` Save、masked state（前端記下最後 4 字元到 sessionStorage / Zustand client store；重整後只剩 dots）、Delete + Replace、shadcn `AlertDialog` 確認 Delete；所有字串走 `t('account.apiKeys.*')`。
- [x] 12.3 在 `apps/web/src/router.tsx` 註冊 `/account/api-keys` route，用既有 RouteGuard 包裝。
- [x] 12.4 跑 `bun test apps/web/src/account/ApiKeysPage.test.tsx` — 全綠。

## 13. Env wiring and docs

- [x] 13.1 在 `apps/api/.env.example` 加上 `API_KEY_ENCRYPTION_KEY=<64-char-hex-placeholder>` 並附產生指令註解（`bun -e "console.log(crypto.randomBytes(32).toString('hex'))"`）。
- [x] 13.2 在 `apps/api/.env.example` 加上 `ANTHROPIC_API_BASE_URL=https://api.anthropic.com`。
- [x] 13.3 在 README 或 docs 既有 env 表（如有）補一行說明 BYOK env 用途；若無此檔則跳過、不創新檔。

## 14. Refactor and verification

- [x] 14.1 跑全 suite：`bun test`、`bun run typecheck`、`bunx oxlint`、`bunx oxfmt --check`，全綠。
- [x] 14.2 review code，把 vault / provider adapter / routes 三層的 deep module 邊界檢查一次：caller 不應該 import `node:crypto`、不應該知道 IV 長度、不應該硬編 anthropic URL。
- [x] 14.3 手動驗收 — 在 dev server 上實際輸入錯 key（看翻譯訊息）、輸入對 key（看 saved 狀態）、Delete（看回 empty 狀態）；同時開 DB 驗 row 進出與 `encrypted_key` 不等於 plaintext。
- [x] 14.4 跑 `spectra analyze add-byok-anthropic --json` 與 `spectra validate add-byok-anthropic`，確認沒有 critical / warning。
