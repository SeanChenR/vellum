---
name: setup-pre-commit
description: Set up Husky pre-commit hooks with lint-staged, oxlint (linter), oxfmt (formatter), type checking, and tests using bun. Use when user wants to add pre-commit hooks, set up Husky, configure lint-staged, or add commit-time formatting/linting/typechecking/testing.
---

# Setup Pre-Commit Hooks (bun + oxc)

> 這個 skill 假設專案使用 **bun** 作為 package manager 與 test runner，搭配 **oxc** 工具鏈（`oxlint` + `oxfmt`）取代 eslint + prettier。

## What This Sets Up / 會建立什麼

- **Husky** pre-commit hook
- **lint-staged**：只對 staged 檔案跑 oxlint + oxfmt
- **oxlint**（Rust-based linter，比 eslint 快 50–100×）
- **oxfmt**（Rust-based formatter，oxc 家族）
- pre-commit hook 內呼叫 **typecheck** 與 **bun test**

## Steps

### 1. 確認 bun 存在 / Verify bun

```bash
bun --version
```

若沒有，請 user 先裝（`curl -fsSL https://bun.sh/install | bash`）。**不要**自動 fallback 到 npm/pnpm — 這個專案明確選擇 bun。

### 2. 安裝 dev dependencies / Install dev deps

```bash
bun add -d husky lint-staged oxlint oxfmt
```

### 3. 初始化 Husky / Init Husky

```bash
bunx husky init
```

這會建立 `.husky/` 目錄並在 `package.json` 加入 `"prepare": "husky"` script。

> ⚠️ Husky 的 `prepare` script 預設會跑 `husky`（不是 `husky install`，v9+ 簡化了）。

### 4. 寫 `.husky/pre-commit`

Husky v9+ 不需要 shebang。檔案內容：

```
bunx lint-staged
bun run typecheck
bun test
```

**Adapt rules:**
- 若 `package.json` 沒有 `typecheck` script，幫 user 加一個 `"typecheck": "tsc --noEmit"`（前提是有 `tsconfig.json`）。
- 若沒有測試（沒有 `*.test.ts` / `*.spec.ts`），先把 `bun test` 那行註解掉並告訴 user：「目前還沒測試，先註解；之後寫了再開」。

### 5. 寫 `.lintstagedrc.json`

```json
{
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    "oxlint --fix",
    "oxfmt"
  ],
  "*.{json,jsonc}": [
    "oxfmt"
  ]
}
```

> oxfmt 目前對 markdown / css / html 支援還在發展中；如果 user 之後需要 format 這些檔案，再評估加 dprint 或保留 prettier 給特定 glob。

### 6. 寫 `.oxlintrc.json`（如果還沒有）

只在沒有現成 config 時建立。預設值偏寬鬆，讓 user 可以漸進收緊：

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error",
    "suspicious": "warn"
  },
  "env": {
    "browser": true,
    "node": true
  }
}
```

### 7. oxfmt config

oxfmt 目前沒有正式 config 檔案標準（截至 2026-04），預設行為已對齊 prettier defaults（2-space indent、80 col、double quote、trailing comma `es5`、semicolons）。若 user 之後想客製，再評估。**不要**主動建立 `.oxfmtrc` —— 可能不被支援。

### 8. 驗證 / Verify

逐項檢查：

- [ ] `.husky/pre-commit` 存在
- [ ] `.lintstagedrc.json` 存在
- [ ] `.oxlintrc.json` 存在（若是新建）
- [ ] `package.json` 的 `prepare` script 是 `"husky"`
- [ ] `package.json` 有 `typecheck` script（若有 tsconfig）
- [ ] 跑 `bunx lint-staged` 確認不會炸（即使 staged 為空也應乾淨退出）

### 9. Smoke test commit

把所有新增/修改的檔案 stage 起來，commit：

```
chore: setup pre-commit (husky + lint-staged + oxlint + oxfmt)
```

這次 commit 本身就會觸發新的 pre-commit hook —— 是最好的煙霧測試。如果擋下來，照錯誤訊息修。

## Notes / 雜記

- **Husky v9+** 的 hook 檔案不需要 shebang、不需要 `chmod +x`，Husky 自己處理。
- **oxlint --fix** 只會自動修可安全修復的 rules；其他會以 error/warn 印出，你需要手動處理。
- **oxfmt** 預設原地寫回（in-place write），不需要 `--write` flag。
- 若 user 後來想加 commit message 規範（commitlint）或 pre-push hook，回來這個 skill 加 step 即可。
- 若 lint-staged 跑很慢，多半是 oxlint config 太嚴 —— 檢查 `.oxlintrc.json` 的 categories。
