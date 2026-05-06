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
| **M11** | **BYOK Foundation** | API Key Vault (AES-256-GCM) · Provider Adapter (9 model + 驗證 + 錯誤翻譯) · Settings → API Keys 頁 | Settings 頁能存 / 驗 / 刪三家 key、看到定價表 | ⏳ |
| **M12** | **Server tldraw Mutator + Tool Surface** | Server tldraw Mutator (套 mutation 到 TLSocketRoom 並廣播) · Tool Surface (low-level shape primitives + Zod) · Permission Guard | Dev-only REST endpoint：給 mutation payload → canvas 上有 shape 出現、所有 client 看得到 | ⏳ |
| **M13** | **Agent Runtime + Streaming** | Agent Runtime (Vercel AI SDK + tool loop + cancel + timeout) · Canvas Digest Builder · Streaming WS Channel | Headless test：CLI 送 prompt 給 server → 看到 streaming text + shape progressive 出現 | ⏳ |
| **M14** | **AI Side Panel + 端到端** | AI Side Panel UI · AI Thread Store (per-user 對話) · Cursor AI Badge · E2E spec | 使用者開 panel → 送 prompt → 看 shape 一個個冒、Cmd+Z 整輪退、多人協作中其他人看到 ✨ badge | ⏳ |

---

## 切法理由

1. **M11 先做最容易、最 user-visible 的** — Settings 頁能存 key 是看得見的進度，無架構風險
2. **M12 把技術風險往前壓** — Server tldraw Mutator 是整個 Phase 2 最不確定的部分（要研究 `TLSocketRoom.updateStore` 怎麼從外部 commit）。先解決它、後面才不會卡
3. **M13 把 agent 跑起來但不接 UI** — 專注在 agent loop / streaming / tool execution / 取消 / timeout 邏輯，純 headless 驗證
4. **M14 才接 UI + 完整 multiplayer 故事** — UI 走「視覺迭代」，留到最後跟 agent 一起調

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

**v1.0** 仍保留給「第一個 deploy 出去的 release」（依 ADR-0004，deploy
凍結中）— Phase 2 結束後若決定 deploy，會先補 deploy checklist 才 bump v1.0。

---

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
