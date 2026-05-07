## 1. 前置：spec / design 對齊與 fixture 準備

- [x] 1.1 重讀 `openspec/changes/add-byok-multi-provider-and-pricing/proposal.md`、`design.md`、`specs/byok-keys/spec.md` 三份，確保實作時 spec naming 與 errorKey 命名同步
- [x] 1.2 在 `apps/api/src/byok/__fixtures__/` 下建立三家 vendor 的 stub responses（200 / 401 / 402 / 403 / 429 / 5xx / network error / timeout 樣本）讓三家 adapter 共用測試 fixture
- [x] 1.3 review M11.1 既有的 `anthropic.test.ts` 結構，確認新加的 openai / google test 沿用同樣的 fetch injection 與 timeout override pattern

## 2. Pricing catalog（packages/shared）— Tests First

- [x] 2.1 [P] 寫 failing test `packages/shared/src/byok-pricing.test.ts`：assert `BYOK_PRICING.length === 9`、三 provider 各 3 row、三 tier 各 3 row、所有 modelId 與 spec `BYOK pricing catalog as a static module` 表格對齊
- [x] 2.2 [P] 寫 failing test 覆蓋 `getPricingForModel("gpt-5-nano")` 回 catalog 對應 row、`getPricingForModel("not-a-model")` 回 undefined、`isKnownModel("not-a-model") === false`

## 3. Pricing catalog — Implementation — Decision: Pricing catalog as static module, single source of truth in `packages/shared/src/byok-pricing.ts`

- [x] 3.1 在 `packages/shared/src/byok-pricing.ts` 實作 `Tier`、`PricingRow`、`BYOK_PRICING` const、`getPricingForModel`、`isKnownModel`，依 design decision「Pricing catalog as static module, single source of truth in packages/shared/src/byok-pricing.ts」執行
- [x] 3.2 跑 `bun test packages/shared/src/byok-pricing.test.ts`，確保 2.1 / 2.2 全部 green

## 4. ProviderId union 擴張 — Tests First — Decision: ProviderId becomes a 3-element union, exhaustiveness via `Record<ProviderId, ProviderAdapter>`

- [x] 4.1 [P] 寫 failing TS-level test（或在 `byok-validator.test.ts` 增加 case）：assert `byokProviderParamSchema.safeParse('openai').success === true`、`google` 同理、`anthropic` 仍 true、`cohere` false
- [x] 4.2 [P] 寫 failing test `apps/api/src/byok/providers/index.test.ts`：assert `createProviderAdapters({})` 回傳的 record 同時包含 `anthropic` / `openai` / `google` 三個 key、type assertion 用 satisfies 觸發 compile-time check（驗證 design decision「ProviderId becomes a 3-element union, exhaustiveness via Record<ProviderId, ProviderAdapter>」）

## 5. ProviderId union 擴張 — Implementation

- [x] 5.1 編輯 `apps/api/src/byok/providers/types.ts` 把 `ProviderId` 從 `'anthropic'` 改為 `'anthropic' | 'openai' | 'google'`
- [x] 5.2 編輯 `apps/api/src/byok/byok-validator.ts` 把 `byokProviderParamSchema = z.enum(['anthropic'])` 改為 `z.enum(['anthropic', 'openai', 'google'])`
- [x] 5.3 跑 `bun run typecheck`，看哪些檔被 union 廣告效應觸發 — adapters table 的 Record 完備性會在 `index.ts` 處 fail（預期），此為 step 7 / 8 解決

## 6. OpenAI adapter — Tests First

- [x] 6.1 寫 failing test `apps/api/src/byok/providers/openai.test.ts` 覆蓋 OpenAI key validation via vendor ping requirement：happy path 200 → ok、401/402/429/5xx → 對應 errorKey、其它 4xx → unreachable、network error → unreachable、5s timeout → unreachable（用 `timeoutMs: 50` override + slow fetch stub）、`Authorization: Bearer <plaintext>` header 出現在 request、no `x-api-key` header、base URL override 透過 fetchImpl args 觀察

## 7. OpenAI adapter — Implementation — Decision: OpenAI adapter — Bearer auth, `/v1/chat/completions` ping with `gpt-5-nano`

- [x] 7.1 新增 `apps/api/src/byok/providers/openai.ts` 實作 `createOpenAIAdapter(baseUrl, fetchImpl, options?)`，依 design decision「OpenAI adapter — Bearer auth, /v1/chat/completions ping with gpt-5-nano」執行：POST `${baseUrl}/v1/chat/completions`、body `{ model: "gpt-5-nano", max_tokens: 1, messages: [...] }`、`Authorization: Bearer <plaintext>`、`AbortSignal.timeout(timeoutMs)`、status → errorKey 對應 spec ADDED 表
- [x] 7.2 跑 `bun test apps/api/src/byok/providers/openai.test.ts` 全 green

## 8. Google adapter — Tests First

- [x] 8.1 寫 failing test `apps/api/src/byok/providers/google.test.ts` 覆蓋 Google Gemini key validation via vendor ping requirement：happy path 200 → ok、400/401/403 → invalidKey、402 → outOfCredits、429 → rateLimited、5xx / network / timeout → unreachable、URL 含 `?key=<plaintext>` query param、no `Authorization` header、base URL override

## 9. Google adapter — Implementation — Decision: Google adapter — query-param auth, Gemini `models.list` ping

- [x] 9.1 新增 `apps/api/src/byok/providers/google.ts` 實作 `createGoogleAdapter(baseUrl, fetchImpl, options?)`，依 design decision「Google adapter — query-param auth, Gemini models.list ping」執行：GET `${baseUrl}/v1beta/models?key=<plaintext>`、`AbortSignal.timeout(timeoutMs)`、status → errorKey 對應 spec ADDED 表（含 400/403 都 → invalidKey 的特例）
- [x] 9.2 跑 `bun test apps/api/src/byok/providers/google.test.ts` 全 green

## 10. Adapter registry 擴張

- [x] 10.1 編輯 `apps/api/src/byok/providers/index.ts` 的 `createProviderAdapters()`：import `createOpenAIAdapter` / `createGoogleAdapter`，新增 `openaiBaseUrl`、`googleBaseUrl` options（讀 `OPENAI_API_BASE_URL` / `GOOGLE_API_BASE_URL`），於回傳 record 註冊三家 adapter；`Record<ProviderId, ProviderAdapter>` 完備（達成 Provider Adapter strategy interface 完備性）
- [x] 10.2 跑 4.2 的 index.test.ts 全 green
- [x] 10.3 編輯 `apps/api/.env.example` 加 `OPENAI_API_BASE_URL=https://api.openai.com`、`GOOGLE_API_BASE_URL=https://generativelanguage.googleapis.com` 兩行範例與註解，覆蓋 Provider validation base URLs configurable via environment requirement

## 11. user_ai_preferences DB schema — Tests First

- [x] 11.1 寫 failing test `packages/shared/src/db/byok-schema.test.ts`（既有檔擴張）：assert exported `userAiPreferences` table schema 含 `userId`（text、PK、FK to users.id ON DELETE CASCADE）、`preferredProvider` text notNull、`preferredModel` text notNull、`updatedAt` timestamp notNull defaultNow，覆蓋 Persist user default-model preference requirement

## 12. user_ai_preferences DB schema — Implementation — Decision: Persist preferences in `api_keys` table（不另開 user_ai_prefs table）

- [x] 12.1 編輯 `packages/shared/src/db/byok-schema.ts` 加 `userAiPreferences` Drizzle table，PK = `user_id`，依 design decision「Persist preferences in api_keys table（不另開 user_ai_prefs table）」修正版選擇執行（獨立 table、不觸碰 better-auth users table、不擴張既有 api_keys table）
- [x] 12.2 跑 `bunx drizzle-kit generate`，產出 `apps/api/drizzle/000X_add_user_ai_preferences.sql`
- [x] 12.3 review 產出的 SQL：CREATE TABLE 含 PK on user_id、FK ON DELETE CASCADE 對 users.id、columns 對齊 schema、無多餘 ALTER；commit migration file
- [x] 12.4 跑 11.1 schema test 全 green

## 13. byok-repo preferences CRUD — Tests First

- [x] 13.1 寫 failing integration test 在 `apps/api/src/byok/byok-routes.test.ts`（既有檔擴張）的 helper：`getPreferences(userId)` 對未設使用者回 null、`upsertPreferences(userId, provider, model)` insert + 第二次 update 同一 row（不變兩 row）、updatedAt 重整

## 14. byok-repo preferences CRUD — Implementation

- [x] 14.1 編輯 `apps/api/src/byok/byok-repo.ts` 加 `getPreferences(userId): Promise<{ provider, model, updatedAt } | null>` 與 `upsertPreferences(userId, provider, model): Promise<{ provider, model, updatedAt }>`（用 Drizzle `onConflictDoUpdate` 對 PK `user_id`），覆蓋 Persist user default-model preference requirement

## 15. preferences-validator zod schema — Tests First

- [x] 15.1 寫 failing test `apps/api/src/byok/preferences-validator.test.ts`：合法 `{provider:'anthropic', model:'claude-haiku-4-5'}` 通過、未知 provider 失敗、未知 model 失敗（透過 `isKnownModel` 串 pricing catalog）、缺欄位失敗、覆蓋 PATCH preferences endpoint validates against pricing catalog requirement 的非法 combo 拒絕邏輯

## 16. preferences-validator zod schema — Implementation

- [x] 16.1 新增 `apps/api/src/byok/preferences-validator.ts`：`byokPreferencesBodySchema = z.object({ provider: z.enum([...]), model: z.string().refine(isKnownModel) })`，import 從 `@vellum/shared/byok-pricing` 的 `isKnownModel`
- [x] 16.2 跑 15.1 test 全 green

## 17. PATCH preferences endpoint + GET response 擴張 — Tests First

- [x] 17.1 在 `apps/api/src/byok/byok-routes.test.ts` 加 PATCH 端點 integration test：合法 combo → 200 + 含 updatedAt、未知 model → 400 + `errors.byok.invalidPreference`、未知 provider → 400、未登入 → 401 + `errors.byok.notAuthenticated`、第 61 次/分鐘 → 429 + `Retry-After`，覆蓋 PATCH preferences endpoint validates against pricing catalog requirement
- [x] 17.2 在同檔加 GET 擴張 test：existing scenarios 仍綠、有設 preference 時回 `{data:{keys:[...], preferences:{provider,model,updatedAt}}}`、無設時回 `{data:{keys:[...], preferences:null}}`，覆蓋 List configured BYOK providers MODIFIED requirement
- [x] 17.3 在同檔擴張 POST scenario：`POST /api/account/byok/openai` 與 `POST /api/account/byok/google` 全程 happy path 與 401 / 402 / 429 path（mock 對應 vendor URL）、三 provider 互不干擾（saved anthropic 後 save openai 不動 anthropic row），覆蓋 Save BYOK provider key with validate-before-persist MODIFIED requirement

## 18. PATCH preferences endpoint + GET response 擴張 — Implementation — Decision: PATCH preferences endpoint, `GET /api/account/byok` extended to include preferences

- [x] 18.1 編輯 `apps/api/src/byok/routes.ts`：加 `PATCH /api/account/byok/preferences` handler — 套 `BYOK_PREFERENCE_RULE` rate limit、auth check、`byokPreferencesBodySchema.parse()`、`upsertPreferences()`、回 `{data:{provider,model,updatedAt}}`；錯誤統一回 `{error:{errorKey:'errors.byok.invalidPreference'}}`，依 design decision「PATCH preferences endpoint, GET /api/account/byok extended to include preferences」執行
- [x] 18.2 編輯同檔 GET handler：除既有 keys list 外平行 `getPreferences(userId)`，回傳 envelope 改為 `{data:{keys:[...], preferences: ... | null}}`
- [x] 18.3 跑 17.1 / 17.2 / 17.3 全 green

## 19. Rate limit BYOK_PREFERENCE_RULE — Tests First / Implementation — Decision: Rate limit BYOK_PREFERENCE_RULE — 60/分鐘 per session

- [x] 19.1 在 `apps/api/src/lib/rate-limit-rules.test.ts` 加 test：`BYOK_PREFERENCE_RULE.windowMs === 60_000` 與 `capacity === 60`，覆蓋 design decision「Rate limit BYOK_PREFERENCE_RULE — 60/分鐘 per session」
- [x] 19.2 在 `apps/api/src/lib/rate-limit-rules.ts` 新增 `export const BYOK_PREFERENCE_RULE: RateLimitRule = { bucketKeyPrefix: 'byok:pref', windowMs: 60_000, capacity: 60 }`
- [x] 19.3 跑 19.1 test 全 green，並確認 17.1 的 429 scenario 也 green（因 18.1 已套此規則）

## 20. shared API contract 型別擴張 — Tests First / Implementation

- [x] 20.1 [P] 在 `packages/shared/src/api-contract.test.ts` 加 type-level assertion：`BYOKListResponse.data.keys` 為 array、`.preferences` 為 nullable、`BYOKPreferencesPatchBody = {provider, model}`、ProviderId 為 3-element union；錯誤 envelope 不變
- [x] 20.2 [P] 編輯 `packages/shared/src/api-contract.ts` 加 / 改型別：`BYOKListResponse`、`BYOKPreferencesPatchBody`、`BYOKPreferencesResponse`、ProviderId 跟 server side 對齊（共用 type 從 server file re-export 或 shared file 定義均可）
- [x] 20.3 跑 20.1 test + `bun run typecheck` 全 green

## 21. i18n catalog 同步 — Tests First / Implementation — Decision: i18n key tree

- [x] 21.1 [P] 在 `packages/shared/src/locales/byok-i18n.test.ts`（既有 parity test）加 expected key list：新增 design decision「i18n key tree」中所有 keys（providers.openai.*、providers.google.*、pricing.*、defaultModel.*、errors.byok.invalidPreference），覆蓋 BYOK i18n catalog populated for both supported locales MODIFIED requirement
- [x] 21.2 [P] 編輯 `packages/shared/src/locales/zh-TW.json`：補齊 21.1 expected keys 的繁中翻譯（用 design 列出的 wording）
- [x] 21.3 [P] 編輯 `packages/shared/src/locales/en.json`：補齊同一組 keys 的英文翻譯
- [x] 21.4 跑 21.1 parity test，確保 zh-TW + en 完全對齊（兩 file key set 相同）

## 22. ApiKeyRow 抽 component — Tests First

- [x] 22.1 寫 failing component test `apps/web/src/account/ApiKeyRow.test.tsx`（新檔）：給定 `provider="openai"`、無 saved key → render input + disabled Save、按 type input 後 Save 啟用、按 Save 觸發 mutation；給定 saved 狀態 → render masked + Delete + Replace；錯誤回傳時 input 不清空且顯示 `t(errorKey)`，覆蓋 Settings API Keys page UI MODIFIED requirement 對所有 provider 一致行為

## 23. ApiKeyRow component — Implementation

- [x] 23.1 新增 `apps/web/src/account/ApiKeyRow.tsx`：抽出 M11.1 既有 ApiKeysPage 內的 row 邏輯成 props-driven `ApiKeyRow({ provider })`，所有顯示字串走 `t('account.apiKeys.providers.<provider>.{label,placeholder,helpUrl}')`
- [x] 23.2 跑 22.1 test 全 green

## 24. ApiKeysPricingTable component — Tests First / Implementation

- [x] 24.1 [P] 寫 failing test `apps/web/src/account/ApiKeysPricingTable.test.tsx`：render 後 9 row 出現、每 row 顯示 provider label / tier label（i18n）/ modelId / inputUsdPer1M / outputUsdPer1M / vendor link href 對齊 `BYOK_PRICING`，覆蓋 BYOK pricing catalog as a static module + Settings API Keys page UI requirement 中 pricing scenario
- [x] 24.2 新增 `apps/web/src/account/ApiKeysPricingTable.tsx`：從 `byok-pricing` import `BYOK_PRICING`，map 出 `<table>` JSX，header / tier 全走 `t('account.apiKeys.pricing.column.*')` / `t('account.apiKeys.pricing.tier.*')`
- [x] 24.3 跑 24.1 test 全 green

## 25. DefaultModelPicker component — Tests First / Implementation

- [x] 25.1 寫 failing test `apps/web/src/account/DefaultModelPicker.test.tsx`：給 `value=null` → render unset state（顯示 `t('account.apiKeys.defaultModel.unset')`）、給 `{provider:'openai', model:'gpt-5-mini'}` → 該 option 預選、選別 option 觸發 onChange callback、9 個 option 分組 by provider；覆蓋 Settings API Keys page UI MODIFIED requirement 中 default-model picker scenarios
- [x] 25.2 新增 `apps/web/src/account/DefaultModelPicker.tsx`：grouped select / native `<optgroup>`，options 從 `BYOK_PRICING` 推出（grouped by providerId、display 加 tier label + price summary）
- [x] 25.3 跑 25.1 test 全 green

## 26. useApiKeys hook 擴張 — Tests First / Implementation

- [x] 26.1 [P] 寫 failing test 在 `apps/web/src/account/useApiKeys.test.ts`（若無則新建）：`useApiKeysList()` 回傳的 data shape 為 `{keys, preferences}`、`useUpdatePreferences()` mutation 呼叫 PATCH、失敗時 error 含 errorKey
- [x] 26.2 [P] 編輯 `apps/web/src/account/useApiKeys.ts`：query response shape 改抓 `data.keys` / `data.preferences`、新加 `useUpdatePreferences()` mutation hook，依 design decision「PATCH preferences endpoint, GET /api/account/byok extended to include preferences」執行
- [x] 26.3 跑 26.1 test 全 green

## 27. ApiKeysPage 重構（資料驅動三 row + 嵌入 pricing + picker）— Decision: Settings UI — 資料驅動三 row + 嵌入定價表 + 底部 picker

- [x] 27.1 寫 failing test 擴張 `apps/web/src/account/ApiKeysPage.test.tsx`：mock `useApiKeysList` 回 `{keys:[], preferences:null}` → 頁面同時 render 三個 ApiKeyRow（anthropic/openai/google）、PricingTable、DefaultModelPicker；mock 不同 saved 組合 → 對應 row 切到 saved 狀態，其它仍 empty；preference picker 變更觸發 useUpdatePreferences；覆蓋 Settings API Keys page UI MODIFIED requirement 全部 scenarios
- [x] 27.2 編輯 `apps/web/src/account/ApiKeysPage.tsx`：用 `PROVIDERS = ['anthropic','openai','google'] as const` 常數陣列 map 出 `<ApiKeyRow provider={p} />`、底部嵌入 `<ApiKeysPricingTable />` 與 `<DefaultModelPicker value={preferences} onChange={mutate} />`，依 design decision「Settings UI — 資料驅動三 row + 嵌入定價表 + 底部 picker」執行
- [x] 27.3 跑 27.1 test 全 green
- [x] 27.4 [視覺預覽 — NOT TDD] 啟動本地 web dev server，於 `/account/api-keys` 視覺檢查三 row 對齊、pricing table 9 row 排版、picker grouping，依 CLAUDE.md「視覺走預覽迭代」規範請使用者拍板

## 28. Avatar menu 入口（補 M11.1 漏的 navigation）— Decision: 用 UserAvatarMenu 加 menu item，路由 `/account/api-keys` 已存在不動

- [x] 28.1 [P] 寫 failing test 在 `apps/web/src/components/UserAvatarMenu.test.tsx`：assert menu 開啟後含 `getByRole('menuitem', { name: t('nav.userMenu.apiKeys') })`，該 link `href === '/account/api-keys'`，順序排在 sessions 之後 / 分隔線之前，覆蓋 `User-menu entry for the API Keys page` requirement
- [x] 28.2 [P] 編輯 `packages/shared/src/locales/zh-TW.json` 加 `nav.userMenu.apiKeys: "API 金鑰"`、編輯 `packages/shared/src/locales/en.json` 加 `nav.userMenu.apiKeys: "API keys"`，覆蓋同一 requirement 中「兩支援 locale 都要有」條款
- [x] 28.3 編輯 `apps/web/src/components/UserAvatarMenu.tsx`：在現有 sessions menu item 後、分隔線之前，加 `<a href="/account/api-keys" role="menuitem" onClick={() => setOpen(false)}>{t("nav.userMenu.apiKeys")}</a>`，沿用既有 className 與 a11y attributes
- [x] 28.4 跑 `bun test apps/web/src/components/UserAvatarMenu.test.tsx` 全 green
- [x] 28.5 [視覺預覽 — NOT TDD] 從 dashboard 點頭像、看到 API 金鑰 / API keys menu item、點下去能進 `/account/api-keys` 頁面（搭配 27.4 同次預覽請使用者拍板）

## 29. 整合驗證

- [x] 29.1 跑 `bun test`（全 unit + integration），確保 M11.1 既有 test 與本 change 新增 test 全部 green
- [x] 29.2 跑 `bun run typecheck`，確保 ProviderId union 擴張未漏掉任何使用點（特別是 agent runtime 預埋的 client switch 點，目前無但 type 應已正確）
- [x] 29.3 跑 `bunx oxlint` + `bunx oxfmt --check`，修正任何 lint / format 問題
- [x] 29.4 跑 `bun test --coverage` 確認 `apps/api/src/byok/**` 與 `apps/web/src/account/**` 覆蓋率 ≥ 70%（CLAUDE.md target）；缺口靠補 unit test 補齊
- [x] 29.5 對照 `proposal.md` Impact 章節的 New / Modified 檔案清單，確認所有列出的檔案都已被建立 / 編輯 / 測試覆蓋；列出未動到的差異並核對 design 是否仍正確

## 30. Iteration: per-provider defaults + UI refactor

### 30a. Provider label cleanup
- [x] 30.1 改 `packages/shared/src/locales/{zh-TW,en}.json` 的 `account.apiKeys.providers.google.label` 從 `"Google Gemini"` 改為 `"Google"`，覆蓋使用者要求「Gemini 的廠商就是 Google，不用 Google Gemini」

### 30b. Schema 改成 per-provider 複合 PK
- [x] 30.2 改 `packages/shared/src/db/byok-schema.ts` 的 `userAiPreferences`：欄位 `preferred_provider` rename → `provider`、`preferred_model` rename → `model`，PK 從 `user_id` 改為複合 `(user_id, provider)`，覆蓋 `Persist user default-model preferences per provider` requirement
- [x] 30.3 改 `packages/shared/src/db/byok-schema.test.ts` 的 schema assertions：column 名換成 `provider` / `model`，PK 改為 `(user_id, provider)`
- [x] 30.4 跑 `bunx drizzle-kit generate`，產出 0005 migration（DROP 舊 PK、rename columns、ADD 新複合 PK）；review SQL，確認 ON DELETE CASCADE 保留、無多餘 ALTER；commit migration
- [x] 30.5 在本機 DB 跑 `bunx drizzle-kit migrate`（0004 是空表，0005 直接 ALTER 即可），驗證 schema 對齊

### 30c. Repo 改 record 形狀
- [x] 30.6 改 `apps/api/src/byok/routes.ts` 的 `ByokRepo` interface：`getPreferences(userId)` 回傳改為 `Promise<Partial<Record<ProviderId, { model, updatedAt }>>>`、`upsertPreferences(userId, provider, model)` 行為改為對 `(user_id, provider)` 複合 PK upsert
- [x] 30.7 改 `apps/api/src/byok/byok-repo.ts` 的實作：select 後組成 record；upsert 用 `onConflictDoUpdate` 對 `[userAiPreferences.userId, userAiPreferences.provider]`
- [x] 30.8 改 `apps/api/src/byok/byok-routes.test.ts` 的 in-memory repo + 13.1 contract tests：把 `prefRows` 操作改成 per-(user, provider) 複合 key；getPreferences 回 record；既有測試斷言全部對齊新 shape

### 30d. Endpoint GET response 改 record
- [x] 30.9 改 `apps/api/src/byok/routes.ts` 的 `handleList` + `preferencesToDto`：`preferences` 從單一 nullable object 改為 `Record<ProviderId, {provider, model, updatedAt}>`（empty `{}` 而非 null）。PATCH endpoint 不變
- [x] 30.10 改 `apps/api/src/byok/byok-routes.test.ts` 的 17.1/17.2/17.3 既有 PATCH/GET tests：preferences shape 改為 record；新增「兩家 provider 互不干擾」scenarios

### 30e. Shared API contract types
- [x] 30.11 改 `packages/shared/src/api-contract.ts`：把 `BYOKListResponse.data.preferences` 從 `BYOKPreferences | null` 改為 `Partial<Record<ProviderId, BYOKPreferences>>`；保留 `BYOKPreferences` 為 `{ provider, model, updatedAt }`（PATCH response 仍用此單筆 shape）
- [x] 30.12 改 `packages/shared/src/api-contract.test.ts` 的 type-level assertions 對齊新 shape

### 30f. Frontend hook
- [x] 30.13 改 `apps/web/src/account/useApiKeys.ts` 的 `ApiKeysListData.preferences` 為 `Partial<Record<ProviderId, BYOKPreferences>>`
- [x] 30.14 改 `apps/web/src/account/useApiKeys.test.ts` 對齊新 shape

### 30g. UI 改成 per-provider picker
- [x] 30.15 改 `apps/web/src/account/DefaultModelPicker.tsx`：API 改為 `value: BYOKPreferencesMap; onChange(provider, model)`；render 三個 provider 區塊，每塊用 segmented control / radio group 顯示三個 tier 選項
- [x] 30.16 改 `apps/web/src/account/DefaultModelPicker.test.tsx`：assert 三個獨立 picker、每個只露三 tier、改一個只觸發對應 provider 的 onChange
- [x] 30.17 改 `apps/web/src/account/ApiKeysPage.tsx`：把 `preferences` 從 nullable object 改為 record；把 picker 的 onChange wired 為 per-provider PATCH
- [x] 30.18 改 `apps/web/src/account/ApiKeysPage.test.tsx`：preferences shape mock 改為 record

### 30h. Pricing table 視覺重構
- [x] 30.19 改 `apps/web/src/account/ApiKeysPricingTable.test.tsx`：assert 三個 provider section header（label + vendor link 各一次）、每段三 tier rows、總共 9 row（無重複 provider 名）
- [x] 30.20 改 `apps/web/src/account/ApiKeysPricingTable.tsx`：改為 grouped layout — 每 provider 一個 `<section>` 含 header（provider label + vendor link）+ 內含 table（tier / model / input / output 四欄）

### 30i. Final integration
- [x] 30.21 跑 `bun test` 全套，確保 0 regression vs 上一輪 baseline
- [x] 30.22 跑 `bun run typecheck` clean
- [x] 30.23 跑 `bunx oxlint` + `bunx oxfmt --check` clean
- [x] 30.24 [視覺預覽 — NOT TDD] 開瀏覽器到 `/account/api-keys`，確認 (a) 三 row 沒重複 provider 名、(b) 三 picker 對應三 provider、(c) Google label 是 "Google" 不是 "Google Gemini"

## 31. Iteration: dropdown 整合進 ApiKeyRow

- [x] 31.1 改 `apps/web/src/account/ApiKeyRow.test.tsx`：新增 cases —
        (a) row 含一個 `<select>` dropdown，labelled `t('account.apiKeys.defaultModel.title')`、placeholder option = unset、3 個 tier options
        (b) `value.<provider>.model` 對應 option 預選；缺則 unset
        (c) 改 dropdown 選項觸發 PATCH preferences mutation 對應 provider；不影響其他 row
        覆蓋新 spec scenarios
- [x] 31.2 改 `apps/web/src/account/ApiKeyRow.tsx`：在 row 內加入 default-model dropdown，從 `useApiKeysList` 讀該 provider preference、用 `useUpdatePreferences` 寫；options 取自 `BYOK_PRICING` filter by providerId
- [x] 31.3 改 `apps/web/src/account/ApiKeysPage.tsx`：移除獨立 `DefaultModelPicker` 區塊（picker 已內嵌 row）
- [x] 31.4 改 `apps/web/src/account/ApiKeysPage.test.tsx`：移除 standalone picker 段相關斷言；改驗 row 內 dropdown PATCH 行為
- [x] 31.5 刪除（或精簡） `apps/web/src/account/DefaultModelPicker.tsx` + `DefaultModelPicker.test.tsx`，因為 picker 已不存在獨立版本
- [x] 31.6 跑 `bun test` 全套確保 0 regression、`bun run typecheck` clean、`bunx oxfmt --check` clean
- [x] 31.7 [視覺預覽] 確認 row 內 dropdown 排版自然、和 input/saved 狀態並排不擠
