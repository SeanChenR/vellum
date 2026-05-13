/* eslint-disable */
// Public surfaces: Home, About, Login, Verify, InviteError

function HomeFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="home" theme={theme} signedIn={false} />
      <div className="v-scroll">
        <section className="v-container" style={{paddingTop: 96, paddingBottom: 96}}>
          <div style={{maxWidth: 760, margin: "0 auto", textAlign: "center"}}>
            <Badge tone="purple" dot>v0.9 · 公開測試版</Badge>
            <h1 className="v-display" style={{
              fontSize: 72, lineHeight: 1.05, marginTop: 20, marginBottom: 20,
              fontWeight: 500, letterSpacing: "-0.02em", textWrap: "balance"
            }}>
              一張畫布，<br />
              凝鍊你的<span style={{color: "var(--accent-purple)", fontStyle: "italic"}}>思考</span>。
            </h1>
            <p style={{
              fontSize: 18, color: "var(--text-muted)", maxWidth: 540,
              margin: "0 auto 32px", textWrap: "pretty"
            }}>
              Vellum 是一張帶有 AI 副駕駛的協作畫布。把想法畫下來、
              讓模型陪你推演，必要時連回你自己的工具鏈。
            </p>
            <div className="v-row v-gap-3" style={{justifyContent: "center"}}>
              <Button variant="primary" size="lg" iconRight={<Icon.ArrowRight size={16} />}>開始使用</Button>
              <Button variant="secondary" size="lg">看一下範例</Button>
            </div>
          </div>

          {/* canvas preview screenshot stand-in */}
          <div style={{
            marginTop: 64,
            borderRadius: 20,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: 10,
            boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{
              height: 360, borderRadius: 14,
              background: "var(--surface-elevated)",
              backgroundImage: `
                radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--text-muted) 18%, transparent) 1px, transparent 0)
              `,
              backgroundSize: "22px 22px",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* fake canvas content */}
              <div style={{position: "absolute", top: 28, left: 32, width: 200, height: 110,
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
                padding: 12, fontSize: 12, color: "var(--text-muted)"}}>
                <div style={{fontWeight: 600, color: "var(--text-primary)", marginBottom: 6}}>研究主題</div>
                <div>記錄手寫感的歷史脈絡 →</div>
              </div>
              <svg style={{position: "absolute", top: 78, left: 232}} width="120" height="40">
                <path d="M0 20 L100 20" stroke="var(--accent-purple)" strokeWidth="2" fill="none" />
                <path d="M95 15 L105 20 L95 25 Z" fill="var(--accent-purple)" />
              </svg>
              <div style={{position: "absolute", top: 28, left: 360, width: 220, height: 110,
                background: "var(--surface)", border: "1px solid var(--accent-purple)", borderRadius: 10,
                padding: 12, fontSize: 12, color: "var(--text-muted)"}}>
                <Badge tone="purple">AI 副駕駛</Badge>
                <div style={{marginTop: 8, color: "var(--text-primary)"}}>從中世紀的 vellum 開始說起⋯</div>
              </div>
              <div style={{position: "absolute", bottom: 28, left: 32, right: 32, height: 90,
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
                padding: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)"}}>
                <div style={{color: "var(--accent-cyan)"}}>// mcp: notion.search</div>
                <div>q = "羊皮紙 vellum 製作工藝"</div>
                <div style={{marginTop: 4, color: "var(--text-primary)"}}>3 個結果已連入畫布 →</div>
              </div>
              {/* top bar */}
              <div style={{position: "absolute", top: 10, left: 10, right: 10, height: 28,
                display: "flex", gap: 6, alignItems: "center"}}>
                <span style={{width: 10, height: 10, borderRadius: 999, background: "var(--accent-red)"}} />
                <span style={{width: 10, height: 10, borderRadius: 999, background: "var(--accent-orange)"}} />
                <span style={{width: 10, height: 10, borderRadius: 999, background: "var(--accent-cyan)"}} />
                <span style={{marginLeft: 12, fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)"}}>
                  vellum.canvas / 學徒筆記
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="v-container" style={{paddingBottom: 96}}>
          <div style={{marginBottom: 32, textAlign: "center"}}>
            <h2 className="v-display" style={{fontSize: 36, fontWeight: 500, letterSpacing: "-0.01em"}}>
              三件你會反覆用到的事
            </h2>
          </div>
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16}}>
            <Card variant="elevated" style={{borderTop: "2px solid var(--accent-purple)"}}>
              <div className="v-accent-purple" style={{marginBottom: 14}}>
                <Icon.PenTool size={22} />
              </div>
              <h3 className="v-display" style={{fontSize: 22, marginBottom: 8, fontWeight: 500}}>
                像紙一樣的畫布
              </h3>
              <p className="v-muted" style={{fontSize: 14}}>
                繼承 tldraw 的手感，加上版面節奏感與安靜的暗色介面,
                專心想事情不會被介面拉走。
              </p>
            </Card>
            <Card variant="elevated" style={{borderTop: "2px solid var(--accent-cyan)"}}>
              <div className="v-accent-cyan" style={{marginBottom: 14}}>
                <Icon.Bot size={22} />
              </div>
              <h3 className="v-display" style={{fontSize: 22, marginBottom: 8, fontWeight: 500}}>
                AI 副駕駛
              </h3>
              <p className="v-muted" style={{fontSize: 14}}>
                在側邊抽屜直接對話,
                可以引用畫布上的任何節點,
                也可以把回應「貼回」畫布。
              </p>
            </Card>
            <Card variant="elevated" style={{borderTop: "2px solid var(--accent-pink)"}}>
              <div style={{color: "var(--accent-pink)", marginBottom: 14}}>
                <Icon.Layers size={22} />
              </div>
              <h3 className="v-display" style={{fontSize: 22, marginBottom: 8, fontWeight: 500}}>
                MCP 連線
              </h3>
              <p className="v-muted" style={{fontSize: 14}}>
                透過 Model Context Protocol 把你的筆記、行事曆、
                程式碼倉接進來,讓 AI 真的派得上用場。
              </p>
            </Card>
          </div>
        </section>

        {/* Narrative band */}
        <section style={{background: "var(--surface-elevated)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)"}}>
          <div className="v-container" style={{paddingTop: 72, paddingBottom: 72, display: "grid",
            gridTemplateColumns: "1.1fr 1fr", gap: 56, alignItems: "center"}}>
            <div>
              <Badge tone="muted">緣起</Badge>
              <h2 className="v-display" style={{fontSize: 40, fontWeight: 500, marginTop: 16, marginBottom: 16, letterSpacing: "-0.01em"}}>
                為什麼叫 <span style={{color: "var(--accent-purple)", fontStyle: "italic"}}>Vellum</span>?
              </h2>
              <p className="v-muted" style={{fontSize: 16, marginBottom: 20, textWrap: "pretty"}}>
                Vellum 是中世紀的羊皮紙。它貴、它耐放、寫上去的字會被認真對待。
                我們想做一張這樣的數位畫布:慢一點、好一點、留得住的東西。
              </p>
              <Button variant="ghost" iconRight={<Icon.ArrowRight size={15} />}>讀完整故事</Button>
            </div>
            <div style={{
              aspectRatio: "4/3",
              borderRadius: 20,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              padding: 24,
              display: "flex", flexDirection: "column", justifyContent: "space-between"
            }}>
              <div className="v-display" style={{fontSize: 88, color: "var(--accent-purple)", fontStyle: "italic", lineHeight: 1, fontWeight: 400}}>
                "
              </div>
              <p className="v-display" style={{fontSize: 22, lineHeight: 1.4, textWrap: "pretty"}}>
                寫在羊皮紙上的字,
                會被認真地讀。
              </p>
              <div className="v-muted" style={{fontSize: 12, fontFamily: "var(--font-mono)"}}>
                ── 設計筆記,2026.04
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </ThemeShell>
  );
}

function AboutFrame({ theme }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="about" theme={theme} signedIn={false} />
      <div className="v-scroll">
        <div className="v-container" style={{paddingTop: 80, paddingBottom: 96, display: "grid",
          gridTemplateColumns: "200px 1fr 200px", gap: 32}}>
          <aside style={{position: "sticky", top: 80, alignSelf: "start"}}>
            <div className="v-label" style={{marginBottom: 12}}>章節</div>
            <ul style={{listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10}}>
              <li style={{fontSize: 13, color: "var(--accent-purple)", fontWeight: 600,
                borderLeft: "2px solid var(--accent-purple)", paddingLeft: 10}}>緣起</li>
              <li style={{fontSize: 13, color: "var(--text-muted)", paddingLeft: 12}}>我們相信的事</li>
              <li style={{fontSize: 13, color: "var(--text-muted)", paddingLeft: 12}}>路線圖</li>
              <li style={{fontSize: 13, color: "var(--text-muted)", paddingLeft: 12}}>團隊</li>
            </ul>
          </aside>

          <article style={{maxWidth: 640}}>
            <Badge tone="muted">關於</Badge>
            <h1 className="v-display" style={{fontSize: 52, fontWeight: 500, letterSpacing: "-0.01em", marginTop: 16, marginBottom: 24, lineHeight: 1.1}}>
              我們在做<br />一張慢一點的畫布。
            </h1>
            <p style={{fontSize: 17, color: "var(--text-muted)", marginBottom: 20, textWrap: "pretty", lineHeight: 1.7}}>
              Vellum 起於一個簡單的不滿:
              現在的協作工具讓人很快地畫出很多東西,
              但很少讓人「想得更慢、更深」。
            </p>
            <p style={{fontSize: 16, marginBottom: 20, textWrap: "pretty", lineHeight: 1.75}}>
              我們把 tldraw 的手感,搭上一個會引用、會推演的 AI 副駕駛,
              並且用 MCP 把這些連回你既有的工具鏈。
              這不是要取代你的筆記軟體,
              而是讓你在它們之間,有一張可以攤開來想事情的桌子。
            </p>
            <p style={{fontSize: 16, marginBottom: 32, textWrap: "pretty", lineHeight: 1.75}}>
              這份產品由兩個人在台北的咖啡店和深夜的書房裡做出來。
              如果你在用,歡迎寫信來。
            </p>

            <h2 className="v-display" style={{fontSize: 28, fontWeight: 500, marginTop: 48, marginBottom: 16}}>
              路線圖
            </h2>
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12}}>
              <Card style={{padding: 18}}>
                <Badge tone="cyan"><Icon.Check size={11} /> 已完成</Badge>
                <div className="v-display" style={{fontSize: 18, marginTop: 10, fontWeight: 500}}>第一階段</div>
                <div className="v-muted" style={{fontSize: 13, marginTop: 4}}>畫布核心 + AI 副駕駛</div>
              </Card>
              <Card style={{padding: 18}}>
                <Badge tone="cyan"><Icon.Check size={11} /> 已完成</Badge>
                <div className="v-display" style={{fontSize: 18, marginTop: 10, fontWeight: 500}}>第二階段</div>
                <div className="v-muted" style={{fontSize: 13, marginTop: 4}}>MCP 連線 + 多人協作</div>
              </Card>
              <Card style={{padding: 18, borderColor: "var(--accent-purple)"}}>
                <Badge tone="purple" dot>進行中</Badge>
                <div className="v-display" style={{fontSize: 18, marginTop: 10, fontWeight: 500}}>下一步</div>
                <div className="v-muted" style={{fontSize: 13, marginTop: 4}}>正式版部署與訂閱方案</div>
              </Card>
            </div>
          </article>

          <aside />
        </div>
        <Footer />
      </div>
    </ThemeShell>
  );
}

function CenteredCardShell({ theme, children }) {
  return (
    <ThemeShell theme={theme}>
      <NavBar active="" theme={theme} signedIn={false} />
      <div className="v-scroll" style={{display: "flex", alignItems: "center", justifyContent: "center"}}>
        <div style={{
          width: "100%", maxWidth: 1152, padding: "48px 32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "100%"
        }}>
          {children}
        </div>
      </div>
    </ThemeShell>
  );
}

function LoginFrame({ theme }) {
  return (
    <CenteredCardShell theme={theme}>
      <Card variant="elevated" style={{width: 420, padding: 36}}>
        <div className="v-row v-gap-3" style={{marginBottom: 24}}>
          <div className="v-brand-mark" style={{width: 32, height: 32}}>V</div>
          <div>
            <div className="v-display" style={{fontSize: 22, fontWeight: 500, lineHeight: 1}}>歡迎回來</div>
            <div className="v-muted" style={{fontSize: 13, marginTop: 4}}>登入你的 Vellum 帳號</div>
          </div>
        </div>

        <div style={{display: "flex", flexDirection: "column", gap: 14}}>
          <Input
            label="Email"
            placeholder="you@example.com"
            icon={<Icon.Mail size={15} />}
          />
          <Button variant="primary" iconRight={<Icon.ArrowRight size={15} />}>
            寄送登入連結
          </Button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          margin: "22px 0", color: "var(--text-muted)", fontSize: 12
        }}>
          <span style={{flex: 1, height: 1, background: "var(--border)"}} />
          <span>或</span>
          <span style={{flex: 1, height: 1, background: "var(--border)"}} />
        </div>

        <Button variant="secondary" style={{width: "100%", justifyContent: "center"}}
          icon={<svg width="16" height="16" viewBox="0 0 24 24"><path d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.65 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.74 3.95 14.6 3 12 3 6.97 3 2.9 7.07 2.9 12s4.07 9 9.1 9c5.25 0 8.73-3.7 8.73-8.9 0-.6-.06-1.05-.13-1.5z" fill="currentColor"/></svg>}>
          使用 Google 繼續
        </Button>

        <div className="v-muted" style={{fontSize: 12, marginTop: 24, textAlign: "center", textWrap: "pretty"}}>
          點選後即代表你同意我們的<a className="v-accent-purple"> 服務條款 </a>與<a className="v-accent-purple"> 隱私權政策</a>。
        </div>
      </Card>
    </CenteredCardShell>
  );
}

function VerifyFrame({ theme }) {
  return (
    <CenteredCardShell theme={theme}>
      <Card variant="elevated" style={{width: 460, padding: 40, textAlign: "center"}}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "var(--accent-purple-soft)",
          color: "var(--accent-purple)",
          display: "grid", placeItems: "center",
          margin: "0 auto 20px"
        }}>
          <Icon.Mail size={26} />
        </div>
        <h2 className="v-display" style={{fontSize: 26, fontWeight: 500, marginBottom: 10}}>
          請查看你的信箱
        </h2>
        <p className="v-muted" style={{fontSize: 14, marginBottom: 24, textWrap: "pretty"}}>
          我們已將登入連結寄到 <span style={{color: "var(--text-primary)", fontFamily: "var(--font-mono)"}}>peiti@studio.tw</span>,
          連結 15 分鐘內有效。
        </p>

        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 14,
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 13
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 999,
            border: "2px solid var(--accent-cyan)", borderRightColor: "transparent",
            animation: "spin 1s linear infinite"
          }} />
          <span className="v-muted">等待你點擊連結⋯</span>
        </div>

        <div style={{marginTop: 20, fontSize: 13}}>
          <span className="v-muted">沒收到信件? </span>
          <a className="v-accent-purple" style={{fontWeight: 600}}>重新寄送</a>
        </div>
      </Card>
    </CenteredCardShell>
  );
}

function InviteErrorFrame({ theme }) {
  return (
    <CenteredCardShell theme={theme}>
      <Card variant="elevated" style={{width: 460, padding: 40, textAlign: "center",
        borderTop: "3px solid var(--accent-orange)"}}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: "var(--accent-orange-soft)",
          color: "var(--accent-orange)",
          display: "grid", placeItems: "center",
          margin: "0 auto 20px"
        }}>
          <Icon.AlertTriangle size={26} />
        </div>
        <h2 className="v-display" style={{fontSize: 26, fontWeight: 500, marginBottom: 10}}>
          這封邀請已失效
        </h2>
        <p className="v-muted" style={{fontSize: 14, marginBottom: 24, textWrap: "pretty"}}>
          這份協作邀請可能已經過期、被撤回,或是被其他帳號接受了。
          請聯絡邀請你的人重新寄送。
        </p>

        <div style={{
          textAlign: "left",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 14,
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: "var(--text-muted)", marginBottom: 24
        }}>
          <div><span style={{color: "var(--accent-orange)"}}>error</span> · invite_expired</div>
          <div>canvas · 學徒筆記 / 第三章</div>
          <div>expires_at · 2026-05-08 18:32 UTC+8</div>
        </div>

        <div className="v-row v-gap-3" style={{justifyContent: "center"}}>
          <Button variant="secondary" icon={<Icon.ArrowLeft size={15} />}>回首頁</Button>
          <Button variant="primary">寫信給邀請者</Button>
        </div>
      </Card>
    </CenteredCardShell>
  );
}

Object.assign(window, { HomeFrame, AboutFrame, LoginFrame, VerifyFrame, InviteErrorFrame });
