## Context

Vellum Phase 2 PRD（issue #2）決定走 BYOK：使用者自帶 LLM API key、應用程式不代理也不 pool。M11.1（issue #3）是 BYOK 系統的第一個 tracer-bullet — Anthropic-only — 把 DB schema、加密 vault、provider validation、API endpoints、Settings UI、i18n、tests 一次跑通；M11.2（issue #5）才把同一套 pattern 擴張到 OpenAI 與 Google。本 design 鎖定的所有決策（加密格式、validation 流程、錯誤翻譯規則、UI layout）將被 M11.2 直接複用，所以**現在做的取捨之後改不便宜**。

現有 deep module 可重用：

- `apps/api/src/lib/rate-limiter.ts` — in-process LRU + token bucket，所有新 endpoint 必須在 `apps/api/src/lib/rate-limit-rules.ts` 註冊規則。
- `apps/api/src/lib/permission.ts` — session-based authn 檢查，BYOK endpoints 全部要求登入。
- `packages/shared/src/db/auth-schema.ts` — `users` table 是 `text` PK；新 `api_keys` table 必須對齊 `text` 而不是 `uuid`（issue #3 描述用 `uuid`，但 better-auth schema 落地是 text；本 design 以實際 schema 為準，後文會明示這個偏離）。
- `apps/api/src/account/routes.ts` — 既有 `/api/account/*` 命名空間；BYOK endpoints 掛在 `/api/account/byok/*` 沿用 namespace 但程式碼分檔。
- `packages/shared/src/api-contract.ts` — API 型別中央集合；新增 BYOK request/response type 加進來。

新加的 deep module（封裝強、介面窄、實作可換）：

- **API Key Vault**（`apps/api/src/byok/vault.ts`）— input: plaintext / packed; output: ciphertext / plaintext。內部封裝 master key 來源、IV 產生、AES-256-GCM、packed format。caller 完全不接觸 raw bytes。
- **Provider Adapter**（`apps/api/src/byok/providers/*.ts` + `types.ts`）— input: plaintext key; output: `{ ok: true } | { ok: false, errorKey }`。內部封裝 vendor URL、endpoint、HTTP 狀態翻譯。

shallow glue：`routes.ts`、`useApiKeys.ts`、`ApiKeysPage.tsx`、`byok-validator.ts` — 都是把 deep module 串起來的薄層，無業務邏輯。

## Goals / Non-Goals

**Goals:**

- 端到端跑通**單一 provider（Anthropic）**：DB → Vault → Provider Adapter → API → UI → tests 全部 green。
- 把加密格式、IV 政策、master key 來源、provider 驗證流程、HTTP 狀態翻譯規則、UI 互動規約一次定下來，讓 M11.2 加 OpenAI / Google 時純粹是「擴 enum + 加 adapter file」而不是再決策。
- 建立 `ProviderAdapter` interface，新 provider 用 strategy pattern 註冊；caller（`routes.ts`）不需 `if/else`。
- 確保未驗證成功的 candidate key **永遠不落 DB**（POST flow: validate → encrypt → upsert，三步缺一就回滾）。
- 全部 user-facing 錯誤透過 `errorKey` 從 server 回到 UI，UI 用 `t(errorKey)` 翻譯（zh-TW + en 同步）。
- 啟動時驗證 `API_KEY_ENCRYPTION_KEY` 存在且為 32-byte hex；缺失或長度錯誤時 `apps/api/src/index.ts` 的啟動流程直接 throw 阻擋啟動（fail-fast，避免上線後才發現加密壞了）。

**Non-Goals:**

- **不做 OpenAI / Google providers** — issue #5 (M11.2)。
- **不做 pricing table** — issue #8 (M11.3)。
- **不做 AI side panel 消費 key** — issue #12 (M14.1)。
- **不做 agent runtime call Anthropic** — issue #9 (M13.1)；本 change 的 `decryptApiKey()` 已可被未來 agent 直接呼叫，但 agent 自身在這 change 範圍外。
- **不做 key rotation 自動排程** — 使用者手動 Delete + Save 即達成 rotation，phase 2 之後再考慮主動到期通知。
- **不做 key 使用統計面板** — `last_used_at` 欄位在 schema 預留但本 change 不寫入（agent runtime 將來才會更新它），只支援 schema migration 一次到位。
- **不裝 `@anthropic-ai/sdk` 套件** — 驗證只發一個簡單 messages 請求，自寫 fetch + 構造 body 即可；M13.1 再決定是不是拉 SDK。
- **不做 worktree 內 e2e Playwright 測試** — Settings UI 的 e2e 走完整 multi-step flow（輸入 → 驗證 → 儲存 → 刪除）成本不對等於 phase 1 不在火線；component test + integration test 已可覆蓋本 change 風險面。

## Decisions

### Decision: AES-256-GCM via node:crypto, packed as base64(iv ‖ tag ‖ ciphertext)

**Choice:** 用 `node:crypto`（Bun 原生支援）的 `createCipheriv('aes-256-gcm', key, iv)`；每筆加密產生 12-byte random IV、16-byte auth tag；存進 DB 的 `encrypted_key` 欄位是單一 base64 字串、layout `iv (12B) | tag (16B) | ciphertext (N B)`。

**Rationale:**

- AES-256-GCM 是業界 baseline 對稱加密（authenticated encryption），auth tag 防止 ciphertext 被篡改後解密成功。
- 12-byte IV 是 GCM 的標準 nonce 長度（NIST SP 800-38D 建議）；每筆隨機產生避免 nonce reuse。
- 把三段 concat 後 base64 一次存比拆三欄省 schema 複雜度，且未來換 algorithm 時可以在 byte 0 加 version prefix 而不破 schema。
- node:crypto 是 Bun 原生 — 不裝任何加密套件、攻擊面最小。

**Alternatives considered:**

- `Bun.password` — 是密碼 hash（Argon2 等）不是 symmetric encryption，不適用 reversible 場景。
- `libsodium-wrappers` / `@noble/ciphers` — 額外依賴、無實質安全 upside，違反 Bun-native preference。
- 把 `iv` / `tag` / `ciphertext` 拆成三個欄位 — schema 複雜化、未來 versioning 也要動 schema，沒有 upside。
- ChaCha20-Poly1305 — 也是合格選項，但 AES-GCM 是 NIST FIPS 認證、相容性更廣。

### Decision: Master key from `Bun.env.API_KEY_ENCRYPTION_KEY`, fail-fast on startup

**Choice:** Master key 是 32-byte（256-bit）值，以 64-char hex string 形式存 env；`Vault` 模組初始化時 `Buffer.from(env, 'hex')` 並斷言 `length === 32`；長度錯誤或 env 缺失時 throw — 由 `apps/api/src/index.ts` 在啟動時呼一次 `initVault()` 觸發此檢查。

**Rationale:**

- Hex 比 base64 安全可讀（無 padding、URL-safe），運維更不易抄錯。
- Fail-fast 比 lazy init 安全：上線後才發現 master key 壞掉時，使用者已開始輸入 key 但全部存錯，遠比啟動失敗慘。
- 把 env 讀取封進 `initVault()` 而非 module-top-level — 讓 unit test 可以注入 fake key 不污染 process env。

**Alternatives considered:**

- 從 file path（`/run/secrets/api_key_encryption_key`）讀 — phase 2 deploy 才有意義，phase 1 local-only 不必要。
- 從 KMS / Vault service 讀 — out-of-scope（phase 2 deploy checklist）。
- 自動 generate 並存 file — 啟動時不可預測，多 instance 不一致，沒有任何優勢。

### Decision: Validate-before-persist with single transaction window

**Choice:** `POST /api/account/byok/:provider` 流程：(1) 拉出對應 `ProviderAdapter`，呼 `validateKey(plaintext)`；(2) `ok: false` 直接回 `{ error: { errorKey } }`、不碰 DB；(3) `ok: true` 才 `encryptApiKey(plaintext)` 然後 `INSERT ... ON CONFLICT (user_id, provider) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, created_at = NOW()`（Drizzle 用 `.onConflictDoUpdate()`）。

**Rationale:**

- 「驗證失敗就不落 DB」是 issue #3 acceptance criteria 明文要求，邏輯放在 route handler 的 happy-path 直線上比拆 service 更易讀。
- 用 upsert（而不是先 SELECT 再 INSERT or UPDATE）省一次 round-trip 並避免 race（同一 user 同 provider 同時 POST 兩次），DB 的 unique constraint `(user_id, provider)` 是正確性的最後防線。
- `created_at` 在 conflict 時也覆寫，因為「重新 save 一個 key」邏輯上是新存的 key、不是更新舊的。

**Alternatives considered:**

- 先 INSERT 後驗證，失敗 DELETE — 多一個失敗模式（驗證 timeout 後 DB 留垃圾），複雜度上升。
- 把驗證做進 DB trigger — 不可能（trigger 不能發外部 HTTP）。
- 驗證成功後另 PATCH 更新 `last_used_at` — out-of-scope，本 change 不寫 `last_used_at`。

### Decision: ProviderAdapter strategy interface; one file per provider

**Choice:** `apps/api/src/byok/providers/types.ts` 定義：

```ts
export type ProviderId = 'anthropic'; // M11.2 will extend: 'anthropic' | 'openai' | 'google'

export interface ProviderAdapter {
  validateKey(plaintext: string): Promise<{ ok: true } | { ok: false; errorKey: string }>;
}

export const adapters: Record<ProviderId, ProviderAdapter> = {
  anthropic: anthropicAdapter,
};
```

每個 provider 一個 file（`anthropic.ts` 匯出 `anthropicAdapter`），routes 用 `adapters[provider]` 查找。

**Rationale:**

- M11.2 加 OpenAI / Google 是「新增兩個 file 加兩行 record entry」，完全不動 routes 或 vault — pattern lock 達成。
- Strategy pattern over `if/else`：避免 switch 在 route handler 蔓延，新增 provider 時 Open-Closed。
- enum/literal type 鎖在 shared `api-contract.ts`（前端、後端、validator 共用），新增 provider 時 TypeScript compiler 會抓到所有未覆蓋的點。

**Alternatives considered:**

- 動態 plugin loader（讀資料夾自動註冊）— 過度工程，3 個 provider 不需要。
- 把 adapter 介面放 `packages/shared/` — 不必要：adapter 只在 server side 跑，shared 只放 ProviderId enum 即可。

### Decision: Anthropic validation ping uses minimal messages request, 5s timeout

**Choice:** `validateAnthropicKey()` 對 `${ANTHROPIC_API_BASE_URL}/v1/messages` POST：

```json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 1,
  "messages": [{"role": "user", "content": "hi"}]
}
```

帶 `x-api-key` header、`anthropic-version` header（`2023-06-01`）、`AbortSignal.timeout(5000)`。回應狀態翻譯：

| status | errorKey |
|---|---|
| 200 / 201 | `(ok)` |
| 401 | `errors.byok.invalidKey` |
| 402 | `errors.byok.outOfCredits` |
| 429 | `errors.byok.rateLimited` |
| 5xx / network error / abort | `errors.byok.unreachable` |
| other 4xx | `errors.byok.unreachable`（保守處理 — 不暴露 vendor 內部錯誤細節） |

**Rationale:**

- 走 `messages` endpoint 是 Anthropic 的主要付費通道，401 / 402 / 429 行為穩定。
- `claude-haiku-4-5` 是最便宜的 tier；驗證一次成本接近 $0（max_tokens=1）。
- 5s timeout 平衡使用者等待感與網路抖動容忍；超時即視為 `unreachable`（保守翻譯）。
- 使用 base URL env var 讓 integration test 可指向 mock server。
- **此呼叫 NOT 走 `validateExternalUrl()`**：vendor URL 是 hard-coded（不是使用者輸入），不是 SSRF 攻擊面。validateExternalUrl 是給 OG card scraper 用的（CLAUDE.md hard rule #3 講的是 `fetch(userProvidedUrl)`）。

**Alternatives considered:**

- 走 `models` list endpoint 比較便宜 — Anthropic 該 endpoint 在某些 plan 下回 200 但 key 其實沒額度，會誤報成功。
- 不設 timeout — 使用者體感差、且讓 server 持有 socket 易被當 oracle。
- 把錯誤狀態暴露原 vendor body 給前端 — 洩漏實作細節，違反 errorKey 約定。

### Decision: api_keys schema uses `text` user_id (not uuid) to align with better-auth

**Choice:**

```ts
export const apiKeys = pgTable(
  'api_keys',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    encryptedKey: text('encrypted_key').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.provider] }),
  ],
);
```

複合 PK `(user_id, provider)` 同時是 unique constraint。

**Rationale:**

- issue #3 描述用 `uuid` PK 的 user_id，但 vellum 既有 `users.id` 是 `text`（better-auth Drizzle adapter 的標準），FK 必須對齊型別。本 change 走實際 schema 而非 issue 描述。
- 複合 PK 直接保證 `(user_id, provider)` 唯一，省掉額外 unique constraint 宣告。
- `casing: 'snake_case'` drizzle config 已存在，camelCase TS → snake_case SQL 自動轉換。
- `created_at` 用 `defaultNow()` server-side 設值，避免 client 時鐘漂移。

**Alternatives considered:**

- 自動 `id` PK + 額外 unique on `(user_id, provider)` — 多一個欄位無實際用途，外部不參考此 row id。
- 把 `provider` 做成 enum type — Postgres enum 修改不便利，後面 M11.2 / M11.3 加 provider 時要 ALTER TYPE，text 反而靈活；validator 在 application layer 把守。

### Decision: Rate limits — 60 / 10 / 30 per minute per session for GET / POST / DELETE

**Choice:** 三條規則加進 `apps/api/src/lib/rate-limit-rules.ts`：

| Endpoint | Bucket key | Limit |
|---|---|---|
| `GET /api/account/byok` | `byok:list:${userId}` | 60 / minute |
| `POST /api/account/byok/:provider` | `byok:save:${userId}` | 10 / minute |
| `DELETE /api/account/byok/:provider` | `byok:delete:${userId}` | 30 / minute |

429 帶 `Retry-After` header（ms → seconds）。

**Rationale:**

- POST 限 10/min 防止把驗證端點當 oracle 暴力撞別人的 key（每次 POST 觸發一次對 vendor 的真實 ping）。
- DELETE 30/min 比 POST 寬，但仍有上限避免誤操作 / 自動化掃刷。
- GET 60/min 寬鬆，因 UI 載入頁面就會觸發一次，使用者可能反覆切換頁籤。
- 全部 per-session（用 userId 當 bucket key）是合理的 — 已通過 auth 層檢查，rate-limit 主要防使用者自身濫用而非匿名洪水。

### Decision: Settings UI — single Anthropic row, masked-when-stored, key never re-fetched

**Choice:** `ApiKeysPage.tsx` 顯示一張卡片包 Anthropic row：

- 未設過 key 時：input field（type=password）+ Save button（disabled until input non-empty）。
- 已設過 key 時：唯讀顯示 `sk-ant-••••••••XXXX`（前 7 字元 + dots + 最後 4 字元）+ Delete button + （可選）Replace button（按下後變回 input + Save 模式）。
- Save 進行中：button disabled + loading spinner。
- 失敗時：input 下方顯示 `t(errorKey)`，input 不清空（讓使用者修正 typo 而不是重打）。

masked 顯示的「最後 4 字元」**不從 server 取**（plaintext 不可逆地存在加密欄位裡）。改採：Save 成功時前端把當下輸入的最後 4 字元存進 sessionStorage / Zustand client store，重整後就只顯示 `sk-ant-••••••••••`（無尾碼）— UI 仍可區分「有 / 無 key」。

**Rationale:**

- 「Save 後不能再讀回 plaintext」是加密設計的必然結論；前端只需「有 key / 無 key」狀態 + 可選的視覺提示（最後 4 字元僅 session 內有效）。
- Replace = Delete + Save（單一 mutation 比 atomic replace 更易理解、且 UI 可以做兩次動作的視覺確認）。
- 不做 rotation timer / 過期警告 — out-of-scope。

**Alternatives considered:**

- 把最後 4 字元當作獨立欄位存 DB — 違反「key 整體當 secret」原則，且只為 UI 顯示便利不值得。
- 顯示完整 plaintext（toggle show/hide）— 失敗：plaintext 已不可取得；且即便能取得也是 anti-pattern。

### Decision: i18n keys — `account.apiKeys.*` for UI, `errors.byok.*` for errors

**Choice:** 字串樹規劃：

```
account.apiKeys.title = "API Keys" / "API 金鑰"
account.apiKeys.subtitle = "Bring your own keys for AI features"
account.apiKeys.providers.anthropic.label = "Anthropic"
account.apiKeys.providers.anthropic.placeholder = "sk-ant-..."
account.apiKeys.providers.anthropic.helpUrl = "https://console.anthropic.com/settings/keys"
account.apiKeys.actions.save = "Save"
account.apiKeys.actions.delete = "Delete"
account.apiKeys.actions.replace = "Replace"
account.apiKeys.status.saving = "Validating..."
account.apiKeys.status.saved = "Saved"
account.apiKeys.confirm.deleteTitle = "Delete Anthropic key?"
account.apiKeys.confirm.deleteBody = "..."

errors.byok.invalidKey = "Your Anthropic key looks invalid. Check it's copied correctly."
errors.byok.outOfCredits = "Your Anthropic account is out of credits."
errors.byok.rateLimited = "Hit Anthropic's rate limit. Wait a moment and try again."
errors.byok.unreachable = "Unable to reach Anthropic. Check your network and try again."
errors.byok.providerUnknown = "Unsupported provider."
errors.byok.notAuthenticated = "Sign in to manage API keys."
```

zh-TW + en 兩 file 同 PR 補齊；零落差。

**Rationale:**

- `errors.byok.*` 與 UI 字串分流，讓 server 用 errorKey 對應的時候不需與 UI tree 耦合。
- 訊息 wording 對齊 issue #3 acceptance criteria 的具體文字。

## Risks / Trade-offs

- **Risk:** Master key 一旦遺失，所有已存的 plaintext key 都無法解 → 等同強制每位使用者重新輸入。**Mitigation:** phase 1 是 local-only，遺失成本只影響 owner 自己；phase 2 deploy 之前須加 deploy checklist 項目（master key 入 secret manager + backup procedure）。
- **Risk:** Anthropic API 改 endpoint shape 或 response code → validation 對應 errorKey 漂移。**Mitigation:** integration test mock 真實 response；CI 不撞真 vendor（test 用 base URL env 指向 mock）。
- **Risk:** Validator endpoint 被當 password oracle（重複丟 key 試對錯）→ 每次驗證會打到 Anthropic。**Mitigation:** POST 10/min per session（Decision 6）；登入 + session-bound 限制非匿名濫用。
- **Risk:** Master key 在 dev `.env` 落 git。**Mitigation:** `.env.example` 只放範例字、實際 `.env` 已在 `.gitignore`；本 change 不動 .gitignore，沿用既有保護。
- **Risk:** 同一 plaintext key 加密多次 IV uniqueness 假設失敗 → ciphertext 可被分析。**Mitigation:** unit test 強制驗 100 次加密 IV 全唯一、ciphertext 全唯一；`crypto.randomBytes(12)` 是 CSPRNG，符合 NIST 對 GCM IV 的隨機產生規範。
- **Trade-off:** 不裝 `@anthropic-ai/sdk`，自寫 fetch — 短期省依賴但 M13.1 agent runtime 自然要用 SDK，到時要改寫 validator 嗎？**Resolution:** validator 對 SDK 是可有可無 — agent runtime 之後拉 SDK 進來時可再決定要不要把 validator 改寫成 SDK 呼叫；現在 fetch 寫法不阻擋未來。
- **Trade-off:** 三條 rate-limit 數字（60/10/30）目前沒有 telemetry 校準。**Resolution:** phase 1 local-only 唯一使用者就是 owner，數字保守即可；phase 2 開放後再依實際曲線調整。
