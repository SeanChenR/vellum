## Summary

把 M11.1 lock 起來的 Anthropic-only BYOK pattern 擴張成「3 家 provider × 3 個 tier = 9 個 model」，並在同一個 Settings UI 加上靜態定價表（pricing table）以及「上次使用 (provider, model)」偏好持久化。同一輪 redesign / 一次 archive cycle，避免 Settings 頁兩次重排。

## Motivation

M11.1（已於 2026-05-06 archive）跑通了單一 provider 的端到端 tracer-bullet：DB schema、AES-256-GCM vault、ProviderAdapter 策略介面、validate-before-persist、Settings UI、i18n、tests 全部到位。下游 milestone 仰賴下面兩件事：

- M13.1（agent runtime）需要能拿到 OpenAI / Google 的 key 才能對應使用者選的 model 呼叫 LLM。
- M14.1（AI side panel）需要讀「使用者上次選的 (provider, model)」做 default selection，不然每次開 panel 都要重選。

兩個需求都圍繞同一個 Settings → API Keys 頁：再加 provider 要重排 row，再加 pricing table / preference picker 又要重排一次。一次做完比兩次重排合理；且 pricing 與 preference 在 3 家 provider 同時存在時才有意義。

PRD 對應：issue #2（PRD）User Stories #3（Settings 輸入 key）、#5（看定價表）、#7（記住上次 (provider, model)）。GitHub issue #5（M11.2）、issue #8（M11.3）合併處理。

## Proposed Solution

延伸（不是重寫）現有 `byok-keys` capability：

### 多 provider 擴張（M11.2 / issue #5）

- 把 `apps/api/src/byok/providers/types.ts` 的 `ProviderId` 從 `'anthropic'` 改成 `'anthropic' | 'openai' | 'google'`。三元 union 強制 `Record<ProviderId, ProviderAdapter>` 在 compile 期就要求三個 adapter 都註冊。
- 新增 `apps/api/src/byok/providers/openai.ts` — `createOpenAIAdapter(baseUrl, fetchImpl, options?)` 沿用 anthropic.ts 的 `createXxxAdapter` 工廠形狀。Validation ping 走 OpenAI `/v1/models` 或 `/v1/chat/completions` with `gpt-5-nano` + `max_tokens: 1`，5s timeout，401/402/429/5xx → 同一張 errorKey 表（invalidKey / outOfCredits / rateLimited / unreachable）。Header 用 `Authorization: Bearer <key>`。
- 新增 `apps/api/src/byok/providers/google.ts` — `createGoogleAdapter(baseUrl, fetchImpl, options?)`。Validation ping 走 Gemini `models.list` 或最小 `generateContent` with `gemini-2.5-flash-lite`。Auth 用 `?key=<plaintext>` query param（不是 header） — adapter 內部封掉這個差異。同一張 status → errorKey 表。
- 把 `apps/api/src/byok/providers/index.ts` 的 `createProviderAdapters()` 擴張成註冊三家；新增 `OPENAI_API_BASE_URL`、`GOOGLE_API_BASE_URL` 環境變數（同 Anthropic 用法，預設指向 vendor 真實 URL，integration test 可覆寫）。
- 把 `apps/api/src/byok/byok-validator.ts` 的 `byokProviderParamSchema` 從 `z.enum(['anthropic'])` 擴張成 `z.enum(['anthropic', 'openai', 'google'])`。
- Settings UI（`apps/web/src/account/ApiKeysPage.tsx`）重構成資料驅動：抽 `ApiKeyRow` 子 component（empty / saved 兩態 UX 不變），由 PROVIDERS 常數陣列 map 出三 row。每家 provider 的 label / placeholder / helpUrl 走 i18n key。
- i18n：新增 `account.apiKeys.providers.openai.{label,placeholder,helpUrl}` 與 `.google.{label,placeholder,helpUrl}` 在 zh-TW.json + en.json，同 PR 雙語齊備。helpUrl 指向各家 console（OpenAI: https://platform.openai.com/api-keys，Google: https://aistudio.google.com/apikey）。
- 測試：`openai.test.ts`、`google.test.ts` 鏡射 `anthropic.test.ts`（happy path / 401 / 402 / 429 / 5xx / network / timeout / base URL override）。`byok-routes.test.ts` 擴張覆蓋三 provider 的 dispatch 與獨立 save / list / delete。`ApiKeysPage.test.tsx` 擴張驗證三 row 在 empty + 部份儲存 + 全部儲存狀態下的 render。`byok-i18n.test.ts` parity 測試自動覆蓋新 key。

### 定價表 + 偏好持久化（M11.3 / issue #8）

- 新增 `packages/shared/src/byok-pricing.ts`：static pricing constants — 9 row 結構（providerId, modelId, tierKey, inputUsdPer1M, outputUsdPer1M, vendorPricingUrl）。single source of truth，未來 M13 / M14 可 import。
- 新增 `apps/web/src/account/ApiKeysPricingTable.tsx`：純展示 component，從 `byok-pricing.ts` 讀資料，渲染 9 row 表格（columns: Provider / Tier / Model ID / Input $/1M / Output $/1M / Pricing link）。tier 顯示走 i18n（`account.apiKeys.pricing.tier.flagship` 旗艦 / `.balanced` 平衡 / `.economy` 經濟）。表格嵌入 `ApiKeysPage.tsx`，置於三 row provider list 之下。NO 即時報價抓取 — 純靜態文字。
- 新增「Default model」picker：在 Settings 頁底部加一個 select / radio group，列 9 個 model（grouped by provider），單選；當前選擇從 server 拉、變更時 PATCH server。
- DB schema：在現有 `api_keys` table 加兩個 nullable 欄位 `last_used_provider text`、`last_used_model text`，**還是**另開 `user_ai_prefs` table — 留到 design 階段決定（M14.1 read query 哪種方便）。proposal 階段先 lock：方案存在、本 change 內決定、本 change 內 migrate。
- 新增 `PATCH /api/account/byok/preferences` endpoint：body `{ provider: ProviderId, model: string }`，驗 provider 在三元 enum 裡 + model 在 pricing table 的 9 個之中；通過 → 寫入；不通過 → 400 with errorKey。同時擴張 `GET /api/account/byok` response 帶上 `preferences: { provider, model } | null` 欄位（讓 UI 一次拉齊）。
- Rate limit：在 `apps/api/src/lib/rate-limit-rules.ts` 加 `BYOK_PREFERENCE_RULE`：60/分鐘 per session。
- Drizzle migration：drizzle-kit generate 產生 `apps/api/drizzle/000X_add_byok_preferences.sql`（具體編號由工具決定）。
- 測試：pricing table component test（9 row、vendor link 正確）、`byok-routes.test.ts` 加 PATCH preferences 端點（拒非法 combo、合法寫入、GET 回傳含 preferences）、ApiKeysPage 擴張驗證 picker render + 變更觸發 mutation。

### Cross-cutting

- M11.1 既有的 vault 介面、AES-GCM 格式、validate-before-persist 流程、`errors.byok.*` 錯誤 key 集合**完全不變**。本 change 只新增 / 擴張，不改既有契約。
- 三 ProviderId entry 進 union 後 TypeScript 強制 `Record<ProviderId, ProviderAdapter>` 完備性；adapters 表 / routes dispatch / test fixtures 任一處漏掉都是 compile error。
- 所有 vendor 連結與 pricing 數字是靜態字串：vendor 改連結或調價，只動 `byok-pricing.ts` / locale json，不動 validation logic。
- TDD：每個 implementation task 前面排 failing test task；component test 用 `bun test` 跑。

## Non-Goals

- 不做 agent runtime（M13.1，issue #9）— 本 change 不消費已存的 key。
- 不做 AI side panel（M14.1，issue #12）— 雖然 preference 是給 panel 讀的，但 panel 本身不在這個 change 範圍。
- 不做即時定價抓取 / API — pricing 是靜態文字，vendor pricing page 連結即足。
- 不做 model-level toggle 控制（例如「停用 gpt-5 但留 gpt-5-mini」）— preference 是「下次預設」不是「啟用清單」。
- 不裝 `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` SDK — 三家都自寫 fetch ping，避免 M13.1 之後又要拔。
- 不做 key rotation 自動排程或過期通知 — 沿用 M11.1 立場。
- 不做 BYOK 的 Phase 2 deploy 強化（KMS、master key rotation 等）— 沿用 M11.1 deploy checklist 條目。

## Alternatives Considered

- **拆兩個 change（M11.2 先、M11.3 後）**：兩次 redesign Settings 頁、兩個 PR 、兩次 archive。Settings 頁面在使用者眼中是一個畫面，連續變兩次體驗不對。一次做完更乾淨。
- **Pricing 改用第三方 API 拉即時報價**：vendor pricing 頁面格式 / 賬單模型差異大，且 phase 1 owner 自用，靜態值已足；維護成本由 owner 直接編輯文字檔即可，不需要打 vendor。
- **把 preference 放在純 client localStorage**：跨裝置 / 重灌 / 多 session 就遺失，PRD US #7 明確說「系統記得」。需要 server 端持久化。

## Impact

- Affected specs:
  - Modified: `byok-keys` （現有 capability，加 OpenAI / Google adapter requirement、加 pricing table requirement、加 preference 端點 requirement、擴張 i18n catalog requirement、擴張 Settings UI requirement、擴張 validator requirement；現有 Anthropic-only 的 requirement 內容不刪除，僅補足 / 平行擴張）。本 change 同時新增「User-menu entry for the API Keys page」requirement，補上 M11.1 漏的 navigation 入口。
- Affected code:
  - New:
    - apps/api/src/byok/providers/openai.ts
    - apps/api/src/byok/providers/openai.test.ts
    - apps/api/src/byok/providers/google.ts
    - apps/api/src/byok/providers/google.test.ts
    - apps/api/src/byok/preferences-validator.ts
    - apps/api/src/byok/preferences-validator.test.ts
    - apps/web/src/account/ApiKeyRow.tsx
    - apps/web/src/account/ApiKeysPricingTable.tsx
    - apps/web/src/account/ApiKeysPricingTable.test.tsx
    - apps/web/src/account/DefaultModelPicker.tsx
    - apps/web/src/account/DefaultModelPicker.test.tsx
    - packages/shared/src/byok-pricing.ts
    - packages/shared/src/byok-pricing.test.ts
    - apps/api/drizzle/000X_add_byok_preferences.sql （drizzle-kit generated）
  - Modified:
    - apps/api/src/byok/providers/types.ts （ProviderId union 擴張）
    - apps/api/src/byok/providers/index.ts （三 adapter 註冊 + base URL options）
    - apps/api/src/byok/byok-validator.ts （provider enum 擴張）
    - apps/api/src/byok/routes.ts （新 PATCH preferences、GET 回傳擴張）
    - apps/api/src/byok/byok-repo.ts （preferences read / write）
    - apps/api/src/byok/byok-routes.test.ts （多 provider + preferences）
    - apps/api/src/lib/rate-limit-rules.ts （BYOK_PREFERENCE_RULE）
    - apps/api/src/lib/rate-limit-rules.test.ts
    - apps/api/.env.example （OPENAI_API_BASE_URL、GOOGLE_API_BASE_URL）
    - apps/web/src/account/ApiKeysPage.tsx （資料驅動三 row + 嵌入 pricing table + picker）
    - apps/web/src/account/ApiKeysPage.test.tsx
    - apps/web/src/account/useApiKeys.ts （新 preferences query / mutation）
    - apps/web/src/components/UserAvatarMenu.tsx （新增 API Keys menu item，作為 /account/api-keys 入口）
    - apps/web/src/components/UserAvatarMenu.test.tsx （驗證 menu item 連到 /account/api-keys）
    - packages/shared/src/api-contract.ts （preferences request / response 型別擴張、provider list 型別擴張）
    - packages/shared/src/api-contract.test.ts
    - packages/shared/src/db/byok-schema.ts （加 last_used_provider / last_used_model 欄位 — 或新建 user_ai_prefs，design 決定）
    - packages/shared/src/db/byok-schema.test.ts
    - packages/shared/src/locales/zh-TW.json （openai / google provider keys、pricing tier keys、defaultModel picker keys、`nav.userMenu.apiKeys`）
    - packages/shared/src/locales/en.json （mirror）
    - packages/shared/src/locales/byok-i18n.test.ts （parity 自動覆蓋）
- Affected dependencies:
  - 不新增 npm 套件 — OpenAI / Google validation ping 用原生 fetch；pricing 是純資料；preference 走 Drizzle / zod / TanStack Query 既有 stack。
- Affected env vars:
  - New optional: `OPENAI_API_BASE_URL`（預設 `https://api.openai.com`）、`GOOGLE_API_BASE_URL`（預設 `https://generativelanguage.googleapis.com`）。沿用 ANTHROPIC_API_BASE_URL pattern。
