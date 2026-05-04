## 1. Spike + Setup

- [x] 1.1 Spike：驗證 `@tldraw/sync-core` 的 `TLSocketRoom.handleSocketConnect({ ..., isReadonly: true })` 真的會擋 client 端送進來的 `push` op（依 design「Viewer-mode read-only：client + server 雙閘」決定 fallback 是否需要自寫過濾層）；spike 結果寫進臨時 `apps/api/src/sync/readonly-spike.test.ts` 後保留至 task 3.7 整合完再刪
- [x] 1.2 [P] 跑 `bunx drizzle-kit generate` 產 0002 migration，建 `canvas_shares (canvas_id, user_id, role enum, created_at, PK(canvas_id,user_id))`、`canvas_invites (id, canvas_id, email lowercase, role enum, token unique, expires_at, created_at)`、`canvas_share_links (canvas_id PK, token unique, mode enum, created_at, rotated_at)` 三張表 + 適當 indexes / FK ON DELETE CASCADE，更新 `apps/api/src/db/schema.ts` 對應 Drizzle types
- [x] 1.3 [P] 在 `packages/shared/src/locales/zh-TW.json` 與 `packages/shared/src/locales/en.json` 兩邊同步新增 `canvas.share.{title,inviteSection,membersSection,publicLinkSection,emailLabel,roleEditor,roleViewer,sendButton,copyLink,rotateLink,modeClosed,modeView,modeEdit,pendingBadge,removeButton,confirmRotate}`、`canvas.chrome.topbar.viewOnlyBadge`、`canvas.chrome.topbar.anonymousLabel`、`email.shareInvite.{subject,greeting,bodyPlain,acceptButton,expiresNote}`、`errors.share.{emailMismatch,inviteExpired,inviteNotFound,linkClosed,roleInvalid}` 等 keys

## 2. Tests First — Backend (TDD red)

- [x] 2.1 寫 `apps/api/src/lib/permission.test.ts` 擴充版本，蓋「Permission contract for canvas actions」MODIFIED 的全 7 種身份矩陣（owner / shared editor / shared viewer / public-link-edit / public-link-view / public-link-closed / null + 無 ctx）— 直接表格驅動每個 (identity, action) 一個 expect
- [x] 2.2 [P] 寫 `apps/api/src/share/invite-token.test.ts` 蓋「Owner invites an unknown email creates a pending invite and sends mail」與「Invite acceptance route requires email match and writes a share」的 token 工具部分（generate 32-byte base64url、唯一性 sanity、constant-length 驗證）
- [x] 2.3 [P] 寫 `apps/api/src/share/link-token.test.ts` 蓋「Owner toggles the public link mode」與「Owner rotates the public link token」的 token 工具部分（generate 32-byte base64url、rotate 產新 token 不重複、token 長度與字符集合）
- [x] 2.4 [P] 寫 `apps/api/src/share/share.test.ts` 蓋「Owner invites a known user by email creates a share immediately」「Owner invites an unknown email creates a pending invite and sends mail」「Owner reads share state for a canvas」「Owner changes a member's role」「Owner removes a share」「Owner revokes a pending invite」「Owner toggles the public link mode」「Owner rotates the public link token」「Sharing endpoints enforce per-owner rate limits」九條 — DI deps（mock email service、mock sync revocation hook、real DB or mock canvases / users / shares state）
- [x] 2.5 [P] 寫 `apps/api/src/share/share.test.ts` 內 `GET /api/share/invite/:token/accept` 子 describe 蓋「Invite acceptance route requires email match and writes a share」（logged-in matching email accept、anonymous redirect 至 login、email mismatch 403、expired token 404、deleted token 404）
- [x] 2.6 [P] 改寫 `apps/api/src/sync/auth.test.ts` 擴版本，蓋「WebSocket handshake authenticates the user via session cookie」MODIFIED（新增 token path：valid view token / valid edit token / closed mode / mismatched canvas / cookie-wins-over-token 五個 sub-scenario）與「WebSocket handshake authorizes the user against the canvas」MODIFIED 的完整 9 列 outcome 矩陣
- [x] 2.7 [P] 改寫 `apps/api/src/sync/index.test.ts` 擴版本，蓋「Sync server kicks affected sessions when access is revoked」（kind:user 只踢該 user、kind:all-anonymous 只踢 anon: 開頭、其他連線保留）與「Viewer role connects in read-only mode」（viewer 推送 push 不 broadcast、view-mode token 升 viewer 的 isReadonly=true）
- [x] 2.8 [P] 寫 `apps/api/src/email/share-invite.test.ts` 蓋「Owner invites an unknown email creates a pending invite and sends mail」的 email render 部分（給 inviterName / canvasTitle / acceptUrl / expiresAt 渲染出含 accept link 的 HTML 與 text，xss 測試 — 標題含 `<script>` 不會逃逸）
- [x] 2.9 [P] 改寫 `apps/api/src/canvas/canvas.test.ts` 擴 scope=shared 區塊，蓋「Canvas list query with scope filter」MODIFIED 新 scenario（scope=shared 回 JOIN canvas_shares 結果、自己擁有的 canvas 即使有 share row 也不在 shared scope）

## 3. Implementation — Backend (TDD green)

- [x] 3.1 改 `apps/api/src/lib/permission.ts` 擴 `canAccess(user, canvas, action, ctx?)` 簽章成 design「Permission 矩陣：`canAccess(user | null, canvas, action, ctx?)` 擴充」表格的 7 列規則；保留既有 owner-only fast path；ctx 沒給或全空時 fallback 到「無權限」，使 2.1 通過
- [x] 3.2 [P] 實作 `apps/api/src/share/invite-token.ts`（32-byte crypto random base64url generator + 7-day expiresAt 計算 helper），使 2.2 通過
- [x] 3.3 [P] 實作 `apps/api/src/share/link-token.ts`（32-byte crypto random base64url generator，依 design「Public link：每張 canvas 一筆 row，三檔切換改 mode 而非 row」），使 2.3 通過
- [x] 3.4 實作 `apps/api/src/share/index.ts` `handleShareRequest(req, session, deps)` 涵蓋 8 條 sharing 端點 + invite accept 端點：
   - `GET /api/canvas/:id/share` 回 members + invites + link
   - `POST /api/canvas/:id/share/invite` 走 design「Email invite：pending invite 用獨立表 `canvas_invites`」分流（已存在 user → 直寫 canvas_shares；不存在 → 寫 invite + 寄信）
   - `PATCH /api/canvas/:id/share/members/:userId` 改 role + 呼叫 `notifyAccessRevoked({ kind: 'user', userId })`
   - `DELETE /api/canvas/:id/share/members/:userId` 移除 + revoke
   - `DELETE /api/canvas/:id/share/invites/:inviteId` 撤 invite
   - `PUT /api/canvas/:id/share/link` 三檔切換 + lazy create + closed 時 revoke anonymous
   - `POST /api/canvas/:id/share/link/rotate` rotate token + revoke anonymous
   - `GET /api/share/invite/:token/accept` 走 design「Email invite」表的 4 步驟（找 invite、redirect login、email match 檢查、寫 canvas_shares + 刪 invite + redirect canvas）
   並在 `apps/api/src/lib/rate-limit-rules.ts` 加 `SHARE_INVITE_RULE` (10/60s) 與 `SHARE_LINK_ROTATE_RULE` (5/60s)，使 2.4 + 2.5 通過
- [x] 3.5 [P] 實作 `apps/api/src/email/templates/share-invite.tsx` React Email template（依 design「Email template：React Email + Mailpit」），共用既有 `apps/api/src/email/mailpit.ts` 寄送，使 2.8 通過
- [x] 3.6 改 `apps/api/src/sync/auth.ts`：依 design「Sync 握手：新增 public-link path」加 query token 解析，新 `SyncAuthDeps.resolveCanvasRole(userId, canvasId)` 內部查 `canvas_shares`、新增 `resolveCanvasShareLink(canvasId)` 查 `canvas_share_links`；anonymous user 用 `anon:<8char>` 形式，使 2.6 通過
- [x] 3.7 改 `apps/api/src/sync/index.ts`：實作 `notifyAccessRevoked(canvasId, scope)` 公開 method（依 design「Mid-session revocation：share 變更 → 主動 close 受影響 WS」），fetch handler 加 query token 路徑（cookie 沒給就走 token），handleSocketConnect 帶 `isReadonly = (role === 'viewer')`，使 2.7 通過；同步刪除 1.1 的 readonly-spike.test.ts
- [x] 3.8 [P] 改 `apps/api/src/canvas/index.ts` 的 list handler，scope=shared 走真實 JOIN canvas_shares + canvases 查詢（依 design「`scope=shared` 從 stub 改成真實查詢」），使 2.9 通過
- [x] 3.9 [P] 在 `apps/api/src/index.ts` 把 `handleShareRequest` 掛進 fetch dispatcher（路徑 `/api/canvas/:id/share/*` 與 `/api/share/invite/:token/accept`），把 sync server 的 `notifyAccessRevoked` 注入給 share handler 的 deps；修 `apps/api/src/sync/index.ts` 的 `SyncServerDeps.auth.resolveCanvasRole` 用真 DB query

## 4. Tests First — Frontend (TDD red)

- [x] 4.1 寫 `apps/web/src/canvas/ShareDialog.test.tsx` 蓋「ShareDialog opens from the TopBar Share button」（三段 section render、Send invite 觸發 mutation、role select 改變呼叫 PATCH、remove 按鈕呼叫 DELETE、public link 三檔 radio 切換呼叫 PUT、Copy 按鈕拷貝 link、Rotate 按鈕呼叫 POST rotate）
- [x] 4.2 [P] 寫 `apps/web/src/canvas/useShareState.test.ts` 蓋 hook 對應的 React Query 行為（initial fetch、optimistic update on invite/patch/remove、`invalidateQueries(['share', canvasId])` 在 mutation settle 觸發）
- [x] 4.3 [P] 寫 `apps/web/src/auth/AnonymousCanvasGuard.test.tsx` 蓋「Anonymous visitors enter via public link without login redirect」（無 user + 有 ?share token → 直接 render；無 user + 無 token → redirect /login；有 user → 直接 render 不在意 token）
- [x] 4.4 [P] 改 `apps/web/src/canvas/use-sync-store.test.ts` 加新 case：sync hook 接受 token from URL → 帶到 useSync 的 uri；handshake 拒絕（4403）→ disconnect；role=viewer 時 result 含 `role: 'viewer'`、role=editor 時含 `role: 'editor'`
- [x] 4.5 [P] 改 `apps/web/src/chrome/TopBar.test.tsx`：蓋「TopBar exposes canvas title, folder breadcrumb, share dialog, and user menu」MODIFIED（owner 看見 share 按鈕並開 dialog；非 owner / anonymous 看不到 share 按鈕；role=viewer 顯示 viewOnlyBadge）

## 5. Implementation — Frontend (TDD green)

- [x] 5.1 實作 `apps/web/src/canvas/useShareState.ts`：用 TanStack Query 拉 `GET /api/canvas/:id/share`，提供 invite / patchRole / removeMember / revokeInvite / setLinkMode / rotateLink 六個 mutation，每個 settle 時 `invalidateQueries(['share', canvasId])`，使 4.2 通過
- [x] 5.2 [P] 實作 `apps/web/src/canvas/ShareDialog.tsx`（依 design「ShareDialog UI：modal + 三段式」），用 motion 做 dialog enter/exit（CLAUDE.md hard rule #5 在 dialog 用 motion 是允許的），使 4.1 通過
- [x] 5.3 [P] 實作 `apps/web/src/auth/AnonymousCanvasGuard.tsx`（依 design「Anonymous 訪客 client 路徑：`AnonymousCanvasGuard`」）：讀 useAuth + URL `?share` query，無 user 但有 token → render children；無 user 無 token → redirect /login，使 4.3 通過
- [x] 5.4 [P] 改 `apps/web/src/canvas/use-sync-store.ts`：syncOriginForCanvas 帶上 `?token=` query；useSyncStore signature 加可選 `shareToken` 參數；hook 結果型別加 `role: 'editor' | 'viewer' | null`；token path connecting 期間不需 user.id（anonymous user.info 用 tldraw 內建 random animal name），使 4.4 通過
- [x] 5.5 改 `apps/web/src/chrome/TopBar.tsx`：share button 改成 onClick 開 ShareDialog（透過 chromeContext 傳入 canvasId 與 share callback）、share button 只在 owner role 時 render、加 `<ViewOnlyBadge>` 在 viewer role 時顯示（依 design「ShareDialog UI」與 spec MODIFIED「TopBar exposes canvas title, folder breadcrumb, share placeholder, and user menu」），使 4.5 通過
- [x] 5.6 [P] 改 `apps/web/src/canvas/Editor.tsx`：把 `useSyncStore` 回傳的 role 透過 chromeContext 傳給 TopBar（讓它決定顯不顯 share / viewOnlyBadge），並把 `isReadonly={role === 'viewer'}` 傳給 `<Tldraw>`，覆蓋「Editor reflects the resolved sync role on the tldraw component」spec
- [x] 5.7 [P] 改 `apps/web/src/router.tsx`：`/canvas/:id` 路由改用 `<AnonymousCanvasGuard>` 包住而非既有的 `<RouteGuard>`（後者強制 redirect 未登入到 /login，會擋公開 link 訪客）

## 6. E2E + 收尾

- [x] 6.1 寫 `e2e/share-invite.spec.ts` happy path：owner 登入並建 canvas → 開 ShareDialog → 邀請第二個 email（用 Mailpit 抓信）→ 第二個 browser context 點 invite link → 完成 magic-link 登入 → 進入同 canvas → 兩個 context 在 multiplayer 中互看 cursor（涵蓋 E2E 行為「Owner invites an unknown email creates a pending invite and sends mail」與「Invite acceptance route requires email match and writes a share」）
- [x] 6.2 [P] 寫 `e2e/share-public-link.spec.ts` happy path：owner 開 link mode=view → copy link → 第二個 browser context（無 cookie）打開該 link → 成功進唯讀 canvas（看到 owner 畫的東西、自己工具列灰掉）→ owner 改 mode=closed → 第二個 context 的 WS 被踢出（紅 banner 出現）（涵蓋 E2E 行為「Owner toggles the public link mode」「Anonymous visitors enter via public link without login redirect」「Sync server kicks affected sessions when access is revoked」「Viewer role connects in read-only mode」）
- [x] 6.3 [P] 跑 `bun test` 全綠 + `bunx oxlint` + `bunx oxfmt --check` + `bun --filter '*' typecheck`；coverage ≥ 70% 對 `apps/api/src/share/**`、`apps/api/src/sync/auth.ts`（修改部分）、`apps/web/src/canvas/ShareDialog.tsx` 與 `useShareState.ts` 與 `AnonymousCanvasGuard.tsx`
- [x] 6.4 [P] 在 `docs/adr/` 新增 ADR-0007 紀錄「viewer 降權無法立即斷送 in-flight 寫入」與「公開 link token 外流唯一止血是 rotate」兩個 trade-off
- [x] 6.5 [P] 手動瀏覽器驗收：(a) email invite 流程（從 Mailpit 抓信點 link 進 canvas）、(b) public link view-mode 訪客（無痕視窗測未登入訪客 UX）、(c) public link rotate 後舊 link 失效、(d) member role 改 viewer 後 viewer 工具列灰掉、(e) ShareDialog 三段 section 視覺與互動順暢。給 user 視覺驗證 sharing 感受
