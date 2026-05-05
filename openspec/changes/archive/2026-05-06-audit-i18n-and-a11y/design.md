## Context

phase 1 milestone roadmap 倒數第二段（M9）。M8（unify-navbar 那一波也包進來的 landing / Navbar / AppLayout / Tabs）已收工；M10 是 test 覆蓋率補位。M9 把整套 chrome 的 i18n + a11y 收齊，M10 再做 coverage 衝刺，phase 1 就到頭。

當前狀況快照（grep 自 unify-navbar 收完之後）：

- **i18n**：71 個 .tsx 用 `t(key)`，但仍有 hardcoded 字串。具代表性的違規（不是窮舉）：
  - `apps/web/src/components/CanvasRenameDialog.tsx`：button text "Cancel"、"Rename"、"…"（pending state）
  - `apps/web/src/components/FolderDeleteDialog.tsx`：button text "Cancel"、"Delete"、"Deleting…"
  - 其他 dialog 大致同款違規
  - LoginPage 內某些表單 label / placeholder 雖走 t() 但小字 "or" 之類連結器是 hardcoded
- **a11y**：
  - 0 個 `<button aria-label>`：grep 出來的 62 個 `<button>` 多數有可見文字 OK；但少數圖示按鈕（FolderTree edit/delete、TopBar 內某些 icon button）需補
  - 4 個 dialog 都用 `useEffect addEventListener("keydown")` 做 Escape 關閉，沒做 Tab cycle trap
  - PublicLayout 沒 skip-link
  - Tab focus 樣式不一致：FolderTree（unify-navbar 補過 warm-sepia ring）vs Navbar 內 a tag（default outline）vs Dialog 內 cancel/confirm 按鈕（default focus）
- **既有 deep modules 可重用**：
  - `apps/web/src/motion/primitives.tsx`：FadeIn/SlideIn/etc.，與 a11y 無交集，純動畫
  - `apps/web/src/motion/dialog.tsx`：DialogMotion/DialogPanel，做 enter/exit 動畫；focus trap 可掛在 DialogPanel 上、不破壞既有 dialog API

PRD 約束：
- US 49：Tab 走完所有 UI 元件（焦點順序合理 + 視覺可見）
- US 50：所有元件有 ARIA label（icon-only 按鈕補）
- US 51：dialog / toast focus trap（Tab 不會跳出）

CLAUDE.md 約束：
- TDD 嚴格：i18n-audit 測試 / focus-trap hook 測試
- 不動 canvas / cursor / presence

## Goals / Non-Goals

**Goals**：

- **i18n**：lint-style 測試擋未來再漏；既有違規一次清掉；zh-TW + en 同步補。
- **focus trap**：4 個既有 dialog 可用 Tab/Shift+Tab 在內部 cycle，不會跑出 modal；Escape 仍可關；unmount 時 focus 還給觸發者。
- **focus-visible**：所有可互動元件套同一條 utility class，鍵盤使用者看到一致的 warm-sepia ring；滑鼠使用者不出現多餘 ring（用 `:focus-visible` 不是 `:focus`）。
- **skip-link**：PublicLayout 加 anchor；keyboard / screen reader 進公開頁可一鍵跳到主內容。
- **icon-only 按鈕 ARIA**：grep 出所有沒可見文字的 button、補 `aria-label={t(key)}`。

**Non-Goals**（已於 proposal 詳列）：
- 不動 canvas / cursor、不做 RTL、不做語言切換 UI、不引 axe-core、不做 toast aria-live、不為 dashboard / 帳號頁加 skip-link（app-internal 工作面，無 marketing nav 干擾）。

## Decisions

### i18n-audit lint-style 測試：自寫 AST scanner，不引 eslint plugin

新增 `apps/web/src/i18n-audit.test.ts`，邏輯：
1. Glob `apps/web/src/**/*.{tsx,ts}`，排除 `*.test.{ts,tsx}` 與 `*.gen.css`
2. 每檔用 TypeScript compiler API（`typescript` 套件已隨 React 工具鏈間接安裝；不行就 fallback 純字串 regex）parse JSX text node、JSX attribute value
3. 對每個純文字 literal（不是 `{...}` 表達式）比對 allowlist：
   - `Vellum` 自身（品牌名）
   - `v\\d+(\\.\\d+)*` 版本字串模式
   - 純標點 `…`、`·`、`×`、`→`、`＋`、`/`、`-`
   - 單字符 ASCII（`?`、`!` 之類）
   - 純數字
   - emoji（unicode 範圍）
4. 不在 allowlist 就把 `{filepath, line, content}` 蒐集起來
5. 測試結尾 assert 違規清單為空

**Rationale**：
- 30–60 行純 TypeScript 可完成；零依賴，跟 Bun-native preference 一致。
- TypeScript compiler API 已被 vellum 用作 typecheck（`tsc --noEmit`），不算新依賴。
- 測試的失敗訊息直接列出每個違規的 `<file>:<line> ─ "<content>"`，user fix 起來容易。

**Alternatives considered**：
- `eslint-plugin-i18next` 之類：要先把 eslint 接起來（vellum 用 oxlint）；reject。
- `i18next-extract` 抽 keys：用途不同（從 t(key) 抽 keys 到 locale），擋不住 hardcoded；reject。
- 純 grep`>[A-Z][a-z]+<` 的字串掃：誤報太多（`<svg>`、`<path>` 內的數字、type literal）；reject。

### useFocusTrap hook：自寫 ~40 行 React hook，不引第三方

新增 `apps/web/src/a11y/use-focus-trap.ts`：

```typescript
export function useFocusTrap<T extends HTMLElement>(opts: {
  active: boolean;
  ref: React.RefObject<T>;
}): void {
  // 1. on `active` true: capture document.activeElement → previousFocus ref
  // 2. find first focusable inside ref.current via querySelectorAll(FOCUSABLE_SELECTORS)
  // 3. call .focus() on it (next tick)
  // 4. attach keydown listener on ref:
  //    - Tab: if focused == last focusable, prevent default + focus first
  //    - Shift+Tab: if focused == first, prevent default + focus last
  // 5. on `active` false / unmount: restore previousFocus.focus()
}
```

`FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'`

**Rationale**：
- `focus-trap-react` 是 ~5KB 額外 bundle、且只 4 個 dialog 用；自寫成本低。
- React-native hook + `useEffect` cleanup 跟既有 dialog 的 keydown handler pattern 一致。
- 測試（`use-focus-trap.test.ts`）跑 happy-dom 內 jsdom-style focus 模擬：mount → 預期第一個 focusable 拿焦點；按 Tab/Shift+Tab → 在 ref 內 cycle；unmount → 預期 previous focus 還回。

**Alternatives considered**：
- `focus-trap-react` npm：bundle / dep 成本太高；reject。
- 改 dialog 用 `<dialog>` HTML element（內建 focus trap）：跟既有 portal-based dialog 結構衝突，需重做動畫整合；reject。

### focus-visible-ring 用 Tailwind utility，不寫 CSS variable

在 `apps/web/src/styles.css` 加：

```css
@layer utilities {
  .focus-visible-ring {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-off-white;
  }
}
```

所有可互動元件套 `className="... focus-visible-ring"`。改一處（換 ring 顏色 / 寬度）全站生效。

**Rationale**：
- Tailwind v4 `@apply` 在 utility layer 內合理用法。
- 跟既有 brand tokens（warm-sepia / off-white）對齊。
- `:focus-visible` 而非 `:focus`：滑鼠點時不顯示 ring，鍵盤 Tab 時才顯示，最少打擾。

**Alternatives considered**：
- 每個元件複製 4 個 class：散布、改色要動 N 處；reject。
- 用 CSS variable + `[data-focus-visible-ring]` 屬性：抽象太重，沒有第三方 system 規定要這樣；reject。
- 用 `:focus`：滑鼠點完按鈕仍顯示 ring，視覺干擾；reject。

### Skip-link 只加在 PublicLayout

`apps/web/src/landing/PublicLayout.tsx` 在 `<Navbar/>` 之前加：

```tsx
<a
  href="#main"
  className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-navy focus:px-4 focus:py-2 focus:text-sm focus:text-white"
>
  {t("a11y.skipToMain")}
</a>
```

`<main id="main">{children}</main>` — `id="main"` 已是 PublicLayout 預設結構（已存在）。`AppLayout` 同款（雖然 dashboard 沒 marketing nav，但 keyboard skip-link 對 Navbar 也有用——一併加進 AppLayout）。

i18n key `a11y.skipToMain` zh-TW = "跳到主內容"，en = "Skip to main content"。

**Rationale**：
- WCAG 2.4.1：要求每頁有「bypass blocks」機制；skip-link 是最常見實作。
- `sr-only` 平時隱藏；keyboard Tab 第一下 focus 到它就 `focus:not-sr-only` 可見。
- ink-navy bg + white text 對比明顯，無視覺退化。

**Alternatives considered**：
- 加 ARIA landmark + screen reader 跳 landmark：landmark 已加（`<nav>` `<main>` `<footer>`）；skip-link 是給 keyboard、互補；adopt 兩個都做。
- 不加 skip-link、只靠 ARIA landmark：keyboard-only user（不開 SR）需要 skip-link；reject。

### Icon-only 按鈕 ARIA：用 i18n-audit 同款 scanner 列出、逐一補

i18n-audit 寫好之後，把它的 AST 邏輯複製一份成 `apps/web/src/a11y-audit.test.ts`，找：「`<button>` 內只有 `<svg>` / `<img>` 子節點且沒有 `aria-label` / `aria-labelledby` 屬性」的違規。先跑一次抓清單、逐一補 `aria-label={t("...")}`。

**Rationale**：
- 跟 i18n-audit 同形——一個 lint-style 防漏測試擋未來新檔案再漏。
- 既有：FolderTree edit/delete buttons（在 unify-navbar 已補過）、AppHeader（已刪）、TopBar 等需要 audit 一遍。

**Alternatives considered**：
- 手動 grep + 一次性修：未來新檔案會再漏；reject。

## Risks / Trade-offs

- **[Risk] AST-based i18n audit 對 inlined utility 字串（class names、`role="dialog"`）誤報** → Mitigation：allowlist 細化到「JSX attribute value 只在 `aria-*` / `placeholder` / `title` 等 user-visible attribute 才檢查；class / role / data-* 完全不檢查」。
- **[Risk] focus trap 在巢狀 modal（dialog 內彈 sub-popover）行為怪** → Mitigation：phase 1 沒巢狀 modal（DeleteConfirmDialog 是獨立的、不在另一個 dialog 內），不為這個情境寫 spec；spec 內顯式聲明「only top-level dialog」。
- **[Risk] focus 還回時觸發者已 unmount** → Mitigation：hook 內 try/catch + falsy check `previousFocus?.focus?.()`。
- **[Risk] skip-link 在 sr-only / focus 切換時造成 layout shift** → Mitigation：`focus:absolute` 把它從 normal flow 提出去，不擠主內容。
- **[Trade-off] 不引 axe-core** → 我們的 audit 只擋兩件具體事（hardcoded 字串、icon-only 沒 aria-label），不涵蓋 colour-contrast、heading hierarchy、landmark structure 等；phase 2 想做完整 a11y 評量再引。
- **[Trade-off] 自寫 focus trap** → 不處理 contenteditable / shadow DOM / iframe；phase 1 dialog 內沒這些；若 phase 2 加 rich text editor 在 dialog 內可能要換成 focus-trap-react。
- **[Trade-off] skip-link 文字一定可見才有用** → sr-only 平時看不到，Tab 第一下才出現；對純 keyboard 友善，但對「滑鼠使用者好奇 keyboard 怎麼用」沒幫助——可接受。
