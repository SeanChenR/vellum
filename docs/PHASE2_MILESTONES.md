# Phase 2 Milestones

**Status:** 🚧 Planning
**Reference PRD:** [#2](https://github.com/SeanChenR/vellum/issues/2)

Phase 2 加入 AI co-pilot — 讓使用者用自然語言請 server-side agent
編輯 canvas。架構是「server agent + server executor」（[ghost-ai](https://github.com/adrianhajdin/ghost-ai)
模式），編輯透過既有 tldraw sync room 廣播，BYOK 自帶 API key
（Anthropic / OpenAI / Google × 旗艦 / 平衡 / 經濟 = 9 個 model）。

每個 milestone 是 vertical slice、可獨立 archive、有可 demo 的產出。

| # | Scope | 主要模組 | 預計交付物 | 狀態 |
|---|---|---|---|---|
| **M11** | **BYOK Foundation** | API Key Vault (AES-256-GCM) · Provider Adapter (9 model + 驗證 + 錯誤翻譯) · Settings → API Keys 頁 | Settings 頁能存 / 驗 / 刪三家 key、看到定價表 | ✅ v0.2.0 |
| **M12** | **Server tldraw Mutator + Tool Surface** | Server tldraw Mutator (套 mutation 到 TLSocketRoom 並廣播) · Tool Surface (low-level shape primitives + Zod) · Permission Guard | Dev-only REST endpoint：給 mutation payload → canvas 上有 shape 出現、所有 client 看得到 | ✅ v0.3.0 |
| **M13** | **Agent Runtime + Streaming** | Agent Runtime (Vercel AI SDK + tool loop + cancel + timeout) · Canvas Digest Builder · Streaming SSE Channel (per-user) | Headless test：CLI 送 prompt 給 server → 看到 streaming text + shape progressive 出現 | ✅ v0.4.0 |
| **M14** | **AI Side Panel + 端到端 + M13 follow-ups** | AI Side Panel UI · AI Thread Store (per-user 對話) · Cursor AI Badge · E2E spec · M13 暴露的 follow-up（read tool quality / code+link-card live test / token-cost monitoring / cancel UI / multi-tab presence / tool description per-shape-type 持續精進） | 使用者開 panel → 送 prompt → 看 shape 一個個冒、Cmd+Z 整輪退、多人協作中其他人看到 ✨ badge | ✅ v0.5.0 |
| **M15** | **Vellum MCP Server**（展示性工程，Phase 2 收尾後加做） | 把 M12.2 `tool-registry` 暴露成標準 MCP endpoint · API token auth + per-token rate limit · Permission scoping (per canvas role) | Claude Desktop / Cursor 連 vellum MCP server → 從外部編輯 canvas、所有 collaborator 看得到 mutation | ✅ v0.6.0 |

---

## Post-Phase-2 polish

Phase 1 + Phase 2 完工後的視覺 / UX 重構。

| 重構 | 範圍 | 驗收 | 狀態 |
|---|---|---|---|
| **Aura UI Redesign** | 統一 `max-w-6xl` 容器寬 · NavBar 三欄 grid · 深 / 淺主題（`system` / `light` / `dark`，CSS custom properties + `data-theme`） · LocaleToggle 進 NavBar 取代 ProfilePage 內 locale field · 抽出 Card / Button / Input / Badge 4 個 primitive · 9 個 route × 2 主題視覺對齊 Claude Design `docs/design/aura-redesign/` · _Ingest 補強：Dashboard 兩欄 greeting + sidebar + canvas grid（無訂閱 callout）· Account 三條 route 合併到 `/account` tab page（profile / sessions / api-keys / pricing）· BYOK 定價從表格改 provider-grouped tier cards · API & MCP rows 改 row-based + cyan dot saved badge · PAT row 排版 + lucide Key icon_ | 切深淺主題無 flicker；NavBar 中央 nav + 右側 locale/theme/auth；每 route 在 light + dark 各跑一次無視覺破版；Dashboard 含 greeting / sidebar / grid 三區塊且無「升級」字串；`/account` 預設 profile tab，舊 path redirect 到 `?tab=...` | ✅ v0.7.0 |

---

## 切法理由

1. **M11 先做最容易、最 user-visible 的** — Settings 頁能存 key 是看得見的進度，無架構風險
2. **M12 把技術風險往前壓** — Server tldraw Mutator 是整個 Phase 2 最不確定的部分（要研究 `TLSocketRoom.updateStore` 怎麼從外部 commit）。先解決它、後面才不會卡
3. **M13 把 agent 跑起來但不接 UI** — 專注在 agent loop / streaming / tool execution / 取消 / timeout 邏輯，純 headless 驗證
4. **M14 才接 UI + 完整 multiplayer 故事** — UI 走「視覺迭代」，留到最後跟 agent 一起調
5. **M15 是展示性工程，刻意排在 Phase 2 MVP 之後** — agent loop 跑穩了再把 `tool-registry` 對外開 MCP endpoint，可乾淨疊在已驗證的 tool surface 上；不擠進 M13 是因為 in-process agent 走 MCP 純加序列化開銷無功能價值，且 M13 已是 phase 2 最大 milestone（3 週）

## 為什麼不更細（例如 7 個）

dependencies 太密，切到一週一個會變成「不能獨立 archive」，違背 milestone 的意義。

## 為什麼不更粗（例如 1–2 個）

Phase 1 的每個 archive ≈ 一個 spec change，這是 spectra-apply 的工作流容量。一個 milestone 跨太多模組會讓 spectra-apply 變成兩週連跑、沒有 checkpoint。

---

## 版號對應

Phase 2 走 v0.x increment，每個 milestone bump 一次：

| Milestone | 版號 |
|---|---|
| M11 完成 | v0.2.0 |
| M12 完成 | v0.3.0 |
| M13 完成 | v0.4.0 |
| M14 完成（Phase 2 AI MVP 完成） | v0.5.0 |
| M15 完成（Vellum MCP Server，展示性工程） | v0.6.0 |

**v1.0** 仍保留給「第一個 deploy 出去的 release」（依 ADR-0004，deploy
凍結中）— Phase 2 結束後若決定 deploy，會先補 deploy checklist 才 bump v1.0。

---

## M13 Follow-ups (track in M14)

M13 e2e session 暴露的後續工作清單，留給 M14 一併處理：

- **Tool description quality**：updateShape / connectShapes / groupShapes 的 description 還只有單句，需要像 createShape 那樣列舉每個 patch 鍵的型別期待。
- **Read tool live exercise**：getViewport / listShapesInSelection / listShapesInViewport / getShape / getCanvasBounds 五個 read tool 在 M13 unit + integration test 過了但 live agent 沒驗證會不會用、用對。
- **更多 shape type live test**：M13 只 live 測過 markdown / code / callout 三種；link-card 的 OG fetch + state lifecycle 沒透過 agent 觸發過。
- **Token / cost monitoring**：BYOK 自付但 server 端目前無 visibility，使用者燒爆額度才會發現。M14 加 per-run usage emit。
- **Cancel UI**：M13 提供 `/agent/run/:runId/cancel` HTTP endpoint，UI button + keyboard shortcut 在 M14 接。
- **Multi-tab presence**：sync room 廣播 mutation 已驗證，但 agent 編輯時其他 tab user 看到的 UX（要不要顯示「AI 正在編輯」徽章）M14 設計。
- **AI Side Panel chat**：M13 純 HTTP，沒 chat history / message thread UI；M14 主軸。
- **AI cursor badge**：PRD #2 提到的「AI 正在動」視覺提示。
- **Cmd+Z batch undo UX**：M12.1 batch undo 結合 multi-tool-call run 的使用者退一輪語意。

## Out of Phase 2

依 PRD #2 的 Out of Scope 段，以下不在 Phase 2 範圍：

- Multi-agent 編排
- RAG / vector search
- 跨 canvas 記憶
- AI 對話分享給 collaborator
- 應用程式內 token 用量顯示
- 主動式 AI 建議
- 獨立 AI cursor / avatar / presence
- Plan-then-execute 確認步驟
- Mobile / touch 支援
- 匿名 AI 使用
- High-level template tools
- 圖片生成
- 語音輸入
- Production deploy

詳見 [PRD #2](https://github.com/SeanChenR/vellum/issues/2)。
