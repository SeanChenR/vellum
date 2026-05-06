## Context

phase 1 milestone roadmap 最後一段。M1-M9 已收完（add-auth → add-canvas-folder-crud → add-canvas-editor-shell → add-multiplayer-sync → add-sharing → add-custom-shapes → fix-image-asset-inline → fix-sync-snapshot-flush → add-export → add-landing-and-branding → unify-navbar → audit-i18n-and-a11y）；M10 是 phase 1 收尾的最後 polish。

當前 test surface 概況：

- **Unit / integration tests**：54 個檔案、394 個 case，378 pass / 16 baseline fail（baseline 是 pre-existing brittle tests，與本次 change 無關）。Coverage：lines 70.65% / functions 79.12%。
- **Coverage zoom-in 凹點**：
  - `apps/web/src/dashboard/DashboardPage.tsx` lines 4.55% — 8 種 dialog 觸發、DnD callback、folder filter 切換的行為都沒單測（既有 test 是 smoke render）。
  - `apps/web/src/dashboard/useCanvasList.ts` 27.78% — mutation create / rename / delete / move 的 invalidate 行為沒覆蓋。
  - `apps/web/src/dashboard/useFolderList.ts` 23.08% — 同上 mutation 行為沒覆蓋。
  - `apps/web/src/router.tsx` 63.64% — 多數是 inline route component 沒測（這個低不補；phase 2 接 CI 時再衝）。
- **E2E specs 現況**：9 個 .spec.ts 在 e2e/，跑在 Playwright + dev server port 3002（`playwright.config.ts:13` baseURL `http://localhost:3002`）。從未在 CI 跑過；某些 spec 修通狀態不明，特別是 sharing-acceptance.spec.ts 內的 6.1/6.2 case（記憶 `project_e2e_debt.md` 標）。
- **Pre-commit / pre-push hooks**：`.husky/` 內既有 `pre-commit`（lint-staged），無 `pre-push`。

PRD 對 M10 的具體要求（`docs/PRD.md:266-272`）：

> 5 條 happy path：
> 1. Login（Magic Link）
> 2. Canvas CRUD（建 / rename / 拖 folder / 刪）
> 3. Sharing（invite + accept）
> 4. Multiplayer（兩 browser context 同時編輯）
> 5. Export（從 menu 觸發 PNG download）

5 條中現有 spec 已涵蓋 1 / 3 / 4；缺 2 / 5。

CLAUDE.md 約束：
- TDD-first 嚴格走「邏輯走 TDD、視覺走預覽」；單測只補有業務邏輯的部分（dashboard mutation / dialog 互動）。
- canvas 內部 / multiplayer cursor / presence 不加測試。
- 跨語言一致 i18n（zh-TW + en）— 本 change 不新增 i18n key。
- Bun-native preference — 不引新 npm dep。

## Goals / Non-Goals

**Goals**：

- 5 條 PRD happy path 都有對應 e2e spec 且 local 起 dev server 全綠（穩過 3 次 in `--retries=0`）。
- 現有 e2e 紅燈（sharing 6.1/6.2 等）修通；若邏輯本身有 bug 一併修。
- E2E smoke subset（3 條最關鍵）在 pre-push 自動跑，擋 broken push。
- Dashboard 三檔（DashboardPage / useCanvasList / useFolderList）lines coverage 從 < 30% 提到 ≥ 60%。
- README 完整重寫成 phase 1 收尾文件，含 quick start / repo layout / test strategy / ADR index / phase 2 references。

**Non-Goals**（已於 proposal 詳列）：
- 不衝 80%+ coverage；不接 GitHub Actions CI（phase 2 上線時做）；不寫 visual regression；不為 canvas 內部加測試；不在 pre-commit 跑 e2e；不寫獨立 CONTRIBUTING.md。

## Decisions

### E2E smoke subset：3 條最關鍵的 spec 進 pre-push

`package.json` 加：

```json
"test:e2e:smoke": "playwright test smoke.spec.ts auth-magic-link.spec.ts canvas-crud.spec.ts"
```

`.husky/pre-push` 加（push 前自動跑 smoke）：

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

bun run test:e2e:smoke
```

選這 3 條的理由：smoke = 啟動驗證、auth-magic-link = 一切登入後流程的入口、canvas-crud = 主要 user value。其他（sharing / multiplayer / export）跑時間較長且比較少 regress，留給手動 `bun run test:e2e` 全套。

**Rationale**：
- pre-push 比 pre-commit 合理：commit 是 work-in-progress（可能不該過 e2e）；push 是宣告「這是準備分享給別人」的 boundary。
- smoke subset 預估 30 秒以內，可接受；全套 90 秒+ 會被嫌而 bypass。
- Playwright 自動啟 dev server 走 `webServer` config（既存）。

**Alternatives considered**：
- pre-commit 跑 e2e：太重、user 一定會 bypass 用 `--no-verify`；reject。
- 全套進 pre-push：90+ 秒太久，user 也會 bypass；reject。
- 進 GitHub Actions CI：phase 1 沒 GitHub workflow 設施；phase 2 deploy checklist 內處理；reject。

### `e2e/canvas-crud.spec.ts` 流程：不含 share / multiplayer，只專注 CRUD

新檔 `e2e/canvas-crud.spec.ts` 的單一 happy path：

```
1. signInWithMagicLink(test1@vellum.dev)
2. dashboard 預設視圖
3. click "建立畫布" → fill title "M10 test" → submit → 驗證 card 出現
4. click card 「⋯」 → rename → fill "M10 renamed" → submit → 驗證 card 標題變
5. click 加 folder「+」→ fill "M10 folder" → submit → 驗證 folder tab 出現
6. drag canvas card → drop on "M10 folder" tab → 驗證 card 在 folder 內
7. click "M10 folder" tab → 看到 card → click「⋯」→ delete → confirm → 驗證 card 消失
8. hover「M10 folder」tab → 點刪除 → confirm → 驗證 folder tab 消失
```

每步用 `expect().toBeVisible()` / `expect().not.toBeVisible()` 驗證視覺結果，而非 mock 資料層。對應 spec scenarios「Canvas CRUD happy path E2E」的 8 個小 step。

**Rationale**：
- E2E spec 的價值在「真實 user flow 跑得通」，不是「驗每個 API」（那是 integration test 的事）。
- DnD step 用 Playwright 的 `dragTo()` API；既存 `multiplayer-sync.spec.ts` 沒有 DnD 但 dnd-kit 文檔有 Playwright 範例。
- folder rename 不寫進這條 spec（PRD 只列「拖進 folder + 刪除」），縮短 spec 時間。

**Alternatives considered**：
- 一條 spec 涵蓋全 CRUD（含 sharing）：太胖、flaky 概率高；reject。
- 拆成 4 條 spec（create / rename / move / delete）：反而 setup teardown 重複；adopt 一條。

### `e2e/export-png.spec.ts` 流程：驗證 download 觸發，不驗 PNG bytes

```
1. signInWithMagicLink
2. dashboard → 建一張 canvas → 進入 /canvas/<id>
3. 等 tldraw mount + sync.status === "ready"
4. 在 canvas 上拖一個矩形（讓匯出的內容非空）
5. 開 MainMenu → Export → PNG → 1×
6. expect Playwright download event 觸發、檔名為 `{slug}.png`
```

**Rationale**：
- Playwright 的 `page.waitForEvent('download')` 是這類測試的標準做法；不需要驗 PNG header bytes（jsPDF / tldraw 自帶測試）。
- 1× 比 4× 快（exportCanvas 內部 toImage 用較小 pixelRatio）。
- 加一個矩形避免「空 canvas」匯出產生 0-byte blob 觸發 export-canvas 內部的 ExportError（reject path）。

**Alternatives considered**：
- 寫 PDF / SVG / JSON 三條：PRD 只列 PNG；reject。
- 只 mock client-side export：失去「pipeline 通到底」的價值；reject。

### Dashboard 三檔單測補位：以行為測試為主、不衝 100%

新增 / 修改下列測試檔，各自 ≥ 60% lines：

- `apps/web/src/dashboard/DashboardPage.dialog.test.tsx`（新）：8 種 dialog 觸發 case（canvas-create / canvas-rename / canvas-delete / canvas-move / folder-create / folder-rename / folder-delete + 確認 dialog 開到正確 kind）；折 active folder 切換切到 sharedView 行為。
- `apps/web/src/dashboard/useCanvasList.mutations.test.ts`（新）：renameCanvas / deleteCanvas / createCanvas / moveCanvas 各 invoke onSuccess 時是否正確 invalidate `["canvas-list"]` query。
- `apps/web/src/dashboard/useFolderList.mutations.test.ts`（新）：createFolder / renameFolder / deleteFolder 各 invoke onSuccess 時 invalidate `["folder-list"]`，並驗 deleteFolder 在 errorKey === `errors.folder.notEmpty` 時的 error path。

**Rationale**：
- `useCanvasList` / `useFolderList` 是 dashboard 的 data layer；mutation invalidate 是 query 一致性的核心保證；沒測就不能放心 refactor。
- DashboardPage 的 dialog 切換 state machine 是真的 UI logic，值得行為測試（不是視覺）。
- 60% 而非 80%：剩下的 lines 多是 render-only branch（empty state 字串、grid class），測它們 ROI 低。

**Alternatives considered**：
- 一個檔測完所有 dashboard 行為：檔太大；拆 dialog vs mutations 兩個切面。
- 用 testing-library `userEvent` 的 drag-and-drop：dnd-kit 在 jsdom 內無法完整模擬 PointerEvent；DnD 留給 e2e 驗，不在單測層做。

### README 重寫：單檔、12 段落、phase 1 收尾敘事

新版 README 段落順序與意圖：

```
1. # Vellum                     — 一句話描述
2. ## Status                     — phase 1 完成圖（M1-M10 check 表 + v0.9.0 → v1.0.0 計畫）
3. ## Quick Start                — install、起 dev server、db (Neon)、mailpit、進 dashboard
4. ## Stack                      — 表格列出每層工具 + 為何選
5. ## Repo Layout                — apps/api、apps/web、packages/shared、e2e、docs、openspec 樹狀
6. ## Common Commands            — bun test / lint / typecheck / e2e / build / db migrations / spectra
7. ## Test Strategy              — unit / integration / e2e 三層 + Playwright + 70% target
8. ## Architecture               — single-binary（Bun.serve HTTP+WS+static）+ tldraw sync 主要 hook
9. ## Capabilities (specs)       — openspec/specs/* 列出 11 個 capability + 一句話描述
10. ## ADR Index                 — docs/adr/0001 ... 0010 連結 + 每篇一句話 takeaway
11. ## Spectra Workflow          — discuss → propose → apply → archive，怎麼開新 change
12. ## Phase 2 Roadmap            — 連 project_deploy_checklist.md 的 high-level 條目（不展開）
```

**Rationale**：
- 單檔 vs 拆檔：phase 1 一個 contributor，單檔讀完比較快；phase 2 開放後再拆 README + DEVELOPING + ARCHITECTURE。
- ADR index：避免 contributor 重新打開所有 ADR；一句話 takeaway 像書背摘要。
- spec 列表：openspec 是這個 repo 的特色，README 上必須提；不然 contributor 不知道 `openspec/specs/*` 是真實的 spec 不是 stale 文件。

**Alternatives considered**：
- 用 docusaurus / mintlify 自動生成：phase 1 殺雞用牛刀；reject。
- 不寫 ADR index、保持「ADR 在 docs/adr/ 自己看」：contributor 進 docs/adr/ 看到 10 個檔案不知該讀哪本；adopt index 提示。

## Risks / Trade-offs

- **[Risk] e2e tests flaky in pre-push** → Mitigation：smoke subset 只 3 條；每條 spec 內部用 `await expect(...).toBeVisible({ timeout: 10_000 })` 而非任意 sleep；`--retries=0` 跑通才算通過；如某條真的 flaky，從 smoke 退出留給手動全套。
- **[Risk] Playwright auto-start dev server 撞既存 dev server（port 3002）** → Mitigation：`playwright.config.ts` 已配 `webServer` 段（如果有）；若沒有就用 `reuseExistingServer: true` 讓 user 自己起 dev server 然後 e2e 用同一個。本次只跑既存 spec、不改 webServer config。
- **[Risk] Canvas CRUD spec 內 DnD step 在 Playwright headless mode flaky** → Mitigation：先用 `dragTo()`，若 flaky 改用 `dispatchEvent('pointerdown'/'pointermove'/'pointerup')` 序列；最壞情況 skip DnD step、把「拖進 folder」改成「rename canvas 到 unfiled / via context menu move dialog」覆蓋同樣的 user goal。
- **[Risk] Export PNG spec 在 happy-dom-style headless browser 內 jsPDF 行為不同** → Mitigation：Playwright 跑真 Chromium，不是 happy-dom；PNG export 已在 add-export 時測過 toImage flow；e2e 只驗 download event 觸發，不驗 byte 內容。
- **[Risk] sharing 6.1/6.2 修通的 root cause 可能要動 server code** → Mitigation：先 local 跑、看具體錯訊；若是 client side（test selector / timing）就 e2e 內修；若是 server bug 就開新 fix change 處理（不在本 change scope 內）。
- **[Trade-off] 60% 而非 80% coverage** → 留下的 dashboard render-only paths 在 phase 2 refactor 時可能踩到。可接受——phase 2 加 visual regression 時一併補。
- **[Trade-off] README 12 段是否太長** → 53 行 → 200+ 行的躍遷。phase 1 一個 user 維護，單檔詳細勝過多檔分散；phase 2 開放後可拆。
- **[Trade-off] pre-push 30 秒** → 比 pre-commit 重，但 push 是 conscious action，延遲 30 秒可接受；user 不爽可在 commit log 標 `[skip-e2e]`（pre-push hook 內加 grep `git log -1 --format=%B` 判斷）——本 change 不加這個 escape hatch，phase 2 評估再加。
