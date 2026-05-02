## Why

Phase 1 PRD User Stories 29–37 要求 canvas owner 能 (a) 用 email 邀請特定協作者、(b) 開公開 link 三檔切換（closed / link-view / link-edit）、(c) rotate link 撤回外流存取、(d) 改 / 移除已邀請成員權限、以及 (e) 收到邀請或拿到公開 link 的人能順利進入 canvas（含未登入訪客）。M4 已經把多人即時協作鋪好，但目前 PermissionChecker 只認 owner、`canvas_shares` 與 `canvas_share_links` 兩張表還沒建、`/api/canvas?scope=shared` 永遠回空、TopBar 的 Share 按鈕仍是 placeholder toast、sync 握手沒有支援匿名訪客。本變更把這些一次補完，讓 M4 的 sync 路徑能承載「擁有者 / 已邀請編輯 / 已邀請唯讀 / 公開 link 訪客」四種身份。

## What Changes

- 新增 `canvas_shares` 表（`canvas_id`, `user_id`, `role` enum `editor|viewer`, `created_at`）— PRD「Sharing 邏輯」已經點名
- 新增 `canvas_invites` 表（`canvas_id`, `email`, `role`, `token` unique, `expires_at`, `created_at`）— 承載尚未接受 invite 的 email-only 邀請（已存在的 user 直接寫 `canvas_shares`，不走 invite 表）
- 新增 `canvas_share_links` 表（`canvas_id` PK, `token` unique, `mode` enum `closed|view|edit`, `created_at`, `rotated_at`）— 一張 canvas **永遠對應一個 link record**，三檔切換改的是 `mode` 欄位
- 新增 REST 端點：
  - `GET    /api/canvas/:id/share` 回傳目前 members + invites + share link 狀態
  - `POST   /api/canvas/:id/share/invite` body `{ email, role }` — 已存在的 user 直接寫 `canvas_shares`、未存在則寫 `canvas_invites` 並寄信
  - `PATCH  /api/canvas/:id/share/members/:userId` body `{ role }` — 改 share role（owner-only）
  - `DELETE /api/canvas/:id/share/members/:userId` — 移除 share（owner-only）
  - `DELETE /api/canvas/:id/share/invites/:inviteId` — 撤回未接受的 invite（owner-only）
  - `PUT    /api/canvas/:id/share/link` body `{ mode }` — 切換 closed/view/edit（owner-only）
  - `POST   /api/canvas/:id/share/link/rotate` — 重新產生 token，舊 link 立即失效（owner-only）
  - `GET    /api/share/invite/:token/accept` — 接受 invite：要求登入後寫 `canvas_shares` + 刪掉 invite，redirect 到 `/canvas/:id`
- 修改 `GET /api/canvas?scope=shared` — 回傳目前 user 在 `canvas_shares` 有 row 的 canvases（M2 暫時短路回空，現在實作完整查詢 + JOIN）
- 修改 `PermissionChecker.canAccess(user, canvas, action)` — 加入 shared editor / shared viewer / public-link-view / public-link-edit / anonymous 五種身份判斷；新增 `canAccess(null, canvas, ...)` 路徑專門給 public link 用
- 修改 multiplayer-sync 握手：query string 帶 `?token=<share-link-token>` 走 public-link path（無 session cookie 也能升級），server 解析 token → 對 `canvas_share_links.mode` 給對應 role；mode=closed 一律 4403；anonymous 訪客 user-id 形如 `anon:<sessionRandom>`
- 新增 sync server 主動踢人（mid-session revocation）：share 被移除 / link mode 改 closed / link 被 rotate 時，server 端 close 受影響 WS（close code 4403）並呼叫 sync server `notifyAccessRevoked(canvasId, userId | "all")`
- 新增前端 ShareDialog 元件（modal，由 TopBar Share 按鈕觸發，取代既有 placeholder toast）：三段 UI — 「邀請成員」（email + role）、「目前成員清單」（含 pending invites、role 切換、移除）、「公開 link」（mode 三檔 radio、copy 按鈕、rotate 按鈕）
- 新增 invite 接受流程：email 內含 `https://<host>/api/share/invite/<token>/accept`；點下後若未登入導 `/login?redirect=...`；登入完成寫 `canvas_shares` + 刪 invite + redirect 至 `/canvas/:id`
- 新增 React Email template `share-invite`（zh-TW + en）含邀請者姓名、canvas 標題、accept 按鈕
- 新增 anonymous 訪客 client 路徑：`/canvas/:id?share=<token>` 開啟時若無登入 session，sync hook 直接帶 token 升級 WS（不導向 /login）；TopBar 顯示「Anonymous {Animal}」並隱藏 user menu / Sign out
- 新增 client-side viewer-mode 唯讀：若握手回的 role 是 viewer，sync hook 把 isReadonly=true 傳給 tldraw store；TopBar 顯示「View only」標籤
- i18n：新增 sharing 相關 zh-TW + en string（dialog labels、role names、error keys、email body）
- 新增 rate-limit 規則：`POST /api/canvas/:id/share/invite` 10 次/60s/user；`POST .../link/rotate` 5 次/60s/user
- E2E：新增 1 條 share 邀請接受 happy path（owner 建 canvas → 邀請 user2 → user2 收信點 link → 兩邊看到同 canvas）；新增 1 條 public link happy path（owner 開 link-view → 未登入瀏覽器訪問成功進唯讀 canvas）

## Non-Goals

- 「申請存取」（request access）流程 — PRD 明列 phase 1 不做
- Owner 離開自己的 canvas — PRD 明列 owner 不能離開自己的 canvas
- 公開 link 的 password / expiration — 三檔切換之外不做更細
- 真寄信（Resend） — 仍走 Mailpit 容器，phase 2 才換
- 讓 viewer 看 cursor 但不發 cursor — 簡化處理：viewer 也會送 own cursor 給其他人看（tldraw 內建行為）
- Share-link 帶到 dashboard 的「Shared with me」分區 — `scope=shared` 只反映 `canvas_shares`（已 invite 並接受的成員），公開 link 訪客不在 dashboard 列表
- 多 owner / 轉移 ownership — 不做，owner 終身綁定到 user_id
- Anonymous 訪客 sign-up upsell — Phase 1 不顯示

## Capabilities

### New Capabilities

- `sharing`: 完整的分享系統 — `canvas_shares` / `canvas_invites` / `canvas_share_links` 三張表 + 對應 REST 端點 + invite email + public link 三檔切換 + ShareDialog UI + anonymous 訪客流程

### Modified Capabilities

- `canvas-management`: `GET /api/canvas?scope=shared` 從 stub 短路改成真實查詢 `canvas_shares` JOIN canvases；PermissionChecker 從 owner-only 擴充到 owner / shared editor / shared viewer / public-link / anonymous
- `multiplayer-sync`: 握手新增 public-link token path（query `?token=<...>`，免 session cookie），role 由 `canvas_share_links.mode` 決定；新增 mid-session revocation（share 異動觸發 close 4403）；viewer role 走 isReadonly
- `canvas-editor`: TopBar Share 按鈕從「placeholder toast」改為「打開 ShareDialog」；TopBar 新增 viewer-mode read-only 視覺指示

## Impact

- Affected specs: 新增 `sharing`；修改 `canvas-management`、`multiplayer-sync`、`canvas-editor`
- Affected code:
  - New:
    - apps/api/drizzle/0002_share.sql
    - apps/api/src/share/index.ts
    - apps/api/src/share/share.test.ts
    - apps/api/src/share/invite-token.ts
    - apps/api/src/share/invite-token.test.ts
    - apps/api/src/share/link-token.ts
    - apps/api/src/share/link-token.test.ts
    - apps/api/src/email/templates/share-invite.tsx
    - apps/api/src/email/share-invite.test.ts
    - apps/web/src/canvas/ShareDialog.tsx
    - apps/web/src/canvas/ShareDialog.test.tsx
    - apps/web/src/canvas/useShareState.ts
    - apps/web/src/canvas/useShareState.test.ts
    - apps/web/src/auth/AnonymousCanvasGuard.tsx
    - apps/web/src/auth/AnonymousCanvasGuard.test.tsx
    - e2e/share-invite.spec.ts
    - e2e/share-public-link.spec.ts
  - Modified:
    - apps/api/src/db/schema.ts
    - apps/api/src/lib/permission.ts
    - apps/api/src/lib/permission.test.ts
    - apps/api/src/lib/rate-limit-rules.ts
    - apps/api/src/canvas/index.ts
    - apps/api/src/canvas/canvas.test.ts
    - apps/api/src/sync/auth.ts
    - apps/api/src/sync/auth.test.ts
    - apps/api/src/sync/index.ts
    - apps/api/src/sync/index.test.ts
    - apps/api/src/index.ts
    - apps/web/src/canvas/CanvasPage.tsx
    - apps/web/src/canvas/Editor.tsx
    - apps/web/src/canvas/use-sync-store.ts
    - apps/web/src/chrome/TopBar.tsx
    - apps/web/src/chrome/TopBar.test.tsx
    - apps/web/src/router.tsx
    - packages/shared/src/api-contract.ts
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
