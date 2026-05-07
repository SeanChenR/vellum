## Context

M11.1（`add-byok-anthropic`，2026-05-06 archive）做完了單一 provider 的端到端 tracer-bullet：建好 `api_keys` table（PK `(user_id, provider)`、`encrypted_key` 欄位、`last_used_at` 預留欄位但不寫入）、AES-256-GCM vault（`apps/api/src/byok/vault.ts`）、ProviderAdapter strategy 介面（`apps/api/src/byok/providers/types.ts`，`ProviderId = 'anthropic'`）、validate-before-persist 流程、Settings → API Keys 頁（`apps/web/src/account/ApiKeysPage.tsx`）、`account.apiKeys.*` + `errors.byok.*` i18n catalog、unit + integration + component tests。

本 change 在這套已驗證的腳手架上做兩件事：(a) 把 `ProviderId` 從 `'anthropic'` 擴成 `'anthropic' | 'openai' | 'google'`，加 OpenAI / Google adapter；(b) 加靜態定價表 + 「上次使用 (provider, model)」偏好持久化。兩件事共享 Settings 頁，所以 redesign 一次到位。

下游 dependencies：

- M13.1（agent runtime，issue #9）拿 `ProviderId` enum + decryptApiKey() 直接呼 LLM，所以 ProviderId 的 union 一旦定下，agent runtime 的 type-level dispatch 就跟著鎖。
- M14.1（AI side panel，issue #12）透過 `GET /api/account/byok` 拉「使用者已設哪些 provider」+「上次選的 (provider, model)」當開啟時的 default。預設 read shape 在這 change 鎖定。

可重用的既有 deep modules：

- `apps/api/src/byok/vault.ts` — 加密 / 解密 API。本 change **不動內容**，三家 provider 共用同一格式。
- `apps/api/src/byok/byok-repo.ts` — DB CRUD wrapper。本 change 擴張一個 `getPreferences(userId)` / `setPreferences(userId, provider, model)` 方法。
- `apps/api/src/byok/providers/types.ts` — ProviderAdapter interface。本 change 擴張 ProviderId union。
- `apps/api/src/byok/providers/index.ts` — adapter registry。擴張到三家。
- `apps/api/src/lib/rate-limiter.ts` — 加新規則 `BYOK_PREFERENCE_RULE`。
- `packages/shared/src/api-contract.ts` — type 中央集合。擴張新型別。
- `apps/web/src/account/useApiKeys.ts` — TanStack Query hooks。擴張 preferences query / mutation。

新加的 deep modules（封裝強、介面窄）：

- **OpenAI ProviderAdapter**（`apps/api/src/byok/providers/openai.ts`）— input: plaintext key；output: ValidationResult。封掉 Bearer auth、`/v1/models` 或 `/v1/chat/completions` 選擇、status → errorKey 翻譯。
- **Google ProviderAdapter**（`apps/api/src/byok/providers/google.ts`）— 一樣封 query-param auth（`?key=<plaintext>`）、Gemini API 路徑、status → errorKey。
- **BYOK Pricing Catalog**（`packages/shared/src/byok-pricing.ts`）— input: ProviderId / 全表查詢；output: pricing rows。封住「9 個 (provider, tier, modelId, input$, output$, vendorPricingUrl)」的 single source of truth。
- **Default Model Picker**（`apps/web/src/account/DefaultModelPicker.tsx`）— input: `{ value: { provider, model } | null, onChange }`；output: UI element。封住三層分組（provider → tier → model）以及 model id 對應。

Shallow glue（不算 deep）：`ApiKeysPricingTable.tsx`（純資料 → JSX）、`ApiKeyRow.tsx`（從 ApiKeysPage 抽出來的 row component，按 provider props 渲染同一互動邏輯）、`preferences-validator.ts`（zod 對 `{provider, model}` validation，依靠 pricing catalog 做 model 合法性判斷）。

## Goals / Non-Goals

**Goals:**

- 三家 provider 完整 CRUD：使用者可以分別 save / replace / delete Anthropic / OpenAI / Google 的 key，互不干擾，UI 三 row 平行存在。
- `ProviderId = 'anthropic' | 'openai' | 'google'` 定下 → TypeScript 強制三 adapter 全註冊（`Record<ProviderId, ProviderAdapter>`）。
- 每家 provider 的 validation ping 用最便宜的 tier、5s timeout、回 `{ ok: true | false, errorKey }` 與 M11.1 同一張 errorKey 表。
- Settings 頁加靜態 9 row 定價表（3 provider × 3 tier），含 input / output $/1M tokens、tier 分級（旗艦 / 平衡 / 經濟）、各 row 連到 vendor pricing page。pricing 是純文字、不跟 vendor API 拉。
- 使用者選的 (provider, model) 持久化：UI 一個 picker、API 一條 PATCH endpoint、DB 一個 schema 變更。重整 / 跨 session 保留；M14.1 開 panel 時讀此設定。
- 既有 M11.1 的 contract（vault 介面、加密格式、validate-before-persist、anthropic adapter、`errors.byok.*` keys、Settings UI 互動規約、現有 rate limit）**完全保留**，本 change 純擴張不刪改。
- TDD：每個 implementation 之前先寫 failing test，覆蓋三家 adapter、preferences 端點、pricing component、picker component。Coverage 目標 70%（per CLAUDE.md）。
- i18n：所有新 UI 字串走 `t('key')`，zh-TW.json + en.json 同一 PR 補齊；`byok-i18n.test.ts` parity 測試自動覆蓋。

**Non-Goals:**

- 不做 agent runtime（M13.1）— 不消費已存的 key，本 change 只到「key 已存好、preference 已設好」。
- 不做 AI side panel（M14.1）— 雖然 preference 設計為了 panel 而存在，但 panel UI / panel 讀邏輯在另一個 milestone。
- 不做 model-level enable/disable toggle — preference 是「下次預設」，不是「可用清單」。9 個 model 都隨對應 provider key 是否設定而成為可選。
- 不做即時 vendor pricing API 抓取 — 純靜態文字。
- 不裝任一家 vendor SDK（`@anthropic-ai/sdk` / `openai` / `@google/generative-ai`）— 三家都自寫 fetch ping，沿用 M11.1 立場（避免 M13.1 又要拔）。
- 不做 worktree 內的 e2e Playwright 測試 — component test + integration test 已可覆蓋本 change 風險面（沿用 M11.1 立場）。
- 不做 BYOK 的 deploy 強化（KMS、master key rotation 等）— phase 1 local-only 沿用 M11.1 deploy checklist 條目。

## Decisions

### Decision: ProviderId becomes a 3-element union, exhaustiveness via `Record<ProviderId, ProviderAdapter>`

**Choice:** 把 `apps/api/src/byok/providers/types.ts` 的 `ProviderId` 從 `'anthropic'` 改成 `'anthropic' | 'openai' | 'google'`。`createProviderAdapters()` 的回傳型別 `Record<ProviderId, ProviderAdapter>` 強制三家都要註冊；缺一個就是 compile error。

**Rationale:**

- TypeScript 的 `Record<UnionLiteral, V>` 在 union 是 literal type 時是 exhaustive — 漏一個 key 會在 compile 期被 catch，比 runtime check 早。
- M11.1 design 已經明文標註 `ProviderId` 是擴張點：「M11.2 will extend `ProviderId` to include `'openai' | 'google'`」。本 change 兌現該擴張。
- 後續 M13 / M14 在 client / server 都需要對 ProviderId 做 dispatch（picker grouping、agent runtime 切 client）；用 literal union 而不是 string 是正確的 type-level 防呆。
- 每家 provider 一個 file（`anthropic.ts` / `openai.ts` / `google.ts`）符合 M11.1 立下的 strategy pattern；`index.ts` 的 registry 多兩行，`routes.ts` 完全不動。

**Alternatives considered:**

- 動態 plugin loader（讀 `providers/` 資料夾自動註冊）— 過度工程，3 家 provider 不需要。
- 把 ProviderId 開放成 `string`（runtime 驗 enum）— 失去 compile-time 完備性，所有依賴 `ProviderId` 的 type 都退化。
- 把 OpenAI / Google adapter 寫進同一個 file — 違反 M11.1 立下的「每家一個 file」原則，混雜兩家不同 auth shape 反而難讀。

### Decision: OpenAI adapter — Bearer auth, `/v1/chat/completions` ping with `gpt-5-nano`

**Choice:** `createOpenAIAdapter(baseUrl, fetchImpl, options?)` 對 `${baseUrl}/v1/chat/completions` POST：

```json
{
  "model": "gpt-5-nano",
  "max_tokens": 1,
  "messages": [{"role": "user", "content": "hi"}]
}
```

帶 `Authorization: Bearer <plaintext>` header、`AbortSignal.timeout(5000)`。同一張 errorKey 表（401 / 402 / 429 / 5xx + 其它）。`baseUrl` 從 `OPENAI_API_BASE_URL` env 拉、預設 `https://api.openai.com`。

**Rationale:**

- `chat/completions` 是 OpenAI 主要付費通道，401 / 402 / 429 行為穩定；和 Anthropic `messages` 是對等選擇。
- `gpt-5-nano` 是 OpenAI 經濟 tier，max_tokens=1 成本接近 $0。
- 不選 `/v1/models` 是因為部分組織 / billing 設定下 `models` 即便 key 過期也回 200，會誤報成功（同 M11.1 對 Anthropic models endpoint 的判斷）。
- Bearer header 與 Anthropic 的 `x-api-key` 是表面差異，封進 adapter 內部，caller 不需要知道。

**Alternatives considered:**

- `/v1/models` list — 上述 false positive 風險。
- `/v1/embeddings` — 額外 model 維度（哪個 embedding model？），增加 surface area 沒有 upside。
- 用 `openai` SDK — 同 M11.1 立場，本 change 不裝 vendor SDK。

### Decision: Google adapter — query-param auth, Gemini `models.list` ping

**Choice:** `createGoogleAdapter(baseUrl, fetchImpl, options?)` 對 `${baseUrl}/v1beta/models?key=<plaintext>` GET：

- query param 帶 plaintext key（Google 的 official auth shape — 不接受 Authorization header for API key）。
- `AbortSignal.timeout(5000)`。
- 401 / 403 / 429 / 5xx 對應同一張 errorKey 表（Google 對非法 key 多用 403 而非 401，adapter 內把 403 也 → invalidKey）。

`baseUrl` 從 `GOOGLE_API_BASE_URL` env 拉、預設 `https://generativelanguage.googleapis.com`。

**Rationale:**

- Google Gemini 的 API key auth 是 query param `?key=...`，OAuth 才走 header；本 BYOK 場景明確是 API key，所以 query param 是正解。
- `models.list` 在 Gemini 是輕量 GET（不消耗 generation quota），對驗證最便宜；和 OpenAI / Anthropic 不同處在 Gemini 沒有「list endpoint 在 key 失效時假成功」的已知問題。
- 403 在 Google 對應「無權」/「key disabled」/「billing 未啟用」，adapter 內統一翻成 `errors.byok.invalidKey` 是保守正確的選擇（user actionable：去重發 key / 啟用 billing）。

**Alternatives considered:**

- 對 `generateContent` 做最小 ping（同 OpenAI / Anthropic pattern）— 會消耗 token quota，且 Gemini 對「無內容 prompt」會 422 而不是讓 key auth 檢查先跑，semantics 不對等。
- 把 plaintext 放 header（Google 的非標流派）— 該流派只在某些 SDK 內部用，公開 API 不支援，會 401。
- 用 `@google/generative-ai` SDK — 同 M11.1 立場。

### Decision: Pricing catalog as static module, single source of truth in `packages/shared/src/byok-pricing.ts`

**Choice:** 一個純 `.ts` module 匯出常數陣列：

```ts
// packages/shared/src/byok-pricing.ts
export type Tier = "flagship" | "balanced" | "economy";

export interface PricingRow {
  providerId: ProviderId;
  tier: Tier;
  modelId: string;          // canonical model id used by adapters / agent
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  vendorPricingUrl: string; // link to vendor pricing page
}

export const BYOK_PRICING: readonly PricingRow[] = [
  // 9 rows: 3 providers × 3 tiers
] as const;

export function getPricingForModel(modelId: string): PricingRow | undefined { ... }
export function isKnownModel(modelId: string): boolean { ... }
```

**Rationale:**

- Single source of truth：UI 渲染 9 row、preferences validator 驗 model 合法性、未來 M13 agent runtime 查 model 對應的 vendor URL，全部讀同一個 module。
- 放 `packages/shared/` 是因為前後端都要用 — UI 渲染 + server validator 都要。
- `as const` + `readonly` 確保不被意外 mutate；CLAUDE.md / coding style 強調 immutability。
- vendor 改名 / 改 ID / 改價時，editing surface 是「一個 file」，不會散落到多處。

**Alternatives considered:**

- 把 pricing 當成 i18n string（locale json）— 數字用 i18n 是反 pattern；數字沒翻譯需求且需要 type-safe access。
- 抓 vendor pricing API — vendor pricing 沒有穩定的 machine-readable API，且更新頻率低（每年 1-2 次），靜態文字維護成本反而最低。
- 拆成 3 個 file（`anthropic-pricing.ts` 等）— 三家平行擴張時跨檔 lookup 變麻煩，且 9 row 不大不需要拆。

### Decision: Persist preferences in `api_keys` table（不另開 user_ai_prefs table）

**Choice:** 不新建 `user_ai_prefs` table。**改在 `users` table 加兩個 nullable 欄位** `preferred_byok_provider text` 與 `preferred_byok_model text`。schema 在 `packages/shared/src/db/byok-schema.ts`（新檔；M11.1 已有此檔但只放 `apiKeys`，本 change 加 `userAiPreferences` 欄位 patch — 由於 better-auth 的 users table 在另一個 file 裡，本 change 改用 separate-table 形式，後文補正）。

**修正版 Choice：** **新建 `user_ai_preferences` 獨立 table**：

```ts
export const userAiPreferences = pgTable('user_ai_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  preferredProvider: text('preferred_provider').notNull(),
  preferredModel: text('preferred_model').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

`user_id` 同時是 PK（每位使用者最多一筆 preferences row）。

**Rationale:**

- `api_keys` 的 PK 是 `(user_id, provider)`，每位使用者**多筆** row（最多 3）；preference 是 per-user 一筆。把 `last_used_provider` / `last_used_model` 塞進 `api_keys` 會變成「在哪一 provider row 上存 preference」的混亂語意（在 anthropic row 存「上次用 google」？）。
- 不去動 `users` table 是因為 `users` 由 better-auth 管理，加自定義欄位需要避開 better-auth migration（沿用 M11.1 對 better-auth schema 的尊重立場）。
- 獨立 table 是對 reads 最 clean 的：M14.1 的 panel `SELECT preferred_provider, preferred_model FROM user_ai_preferences WHERE user_id = $1` 一個 query 拿到，無 join 無歧義。
- `user_id` 為 PK 強制每位使用者一筆，upsert 用 `ON CONFLICT (user_id) DO UPDATE` 是最簡單的 idempotent 寫入。
- M11.1 的 `api_keys.last_used_at` 欄位仍保留（agent runtime 會寫），與 preferences 是不同語意：`last_used_at` 是「這個 provider key 最後一次被 agent 用」（紀錄用途），preferences 是「使用者主動選的 default」（意圖）。兩者解耦，schema 各自獨立。

**Alternatives considered:**

- 加在 `api_keys` table（最初 proposal 的選項 A）— 上述 PK 衝突 / 語意混亂，不採用。
- 加在 `users` table（最初 proposal 的選項 B）— 動 better-auth 管的 table，避免。
- 用 user-scoped key-value table（generic prefs）— 過度通用化，phase 1 沒有第二個 pref 場景，YAGNI。

**Migration strategy:** drizzle-kit generate 產出新 SQL `apps/api/drizzle/000X_add_user_ai_preferences.sql`，建表 + index on user_id（PK 自帶）。`api_keys` table 完全不變。

### Decision: PATCH preferences endpoint, `GET /api/account/byok` extended to include preferences

**Choice:** 新加 `PATCH /api/account/byok/preferences`：

```
PATCH /api/account/byok/preferences
body: { provider: 'anthropic' | 'openai' | 'google', model: string }
  → 200 { data: { provider, model, updatedAt } }
  → 400 { error: { errorKey: 'errors.byok.invalidPreference' } }
```

server 端 zod 驗 `provider in ['anthropic','openai','google']` + `isKnownModel(model)`（用 pricing catalog 查），通過再 upsert 進 `user_ai_preferences`。

擴張既有 `GET /api/account/byok` response：

```ts
{
  data: {
    keys: Array<{ provider, createdAt, lastUsedAt }>,         // unchanged shape
    preferences: { provider, model, updatedAt } | null,      // new field
  }
}
```

**BREAKING（內部 contract）：** GET 回傳 envelope 從 `{ data: [...] }` 變 `{ data: { keys: [...], preferences: ... } }`。前端 hook + tests 一起改；無外部 consumer。

**Rationale:**

- 一條 GET 拉齊 keys + preferences 比兩條來回對 UI 是一次 round-trip vs 兩次；且 ApiKeysPage 開啟時就需要兩者，分開拉沒 upside。
- PATCH（不是 PUT）因為「設新偏好」是 partial update，且未來如果加第二個 pref 欄位（例如預設語氣），endpoint shape 不需動。
- 拒絕未在 pricing catalog 內的 model id 是必要 server-side check：UI 雖然 picker 限定 9 個，但 API 不能信前端。
- 不檢查「使用者必須先存對應 provider 的 key 才能設 preference」— preference 是意圖、key 是憑據；使用者可以先設「我打算用 GPT-5」、之後再去存 OpenAI key。M14.1 在開 panel 時若 preference 對應的 key 不存在，再走「請去 Settings 設 key」引導。

**Alternatives considered:**

- 把 preferences 放 GET 是 separate endpoint `/api/account/byok/preferences` — 兩條 round-trip，沒 upside。
- 用 PUT — semantic 上 PUT 是 replace 整個 resource，preferences 只有兩欄，差異不重要；PATCH 留未來擴張空間。
- 不擋未知 model — UI 改了沒同步 server 時，可能寫入垃圾 model id。zod + pricing catalog 的雙重 check 防呆。

### Decision: Settings UI — 資料驅動三 row + 嵌入定價表 + 底部 picker

**Choice:** `ApiKeysPage.tsx` 重構：

```
<Page>
  <Header />                              <!-- 既有 -->
  <ProvidersList>                         <!-- 新：資料驅動 -->
    {PROVIDERS.map(p => <ApiKeyRow key={p.id} provider={p.id} />)}
  </ProvidersList>
  <PricingTable />                        <!-- 新：靜態 9 row -->
  <DefaultModelPicker />                  <!-- 新：preferences picker -->
</Page>
```

`ApiKeyRow.tsx` 是把 M11.1 既有的 row 邏輯抽出來、改成 props-driven：empty state（input + Save）、saved state（masked + Replace + Delete）。互動邏輯不變。

`PricingTable.tsx` 從 `byok-pricing.ts` 讀 9 row，渲染 5 column（Provider / Tier / Model ID / Input $/1M / Output $/1M / Pricing link）。Tier label 用 i18n（旗艦 / 平衡 / 經濟）。

`DefaultModelPicker.tsx` 讀目前 preferences、提供分組 select（grouped by provider，每組 3 model 含 tier label + price summary），onChange → mutation。Picker 不限制使用者只能選已有 key 的 model（理由見上一個 decision）。

**Rationale:**

- 資料驅動 row 是 M11.2 / M11.3 redesign 一次到位的原因：之後加第 4 家 provider（如果 phase 2 想加）只要在 PROVIDERS 陣列加一筆 + adapter file。
- pricing table 嵌頁面 vs. 拆成 dialog：使用者要能「邊輸 key 邊看價格」做決定，inline 比 modal 自然。
- picker 放底部是因為它依賴前面的 keys + pricing 兩個視覺前提（先讓使用者知道有哪些 provider 可選 + 各 tier 多錢、再選 default）。
- 互動邏輯走 TDD（component test 覆蓋 picker 變更觸發 mutation、saved/empty 三 row 狀態組合）；視覺 / spacing 走預覽迭代（per CLAUDE.md 規範）。

**Alternatives considered:**

- 把 pricing 拆成獨立 page `/account/pricing` — 使用者要切頁切回，破壞「決定 → 設 key」流程。
- picker 用 radio group 而不是 select — 9 個 option 用 radio 太佔版面；分組 select 讓 provider × tier 兩維清楚。
- 不抽 ApiKeyRow，三 row 在 ApiKeysPage 直接寫 — 三份重複 JSX，未來改互動要動三處。

### Decision: Rate limit BYOK_PREFERENCE_RULE — 60/分鐘 per session

**Choice:** 在 `apps/api/src/lib/rate-limit-rules.ts` 加：

```ts
export const BYOK_PREFERENCE_RULE: RateLimitRule = {
  bucketKeyPrefix: 'byok:pref',
  windowMs: 60_000,
  capacity: 60,
};
```

PATCH `/api/account/byok/preferences` 用此規則，bucket key `byok:pref:${userId}`。429 帶 `Retry-After`。

**Rationale:**

- Preference 寫入沒有「打 vendor 的副作用」（不像 POST save 會 ping），oracle 攻擊面不存在；60/分鐘 寬鬆但仍有 cap 防自動化掃刷或誤觸 mutation loop。
- 跟 `BYOK_LIST_RULE`（GET 60/min）對齊：兩者都是「使用者自身使用」的查 / 改一筆狀態，無外部 cost。
- 不用比 POST save 嚴格（10/min）：因為 PATCH 不打 vendor API。

**Alternatives considered:**

- 30/分鐘 — 過於嚴格，使用者在 picker 上反覆點選試感覺都會撞牆。
- 不加 rate limit — 違反 CLAUDE.md hard rule #4「all endpoints rate limited」。

### Decision: i18n key tree

**Choice:** 新增 keys（zh-TW + en 同步）：

```
account.apiKeys.providers.openai.label = "OpenAI" / "OpenAI"
account.apiKeys.providers.openai.placeholder = "sk-proj-..." / "sk-proj-..."
account.apiKeys.providers.openai.helpUrl = "https://platform.openai.com/api-keys"

account.apiKeys.providers.google.label = "Google Gemini" / "Google Gemini"
account.apiKeys.providers.google.placeholder = "AIza..." / "AIza..."
account.apiKeys.providers.google.helpUrl = "https://aistudio.google.com/apikey"

account.apiKeys.pricing.title = "Pricing" / "定價"
account.apiKeys.pricing.subtitle = "USD per 1M tokens" / "USD / 百萬 tokens"
account.apiKeys.pricing.tier.flagship = "Flagship" / "旗艦"
account.apiKeys.pricing.tier.balanced = "Balanced" / "平衡"
account.apiKeys.pricing.tier.economy = "Economy" / "經濟"
account.apiKeys.pricing.column.provider = "Provider" / "供應商"
account.apiKeys.pricing.column.tier = "Tier" / "等級"
account.apiKeys.pricing.column.model = "Model" / "模型"
account.apiKeys.pricing.column.inputCost = "Input" / "輸入"
account.apiKeys.pricing.column.outputCost = "Output" / "輸出"
account.apiKeys.pricing.column.link = "Details" / "詳情"

account.apiKeys.defaultModel.title = "Default model" / "預設模型"
account.apiKeys.defaultModel.subtitle = "Used when you open the AI panel." / "開啟 AI panel 時的預設選擇。"
account.apiKeys.defaultModel.unset = "No default selected" / "尚未選擇預設"

errors.byok.invalidPreference = "Selected provider/model is not supported." / "所選的供應商/模型不支援。"
```

`errors.byok.invalidKey / outOfCredits / rateLimited / unreachable` 等既有 keys 沿用，三家 provider 共享。

**Rationale:**

- 同一張 errorKey 表跨三家 provider，UI 翻譯文字不需要 vendor 名稱（「金鑰似乎無效」對哪一家都通用）— 沿用 M11.1 翻譯精神。
- pricing.column.* 拆細是因為表格 header 翻譯品質差（直接機翻常出錯），明確 key 讓 zh-TW / en 都精準。
- `errors.byok.invalidPreference` 是 PATCH endpoint 的拒絕訊號（zod schema 失敗或 model 不在 catalog 都用此 key）。

**Alternatives considered:**

- 把 pricing tier 名稱寫死英文 — 違反 i18n hard rule。
- 為三家 provider 各做專屬 errorKey（`errors.byok.invalidOpenaiKey` 等）— 翻譯文字基本一樣，3× 重複；現有 `errors.byok.invalidKey` 已涵蓋。

## Risks / Trade-offs

- **Risk:** OpenAI / Google vendor API 改 endpoint shape 或 response code → validation errorKey 翻譯漂移。**Mitigation:** integration test 走 mock fetch（`fetchImpl` 注入），CI 不撞真 vendor；adapter 對未知 status 一律保守翻成 `unreachable`，不暴露原 vendor body。

- **Risk:** `gpt-5-nano` / `gemini-2.5-flash-lite` 在 vendor 端被改名 / 下架 → 全使用者 save 都失敗。**Mitigation:** model id 集中在 `byok-pricing.ts`，editing surface 是一個 file；adapter 內寫死的 validation model 與 pricing catalog 共用同一 const。phase 2 之前若 vendor 改名，editing surface 一處。

- **Risk:** Google 用 query-param 帶 plaintext key → log 落 access log 風險。**Mitigation:** server 自身的 access logger（Pino）只 log path 不 log query string；`fetch()` 的 query param 在 vendor 端的 log 已是 vendor 責任（任何走 Gemini 的客戶都吃同樣風險）；不影響我們 server-side 。Test 加 assertion：log entry 不含 `?key=`。

- **Risk:** Settings UI 的三 row + pricing table + picker 在 narrow viewport（<1024px）會擠。**Mitigation:** phase 1 mobile 是 out-of-scope（CLAUDE.md hard rule #8）；desktop layout 用 max-w-3xl + 縱向堆疊，不用 multi-column。視覺迭代靠 browser preview。

- **Risk:** Preference picker 允許選未對應 key 的 model，使用者在 M14.1 panel 開啟時才知道「沒對應 key」，產生反饋 cycle 拖長。**Mitigation:** picker 旁邊顯示 inline indicator（例如灰字 `(no key set)` 在沒 key 的 provider 旁），讓使用者在 Settings 階段就看到。功能不擋（per Decision 5），但 UI hint 顯著。

- **Risk:** GET response shape 從 `{ data: [...] }` 變 `{ data: { keys, preferences } }` 是內部 breaking change。**Mitigation:** 沒有外部 consumer（phase 1 local-only、無公開 API client），前端 hook 與 tests 一同更新；M11.1 的 routes test 改寫覆蓋新 envelope。

- **Trade-off:** 不裝 vendor SDK，自寫 fetch — M13.1 agent runtime 之後可能要拉 SDK，那時 validation adapter 要不要改寫？**Resolution:** validation adapter 對 SDK 是可有可無；agent runtime 拉 SDK 進來時可以再決定是否把 validation 改用 SDK，現在 fetch 寫法不阻擋未來 — 同 M11.1 立場。

- **Trade-off:** Pricing 是靜態文字 → vendor 調價時需要 owner 手動更新文件。**Resolution:** vendor 調價頻率低（每年 1-2 次），且調價時 owner 通常會收到 vendor 通知；維護成本低於做 cron job 抓 pricing page。

## Migration Plan

1. drizzle-kit generate 建立 `apps/api/drizzle/000X_add_user_ai_preferences.sql`（CREATE TABLE）；不變動既有 `api_keys` table。
2. 部署順序（phase 1 local-only，無多 instance）：
   - 起 API server → 跑 migration → 既有 BYOK API 仍正常（GET 仍回舊 shape，新 PATCH 端點 reachable 但未啟用）。
   - 部署前端 → 切到新 GET response shape + 新 PATCH 客戶端。
   - 因為 phase 1 single-instance，server + client 一起部署即可，不需要前後相容窗口。
3. Rollback：drizzle 反向 migration drop `user_ai_preferences` 表；前端 revert commit；既有 `api_keys` 行為不變。

## Open Questions

無重大 open question。所有實作層級的選擇（adapter HTTP shape、preferences 表結構、UI layout、rate limit、i18n key 樹）都已 lock。實作期遇到 vendor API 細節差異時走 superpowers:systematic-debugging 流程，不另開 design 修訂。
