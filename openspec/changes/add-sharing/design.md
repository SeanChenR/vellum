## Context

M4 已經把多人即時協作鋪好，但所有 `multiplayer-sync` 握手都假設「user 必須是 canvas owner」（PermissionChecker 目前只認 owner）。要讓 PRD US 29–37 的四種協作身份全部能進 canvas，需要同時動到 schema、權限、握手、UI、Email。本變更橫跨：

- **DB（drizzle migration）**：新增三張表 `canvas_shares` / `canvas_invites` / `canvas_share_links`
- **REST API**：新增 8 條 `/api/canvas/:id/share/*` 端點 + 1 條 `/api/share/invite/:token/accept`
- **Permission 層**：`canAccess(...)` 從 owner-only 擴充到 5 種身份矩陣
- **Sync 握手**：新增 public-link token path（query string 帶 token，免 session cookie），mid-session revocation 主動踢人
- **前端**：ShareDialog modal、`AnonymousCanvasGuard`（未登入訪客也能進 canvas）、TopBar viewer-mode 視覺
- **Email**：React Email template + Mailpit 寄送
- **i18n**：zh-TW / en 同步補齊

**現存可重用模組**

- `apps/api/src/auth/session-cookie-parser.ts` — 解析 better-auth cookie
- `apps/api/src/lib/permission.ts` — 擴充而非重寫
- `apps/api/src/lib/rate-limiter.ts` + `apps/api/src/lib/rate-limit-rules.ts`
- `apps/api/src/email/mailpit.ts` — SMTP 客戶端，用法跟 magic-link template 一致
- `apps/api/src/sync/auth.ts` 的 `SyncAuthDeps` — 已 dependency-injected，擴 resolveCanvasRole 即可
- `apps/api/src/sync/index.ts` 已有 `notifyCanvasDeleted(canvasId)` — 模式可重用做 share revocation

**M4 留尾事項本變更會清掉**

- Anonymous 訪客 / tldraw 內建動物名（M4 proposal Non-Goals 第 1 條）
- 公開 link 三檔切換（M4 Non-Goals 第 2 條）
- 權限降級主動 close（M4 design 第 4 節 WS 握手「Phase 1 不主動踢人」一段，M5 補上）

## Goals / Non-Goals

**Goals:**

- Owner 能用 email 邀請特定人，email 收件人可未登入收信、點 link 後完成註冊 / 登入後自動加入 canvas
- Owner 能切換公開 link 在 closed / link-view / link-edit 三檔之間
- Owner 能 rotate share link，舊 link 立即失效（< 1s 內所有用舊 link 的 WS 被 4403 close）
- Owner 能改成員 role（editor ↔ viewer）與移除成員
- 已登入的 shared editor / shared viewer 走原 cookie 路徑進 canvas
- 未登入訪客拿到公開 link 能直接進 canvas（不導 /login），擁有 anonymous 動物名身份
- viewer 進來看得到所有人的 cursor、shape，但無法編輯（client + server 雙保險）
- Share / role 異動時，server 主動 close 受影響的 WS sessions 並讓 client 重連走新權限

**Non-Goals:**

- 「申請存取」流程
- Owner 轉移 ownership / 多 owner
- Anonymous 訪客 sign-up upsell
- 公開 link 的 password / 細時效 / IP 白名單
- 真寄信（Resend），仍走 Mailpit 容器
- 跨進程協調 share 變更（單 process 直接踢人即可，phase 2 再考慮 Redis pub/sub）

## Decisions

### Email invite：pending invite 用獨立表 `canvas_invites`

`canvas_shares` schema 已固定 `user_id` 必填，無法承載「邀請了一個還沒註冊的 email」。新增 `canvas_invites` 表存 pending invite：

```
canvas_invites(
  id uuid PK,
  canvas_id uuid FK canvases.id ON DELETE CASCADE,
  email text NOT NULL,
  role text CHECK (role IN ('editor', 'viewer')) NOT NULL,
  token text UNIQUE NOT NULL,    -- 32-byte crypto random base64url
  expires_at timestamp NOT NULL, -- created_at + 7 days
  created_at timestamp NOT NULL DEFAULT now()
)
```

POST `/api/canvas/:id/share/invite` 邏輯：

1. 檢查 owner 身份（forbid 否則 403）
2. 用 email 查 `users` — 命中（已有帳號）→ 直接寫 `canvas_shares`，回 `{ kind: 'member' }`
3. 沒命中 → 寫 `canvas_invites` + 寄 `share-invite` email 含 accept link，回 `{ kind: 'pending' }`

`/api/share/invite/:token/accept` 邏輯：

1. 找 invite by token，檢查 `expires_at > now()`、未被使用過
2. 沒登入 → redirect `/login?redirect=/api/share/invite/<token>/accept`
3. 登入後 → 確認當前 user 的 email 跟 invite.email 一致；不一致回 403（防止把 invite link 轉貼給別人）
4. 寫 `canvas_shares(canvas_id, user_id=session.userId, role=invite.role)` + 刪 invite + redirect `/canvas/:id`

**為什麼分兩個表（不用 nullable user_id）：**

- 已接受的成員與待接受的 invite 語意不同；查「誰能編輯這張 canvas」只 JOIN `canvas_shares`（pending 不算）
- ShareDialog UI 也需要分開展示「目前成員」 vs 「未接受邀請」
- 替代方案 — 統一一張 `canvas_shares` 加 `accepted_at` nullable：查詢需要每處過濾 NULL，且 `(canvas_id, user_id)` UNIQUE 約束無法在 user_id 為 null 時運作

**為什麼 invite 走獨立 token 不重用 magic-link：**

- magic-link 是一次性登入用，與 invite 接受是不同語意（接受後仍要走 better-auth session 流程）
- magic-link rate-limit 規則跟 invite 不同（前者按 email 防垃圾信、後者按 owner 防量產）

### Public link：每張 canvas 一筆 row，三檔切換改 mode 而非 row

`canvas_share_links` 結構：

```
canvas_share_links(
  canvas_id uuid PK FK canvases.id ON DELETE CASCADE,  -- 一張 canvas 一筆
  token text UNIQUE NOT NULL,                          -- 32-byte crypto random base64url
  mode text CHECK (mode IN ('closed','view','edit')) NOT NULL DEFAULT 'closed',
  created_at timestamp NOT NULL DEFAULT now(),
  rotated_at timestamp NOT NULL DEFAULT now()          -- 重新產生 token 時更新；handshake 用此判斷舊 token 失效
)
```

行為合約：

- 第一次任何 share/link 操作觸發 lazy create（owner 點開 ShareDialog 時 GET 端點若無 row 自動 INSERT mode='closed'）
- 切 mode：UPDATE mode 欄位，token 不動 — 拿過 link 的人若 mode 從 view 升 edit 直接拿到 edit 權，反之自動降權
- Rotate：UPDATE token + rotated_at = now()；舊 token 立刻失效；同步呼叫 `syncServer.notifyAccessRevoked(canvasId, 'all-anonymous')` 把所有 public-link 連線踢掉
- Mode = 'closed' 時 token 仍存在，但 sync 握手一律拒絕（4403）

**為什麼一張 canvas 只有一個 link 而不是「多個 link 各帶不同 mode」：**

- PRD 明文「永遠一張 canvas 對應一個 link record」
- 多 link 模型暴增 UI 複雜度，且 phase 1 沒有「不同對象不同權限」的 use case
- 升 / 降權直接改 mode，對使用者直覺；關掉外流就 rotate

**Token 格式：** 32 bytes from crypto.randomUUID + secondary random，base64url encoded → 約 43 chars。Constant-time compare via `Bun.password` not needed（不是密碼），用普通 string equality 即可（token 本身就是 secret）。

### Permission 矩陣：`canAccess(user | null, canvas, action, ctx?)` 擴充

新簽章：

```ts
function canAccess(
  user: { id: string } | null,        // null = anonymous via public link
  canvas: { id, ownerId },
  action: 'read' | 'write' | 'delete' | 'share',
  ctx?: { 
    sharedRole?: 'editor' | 'viewer' | null,  // canvas_shares 命中
    publicLinkMode?: 'closed' | 'view' | 'edit' | null  // canvas_share_links.mode（若有 token）
  }
): boolean
```

矩陣（`✓ = allow`）：

| Identity | read | write | delete | share |
| -------- | ---- | ----- | ------ | ----- |
| owner | ✓ | ✓ | ✓ | ✓ |
| shared editor | ✓ | ✓ |  |  |
| shared viewer | ✓ |  |  |  |
| public-link-edit visitor (logged in or anon) | ✓ | ✓ |  |  |
| public-link-view visitor (logged in or anon) | ✓ |  |  |  |
| no relation | | | | |

**為什麼把 sharedRole + publicLinkMode 都做為 ctx 傳入而不在內部查 DB：**

- 保持 `canAccess` 純函式（容易單測）
- 呼叫方（route handler / sync handshake）一定是 DB-aware 的，自然能準備這些 ctx
- 多次呼叫同一個權限決定（如 read + write 都查）只需要查一次 DB

**Phase 1 不在 `canAccess` 內處理「revoke 後立刻失效」**：那是 sync server 的 mid-session revocation 工作，不是 access predicate 的事。

### Sync 握手：新增 public-link path

`apps/api/src/sync/auth.ts` 的 `authenticateSyncHandshake(req, canvasId, deps)` 擴成：

1. 看 URL query 有沒有 `token=<...>`
2. 有 token：走 public-link path
   - 找 `canvas_share_links` 這 token 對應 canvas 是否符合 path canvasId、mode 不是 closed
   - mode=view → role=viewer；mode=edit → role=editor
   - userId：若有有效 session cookie 用 session userId；否則 `anon:<canvasId-prefix>:<8-char-random>`
   - canvas existence 用 link 的 canvas_id 反查決定（不存在 → 404）
3. 無 token：走 cookie path（既有邏輯，但 resolveCanvasRole 內部現在會查 `canvas_shares`）

`SyncAuthDeps.resolveCanvasRole` 重寫（仍純函式接 DB 結果）：

```ts
async resolveCanvasRole(userId, canvasId): {
  canvasExists: boolean;
  role: 'editor' | 'viewer' | null;
}
```

實作順序：
1. 找 canvas，無 → `{ canvasExists: false, role: null }`
2. ownerId = userId → role: 'editor'
3. 查 `canvas_shares` 命中 → 用其 role
4. 否則 → role: null

**Anonymous 識別策略：** userId 形如 `anon:<8-char>` 確保不會撞到 better-auth 的 user.id（後者是 cuid 格式）。同個 anonymous 訪客 reload 後得到新 anon id（無 cookie 持久化）— phase 1 接受。

**為什麼不用 cookie 模仿 anonymous session：**

- 多餘的 state（要管 anon-cookie 過期、生命週期）
- 重整看起來變新人，反而符合「我是過客」的心智模型
- tldraw sync 內建 awareness 動物名來自 random，不需要 stable id

### Mid-session revocation：share 變更 → 主動 close 受影響 WS

share 端點任何「降權 / 移除 / link rotate / mode 改 closed」操作都呼叫 sync server：

```ts
syncServer.notifyAccessRevoked(canvasId, scope: { kind: 'user', userId } | { kind: 'all-anonymous' } | { kind: 'all' })
```

實作：sync server 把 sockets map 中對應 canvasId 的連線過濾後 close（close code 4403）。Client 收到 4403 → 進 `disconnected` 狀態 + 紅色 banner（M4 既有路徑）。

**Scope 對應：**

- 移除 share / role 改 viewer：`{ kind: 'user', userId }`（只 close 該 user 的）
- Link rotate / mode 改 closed：`{ kind: 'all-anonymous' }`（所有 anon: 開頭的 user 全 close）
- Canvas 刪除（既存）：`{ kind: 'all' }`（用 4404 不是 4403）

**為什麼 scope 不細到「降 editor → viewer」也踢：** 降權後 client 重連會拿到新 role 並 isReadonly=true，但已經連著的 viewer 仍能寫直到斷線——這是個小漏。Phase 1 接受（owner 真要堵就 rotate link 或先移除再加），phase 2 加「降權立即降低」需要 server 端 op-level 過濾。

### Viewer-mode read-only：client + server 雙閘

**Server 端：** sync handshake 拿到 role=viewer 時，呼叫 `room.handleSocketConnect({ ..., isReadonly: true })`。`TLSocketRoom` 收到 readonly 連線會自動拒絕該連線發出的 store mutation（tldraw sync 內建）。

**Client 端：** sync hook 把 role 透過 callback 傳給 Editor，Editor 把 `isReadonly` prop 傳給 `<Tldraw>`。tldraw 看到 `isReadonly=true` 會把工具列灰掉、shape 不可選、文字不可編輯。

**為什麼雙閘：**

- 純 client 閘可被人改 dev tools 繞過 → server 端必須擋
- 純 server 閘 viewer 的 UI 還是會看起來能編輯，按了沒反應體驗差 → client 端要讓 UI 反映

### ShareDialog UI：modal + 三段式

由 TopBar 「Share」按鈕觸發（取代 placeholder toast）。元件結構：

```
<ShareDialog open onClose>
  <InviteSection>
    <Input email + role select (editor|viewer) + Send button>
  </InviteSection>
  <MembersSection>
    <List of {users + pending invites}>
      <Row: avatar/email | role-select | remove-button>
    </List>
  </MembersSection>
  <PublicLinkSection>
    <RadioGroup mode={closed|view|edit}>
    <CopyButton link={baseUrl}/canvas/{canvasId}?share={token}>
    <RotateButton>
  </PublicLinkSection>
</ShareDialog>
```

資料源 `useShareState(canvasId)` hook：

- 用 TanStack Query 拉 `GET /api/canvas/:id/share`
- 每個 mutation（invite / patch role / remove / put link mode / rotate）後 `invalidateQueries(['share', canvasId])`
- Optimistic update for instant UI feedback

**動畫：** dialog enter / exit 用 motion（CLAUDE.md hard rule #5「在 dialog 上用 motion」明確允許）；list item add / remove fade。

### Anonymous 訪客 client 路徑：`AnonymousCanvasGuard`

URL 形如 `/canvas/<id>?share=<token>` 開啟時，`CanvasPage` 外層改用 `<AnonymousCanvasGuard>`：

1. 若 `useAuth()` 有 user → 直接 render（已登入路徑）
2. 若無 user 但 URL 有 `?share=<token>` → render 但 sync hook 帶 token，TopBar 隱藏 user menu / Sign out / Share 按鈕，顯示 「Anonymous {animal}」 標籤
3. 若無 user 且 URL 無 token → redirect `/login?redirect=...`

**為什麼不靠 RouteGuard：** RouteGuard 假設「沒 session 就 reject」，跟 anonymous 訪客衝突。獨立元件邏輯清楚。

### Email template：React Email + Mailpit

新增 `apps/api/src/email/templates/share-invite.tsx`，跟既有 `magic-link.tsx` 同 layout 風格。重要欄位：

- `inviterName`：邀請者 display name
- `canvasTitle`：被分享的 canvas 標題
- `acceptUrl`：`<base>/api/share/invite/<token>/accept`
- `expiresAt`：7 天後 — 顯示給收件人

Subject：i18n key `email.shareInvite.subject` — `{{inviter}} invited you to "{{title}}" on Vellum` 等同模式 zh-TW / en 同步加入 locale JSON。

## Risks / Trade-offs

- **viewer 降權無法立即斷送 in-flight 寫入** → Phase 1 接受。owner 如要硬擋可改 share role + rotate link 兩動。已寫進 ADR-0007（task 6.3）
- **Email-only invite 上限 7 天過期** → token 換新需要 owner 再點一次邀請。phase 2 加自動續期看 traffic
- **公開 link token 一旦外流 rotate 是唯一止血** → 沒有「block by IP / device」。phase 2 評估
- **Anonymous 訪客重整變新身份** → tldraw 動物名也會換。可能造成「一個人開兩 tab 看起來像兩人」— 跟 M4 同帳號雙 tab 同樣現象，已知妥協
- **`canvas_invites.email` 大小寫處理** → 統一 lowercase 存入 + 比對；防 `Foo@x.com` 與 `foo@x.com` 同邀請被當成不同
- **tldraw sync 的 `isReadonly` 是否真的擋寫入** → 第一週前 spike 驗（tasks 1.1）；若不行 fallback 走自寫過濾層

## Migration Plan

Phase 1 沒有 production 使用者，無 zero-downtime 需求：

1. 跑 `bunx drizzle-kit generate` 產生 0002_share migration（內含三張表 + indexes + FK）
2. `bunx drizzle-kit migrate` 套到 dev DB
3. 全 test 綠 + 兩條 E2E 通過
4. 本地 visual review：開兩個帳號驗 invite、開無痕視窗驗 public-link
5. Commit 走兩個 commit：「migration + share API + permission」、「ShareDialog + anonymous + i18n」方便 review

## Open Questions

- ShareDialog 的「目前成員清單」是否分頁？— phase 1 預設不分頁（單 canvas 通常 < 20 人），phase 2 視 canvas 變大再加。task 寫死前 200 名顯示
- Anonymous 訪客的 cursor 顏色是否用統一灰色而非 hash？— 預設仍走 hash（從 anon id），讓多 anon 訪客可區分；視覺 review 再決定
- 已是 shared editor 的人若再被 invite 同 canvas → 直接覆蓋 role（PUT-like 行為）還是 409？— 預設覆蓋；理由是 owner 的意圖通常是「改 role」而非「拒絕」

