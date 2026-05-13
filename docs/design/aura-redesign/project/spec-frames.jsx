/* eslint-disable */
// Spec sheet + mobile breakpoint frames

function SpecBlock({ title, children, style }) {
  return (
    <div style={{marginBottom: 32, ...style}}>
      <div className="v-label" style={{marginBottom: 12, fontSize: 11}}>{title}</div>
      {children}
    </div>
  );
}

function ComponentSpecFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64}}>
          <Badge tone="muted">設計系統</Badge>
          <h1 className="v-display" style={{fontSize: 40, fontWeight: 500, marginTop: 12, marginBottom: 8, letterSpacing: "-0.01em"}}>
            元件規格表 · {theme === "dark" ? "深色" : "淺色"}
          </h1>
          <p className="v-muted" style={{fontSize: 14, marginBottom: 32}}>
            所有元件共用 8 個 token: bg / surface / surface-elevated / border / text-primary / text-muted / accent-purple / 對應狀態色。
          </p>

          {/* Buttons */}
          <SpecBlock title="按鈕 · BUTTONS">
            <Card style={{padding: 24}}>
              <div className="v-row v-gap-3" style={{flexWrap: "wrap", marginBottom: 16}}>
                <Button variant="primary">主要動作</Button>
                <Button variant="secondary">次要動作</Button>
                <Button variant="ghost">透明按鈕</Button>
                <Button variant="destructive">破壞性</Button>
              </div>
              <div className="v-row v-gap-3" style={{flexWrap: "wrap", marginBottom: 16}}>
                <Button variant="primary" size="sm">小</Button>
                <Button variant="primary">中</Button>
                <Button variant="primary" size="lg">大</Button>
                <Button variant="primary" icon={<Icon.Plus size={15} />}>有圖示</Button>
                <Button variant="primary" iconRight={<Icon.ArrowRight size={15} />}>右側圖示</Button>
              </div>
              <div className="v-row v-gap-3" style={{flexWrap: "wrap"}}>
                <Button variant="primary" disabled style={{opacity: 0.4, cursor: "not-allowed"}}>停用</Button>
                <Button variant="primary" style={{boxShadow: "var(--ring)"}}>聚焦</Button>
              </div>
            </Card>
          </SpecBlock>

          {/* Cards */}
          <SpecBlock title="卡片 · CARDS">
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16}}>
              <Card>
                <div className="v-display" style={{fontSize: 16, fontWeight: 500, marginBottom: 6}}>default</div>
                <div className="v-muted" style={{fontSize: 13}}>背景 surface · 邊框 border · 圓角 20</div>
              </Card>
              <Card variant="elevated">
                <div className="v-display" style={{fontSize: 16, fontWeight: 500, marginBottom: 6}}>elevated</div>
                <div className="v-muted" style={{fontSize: 13}}>背景 surface-elevated · 陰影 shadow-md</div>
              </Card>
              <Card variant="outlined">
                <div className="v-display" style={{fontSize: 16, fontWeight: 500, marginBottom: 6}}>outlined</div>
                <div className="v-muted" style={{fontSize: 13}}>透明背景 · 1px 邊框</div>
              </Card>
              <Card className="hover-ring" style={{boxShadow: "0 0 0 2px var(--accent-purple)"}}>
                <div className="v-display" style={{fontSize: 16, fontWeight: 500, marginBottom: 6}}>hover :ring</div>
                <div className="v-muted" style={{fontSize: 13}}>2px accent-purple 外環</div>
              </Card>
              <Card style={{borderTop: "3px solid var(--accent-orange)"}}>
                <div className="v-display" style={{fontSize: 16, fontWeight: 500, marginBottom: 6}}>accent-top</div>
                <div className="v-muted" style={{fontSize: 13}}>狀態色頂邊,用於警告或里程碑卡</div>
              </Card>
              <Card variant="elevated" style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                borderStyle: "dashed", color: "var(--text-muted)"
              }}>
                <span style={{fontSize: 13}}>+ 空狀態</span>
              </Card>
            </div>
          </SpecBlock>

          {/* Inputs */}
          <SpecBlock title="表單 · INPUTS">
            <Card style={{padding: 24}}>
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18}}>
                <Input label="預設" placeholder="標準狀態" />
                <Input label="有圖示" placeholder="搜尋⋯" icon={<Icon.Search size={15} />} />
                <Input label="聚焦狀態" value="陳沛緹" />
                <Input label="錯誤狀態" value="abc" error="請輸入有效的 Email" />
                <div>
                  <label className="v-label">下拉選單</label>
                  <div className="v-input" style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                    <span>claude-haiku-4-5</span>
                    <Icon.ChevronDown size={14} />
                  </div>
                </div>
                <div>
                  <label className="v-label">切換開關</label>
                  <div style={{display: "flex", alignItems: "center", gap: 12, height: 40}}>
                    <span style={{
                      width: 44, height: 24, borderRadius: 999,
                      background: "var(--accent-purple)",
                      position: "relative", flexShrink: 0
                    }}>
                      <span style={{
                        position: "absolute", top: 2, right: 2,
                        width: 20, height: 20, borderRadius: 999,
                        background: "#fff"
                      }} />
                    </span>
                    <span style={{fontSize: 13}}>系統主題追蹤</span>
                  </div>
                </div>
              </div>
            </Card>
          </SpecBlock>

          {/* NavBar */}
          <SpecBlock title="導覽列 · NAVBAR">
            <Card style={{padding: 0, overflow: "hidden"}}>
              <NavBar active="home" theme={theme} signedIn={true} />
              <div style={{padding: "12px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
                background: "var(--surface-elevated)", borderTop: "1px solid var(--border)"}}>
                grid-cols: [1fr · auto · 1fr] · height 64 · backdrop-blur 12px · border-b 1px
              </div>
            </Card>
          </SpecBlock>

          {/* Footer */}
          <SpecBlock title="頁尾 · FOOTER">
            <Card style={{padding: 0, overflow: "hidden"}}>
              <Footer />
            </Card>
          </SpecBlock>

          {/* Dialog */}
          <SpecBlock title="對話框 · DIALOG">
            <div style={{
              background: theme === "dark" ? "rgba(0,0,0,0.4)" : "rgba(30,30,40,0.18)",
              borderRadius: 16,
              padding: 32,
              display: "grid", placeItems: "center"
            }}>
              <Card variant="elevated" style={{width: 420, padding: 28, boxShadow: "var(--shadow-lg)"}}>
                <div className="v-row" style={{justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8}}>
                  <div className="v-display" style={{fontSize: 20, fontWeight: 500}}>確認撤銷?</div>
                  <button className="v-iconbtn" style={{height: 28, minWidth: 28, padding: 0, border: "none", background: "transparent"}}>
                    <Icon.X size={16} />
                  </button>
                </div>
                <p className="v-muted" style={{fontSize: 14, marginBottom: 20}}>
                  撤銷後,iPhone 15 上會立即被登出,需要重新登入才能繼續使用。
                </p>
                <div className="v-row v-gap-3" style={{justifyContent: "flex-end"}}>
                  <Button variant="ghost">取消</Button>
                  <Button variant="destructive">撤銷</Button>
                </div>
              </Card>
            </div>
          </SpecBlock>

          {/* Badges + colors */}
          <SpecBlock title="標籤 · BADGES">
            <Card style={{padding: 24}}>
              <div className="v-row v-gap-3" style={{flexWrap: "wrap"}}>
                <Badge tone="purple" dot>進行中</Badge>
                <Badge tone="cyan" dot>已同步</Badge>
                <Badge tone="orange">警告</Badge>
                <Badge tone="muted">標籤</Badge>
                <Badge tone="purple"><Icon.Check size={11} /> 已完成</Badge>
              </div>
            </Card>
          </SpecBlock>
        </div>
      </div>
    </ThemeShell>
  );
}

/* ============================================================
   Color palette frame (one frame; theme switch shows both)
   ============================================================ */

function PaletteFrame({ theme }) {
  const swatches = [
    ["bg", "var(--bg)", theme === "dark" ? "#21202E" : "#FAF9F6"],
    ["surface", "var(--surface)", theme === "dark" ? "#2C2A3A" : "#FFFFFF"],
    ["surface-elevated", "var(--surface-elevated)", theme === "dark" ? "#3D3B4D" : "#F4F2EE"],
    ["border", "var(--border)", theme === "dark" ? "#3D3B4D" : "#E5E3DC"],
    ["text-primary", "var(--text-primary)", theme === "dark" ? "#EDECEE" : "#21202E"],
    ["text-muted", "var(--text-muted)", theme === "dark" ? "#A7A6B0" : "#6B6976"],
    ["accent-purple", "var(--accent-purple)", theme === "dark" ? "#A277FF" : "#7C3AED"],
    ["accent-cyan", "var(--accent-cyan)", theme === "dark" ? "#61FFCA" : "#0D9488"],
    ["accent-pink", "var(--accent-pink)", theme === "dark" ? "#FF6AD5" : "#DB2777"],
    ["accent-orange", "var(--accent-orange)", theme === "dark" ? "#FFCA85" : "#EA580C"],
    ["accent-red", "var(--accent-red)", theme === "dark" ? "#FF6767" : "#DC2626"],
  ];
  return (
    <ThemeShell theme={theme}>
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64}}>
          <Badge tone="muted">設計系統</Badge>
          <h1 className="v-display" style={{fontSize: 40, fontWeight: 500, marginTop: 12, marginBottom: 8, letterSpacing: "-0.01em"}}>
            Aura · {theme === "dark" ? "深色" : "淺色"}模式
          </h1>
          <p className="v-muted" style={{fontSize: 14, marginBottom: 28}}>
            所有顏色都透過 CSS custom properties 取用,Tailwind 直接寫成 <code style={{fontFamily: "var(--font-mono)", fontSize: 12}}>bg-[var(--surface)]</code>。
          </p>

          <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12}}>
            {swatches.map(([name, varname, hex]) => (
              <Card key={name} style={{padding: 0, overflow: "hidden"}}>
                <div style={{height: 90, background: varname, borderBottom: "1px solid var(--border)"}} />
                <div style={{padding: 14}}>
                  <div style={{fontSize: 13, fontWeight: 600, marginBottom: 4}}>{name}</div>
                  <div className="v-muted" style={{fontSize: 11, fontFamily: "var(--font-mono)"}}>{hex}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Type */}
          <div className="v-label" style={{marginTop: 36, marginBottom: 12}}>字型 · TYPE</div>
          <Card style={{padding: 28}}>
            <div className="v-display" style={{fontSize: 72, lineHeight: 1, marginBottom: 4, fontWeight: 500, letterSpacing: "-0.02em"}}>
              凝鍊思考
            </div>
            <div className="v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)", marginBottom: 24}}>
              Newsreader · 72/72 · weight 500 · letter-spacing -0.02em
            </div>
            <div style={{fontSize: 32, lineHeight: 1.2, marginBottom: 4}}>The quick brown fox</div>
            <div className="v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)", marginBottom: 24}}>
              Inter · 32/38 · weight 400
            </div>
            <div style={{fontFamily: "var(--font-mono)", fontSize: 14, marginBottom: 4}}>vlm_pat_a7f2_8d4c1be94b2c</div>
            <div className="v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)"}}>
              ui-monospace · 14/22 · 用於金鑰與技術數值
            </div>
          </Card>
        </div>
      </div>
    </ThemeShell>
  );
}

/* ============================================================
   Token map (the CSS to paste into styles.css)
   ============================================================ */

function TokenMapFrame({ theme }) {
  const css = `:root[data-theme="dark"] {
  --bg: #21202E;
  --surface: #2C2A3A;
  --surface-elevated: #3D3B4D;
  --border: #3D3B4D;
  --text-primary: #EDECEE;
  --text-muted: #A7A6B0;
  --accent-purple: #A277FF;
  --accent-cyan: #61FFCA;
  --accent-pink: #FF6AD5;
  --accent-orange: #FFCA85;
  --accent-red: #FF6767;
}

:root[data-theme="light"] {
  --bg: #FAF9F6;        /* warm off-white, NOT #FFFFFF */
  --surface: #FFFFFF;
  --surface-elevated: #F4F2EE;
  --border: #E5E3DC;
  --text-primary: #21202E;
  --text-muted: #6B6976;
  --accent-purple: #7C3AED;
  --accent-cyan: #0D9488;
  --accent-pink: #DB2777;
  --accent-orange: #EA580C;
  --accent-red: #DC2626;
}

/* @theme inline maps these into Tailwind v4 utilities */
@theme inline {
  --color-background: var(--bg);
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-border: var(--border);
  --color-foreground: var(--text-primary);
  --color-muted: var(--text-muted);
  --color-accent: var(--accent-purple);
  --color-success: var(--accent-cyan);
  --color-warning: var(--accent-orange);
  --color-destructive: var(--accent-red);

  --radius: 12px;
  --font-display: "Newsreader", ui-serif, Georgia, serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, monospace;
}`;

  return (
    <ThemeShell theme={theme}>
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 40, paddingBottom: 64}}>
          <Badge tone="muted">交付物</Badge>
          <h1 className="v-display" style={{fontSize: 36, fontWeight: 500, marginTop: 12, marginBottom: 8, letterSpacing: "-0.01em"}}>
            Tailwind v4 token map
          </h1>
          <p className="v-muted" style={{fontSize: 14, marginBottom: 24, textWrap: "pretty"}}>
            直接貼進 <code style={{fontFamily: "var(--font-mono)", fontSize: 12}}>apps/web/src/styles.css</code>。
            主題切換靠 <code style={{fontFamily: "var(--font-mono)", fontSize: 12}}>&lt;html data-theme="..."&gt;</code>,
            Zustand 寫入 localStorage 同步,system 模式監聽 prefers-color-scheme。
          </p>

          <Card style={{padding: 0, overflow: "hidden"}}>
            <div style={{
              padding: "10px 18px",
              background: "var(--surface-elevated)",
              borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)"
            }}>
              <span>apps/web/src/styles.css</span>
              <Button variant="ghost" size="sm" icon={<Icon.Copy size={13} />}>複製</Button>
            </div>
            <pre style={{
              margin: 0, padding: 24,
              fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap"
            }}>{css}</pre>
          </Card>

          <div className="v-label" style={{marginTop: 32, marginBottom: 12}}>主題切換協議</div>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12}}>
            {[
              { i: <Icon.Monitor size={20} />, name: "system", note: "預設值,跟著 OS 走" },
              { i: <Icon.Sun size={20} />, name: "light", note: "強制 #FAF9F6 暖白" },
              { i: <Icon.Moon size={20} />, name: "dark", note: "強制 #21202E Aura" },
            ].map(({i, name, note}) => (
              <Card key={name} style={{padding: 16}}>
                <div className="v-row v-gap-2" style={{marginBottom: 8}}>
                  <span className="v-accent-purple">{i}</span>
                  <span style={{fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600}}>{name}</span>
                </div>
                <div className="v-muted" style={{fontSize: 12}}>{note}</div>
              </Card>
            ))}
          </div>
          <div className="v-muted" style={{fontSize: 12, marginTop: 12, fontFamily: "var(--font-mono)"}}>
            循環:system → light → dark → system · 切換無動畫
          </div>
        </div>
      </div>
    </ThemeShell>
  );
}

/* ============================================================
   Mobile sketches: NavBar + Dashboard drawer
   ============================================================ */

function MobileNavFrame({ theme }) {
  const [open, setOpen] = React.useState(false);
  return (
    <ThemeShell theme={theme}>
      <div className="v-scroll" style={{padding: 24, display: "flex", gap: 20, justifyContent: "center", alignItems: "flex-start"}}>
        {/* closed state */}
        <div style={{width: 320, borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)"}}>
          <header className="v-nav" style={{height: 56}}>
            <div className="v-nav-inner" style={{gridTemplateColumns: "auto 1fr auto", padding: "0 16px"}}>
              <div className="v-brand" style={{fontSize: 17}}>
                <div className="v-brand-mark" style={{width: 26, height: 26, fontSize: 13}}>V</div>
                Vellum
              </div>
              <span />
              <button className="v-iconbtn" style={{height: 34}}>
                <Icon.Menu size={17} />
              </button>
            </div>
          </header>
          <div style={{padding: 20, minHeight: 320}}>
            <div className="v-display" style={{fontSize: 26, fontWeight: 500, lineHeight: 1.15, marginBottom: 12}}>
              一張畫布,凝鍊思考。
            </div>
            <div className="v-muted" style={{fontSize: 13, marginBottom: 16}}>
              手機版的 NavBar 只保留 logo + 漢堡選單;
              中央連結與右側控制項摺進 sheet。
            </div>
            <Button variant="primary" size="sm" iconRight={<Icon.ArrowRight size={13} />}>開始使用</Button>
          </div>
          <div style={{textAlign: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: 10, borderTop: "1px solid var(--border)"}}>
            收合狀態
          </div>
        </div>

        {/* open sheet state */}
        <div style={{width: 320, borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)"}}>
          <header className="v-nav" style={{height: 56}}>
            <div className="v-nav-inner" style={{gridTemplateColumns: "auto 1fr auto", padding: "0 16px"}}>
              <div className="v-brand" style={{fontSize: 17}}>
                <div className="v-brand-mark" style={{width: 26, height: 26, fontSize: 13}}>V</div>
                Vellum
              </div>
              <span />
              <button className="v-iconbtn" style={{height: 34, color: "var(--accent-purple)"}}>
                <Icon.X size={17} />
              </button>
            </div>
          </header>
          <div style={{padding: 16, display: "flex", flexDirection: "column", gap: 4}}>
            <a style={{padding: "14px 12px", borderRadius: 10, fontSize: 17, fontWeight: 600,
              color: "var(--accent-purple)", background: "var(--accent-purple-soft)"}}>首頁</a>
            <a style={{padding: "14px 12px", borderRadius: 10, fontSize: 17, fontWeight: 500}}>關於</a>
            <div style={{height: 1, background: "var(--border)", margin: "8px 0"}} />
            <div className="v-row" style={{justifyContent: "space-between", padding: "10px 12px"}}>
              <span style={{fontSize: 14}}>語言</span>
              <div className="v-row v-gap-2">
                <Badge tone="purple">繁體中文</Badge>
                <Badge tone="muted">EN</Badge>
              </div>
            </div>
            <div className="v-row" style={{justifyContent: "space-between", padding: "10px 12px"}}>
              <span style={{fontSize: 14}}>主題</span>
              <div className="v-row v-gap-2">
                <button className="v-iconbtn" style={{height: 30, color: "var(--text-muted)"}}><Icon.Monitor size={14} /></button>
                <button className="v-iconbtn" style={{height: 30, color: "var(--text-muted)"}}><Icon.Sun size={14} /></button>
                <button className="v-iconbtn" style={{height: 30, color: "var(--accent-purple)", borderColor: "var(--accent-purple)"}}><Icon.Moon size={14} /></button>
              </div>
            </div>
            <div style={{height: 1, background: "var(--border)", margin: "8px 0"}} />
            <Button variant="primary" style={{width: "100%", justifyContent: "center"}}>登入</Button>
          </div>
          <div style={{textAlign: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: 10, borderTop: "1px solid var(--border)"}}>
            sheet 展開
          </div>
        </div>

        {/* dashboard drawer */}
        <div style={{width: 320, borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)", position: "relative"}}>
          <header className="v-nav" style={{height: 56}}>
            <div className="v-nav-inner" style={{gridTemplateColumns: "auto 1fr auto", padding: "0 16px"}}>
              <button className="v-iconbtn" style={{height: 34}}><Icon.Menu size={17} /></button>
              <span style={{fontFamily: "var(--font-display)", fontSize: 16, textAlign: "center", fontWeight: 500}}>儀表板</span>
              <button className="v-iconbtn" style={{height: 34, padding: "0 4px"}}>
                <div style={{width: 24, height: 24, borderRadius: 999,
                  background: "linear-gradient(135deg, var(--accent-purple), var(--accent-pink))",
                  display: "grid", placeItems: "center", color: "#fff", fontSize: 11, fontWeight: 600
                }}>沛</div>
              </button>
            </div>
          </header>
          {/* drawer overlay */}
          <div style={{position: "absolute", inset: "56px 0 0 0", background: "rgba(0,0,0,0.4)"}} />
          <aside style={{
            position: "absolute", top: 56, bottom: 0, left: 0, width: 240,
            background: "var(--bg)", borderRight: "1px solid var(--border)",
            padding: 16, boxShadow: "var(--shadow-lg)"
          }}>
            <div className="v-label" style={{marginBottom: 10}}>資料夾</div>
            <div style={{display: "flex", flexDirection: "column", gap: 2}}>
              <FolderItem label="全部畫布" count={24} active />
              <FolderItem label="工作中" count={6} />
              <FolderItem label="研究筆記" count={11} />
              <FolderItem label="共享" count={4} />
              <FolderItem label="封存" count={3} />
            </div>
            <Button variant="primary" size="sm" icon={<Icon.Plus size={14} />} style={{width: "100%", justifyContent: "center", marginTop: 16}}>
              新畫布
            </Button>
          </aside>
          <div style={{textAlign: "center", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", padding: 10, borderTop: "1px solid var(--border)", position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--bg)"}}>
            儀表板 · drawer 展開
          </div>
        </div>
      </div>
    </ThemeShell>
  );
}

Object.assign(window, { ComponentSpecFrame, PaletteFrame, TokenMapFrame, MobileNavFrame });
