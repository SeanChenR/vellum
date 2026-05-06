## Summary

補完 PRD 5 條 happy path 的 E2E 覆蓋（補 Canvas CRUD + Export PNG）、修通既存 E2E 紅燈（sharing 6.1/6.2）、把 E2E 接進可信任的執行流程，重寫 README 成完整 phase 1 收尾文件，phase 1 milestone roadmap 完成。

## Motivation

phase 1 milestone roadmap 進到最後一段（M10）。當前狀況：

- **Coverage**：`bun test apps/web --coverage` 顯示 lines 70.65% / functions 79.12%，已過 PRD 70% 門檻，但 dashboard 行為（DashboardPage 4.55% / useCanvasList 27.78% / useFolderList 23.08%）幾乎沒單測——靠人工點擊驗。
- **E2E 5 條 happy path**：PRD `docs/PRD.md:266-272` 明列 5 條，現況：
  - ✅ Login（Magic Link）→ `e2e/auth-magic-link.spec.ts`
  - ❌ Canvas CRUD（建 / rename / 拖 folder / 刪）→ 沒有 spec
  - ✅ Sharing（invite + accept）→ `e2e/share-invite.spec.ts` + `sharing-acceptance.spec.ts`（但記憶 `project_e2e_debt.md` 標「6.1/6.2 寫了但沒跑通」）
  - ✅ Multiplayer → `e2e/multiplayer-sync.spec.ts`
  - ❌ Export PNG → 沒有 spec
- **E2E 信心度**：9 個既存 spec 從未在 CI / pre-commit 層級跑過；`bun test` 預設不含 e2e；`bun run test:e2e` 是手動觸發；某些 spec 的修通狀態不明。
- **README**：53 行 stub，phase 1 接近 v0.9.0，但 README 沒寫 quick start、test 策略、ADR 連結、phase 2+ 規劃跳板——第一個 contributor / 自己半年後回來會迷路。

phase 1 收尾的目的是「能放心做下一階段 / 上線」，重點是 **e2e 紅綠燈** 而不是 unit coverage 數字。e2e 接進 CI 才能擋未來 regression。

## Proposed Solution

四件事，一個 PR 收：

- **新增 2 條 e2e spec**：
  - `e2e/canvas-crud.spec.ts` — magic-link 登入 → 建 canvas → rename → 建 folder → 拖 canvas 進 folder → 刪 canvas → 刪 folder。對應 PRD US 269。
  - `e2e/export-png.spec.ts` — 登入 → 進 canvas → 從 MainMenu 觸發 Export → PNG → 1× → 驗證 download 觸發。對應 PRD US 272。
- **既有 e2e 跑一次 + 修通**：local 起 dev server（port 3002）跑 `bun run test:e2e`；逐個修通；特別重點是 sharing 6.1/6.2（記憶標 debt）。修通的判定：每個 spec 在 `--retries=0` 下穩過 3 次。
- **E2E 接執行流程**：在 `package.json` 加 `test:e2e:smoke`（只跑 smoke + auth-magic-link + canvas-crud，作為 push 前快檢）；在 `.husky/pre-push` 加 `bun run test:e2e:smoke`（pre-commit 太重，pre-push 比較合理）。`bun run test:e2e` 維持「跑全部」的手動觸發。
- **單測補位 dashboard 凹點**：`apps/web/src/dashboard/DashboardPage.test.tsx` 加 dialog 開合 / DnD callback / 切 folder 行為 case；`useCanvasList.test.ts` 與 `useFolderList.test.ts` 加 mutation invalidate 行為 case。目標把這三檔 lines coverage 從 < 30% 提到 ≥ 60%（不衝 100%——dialog 內部已有自己的測試）。
- **README 重寫**：phase 1 完成圖（M1-M10 ✓ check 表）、Quick Start（install / dev / db / mailpit）、Stack 詳列、Repo Layout 樹狀圖、Common Commands（test / lint / typecheck / e2e / build）、Test 策略段（unit + integration + e2e 三層 + Playwright）、ADR 連結 index、phase 2 預告（deploy checklist 跳板）、貢獻指引（spectra workflow 提及）。

## Non-Goals

- **不衝 coverage 到 80%+**：phase 1 已過 70% 門檻；canvas 內部 / shape 視覺仍不寫像素測試（CLAUDE.md hard rule）。
- **不做 visual regression / screenshot diff**：phase 2+ marketing 上線前再評估。
- **不為 canvas 內部 / multiplayer cursor / presence 加單測**：tldraw 自帶 + hard rule 禁區。
- **不在 pre-commit 跑 e2e**：太慢（單條 spec 8-15 秒，全套 90 秒+），會打斷 commit 節奏；改 pre-push 的 smoke subset。
- **不接 GitHub Actions CI**：phase 1 仍 local-only（PRD 主軸）；CI / GitHub workflow 在 phase 1 → phase 2 過渡時做（記憶 `project_deploy_checklist.md` 內列）。
- **不寫 CONTRIBUTING.md**：README 內加一段「貢獻指引」即可，獨立檔 phase 2+。
- **不為 i18n 額外 audit unused keys**：`audit-i18n-and-a11y` 已擋未來漏網；既存的 unused keys（如有）由 oxlint 之後 phase 2 加 i18next-extract 再清。

## Alternatives Considered

- **不補單測，只補 e2e**：dashboard 4.55% 真的太凹，未來 refactor 沒網接；補位是必要的（不衝 80%、但 60% 是合理底線）。reject 純 e2e 路線。
- **e2e 接 GitHub Actions CI 而非 pre-push**：phase 1 還沒 deploy、沒 GitHub workflow 設施；pre-push 的 smoke subset 是 local 階段最合適點；phase 2 上 CI 時再補。adopt pre-push smoke。
- **README 拆成多檔（README + DEVELOPING + ARCHITECTURE）**：phase 1 一個 contributor（user 自己），單檔較好維護；phase 2+ 開放後再拆。adopt 單檔。
- **單測補位涵蓋所有 < 50% 的檔案**：很多低 coverage 是 boilerplate / glue（router 本身、dialog 上層）；只補真的有業務邏輯的 dashboard 三檔。adopt 收斂。
- **新加 capability `unit-coverage` 跟 `e2e-coverage` 拆兩個**：太碎；e2e + 單測補位都是「測試完整性」的同一件事，合在 `e2e-coverage` 一個 capability 內，spec scenarios 涵蓋兩種測試型態。adopt 合一。

## Impact

- Affected specs: `e2e-coverage`（新）
- Affected code:
  - New:
    - e2e/canvas-crud.spec.ts
    - e2e/export-png.spec.ts
    - apps/web/src/dashboard/DashboardPage.dialog.test.tsx（補 dialog 開合 / 切 folder 互動 cases）
    - apps/web/src/dashboard/useCanvasList.mutations.test.ts（補 mutation invalidate cases）
    - apps/web/src/dashboard/useFolderList.mutations.test.ts（補 mutation invalidate cases）
  - Modified:
    - apps/web/src/dashboard/DashboardPage.test.tsx（已有；視需要補強而非另開）
    - apps/web/src/dashboard/useCanvasList.test.ts（同上）
    - apps/web/src/dashboard/useFolderList.test.ts（同上）
    - e2e/sharing-acceptance.spec.ts（修通 6.1/6.2 紅燈）
    - e2e/share-invite.spec.ts（若有紅燈一併修通）
    - e2e/multiplayer-sync.spec.ts / 其他既存 spec（修通在地跑）
    - package.json（加 `test:e2e:smoke` 腳本）
    - .husky/pre-push（新增；如已存在則修改）
    - README.md（完整重寫）
  - Removed: (none)
- Dependencies: 無新增 npm dep。
- 不動 server / DB / WS / canvas 編輯器 / 其他既有 spec 內容。
