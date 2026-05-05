## Context

M8 是 phase 1 milestone roadmap（agent memory `project_milestones.md`）內第 8 個交付段，目標把品牌 / 動畫 / Landing Page 收齊。M9（i18n + a11y 補完）和 M10（test coverage 補位）跟在後面，所以這個 milestone 的產出必須讓後續兩段直接驗收（i18n key 從 day 1 就齊全、a11y 屬性從生成時就有）。

當前狀態：
- **Brand tokens 已宣告但未充分利用**：`apps/web/src/styles.css:8-19` 內 `--color-ink-navy / --color-parchment-cream / --color-warm-sepia / --color-off-white` 與 Inter / Newsreader 已就位；目前主要在 dashboard、editor chrome、auth 頁面用。Landing 頁只用了一小部分。
- **Logo 與 Favicon 已就位**：`asset/vellum-logo.png`（3.7MB，原始）、`asset/vellum-logo-removebg.png`（47KB，透明背景）、`asset/vellum-favicon.png`（15KB，羽毛筆插畫）。`vellum-logo.png` 已被 `apps/web/src/assets/vellum-logo.png` 引用。Favicon 還沒被任何地方引用。
- **HomePage 是 inline minimal stub**：`apps/web/src/router.tsx:128-160`（33 行）—— logo + tagline + Login button，沒有 hero / features / CTA / Navbar / Footer。
- **沒有 About 頁**、**沒有公開 Layout 殼**、**沒有 Navbar / Footer 元件**。
- **動畫庫都沒裝**：`grep -r "from \"motion\"" apps/web/src` 0 hits；package.json 只有 `motion` v12.38（已裝但未用，是之前 day-1 scaffolding 留下的占位），沒有 magicui / animate-ui。
- **既有 dialog 是 native createPortal + Tailwind**，沒有 enter / exit transition（`apps/web/src/chrome/MainMenu.tsx` DeleteConfirmDialog 是個範例）。
- **Toast 用 tldraw 自帶的 useToasts**（剛在 add-export 接好），不需要我們自己做 toast 動畫。

設計流程資源（外部）：
- **ui-ux-pro-max**：CSV 設計知識搜尋庫，位於 `~/.shared/ui-ux-pro-max/data/` + `~/.shared/ui-ux-pro-max/scripts/search.py`。8 個 domain（product / style / typography / color / landing / chart / ux / stack）+ 9 個 stack（含 react / shadcn / html-tailwind）。Workflow 描述在 `~/Sean/MasterConcept/uiux-pro-max-skill/.agent/workflows/ui-ux-pro-max.md`。內建 pre-delivery checklist（icons / cursor / contrast / spacing / a11y / responsive）。
- **frontend-design skill**：Claude 內建，描述為「Generates creative, polished code that avoids generic AI aesthetics」。

約束（hard rules from CLAUDE.md）：
- TDD-first：邏輯走 TDD（Navbar 行為 / 動畫 primitives 邏輯 / route 連線）；視覺走預覽迭代（Hero 排版 / Hover 效果 / 字距 / 留白）。
- i18n：所有新 string 走 t(key)，zh-TW / en 同 PR 補齊。
- 動畫 discipline：landing 重動畫、in-app 微動畫、canvas / multiplayer cursor 不動。
- Bun-native preference：能用瀏覽器 API 就用，動畫庫是不可避免的 npm dep。
- Out-of-scope：mobile（< 768px）、dark mode、marketing 深度頁、SEO / analytics 全部 phase 2+。

## Goals / Non-Goals

**Goals:**

- Landing 與 About 兩頁都讓未登入訪客在 30 秒內理解「這是 craftsmanship-driven 個人 / 小團隊白板工具」與「為何是這個工具而不是 Whimsical」。
- Navbar / Footer 兩個共用元件，公開頁面共用，已登入訪客 / 未登入訪客都使用同一份。
- 動畫底層 wire 完成後，往後 UI 工作（M9 a11y / phase 2 features）想加微動畫只要 import primitive，不需要重新做架構決策。
- Pre-delivery（push 前）跑過 ui-ux-pro-max 內建 checklist——icons / cursor-pointer / hover stable / light-mode contrast / floating navbar spacing / responsive breakpoints。
- 動畫滿足 `prefers-reduced-motion`：使用者 OS 設定「降低動態效果」時所有 enter / exit transition 縮成 0ms（無 jitter、無 layout shift）。
- 既有 dialog 系列（ShareDialog / CanvasRenameDialog / FolderDeleteDialog）有平滑 enter / exit fade + scale 過場。
- Coverage 70%+ 涵蓋 motion primitives 邏輯、Navbar 互動行為、HomePage / AboutPage smoke render（非視覺像素）。

**Non-Goals:**

- 不做 marketing 深度頁、不做 mobile 響應、不做 dark mode、不做 SVG logo、不做 SEO / analytics、不在 canvas / cursor 加動畫（已於 proposal Non-Goals 詳列）。
- 不做 i18n locale dropdown 切換 UI（語言由瀏覽器 detect，後續可加；不在 M8 範圍）。
- 不做動畫播放速度 / 強度的個人化設定（reduced-motion OS 設定即可）。

## Decisions

### Use ui-ux-pro-max as design knowledge layer, frontend-design as code generator

實作前先用 `python3 ~/.shared/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain>` 蒐集設計參考；蒐集完再呼叫 `frontend-design` skill 把參考編譯成具識別度的 React + Tailwind 程式碼。Pre-delivery 跑 ui-ux-pro-max 的 checklist 把品牌不一致（emoji 當 icon、hover 跳格、light-mode contrast 不夠）的常見地雷掃乾淨。

**Search plan（會在 tasks.md 第 1 群組明確列出每一條 search command）**：
- product: "indie tool craftsmanship service"
- style: "minimal editorial elegant warm" 與 "parchment sepia"
- typography: "elegant serif headline body sans" → 確認 Newsreader / Inter pairing 在資料庫內被推薦
- color: "service warm neutral indie" → 對照既有 4 色 palette
- landing: "hero-centric craftsmanship narrative simple-cta"
- ux: "animation prefers-reduced-motion accessibility z-index"
- stack: "react shadcn tailwind"

**Rationale**：
- ui-ux-pro-max 專長是設計參考蒐集（CSV 內藏的累積經驗），但不會生 code；frontend-design 專長是生 code 但沒有結構化的設計知識基底。組合起來才是完整流程。
- ui-ux-pro-max checklist 跟 vellum hard rules 沒衝突，反而補強 light-mode contrast 與 cursor-pointer 這類容易漏的細節。

**Alternatives considered**：
- 只用 frontend-design：generic AI aesthetics 風險高、配色字體選擇沒結構化參考；reject。
- 只用 ui-ux-pro-max：搜尋結果是文字描述，最後還是要寫 code；reject。
- 引入 Figma / Pencil 設計檔再 export：phase 1 是個人專案無設計師時間，工序倍增；reject。

### Two new capabilities: `public-pages` + `motion-system`

`public-pages` 涵蓋 Homepage / About / Navbar / Footer / PublicLayout / favicon。`motion-system` 涵蓋三個 npm dep wire、共用 primitives（`<FadeIn>` / `<SlideIn>` / `<ScaleIn>` / `<StaggerContainer>`）、適用 / 禁用區域規則，以及在既有 in-app 元件上套用 primitives。

**Rationale**：
- `public-pages` 是 user-facing 的「頁面」需求；`motion-system` 是 cross-cutting 的「行為」需求。混在一個 capability 內以後想加 phase 2 marketing 頁就會跟動畫 primitives 攪在一起。
- 兩個 capability 各有獨立的 spec scenarios，archive 後 spec 結構清楚。

**Alternatives considered**：
- 一個大 `branding-and-landing` 合起來：spec 文件混雜、未來分裂困難；reject。
- 動畫不單獨成 capability，每個既有 capability 加 MODIFIED requirement 補動畫：散開後失去全局規則（動畫適用 / 禁用區域）的單點記載；reject。

### Public layout shell extracted as `<PublicLayout>` component

新增 `apps/web/src/landing/PublicLayout.tsx`：top-level `<div>` → `<Navbar>` → `<main>{children}</main>` → `<Footer>`。HomePage 與 AboutPage 都包在這個殼內。Navbar / Footer 各自從 i18n 拉字串、各自處理 a11y（landmark roles、skip link）。

**Rationale**：
- 公開頁面只有 Homepage / About 兩個（phase 1），抽 layout 看起來是 over-engineering，但 Navbar / Footer 一旦複製貼上，未來品牌 logo 改字、Footer 加版號、social link 都要改兩處。
- TanStack Router 支援 layout route 但沒必要在這 milestone 重構整個 routing tree——元件級的 layout 殼足夠。

**Alternatives considered**：
- 各 page 自己 render Navbar / Footer：複製貼上、難維護；reject。
- 用 TanStack Router 的 layout route：M8 範圍變大、要重構 router.tsx；reject。

### Motion primitives API: 4 個簡單元件，反映「方向 + 觸發時機」

新增 `apps/web/src/motion/primitives.tsx`，匯出：

```typescript
<FadeIn delay?={number} duration?={number} reducedMotion?={boolean}>
<SlideIn from={'left' | 'right' | 'top' | 'bottom'} delay?={number}>
<ScaleIn delay?={number} initialScale?={number}>
<StaggerContainer staggerMs?={number}>{children}</StaggerContainer>
```

每個 primitive 內部用 `motion`（framer-motion 後繼）的 `motion.div` + `useReducedMotion()` hook；偵測到 OS 設定 reduced-motion 時把 duration 設為 0。Hero / features 段落直接用這 4 個 primitive 組合，不引入 MagicUI / Animate UI（兩者是 shadcn-CLI copy-into-source 模式，repo 還沒 wire；phase 1 craftsmanship 風格不需要 typing / marquee 那類華麗元件）。

**Rationale**：
- 4 個 primitive 涵蓋 phase 1 動畫的 90%（Hero fade、Section slide、Card scale、List stagger）。多了會 over-engineer。
- `useReducedMotion` 是 motion lib 內建 hook，直接複用、不自己寫 polyfill。
- 不引入 MagicUI / Animate UI 可省下 shadcn registry 的安裝與 components.json 配置——這兩個元件庫本來就是 phase 2 marketing 加強時才需要。

**Alternatives considered**：
- 不抽 primitive、每個頁面自己呼叫 `motion.div`：重複、難集中改 default duration；reject。
- 抽到 design-system package：phase 1 沒 design-system package，新增一個 workspace 太重；reject。

### Dialog enter / exit motion: 套上 `<AnimatePresence>` + scale-fade

既有三個 dialog（ShareDialog / CanvasRenameDialog / FolderDeleteDialog）都改成在 mount / unmount 時透過 `motion.div initial / animate / exit` 加 fade（opacity 0 → 1）+ scale（0.95 → 1，180ms）。MainMenu 的 DeleteConfirmDialog 也套上。

**Rationale**：
- Dialog 突然出現 / 消失感覺粗糙，和「craftsmanship-driven」的 brand voice 衝突。
- 180ms 是 ui-ux-pro-max checklist 推薦的 sweet spot（150-300ms 之間）。
- Reduced-motion 下 duration 0ms 即可，沒有 a11y 風險。

**Alternatives considered**：
- 不加動畫：phase 1 已經到 M8，補完成本低；reject。
- 用 CSS transition：dialog mount / unmount 時 React 會直接卸 DOM，CSS transition 抓不到 unmount 那一幕；reject。

### Favicon: PNG 直接連，不轉 ICO / SVG

把 `asset/vellum-favicon.png` 複製到 `apps/web/src/assets/vellum-favicon.png`，在 `apps/web/src/index.html` `<head>` 加：

```html
<link rel="icon" type="image/png" sizes="64x64" href="/src/assets/vellum-favicon.png" />
<title>Vellum — Craftsmanship-driven Whiteboard</title>
<meta name="description" content="A canvas-based collaborative whiteboard built with care. Light, fast, and made for thinking." />
```

**Rationale**：
- 現代瀏覽器全部支援 PNG favicon；不需要 .ico 相容檔。
- Phase 1 不做 dark mode / 多解析度組合；單張 PNG 即可。
- `<title>` 與 `<meta description>` 是 phase 1 唯一的兩個 SEO 元素（PRD 內 SEO out-of-scope 但這兩個是基本禮貌）。

**Alternatives considered**：
- 用 favicon.ico + favicon.svg + apple-touch-icon 全套：phase 2 上線前再補；reject。
- 不加 favicon：tab 沒 logo 看起來像未完成；reject。

### `motion` 已在 package.json 內，本 milestone 不引入 MagicUI / Animate UI

`apps/web/package.json` 已有 `motion@^12.38.0`（之前 day-1 scaffolding 裝過但沒用）。M8 不再新增 npm dep——MagicUI 與 Animate UI 是 shadcn-CLI copy-into-source 元件庫（`bunx shadcn@latest add <registry-url>` 把元件 source 抓到 `apps/web/src/components/ui/`），repo 還沒 wire shadcn registry（無 `components.json` 與 `src/components/ui/`），引入這兩個 lib 變成「先做 shadcn registry → 再選 MagicUI / Animate UI 子元件 → copy-paste source 到專案」三段工序，超出 M8 範圍。

**Rationale**：
- `motion` 是基底、已裝、單一個 lib 就涵蓋本 milestone 全部動畫需求。
- 不裝 MagicUI / Animate UI 對 craftsmanship-driven 風格沒有損失——hero / features 段落用 motion 直接寫即可。
- 引入 shadcn registry 是獨立的工程決策，phase 2 marketing 加強時再評估。

**Alternatives considered**：
- 引入 shadcn registry + MagicUI / Animate UI：M8 範圍變成 1.5–2 週；reject。
- 用 framer-motion 而非 motion：`motion` 是 framer-motion 後繼版（同團隊）、API 一樣、bundle 小；reject。
- 不裝任何動畫 lib：要自寫 keyframe / RAF；工序倍增；reject。

## Risks / Trade-offs

- **[Risk] motion 直接寫 hero / features 過於依賴手工 keyframe → 風格不一致** → Mitigation：4 個 motion primitive 集中管理 default duration / easing / stagger interval，所有 surface 都走同一組常數；單一檔案 `motion/primitives.tsx` 是 source-of-truth。
- **[Risk] ui-ux-pro-max 推薦的色票 / 字體跟既有 brand tokens 衝突** → Mitigation：search 結果只當參考，最終 source-of-truth 是 styles.css 內既有 4 色 + Inter / Newsreader，不接受推翻。若搜出的 style 跟既有 tokens 完全不合（例如推薦 cyber-punk neon），就放棄那組 search 結果，重搜更貼近 craftsmanship 的 keyword。
- **[Risk] 動畫 jitter 在 multiplayer canvas 旁邊出現** → Mitigation：motion-system spec 明文禁止在 canvas / cursor 加動畫；既有 Editor.tsx 不引用 motion primitives；coverage 內加一個「Editor.tsx 不 import 任何 motion primitive」的靜態斷言測試。
- **[Risk] 動畫不滿足 `prefers-reduced-motion`** → Mitigation：每個 primitive 內呼叫 `useReducedMotion()` 把 duration 縮為 0；測試裡 mock window.matchMedia('(prefers-reduced-motion: reduce)') = true 跑一條 case。
- **[Risk] About 頁文案花太久** → Mitigation：tasks.md 把文案 draft 切成獨立 task（不是「實作 AboutPage」整包做完），先寫純結構與 i18n key；文案先放短句，user review 時迭代。
- **[Trade-off] 不做 mobile 響應** → Phase 1 user 全是桌面瀏覽，但 < 768px 直接看到 broken layout 不好。Mitigation：在 styles.css 加一個 `@media (max-width: 767px)` 顯示「Vellum 暫不支援行動裝置，請以桌面瀏覽」的 placeholder。這個對 PRD 沒違反——只是 graceful 降級訊息，不是支援 mobile。
- **[Trade-off] PublicLayout 抽元件 vs. 直接複製** → 抽元件當下成本高（多寫 1 個檔 + 1 份測試），但兩頁共用後，未來修 footer / nav 一處生效；長期 ROI 為正。
