## 1. i18n-audit lint-style test（先寫測試擋未來）

- [x] 1.1 寫 apps/web/src/i18n-audit.test.ts，依「i18n-audit lint-style 測試：自寫 AST scanner，不引 eslint plugin」決議：用 TypeScript compiler API（或 fallback 到字串掃）parse 每個 `apps/web/src/**/*.{tsx,ts}`（排除 test files），找 JSX 內 hardcoded display 字串；對照 allowlist（`Vellum`、`v\d+(\.\d+)*`、`…·×→＋/-`、單字符 ASCII、純數字、emoji）；不在 allowlist 就把 `{filepath, line, content}` 蒐集，測試結尾 assert 違規清單為空——對應「Static i18n audit fails when JSX contains hardcoded display strings」與「i18n audit runs as part of the project test suite」spec scenarios
- [x] 1.2 跑 1.1 抓出當前所有違規清單，存到 `openspec/changes/audit-i18n-and-a11y/i18n-violations.md` 暫存（最後 archive 前刪），做為後續 task 的 input

## 2. i18n hardcoded 字串清掃（依 1.2 清單逐檔）

- [x] 2.1 [P] 修 apps/web/src/components/CanvasRenameDialog.tsx：button text "Cancel"、"Rename"、"…"（pending）改成 t() 並補 zh-TW + en key
- [x] 2.2 [P] 修 apps/web/src/components/FolderDeleteDialog.tsx：button text "Cancel"、"Delete"、"Deleting…" 改成 t() 並補兩語 key
- [x] 2.3 [P] 修 apps/web/src/components/CanvasMoveDialog.tsx：所有 hardcoded display 字串（按 1.2 清單）改成 t()
- [x] 2.4 [P] 修 apps/web/src/components/CanvasCreateDialog.tsx：同上樣式
- [x] 2.5 [P] 修 apps/web/src/components/CanvasDeleteDialog.tsx：同上樣式
- [x] 2.6 [P] 修 apps/web/src/components/FolderCreateDialog.tsx：同上樣式
- [x] 2.7 [P] 修 apps/web/src/components/FolderRenameDialog.tsx：同上樣式
- [x] 2.8 [P] 修 apps/web/src/canvas/ShareDialog.tsx：1.2 清單內字串改成 t()
- [x] 2.9 [P] 修 apps/web/src/auth/LoginPage.tsx：剩餘 hardcoded 連結器 / placeholder 改成 t()
- [x] 2.10 [P] 修 apps/web/src/account/DeleteAccountDialog.tsx：同上樣式
- [x] 2.11 [P] 修 apps/web/src/dashboard/DashboardPage.tsx：剩餘 "Folders"、"Loading…"、"No canvases yet" 之類改成 t()
- [x] 2.12 同步補完 packages/shared/src/locales/zh-TW.json 與 en.json 兩個檔（zh-TW + en 同一 PR、key set 完全一致）——對應「zh-TW and en locale files share the same key set」spec scenario
- [x] 2.13 跑 1.1 i18n-audit 確認違規數歸零，達成「All visible Dashboard, Auth, and Account display strings come from i18n」requirement——對應「i18n audit passes after the cleanup」spec scenario

## 3. useFocusTrap hook（TDD）

- [x] 3.1 寫 apps/web/src/a11y/use-focus-trap.test.ts：紅燈測試 4 個情境（mount → 第一個 focusable 被 focus、Tab 從最後一個 wrap 回第一個、Shift+Tab 從第一個 wrap 回最後一個、unmount → previous focus 還回）+ SBE 範例表（3 按鈕 modal Tab cycle）——對應「System provides a reusable focus-trap React hook」spec 內 4 個 scenarios
- [x] 3.2 實作 apps/web/src/a11y/use-focus-trap.ts 至 3.1 全綠：useEffect 內 capture document.activeElement、querySelectorAll FOCUSABLE_SELECTORS、Tab/Shift+Tab keydown listener、cleanup 內 try/catch restore focus——依「useFocusTrap hook：自寫 ~40 行 React hook，不引第三方」決議
- [x] 3.3 補測試：previous focus 元素已 unmount 時 restore 不應 throw——對應 spec scenario「Deactivating the trap restores focus to the previous element」邊界

## 4. 4 個 dialog 套 useFocusTrap（不破壞既有 Escape 行為）

- [x] 4.1 [P] 修 apps/web/src/canvas/ShareDialog.tsx：useRef 包外層 dialog panel、呼叫 `useFocusTrap({ active: open, ref })`；既有 Escape close 邏輯保留——對應「All four existing dialogs trap keyboard focus while open」spec 內 ShareDialog
- [x] 4.2 [P] 修 apps/web/src/components/CanvasRenameDialog.tsx 同 4.1 樣式
- [x] 4.3 [P] 修 apps/web/src/components/FolderDeleteDialog.tsx 同 4.1 樣式
- [x] 4.4 [P] 修 apps/web/src/chrome/MainMenu.tsx 內 DeleteConfirmDialog 同 4.1 樣式
- [x] 4.5 補整合測試（任選 ShareDialog）：open 後按 Tab 數次、focus 永遠在 dialog 內；Escape 仍可關——對應「Tab inside an open dialog never escapes the dialog」與「Escape still closes the dialog」spec scenarios

## 5. focus-visible-ring utility class

- [x] 5.1 在 apps/web/src/styles.css 加 `@layer utilities { .focus-visible-ring { @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-off-white; } }`——依「focus-visible-ring 用 Tailwind utility，不寫 CSS variable」決議
- [x] 5.2 套上 Navbar 內所有 a / button：apps/web/src/landing/Navbar.tsx 的 logo a、About link、Sign-in CTA、UserAvatarMenu trigger 全部加 `focus-visible-ring` class
- [x] 5.3 [P] 套上 Footer 內 a：apps/web/src/landing/Footer.tsx 全部 a 加 `focus-visible-ring`
- [x] 5.4 [P] 套上 dialog 內 button：4 個 dialog 內 cancel / confirm / submit 按鈕加 `focus-visible-ring`
- [x] 5.5 [P] 套上 UserAvatarMenu 內 4 個 menuitem：apps/web/src/components/UserAvatarMenu.tsx
- [x] 5.6 [P] 套上 CanvasCard 內可互動元素：apps/web/src/components/CanvasCard.tsx
- [x] 5.7 [P] 套上 LoginPage 內 form 輸入 / 按鈕：apps/web/src/auth/LoginPage.tsx——對應「All interactive elements share a consistent focus-visible ring」spec scenarios

## 6. Skip-to-main-content link

- [x] 6.1 [P] 在 packages/shared/src/locales/zh-TW.json 加 `a11y.skipToMain` 鍵（值「跳到主內容」）
- [x] 6.2 [P] 在 packages/shared/src/locales/en.json 加 `a11y.skipToMain`（值「Skip to main content」）
- [x] 6.3 修 apps/web/src/landing/PublicLayout.tsx，依「Skip-link 只加在 PublicLayout」決議（其實也加進 AppLayout，是 dashboard / 帳號頁 keyboard 友善的延伸；canvas 編輯器仍不加）：在頂層 Navbar 之前加 `<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-navy focus:px-4 focus:py-2 focus:text-sm focus:text-white">{t("a11y.skipToMain")}</a>`；確保 `<main id="main">` 已存在（若無則加）——對應「PublicLayout provides a skip-to-main-content link」spec scenarios「Keyboard user sees the skip-link on first Tab」與「Skip-link is hidden visually until focused」
- [x] 6.4 修 apps/web/src/landing/AppLayout.tsx 同樣加 skip-link——對應 spec scenario「AppLayout also exposes the skip-link」
- [x] 6.5 補測試：apps/web/src/landing/PublicLayout.test.tsx assert skip-link 存在（用 querySelector `a[href="#main"]`）、預設 sr-only、focus 後變可見

## 7. Icon-only button ARIA audit

- [x] 7.1 寫 apps/web/src/a11y/icon-button-audit.test.ts，依「Icon-only 按鈕 ARIA：用 i18n-audit 同款 scanner 列出、逐一補」決議（結構與 1.1 同形）：parse `apps/web/src/**/*.tsx`，找 button 內只有 `<svg>` / `<img>` 子節點且沒 `aria-label` / `aria-labelledby` 的；測試結尾 assert 違規數歸零——對應「Icon-only buttons must declare an accessible label」spec scenarios
- [x] 7.2 跑 7.1 抓出違規清單、逐個 button 加 `aria-label={t("...")}` 並補對應 i18n key 兩語

## 8. 驗證收斂

- [x] 8.1 `bun test apps/web` 全綠（baseline 16 個 pre-existing fail 不算 regression）；新測試 i18n-audit / use-focus-trap / icon-button-audit 全綠
- [x] 8.2 `bunx oxlint apps/web/src` 不出現新增 error / warning（baseline drift 不算）
- [x] 8.3 `cd apps/web && bun run typecheck` 全綠
- [x] 8.4 手動 smoke（在 tmux 起 dev server 後）：
  - `/` Tab 第一下 → 看到 skip-link 顯示在左上角；按 Enter → focus 跳到 main
  - 所有 Tab 經過的元件都顯示 warm-sepia focus ring
  - 開 ShareDialog → Tab 數次 focus 不跑出；Escape 關閉 → focus 還回 Share button
  - dashboard 內所有按鈕 hover/focus 視覺一致
- [x] 8.5 刪除暫存檔 openspec/changes/audit-i18n-and-a11y/i18n-violations.md（archive 前清乾淨）
