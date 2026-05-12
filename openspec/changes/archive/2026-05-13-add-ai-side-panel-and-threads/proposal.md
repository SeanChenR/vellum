## Why

M11–M13 已把 BYOK Vault、Server Mutator、Tool Surface、Permission Guard、Agent Runtime、Streaming SSE Channel 六層下層 plumbing 全部接通並以 headless e2e 驗證過；但 Phase 2 PRD #2（Issue #2）的主使用者故事——「打開 Side Panel、輸入自然語言、看 shape 一個個冒出來」——目前還只能用 curl 觸發。M13 archive 同時遺留 7 條 follow-up：tool description per-shape-type quality、read-tool live exercise、code/link-card live test、token-cost monitoring、cancel UI、multi-tab AI presence、provider routing 從 startsWith 升級成 explicit map。M14 把 UI 接上去並把 follow-ups 一次清完，是 Phase 2 v0.5.0 收尾的最後一個 milestone。

## What Changes

- 新增 **AI Side Panel**（apps/web/src/agent/）：Editor 右側 docked、可收合；ChatList 渲染 user / assistant / tool_call / tool_result 四種訊息；ChatComposer 含 textarea + provider/model picker（讀使用者 BYOK preferences）+ Send / Cancel button；TokenUsageFooter 顯示本輪 usage + 對話累計 + $ 換算。
- 新增 **AI Thread 持久化**：DB 兩張新表（ai_threads / ai_messages）+ multi-thread per (user, canvas) + Thread Switcher UI（dropdown + "+ New Chat" + clear / delete actions）+ 第一輪 run 結束後 fire-and-forget 觸發小模型 title generation（沿用該 provider 的 economy 檔：gpt-4o-mini / claude-haiku-4-5 / gemini-2.5-flash-lite）；fallback 取 user message 前 30 字。
- 新增 **Cursor AI Badge**：透過 tldraw `instancePresence.userMeta.aiActive` 廣播；CollaboratorAvatars 對 aiActive 為 true 的 collaborator 加 ✨ overlay；本 channel 與 SSE 完全分離（多人協作可見 / AI 對話內容不外洩，符合 PRD #2「AI 對話不分享給 collaborator」）。
- **MODIFIED** Streaming Channel：run endpoint body 從 `{messages, provider, model, sessionId}` 改成 `{threadId, userMessage, provider, model}`，server 從 thread 讀歷史；`done` SSE event payload 加 `usage: {input, output, provider, model}` 欄位，client 直接顯示無需重新 fetch thread。
- **MODIFIED** Agent Runtime：`runAgent` deps 加 ThreadRepo，run 開頭從 thread 讀全部歷史 messages 組進 prompt、run 過程把每個 assistant / tool message append 進 thread；run done 後觸發 background title generation 子任務（不阻塞 SSE done event）。
- **MODIFIED** Server Mutation Bridge：tool-registry 中 `updateShape` / `connectShapes` / `groupShapes` 的 description 升級成 per-shape-type 詳列 props 鍵名與型別期待，對齊 M13 §13 已對 createShape 做過的 LLM-friendly 描述格式。
- 新增 **Token usage runtime 換算**：用既有 packages/shared/src/byok-pricing.ts 的 per-1M-token 單價，前端拿 SSE `usage` 即時換算 $ 顯示；不做 budget cap、不做 hard enforcement、不做 cross-thread aggregation。
- 新增 **Permission gate UI 層**：viewer / 匿名公共連結存取者隱藏 AI Side Panel toggle button（後端 401 已測，但 UI 不該讓使用者按了才知道沒權限）。
- 新增 **i18n keys**：agent.panel.* / agent.usage.* / agent.badge.* / agent.thread.* / agent.title.*；zh-TW + en 同步落地。
- **REFACTOR** wiring.ts 的 provider routing：將 `model.startsWith()` 字串比對改成 explicit `Record<ModelId, ProviderName>` map（純 implementation-level 重構，非 spec change；ADR-0019 已記錄此風險）。
- 補完 **M14 寬定義 e2e**：4 條 Playwright spec — cancel mid-run / multi-tab AI badge 可見性 / viewer 看不到 AI panel toggle / rate limit 429 toast 顯示 errorKey。窄定義 happy-path 由 owner 手動驗證。
- **M14 verification 中補的修補**（owner 手動驗證階段發現後 ingest 進本 change）：
  - **MODIFIED Streaming Channel**：SSE 路由 per-request idle timeout 從 Bun 預設 10 s override 成 255 s；`SseWriter` 的 heartbeat 機制（M13 已寫好的 `:hb` comment frame）在 production run handler 真正接上 `setInterval` tick；dev proxy 對 run 路徑套相同 timeout override。修補理由：M13 留下的 heartbeat 邏輯只有 unit test 在用，導致 30+ 秒 model deliberation 就斷流。
  - **MODIFIED Agent Runtime**：runtime 在 run 開頭呼叫新加的 internal `listAllShapes` reader + 既有 `getCanvasBounds`，build system prompt（behavioural discipline + canvas digest），prepend 為 `conversation[0]` 的 `role: "system"` message；system message 不寫入 `ai_messages`，每次 run 重組。Wiring 層改用 `streamText({ system, messages })` 把 system 從 messages 陣列拉出（消除 AI SDK warning）。修補理由：原本 runtime 完全沒 system prompt，AI 在已有 shape 的 canvas 上仍把新 shape 放預設座標、且對「調整」類請求常常謊報已執行。
  - **MODIFIED Server Mutation Bridge**：tool-registry `createShape` 與 `updateShape` description 擴充支援 tldraw built-in `geo` shape — 20 種 variant、12 種 color、4 種 fill、4 種 dash、size、optional text。Mutator 新加 `geo-defaults` helper：在 createShape 對 `type === "geo"` 補齊 11 個 tldraw 必填 prop（含 richText 預設值），updateShape 對 geo 把 `partial.props.text` 轉成 richText。LLM 介面仍只看到精簡 prop 集（8 個 optional），server side 自動補齊。修補理由：M14 verification 中 owner 反映 AI 畫不出方形 / 三角形 / 五顏六色幾何圖，雖然 schema 接受但 description 沒提，LLM 看不到。
  - **Backlog 不在本 change 範圍**：spatial-awareness 進階解法（接 Dagre / ELK 等 layout engine 接管座標）排進 M16+ — 本 change 只先做 prompt-level patch（system prompt + spacing 規則 + 分支佈局指引）。
  - **MODIFIED Ai Side Panel — ChatComposer provider/model picker**：ChatComposer 把原 read-only `provider / model` span 換成兩個 dropdown（provider + model），切換 provider 自動 reset 該 provider 的偏好 model；無 BYOK key 時 textarea / Send button disabled + 顯示 `agent.panel.noApiKeyHint` 引導使用者去 Settings。理由：M14 verification 中 owner 反映三個 provider 都配置時無法切換；spec 早寫了「picker」但 UI 沒做完。
  - **MODIFIED Agent Runtime — provider adapter 補抽 token usage**：wiring 的 part-to-event 轉換從 `bridge()` 抽成 module-level pure helper `aiSdkPartToProviderEvents(part)`，並在 `finish-step` 額外 emit `{ type: "usage", usage: { input, output } }` event。理由：M14 verification 中 owner 反映 Token usage footer 永遠 0/0；根因是 wiring 從沒從 AI SDK fullStream 抽出 token 數字 emit 給 runtime，導致 `usageTotals` 永遠 null、`setUsageOnLastAssistant` skip、`ai_messages.token_usage` 全 NULL、thread total 算 SUM(NULL) → 0。
  - **MODIFIED Ai Side Panel — Markdown rendering for assistant bubbles**：引入 `react-markdown@10` + `remark-gfm@4`；ChatList 的 assistant bubble（含 streaming bubble）改用 Markdown renderer，user bubble 與 tool bubble 維持原樣。理由：AI 回應普遍用 Markdown，視覺呈現一致是 chat UX 基線。對應 design.md non-goal「不引入新 npm package」翻過來（30 KB gzipped、自寫 markdown parser 反而是技術債）。
  - **MODIFIED Ai Side Panel — Agent error toast + composer draft preservation**：AiSidePanel 新增 inline toast（`data-testid="agent-error-toast"`、`role="alert"`、6s auto-dismiss）渲染 `agent.error.*` 翻譯；useEffect 監 `run.state === "error" && run.error`。ChatComposer 的 `setDraft("")` 從同步 submit 移到「`prevState === "running" && state === "done"`」transition — error / cancelled terminal 保留 typed text 給 user retry。理由：原本 server 回 429 / 其他 error 時 UI 完全無回饋（只在 hook state 不視覺化），且 composer 立刻被清空違反 spec「typed prompt SHALL still be present in the textarea」。
  - **NEW E2E — 4 條 agent Playwright spec 真實啟用**：新加 `e2e/helpers/agent-setup.ts` 共享 sign-in / create canvas / inject BYOK key / pickEnabledByokKey helper（accept Gemini OR OpenAI env var）；`agent-cancel.spec.ts` / `agent-rate-limit-toast.spec.ts` / `agent-viewer-no-panel.spec.ts` 從 `test.fixme` 改為 helper-driven 真實 e2e；`agent-multi-tab-badge.spec.ts` body 完整但 `test.skip` 等 M15 broadcast 補完（issue #16）。`e2e/sharing-acceptance.spec.ts` 刪除（視覺驗收 spec，不是 regression test，跟 M14 無關；share-invite / share-public-link 兩條 functional spec 仍綠覆蓋分享功能 regression）。

涵蓋 PRD #2（Issue #2）AI co-pilot 端到端體驗；Phase 2 milestone roadmap 對應 M14 / v0.5.0。

## Capabilities

### New Capabilities

- `ai-thread`: per-user × per-canvas AI 對話歷史的持久化能力 — DB schema (ai_threads + ai_messages)、thread CRUD endpoints、multi-thread per canvas 切換、第一輪 run 後背景小模型 title generation。
- `ai-side-panel`: Editor 右側 docked AI Side Panel 的 UI 與互動行為 — chat 列表、composer、token usage footer、thread switcher、cancel button、cursor AI badge、viewer 角色隱藏 toggle。

### Modified Capabilities

- `streaming-channel`: run endpoint body shape 改成 thread-driven (`{threadId, userMessage}`)；`done` SSE event payload 加 `usage` 欄位；連線生命週期不變。
- `agent-runtime`: runAgent deps 加 ThreadRepo；run 開頭從 thread 讀歷史、過程 append 新訊息、結束觸發 background title generation；五狀態生命週期不變。
- `server-mutation-bridge`: tool-registry 的 updateShape / connectShapes / groupShapes 三個 ToolEntry description 改成 per-shape-type 詳列（涵蓋 markdown / code / callout / link-card 四個 vellum custom shape 各自的 props 鍵名）。

## Impact

- Affected specs:
  - New: openspec/specs/ai-thread/spec.md, openspec/specs/ai-side-panel/spec.md
  - Modified: openspec/specs/streaming-channel/spec.md, openspec/specs/agent-runtime/spec.md, openspec/specs/server-mutation-bridge/spec.md
- Affected code:
  - New (web):
    - apps/web/src/agent/AiSidePanel.tsx
    - apps/web/src/agent/AiSidePanel.test.tsx
    - apps/web/src/agent/ChatList.tsx
    - apps/web/src/agent/ChatList.test.tsx
    - apps/web/src/agent/ChatComposer.tsx
    - apps/web/src/agent/ChatComposer.test.tsx
    - apps/web/src/agent/TokenUsageFooter.tsx
    - apps/web/src/agent/TokenUsageFooter.test.tsx
    - apps/web/src/agent/ThreadSwitcher.tsx
    - apps/web/src/agent/ThreadSwitcher.test.tsx
    - apps/web/src/agent/useAgentThread.ts
    - apps/web/src/agent/useAgentThread.test.ts
    - apps/web/src/agent/useAgentRun.ts
    - apps/web/src/agent/useAgentRun.test.ts
    - apps/web/src/agent/sse-parser.ts
    - apps/web/src/agent/sse-parser.test.ts
    - apps/web/src/agent/store.ts
    - apps/web/src/agent/store.test.ts
    - apps/web/src/agent/cursor-ai-badge.ts
    - apps/web/src/agent/cursor-ai-badge.test.ts
  - New (api):
    - apps/api/src/agent/threads/handlers.ts
    - apps/api/src/agent/threads/handlers.test.ts
    - apps/api/src/agent/threads/repo.ts
    - apps/api/src/agent/threads/repo.test.ts
    - apps/api/src/agent/title-gen.ts
    - apps/api/src/agent/title-gen.test.ts
    - apps/api/src/agent/system-prompt.ts (M14 verification fix)
    - apps/api/src/agent/system-prompt.test.ts (M14 verification fix)
    - apps/api/src/sync/geo-defaults.ts (M14 verification fix)
    - apps/api/src/sync/geo-defaults.test.ts (M14 verification fix)
    - apps/api/drizzle/0006_ai_threads.sql
  - New (e2e):
    - e2e/agent-cancel.spec.ts (activated from fixme to helper-driven real flow)
    - e2e/agent-multi-tab-badge.spec.ts (body ready, skipped pending M15 broadcast)
    - e2e/agent-viewer-no-panel.spec.ts (activated; dialog flow + share API)
    - e2e/agent-rate-limit-toast.spec.ts (activated; API burn + UI 6th + toast)
    - e2e/helpers/agent-setup.ts (M14 verification: shared sign-in / canvas / BYOK / pickEnabledByokKey)
  - Removed (e2e):
    - e2e/sharing-acceptance.spec.ts (visual-acceptance spec, not a regression test; share-invite + share-public-link cover functional regression)
  - Modified:
    - apps/api/src/db/schema.ts
    - apps/api/src/db/schema.test.ts
    - apps/api/src/index.ts
    - apps/api/src/agent/sse-endpoint.ts (incl. heartbeat ticker + per-request idle timeout)
    - apps/api/src/agent/sse-endpoint.test.ts
    - apps/api/src/agent/runtime.ts (incl. system-prompt prepend)
    - apps/api/src/agent/runtime.test.ts (incl. Group A0 system-prompt tests)
    - apps/api/src/agent/wiring.ts (incl. extractSystem → streamText system param)
    - apps/api/src/sync/tool-registry.ts (incl. geo shape description block)
    - apps/api/src/sync/tool-registry.test.ts (incl. geo description assertions)
    - apps/api/src/sync/mutator.ts (incl. geo normalisation hook in createShape + updateShape)
    - apps/api/src/sync/mutator.test.ts (incl. geo create/update scenarios)
    - apps/api/src/sync/mutator-readers.ts (incl. listAllShapes internal reader)
    - apps/api/src/sync/mutator-readers.test.ts (incl. listAllShapes scenarios)
    - apps/api/src/index.ts (incl. SSE route srv.timeout(req, 255) override)
    - scripts/dev-proxy.ts (incl. matching srv.timeout override for /api/agent/.../run)
    - apps/api/src/lib/rate-limit-rules.ts
    - packages/shared/src/agent-events.ts
    - packages/shared/src/agent-events.test.ts
    - packages/shared/src/locales/zh-TW.json
    - packages/shared/src/locales/en.json
    - apps/web/src/canvas/Editor.tsx
    - apps/web/src/canvas/Editor.test.tsx
    - apps/web/src/canvas/CanvasPage.tsx
    - apps/web/src/canvas/CollaboratorAvatars.tsx
    - apps/web/src/canvas/CollaboratorAvatars.test.tsx
    - apps/web/src/canvas/use-sync-store.ts
    - apps/web/src/canvas/use-sync-store.test.ts
    - docs/PHASE2_MILESTONES.md
  - Removed: (none)
- Affected dependencies: 既有 `ai` SDK / `@ai-sdk/openai` / `@ai-sdk/anthropic` / `@ai-sdk/google` 已在 M13 引入；title-gen 重用同一條 provider client 路徑。**M14 verification ingest 階段新增** `react-markdown@10` 與 `remark-gfm@4` 進 `apps/web`，用於 ChatList assistant bubble 的 Markdown 渲染（合計 ~30 KB gzipped）。原本 design.md 寫的 non-goal「不引入新 npm package」明確翻過來。
- Affected runtime: 1 個 SQL migration（ai_threads + ai_messages + 索引）；3 個新 thread CRUD endpoints + 既有 run / cancel 兩個 endpoint 行為微調；agent run done 後新增 1 條 fire-and-forget background LLM call（economy model，不阻塞 SSE）。
