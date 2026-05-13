/* eslint-disable */
// Authenticated surfaces: Dashboard, Profile, Sessions, ApiKeys

function FolderItem({ label, count, active }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px", borderRadius: 8,
      background: active ? "var(--accent-purple-soft)" : "transparent",
      color: active ? "var(--accent-purple)" : "var(--text-primary)",
      fontSize: 13, fontWeight: active ? 600 : 500,
      cursor: "pointer"
    }}>
      <span className="v-row v-gap-2">
        <Icon.Folder size={14} />
        {label}
      </span>
      <span className="v-muted" style={{fontSize: 11}}>{count}</span>
    </div>
  );
}

function CanvasCard({ title, edited, role, accent, content }) {
  return (
    <Card className="hover-ring" style={{padding: 0, overflow: "hidden", cursor: "pointer"}}>
      <div className="v-canvas-thumb" style={{borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none"}}>
        {content}
        <div style={{position: "absolute", top: 8, left: 8, right: 8, display: "flex", justifyContent: "space-between"}}>
          <Badge tone={accent}>{role}</Badge>
        </div>
      </div>
      <div style={{padding: 14}}>
        <div className="v-display" style={{fontSize: 16, fontWeight: 500, marginBottom: 4}}>{title}</div>
        <div className="v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)"}}>{edited}</div>
      </div>
    </Card>
  );
}

function DashboardFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="" theme={theme} signedIn={true} />
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64}}>
          <div className="v-row" style={{justifyContent: "space-between", marginBottom: 28}}>
            <div>
              <div className="v-muted" style={{fontSize: 13, marginBottom: 4}}>2026 年 5 月 13 日 · 週三</div>
              <h1 className="v-display" style={{fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em"}}>
                早安,沛緹
              </h1>
            </div>
            <div className="v-row v-gap-3">
              <div style={{position: "relative"}}>
                <Icon.Search size={15} />
                <input className="v-input" placeholder="搜尋畫布⋯" style={{paddingLeft: 36, width: 240}} />
                <span style={{position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)"}}>
                  <Icon.Search size={15} />
                </span>
              </div>
              <Button variant="primary" icon={<Icon.Plus size={15} />}>新畫布</Button>
            </div>
          </div>

          <div style={{display: "grid", gridTemplateColumns: "220px 1fr", gap: 28}}>
            <aside>
              <div className="v-label" style={{marginBottom: 10}}>資料夾</div>
              <div style={{display: "flex", flexDirection: "column", gap: 2}}>
                <FolderItem label="全部畫布" count={24} active />
                <FolderItem label="工作中" count={6} />
                <FolderItem label="研究筆記" count={11} />
                <FolderItem label="與沛軒共享" count={4} />
                <FolderItem label="封存" count={3} />
              </div>
              <div className="v-label" style={{marginTop: 28, marginBottom: 10}}>標籤</div>
              <div className="v-row v-gap-2" style={{flexWrap: "wrap"}}>
                <Badge tone="purple">產品</Badge>
                <Badge tone="cyan">研究</Badge>
                <Badge tone="orange">客戶</Badge>
                <Badge tone="muted">+ 標籤</Badge>
              </div>
              <Card style={{marginTop: 28, padding: 16, background: "var(--accent-purple-soft)",
                border: "1px solid var(--accent-purple)"}}>
                <div className="v-accent-purple" style={{marginBottom: 8}}><Icon.Sparkles size={18} /></div>
                <div style={{fontSize: 13, fontWeight: 600, marginBottom: 4}}>升級至 Studio</div>
                <div className="v-muted" style={{fontSize: 12, marginBottom: 12}}>解鎖無限畫布與更長的 AI 對話。</div>
                <Button variant="primary" size="sm">了解方案</Button>
              </Card>
            </aside>

            <section>
              <div className="v-row" style={{justifyContent: "space-between", marginBottom: 16}}>
                <h2 className="v-display" style={{fontSize: 20, fontWeight: 500}}>全部畫布 · 24</h2>
                <div className="v-row v-gap-2">
                  <Button variant="ghost" size="sm">最近編輯</Button>
                  <Button variant="ghost" size="sm">字母排序</Button>
                </div>
              </div>

              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16}}>
                <CanvasCard title="學徒筆記 · 第三章" edited="3 分鐘前" role="擁有者" accent="purple"
                  content={
                    <div style={{padding: 16, width: "100%", height: "100%"}}>
                      <div style={{width: 80, height: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, marginBottom: 8}} />
                      <div style={{width: 120, height: 4, background: "var(--text-muted)", opacity: 0.3, marginBottom: 4}} />
                      <div style={{width: 90, height: 4, background: "var(--text-muted)", opacity: 0.3}} />
                    </div>
                  } />
                <CanvasCard title="Q3 產品線會議" edited="昨天" role="共同編輯" accent="cyan"
                  content={
                    <svg viewBox="0 0 200 110" style={{width: "100%", height: "100%"}}>
                      <circle cx="40" cy="55" r="20" fill="var(--accent-purple)" opacity="0.4" />
                      <circle cx="100" cy="55" r="20" fill="var(--accent-cyan)" opacity="0.4" />
                      <circle cx="160" cy="55" r="20" fill="var(--accent-pink)" opacity="0.4" />
                      <line x1="60" y1="55" x2="80" y2="55" stroke="var(--text-muted)" strokeWidth="1" />
                      <line x1="120" y1="55" x2="140" y2="55" stroke="var(--text-muted)" strokeWidth="1" />
                    </svg>
                  } />
                <CanvasCard title="字型蒐集" edited="3 天前" role="檢視" accent="muted"
                  content={
                    <div style={{padding: 20, fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text-muted)", lineHeight: 1.1}}>
                      Aa Bb<br />Cc Dd
                    </div>
                  } />
                <CanvasCard title="客戶訪談 · Studio K" edited="上週四" role="共同編輯" accent="cyan"
                  content={
                    <div style={{padding: 14, display: "flex", flexDirection: "column", gap: 4}}>
                      <div style={{display: "flex", gap: 6}}>
                        <div style={{width: 18, height: 18, borderRadius: 999, background: "var(--accent-orange)", opacity: 0.5}} />
                        <div style={{flex: 1, height: 18, background: "var(--surface)", borderRadius: 4}} />
                      </div>
                      <div style={{display: "flex", gap: 6}}>
                        <div style={{width: 18, height: 18, borderRadius: 999, background: "var(--accent-purple)", opacity: 0.5}} />
                        <div style={{flex: 1, height: 18, background: "var(--surface)", borderRadius: 4}} />
                      </div>
                      <div style={{display: "flex", gap: 6}}>
                        <div style={{width: 18, height: 18, borderRadius: 999, background: "var(--accent-cyan)", opacity: 0.5}} />
                        <div style={{flex: 1, height: 18, background: "var(--surface)", borderRadius: 4}} />
                      </div>
                    </div>
                  } />
                <CanvasCard title="個人 OKR · 2026 上" edited="2 週前" role="擁有者" accent="purple"
                  content={
                    <div style={{padding: 16}}>
                      <div style={{width: "100%", height: 6, background: "var(--surface)", borderRadius: 999, overflow: "hidden", marginBottom: 6}}>
                        <div style={{width: "62%", height: "100%", background: "var(--accent-cyan)"}} />
                      </div>
                      <div className="v-muted" style={{fontSize: 11, fontFamily: "var(--font-mono)"}}>5 / 8 達成</div>
                    </div>
                  } />
                <Card variant="outlined" className="hover-ring" style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column", gap: 10,
                  borderStyle: "dashed",
                  cursor: "pointer",
                  minHeight: 200
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: "var(--accent-purple-soft)", color: "var(--accent-purple)",
                    display: "grid", placeItems: "center"
                  }}>
                    <Icon.Plus size={20} />
                  </div>
                  <div style={{fontSize: 14, fontWeight: 600}}>新增畫布</div>
                  <div className="v-muted" style={{fontSize: 12}}>空白 · 從範本 · 從 PDF</div>
                </Card>
              </div>
            </section>
          </div>
        </div>
        <Footer />
      </div>
    </ThemeShell>
  );
}

/* ============================================================
   Profile
   ============================================================ */

function ProfileFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="" theme={theme} signedIn={true} />
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64, maxWidth: 960}}>
          {/* breadcrumb */}
          <div className="v-row v-gap-2 v-muted" style={{fontSize: 13, marginBottom: 14}}>
            <a>儀表板</a>
            <Icon.ChevronRight size={12} />
            <a>帳號設定</a>
            <Icon.ChevronRight size={12} />
            <span style={{color: "var(--text-primary)"}}>個人資料</span>
          </div>

          <div className="v-row" style={{justifyContent: "space-between", alignItems: "baseline", marginBottom: 8}}>
            <h1 className="v-display" style={{fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em"}}>個人資料</h1>
          </div>
          <p className="v-muted" style={{fontSize: 14, marginBottom: 24}}>
            這些資訊會顯示在你共享的畫布與留言上。
          </p>

          {/* secondary nav */}
          <div className="v-row v-gap-2" style={{
            borderBottom: "1px solid var(--border)", marginBottom: 28, paddingBottom: 0
          }}>
            {[
              ["個人資料", true],
              ["登入工作階段", false],
              ["API 與 MCP 金鑰", false],
              ["訂閱方案", false],
            ].map(([l, a], i) => (
              <a key={i} style={{
                padding: "10px 14px",
                fontSize: 13, fontWeight: 600,
                color: a ? "var(--text-primary)" : "var(--text-muted)",
                borderBottom: a ? "2px solid var(--accent-purple)" : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer"
              }}>{l}</a>
            ))}
          </div>

          <Card variant="elevated" style={{padding: 32}}>
            <div style={{display: "grid", gridTemplateColumns: "200px 1fr", gap: 40}}>
              {/* avatar column */}
              <div>
                <div className="v-label" style={{marginBottom: 12}}>頭像預覽</div>
                <div style={{
                  width: 160, height: 160, borderRadius: 24,
                  background: "linear-gradient(135deg, var(--accent-purple), var(--accent-pink))",
                  display: "grid", placeItems: "center",
                  color: "#fff", fontFamily: "var(--font-display)",
                  fontSize: 56, fontWeight: 500
                }}>沛</div>
                <div className="v-muted" style={{fontSize: 12, marginTop: 12, textWrap: "pretty"}}>
                  從 URL 載入。建議使用方形圖,至少 256×256。
                </div>
              </div>

              {/* form */}
              <div style={{display: "flex", flexDirection: "column", gap: 18}}>
                <Input label="顯示名稱" value="陳沛緹" />
                <Input label="Email" value="peiti@studio.tw" suffix="已驗證" />
                <Input label="頭像 URL" placeholder="https://..." value="https://i.vellum.app/u/peiti.jpg" />
                <div>
                  <label className="v-label">個人介紹</label>
                  <textarea className="v-textarea" rows={3}
                    defaultValue="字型設計師 / 在台北。" />
                </div>

                <div className="v-row" style={{justifyContent: "space-between", marginTop: 6}}>
                  <Button variant="ghost">取消變更</Button>
                  <div className="v-row v-gap-2">
                    <Badge tone="cyan" dot>已自動儲存</Badge>
                    <Button variant="primary">儲存變更</Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{marginTop: 20, padding: 24, borderColor: "var(--accent-red-soft)"}}>
            <div className="v-row" style={{justifyContent: "space-between"}}>
              <div>
                <div className="v-display" style={{fontSize: 18, fontWeight: 500, marginBottom: 4}}>
                  刪除帳號
                </div>
                <div className="v-muted" style={{fontSize: 13}}>
                  永久刪除你的帳號與所有畫布。此動作無法復原。
                </div>
              </div>
              <Button variant="destructive">刪除帳號</Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    </ThemeShell>
  );
}

/* ============================================================
   Sessions
   ============================================================ */

function SessionRow({ device, icon, browser, ip, location, lastSeen, current }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto",
      gap: 16,
      alignItems: "center",
      padding: "16px 20px",
      borderBottom: "1px solid var(--border)"
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: current ? "var(--accent-cyan-soft)" : "var(--surface-elevated)",
        color: current ? "var(--accent-cyan)" : "var(--text-muted)",
        display: "grid", placeItems: "center"
      }}>{icon}</div>
      <div>
        <div className="v-row v-gap-2">
          <span style={{fontSize: 14, fontWeight: 600}}>{device}</span>
          {current && <Badge tone="cyan" dot>這台裝置</Badge>}
        </div>
        <div className="v-muted" style={{fontSize: 12, marginTop: 2, fontFamily: "var(--font-mono)"}}>
          {browser} · {ip} · <Icon.MapPin size={11} /> {location}
        </div>
      </div>
      <div className="v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)"}}>{lastSeen}</div>
      <Button variant="destructive" size="sm" icon={<Icon.LogOut size={13} />}>
        {current ? "登出" : "撤銷"}
      </Button>
    </div>
  );
}

function SessionsFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="" theme={theme} signedIn={true} />
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64, maxWidth: 960}}>
          <div className="v-row v-gap-2 v-muted" style={{fontSize: 13, marginBottom: 14}}>
            <a>儀表板</a><Icon.ChevronRight size={12} />
            <a>帳號設定</a><Icon.ChevronRight size={12} />
            <span style={{color: "var(--text-primary)"}}>登入工作階段</span>
          </div>

          <h1 className="v-display" style={{fontSize: 36, fontWeight: 500, marginBottom: 8}}>
            登入工作階段
          </h1>
          <p className="v-muted" style={{fontSize: 14, marginBottom: 28}}>
            你目前有 4 個有效的登入。如果認不出某個裝置,立刻撤銷它。
          </p>

          <Card style={{padding: 0, overflow: "hidden"}}>
            <SessionRow current
              device="MacBook Pro 14&Prime;"
              icon={<Icon.Laptop size={18} />}
              browser="Arc 1.74"
              ip="118.232.4.18"
              location="台北市"
              lastSeen="此刻"
            />
            <SessionRow
              device="iPhone 15"
              icon={<Icon.Smartphone size={18} />}
              browser="Safari Mobile"
              ip="36.225.118.4"
              location="台北市"
              lastSeen="2 小時前"
            />
            <SessionRow
              device="Studio iMac"
              icon={<Icon.Monitor size={18} />}
              browser="Chrome 137"
              ip="111.250.6.82"
              location="新北市"
              lastSeen="昨天"
            />
            <SessionRow
              device="未知 Linux 裝置"
              icon={<Icon.Monitor size={18} />}
              browser="Firefox 129"
              ip="45.61.18.220"
              location="柏林,DE"
              lastSeen="3 天前"
            />
            <div style={{
              padding: "14px 20px",
              background: "var(--surface-elevated)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <span className="v-muted" style={{fontSize: 13}}>不認得某個裝置?立刻撤銷其他所有登入。</span>
              <Button variant="destructive" size="sm">撤銷其他全部</Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    </ThemeShell>
  );
}

/* ============================================================
   API Keys
   ============================================================ */

function ProviderRow({ name, logo, model, masked }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto",
      gap: 16, alignItems: "center",
      padding: "18px 20px",
      borderBottom: "1px solid var(--border)"
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "var(--surface-elevated)",
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-display)",
        fontSize: 18, fontWeight: 600
      }}>{logo}</div>
      <div>
        <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>{name}</div>
        <div className="v-row v-gap-2 v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)"}}>
          <Icon.Key size={11} /> {masked}
        </div>
      </div>
      <div>
        <div className="v-label" style={{marginBottom: 4}}>偏好模型</div>
        <div style={{
          height: 32, padding: "0 10px",
          border: "1px solid var(--border)", borderRadius: 8,
          background: "var(--surface)",
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 12, fontFamily: "var(--font-mono)",
          minWidth: 200, justifyContent: "space-between"
        }}>
          {model} <Icon.ChevronDown size={12} />
        </div>
      </div>
      <div className="v-row v-gap-2">
        <Button variant="secondary" size="sm">替換</Button>
        <Button variant="destructive" size="sm" icon={<Icon.Trash size={13} />} />
      </div>
    </div>
  );
}

function TokenRow({ name, prefix, lastUsed, expires, color = "purple" }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 200px 140px 140px auto",
      gap: 16, alignItems: "center",
      padding: "14px 20px",
      borderBottom: "1px solid var(--border)",
      fontSize: 13
    }}>
      <div>
        <div style={{fontWeight: 600, marginBottom: 2}}>{name}</div>
        <div className="v-row v-gap-2"><Badge tone={color}>讀取畫布</Badge><Badge tone="muted">寫入留言</Badge></div>
      </div>
      <div className="v-muted" style={{fontFamily: "var(--font-mono)", fontSize: 12}}>{prefix}</div>
      <div className="v-muted" style={{fontFamily: "var(--font-mono)", fontSize: 12}}>{lastUsed}</div>
      <div className="v-muted" style={{fontFamily: "var(--font-mono)", fontSize: 12}}>{expires}</div>
      <Button variant="destructive" size="sm" icon={<Icon.Trash size={13} />} />
    </div>
  );
}

function ApiKeysFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="" theme={theme} signedIn={true} />
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64}}>
          <div className="v-row v-gap-2 v-muted" style={{fontSize: 13, marginBottom: 14}}>
            <a>儀表板</a><Icon.ChevronRight size={12} />
            <a>帳號設定</a><Icon.ChevronRight size={12} />
            <span style={{color: "var(--text-primary)"}}>API 與 MCP 金鑰</span>
          </div>

          <h1 className="v-display" style={{fontSize: 36, fontWeight: 500, marginBottom: 8}}>
            API 與 MCP 金鑰
          </h1>
          <p className="v-muted" style={{fontSize: 14, marginBottom: 32}}>
            設定 AI 提供者的 API 金鑰,以及讓外部工具讀寫你畫布的 MCP 個人權杖。
          </p>

          {/* Section A: Providers */}
          <div style={{marginBottom: 36}}>
            <div className="v-row" style={{justifyContent: "space-between", marginBottom: 14}}>
              <div>
                <h2 className="v-display" style={{fontSize: 22, fontWeight: 500, marginBottom: 4}}>
                  A · 提供者金鑰
                </h2>
                <div className="v-muted" style={{fontSize: 13}}>
                  你的金鑰只儲存在你的帳號下,絕不會出現在伺服器紀錄中。
                </div>
              </div>
            </div>
            <Card style={{padding: 0, overflow: "hidden"}}>
              <ProviderRow
                name="Anthropic"
                logo="A"
                model="claude-haiku-4-5"
                masked="sk-ant-•••• •••• •••• 4f2a"
              />
              <ProviderRow
                name="OpenAI"
                logo="O"
                model="gpt-4.1-mini"
                masked="sk-•••• •••• •••• 91c0"
              />
              <ProviderRow
                name="Google"
                logo="G"
                model="gemini-2.5-pro"
                masked="未設定"
              />
            </Card>
          </div>

          {/* Section B: MCP tokens */}
          <div>
            <div className="v-row" style={{justifyContent: "space-between", marginBottom: 14}}>
              <div>
                <h2 className="v-display" style={{fontSize: 22, fontWeight: 500, marginBottom: 4}}>
                  B · MCP 個人權杖
                </h2>
                <div className="v-muted" style={{fontSize: 13}}>
                  讓 Claude Desktop、Cursor 等外部客戶端透過 MCP 連入你的畫布。
                </div>
              </div>
              <Button variant="primary" icon={<Icon.Plus size={15} />}>建立新權杖</Button>
            </div>

            <Card style={{padding: 0, overflow: "hidden"}}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px 140px 140px auto",
                gap: 16, padding: "10px 20px",
                background: "var(--surface-elevated)",
                fontSize: 11, fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                borderBottom: "1px solid var(--border)"
              }}>
                <span>名稱 · 權限</span>
                <span>前綴</span>
                <span>最近使用</span>
                <span>到期</span>
                <span />
              </div>
              <TokenRow name="Claude Desktop · 桌機" prefix="vlm_pat_a7f2…" lastUsed="2 分鐘前" expires="2026-12-01" />
              <TokenRow name="Cursor · 工作站" prefix="vlm_pat_91c0…" lastUsed="昨天" expires="無限期" color="cyan" />
              <TokenRow name="個人腳本" prefix="vlm_pat_44de…" lastUsed="3 週前" expires="2026-05-30" color="orange" />
            </Card>

            {/* dialog reveal preview */}
            <Card variant="elevated" style={{
              marginTop: 24,
              padding: 24,
              maxWidth: 520,
              borderTop: "3px solid var(--accent-cyan)"
            }}>
              <div className="v-row v-gap-2" style={{marginBottom: 12}}>
                <div className="v-accent-cyan"><Icon.Sparkles size={18} /></div>
                <div className="v-display" style={{fontSize: 18, fontWeight: 500}}>權杖已建立</div>
              </div>
              <p className="v-muted" style={{fontSize: 13, marginBottom: 16}}>
                請現在複製這串權杖。離開這個對話框後,你就再也看不到它了。
              </p>
              <div style={{
                background: "var(--bg)",
                border: "1px solid var(--accent-cyan)",
                borderRadius: 10,
                padding: 12,
                fontFamily: "var(--font-mono)", fontSize: 12,
                color: "var(--accent-cyan)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8, wordBreak: "break-all"
              }}>
                <span>vlm_pat_a7f2_8d4c1be94b2cae091f3e</span>
                <Button variant="secondary" size="sm" icon={<Icon.Copy size={13} />}>複製</Button>
              </div>
              <div className="v-row v-gap-3" style={{marginTop: 16, justifyContent: "flex-end"}}>
                <Button variant="ghost">關閉</Button>
                <Button variant="primary">我已經複製好了</Button>
              </div>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    </ThemeShell>
  );
}

Object.assign(window, { DashboardFrame, ProfileFrame, SessionsFrame, ApiKeysFrame });
