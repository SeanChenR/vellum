## Summary

把所有 UI 字串走 i18n（lint-style 防漏）、補齊鍵盤導航 + focus trap + 共用 focus-visible ring 樣式 + skip-to-main-content + 圖示按鈕的 ARIA 標籤，完成 phase 1 milestone roadmap 的 M9（i18n 補完 + a11y）。

## Motivation

PRD User Stories 49–51（鍵盤使用者 Tab 走完 UI、screen reader 有 ARIA、dialog/toast focus trap）目前部分滿足、部分散落。掃描狀況：

- **i18n 漏網**：dialog 按鈕「Cancel / Rename / Delete / Deleting…」等多處仍是硬寫字串（`apps/web/src/components/CanvasRenameDialog.tsx:78` 是個明顯範例）。沒有自動化測試擋未來新檔案再漏。
- **Focus trap 缺**：4 個 dialog（ShareDialog / CanvasRenameDialog / FolderDeleteDialog / MainMenu DeleteConfirmDialog）只做 Escape 關閉，沒做 Tab cycle trap——鍵盤使用者按 Tab 會跑出 modal 到背景。
- **Focus-visible ring 不一致**：unify-navbar 在 FolderTree tab + 加資料夾按鈕加了 `focus-visible:ring-warm-sepia` 樣式，但其他元件（Navbar 內 link、TopBar、CanvasCard、Dialog 內按鈕）還是 default outline。整站視覺不一致。
- **Skip-link 缺**：keyboard / screen reader 使用者進公開頁要先聽完 Navbar 才能到主內容；缺一個「跳到主內容」的隱藏 anchor。
- **Icon-only 按鈕的 ARIA**：少數圖示按鈕雖有 `aria-label`，但散在不同 component；缺一份共用 audit + 補位。

phase 1 收尾在即（M9 + M10），這次集中清掉。

## Proposed Solution

兩個 capability，行為性質完全不同：

- `i18n-audit`（清掃 + 防漏）：寫一條 lint-style 測試 `apps/web/src/i18n-audit.test.ts`，AST-parse 所有 `apps/web/src/**/*.{tsx,ts}`，找 JSX text node 內非 `{...}` 表達式的純文字 literal；對照 allowlist（`Vellum`、`v{...}`、純標點 `…·×→＋`、emoji、單字符、數字）；不在 allowlist 就 fail。先跑一次抓出所有違規，逐一改成 `t(key)`。i18n keys 走既有 namespace（`canvas.dialog.*` / `account.*` 等），zh-TW + en 同步。
- `a11y`（行為新增）：
  - 新增 `useFocusTrap(ref)` hook 在 `apps/web/src/a11y/use-focus-trap.ts`：mount 時 capture focus 到 ref 內第一個 focusable element、Tab/Shift+Tab 在 ref 內 cycle、unmount 時 restore focus 到觸發者。
  - 4 個既有 dialog 套上 `useFocusTrap`。
  - PublicLayout 加 `<a href="#main" className="sr-only focus:not-sr-only">Skip to main content</a>`，main 加 `id="main"`。
  - 新增 Tailwind utility class（在 styles.css）`focus-visible-ring`，所有可互動元件套這個（單點改一處生效）；初版定義為 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-off-white`。
  - 圖示按鈕 audit：grep `<button` without text content / with only `<svg>`；補 `aria-label={t(key)}`。

## Non-Goals

- **不為 canvas 內部加鍵盤導航**：tldraw 自帶（hard rule #5 延伸——canvas / multiplayer cursor / presence 都不動）。
- **不為 i18n 加語言切換 dropdown UI**：phase 1 out-of-scope guard、瀏覽器 detect 即可。
- **不做 RTL（right-to-left）支援**：phase 2+，目前只支援 zh-TW + en（兩者都 LTR）。
- **不為 multiplayer cursor / presence 加 ARIA live region**：cursor 必須 instant（hard rule），不該有 screen reader 公告干擾。
- **不為 tldraw 自家的內部元素加 ARIA / 加 i18n**：tldraw 自帶英文與 a11y，phase 1 用既有；i18n 其它語的工作 phase 2+ 上游 tldraw 改。
- **不做 axe-core 自動化掃描**：phase 1 用 lint-style 測試 + 手動 smoke 檢查；axe-core 是 phase 2 polish。
- **不做螢幕閱讀器 announcement 的 toast spec**：phase 1 toast 沿用 tldraw 自帶（`role="alert"` 內建），不另外加 aria-live。

## Alternatives Considered

- **i18n 用第三方 lint plugin（eslint-plugin-i18next、i18next-extract）**：要先把 oxlint / eslint config 接起來、且未必擋得住 JSX 內 hardcoded 字串；自寫 30 行 AST-walk 測試已涵蓋；reject。
- **Focus trap 用 npm `focus-trap-react`**：穩定但 +5KB bundle、且 Vellum 只有 4 個 dialog；自寫 hook ~40 行、不依賴；reject。
- **每個 component 自己定義 focus 樣式**：散布、難一致；改用單一 utility class 一處生效；adopt。
- **把 i18n 與 a11y 合成一個 capability**：兩件事性質不同（audit 是清掃工、a11y 是行為新增），spec 文件混雜；reject 拆兩個。
- **Skip-link 也加在 dashboard / 帳號頁**：dashboard 是 app-internal、進去就是工作介面、沒 marketing-style nav 干擾；只在 PublicLayout 加；adopt（與 unify-navbar 內 PublicLayout vs AppLayout 拆分一致）。

## Impact

- Affected specs: `i18n-audit`（新）、`a11y`（新）
- Affected code:
  - New:
    - apps/web/src/i18n-audit.test.ts
    - apps/web/src/a11y/use-focus-trap.ts
    - apps/web/src/a11y/use-focus-trap.test.ts
  - Modified（i18n hardcoded 字串改 t(key)；具體每檔逐項在 tasks.md 列）:
    - apps/web/src/components/CanvasRenameDialog.tsx
    - apps/web/src/components/FolderDeleteDialog.tsx
    - apps/web/src/components/CanvasMoveDialog.tsx
    - apps/web/src/components/CanvasCreateDialog.tsx
    - apps/web/src/components/CanvasDeleteDialog.tsx
    - apps/web/src/components/FolderCreateDialog.tsx
    - apps/web/src/components/FolderRenameDialog.tsx
    - apps/web/src/canvas/ShareDialog.tsx
    - apps/web/src/auth/LoginPage.tsx
    - apps/web/src/account/DeleteAccountDialog.tsx
    - apps/web/src/landing/PublicLayout.tsx
    - apps/web/src/dashboard/DashboardPage.tsx
    - apps/web/src/components/UserAvatar.tsx
    - apps/web/src/styles.css（新增 focus-visible-ring utility class）
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
  - 套 focus trap 的 dialog（不新增檔案，只 modify）:
    - apps/web/src/canvas/ShareDialog.tsx
    - apps/web/src/components/CanvasRenameDialog.tsx
    - apps/web/src/components/FolderDeleteDialog.tsx
    - apps/web/src/chrome/MainMenu.tsx
  - 套 focus-visible-ring utility 的 component（散布）：Navbar 內 a tag、TopBar、CanvasCard、UserAvatarMenu、所有 dialog 內按鈕、Footer 內 a tag——具體清單由 i18n-audit.test.ts 同款 AST 工具列出
  - Removed: (none)
- Dependencies: 無新增 npm dep（lint-style 測試用 bun built-in path / fs / TypeScript-native 字串掃；focus trap 純 React hook）
- 不動 server / DB / WS / canvas 編輯器內 / multiplayer cursor
