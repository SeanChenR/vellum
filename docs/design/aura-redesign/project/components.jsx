/* eslint-disable */
// Shared NavBar / Footer / page-shell used across every Vellum frame.

const { useState } = React;

function ThemeShell({ theme = "dark", children, mobile = false }) {
  return (
    <div className={"v-frame" + (mobile ? " mobile" : "")} data-theme={theme}>
      {children}
    </div>
  );
}

function NavBar({ active = "home", theme = "dark", signedIn = true, mobile = false }) {
  if (mobile) {
    return (
      <header className="v-nav">
        <div className="v-nav-inner" style={{gridTemplateColumns: "auto 1fr auto", padding: "0 20px"}}>
          <div className="v-brand">
            <div className="v-brand-mark">V</div>
            <span>Vellum</span>
          </div>
          <span />
          <button className="v-iconbtn" aria-label="開啟選單">
            <Icon.Menu size={18} />
          </button>
        </div>
      </header>
    );
  }
  return (
    <header className="v-nav">
      <div className="v-nav-inner">
        <div className="v-brand">
          <div className="v-brand-mark">V</div>
          <span>Vellum</span>
        </div>
        <nav className="v-nav-links">
          <a className={"v-nav-link" + (active === "home" ? " active" : "")}>首頁</a>
          <a className={"v-nav-link" + (active === "about" ? " active" : "")}>關於</a>
        </nav>
        <div className="v-nav-right">
          <button className="v-iconbtn" title="語言">
            <Icon.Languages size={15} />
            <span className="v-locale">{theme === "dark" ? "中" : "中"}</span>
          </button>
          <button className="v-iconbtn" title="主題" style={{padding: "0 9px"}}>
            {theme === "dark"
              ? <Icon.Moon size={15} />
              : <Icon.Sun size={15} />}
          </button>
          {signedIn ? (
            <button className="v-iconbtn" style={{padding: "0 4px 0 10px"}}>
              <span style={{fontSize: 12}}>陳沛緹</span>
              <div style={{
                width: 26, height: 26, borderRadius: 999,
                background: "linear-gradient(135deg, var(--accent-purple), var(--accent-pink))",
                color: "#fff", display: "grid", placeItems: "center",
                fontSize: 11, fontWeight: 700, marginLeft: 4
              }}>沛</div>
            </button>
          ) : (
            <button className="v-btn v-btn-primary v-btn-sm">登入</button>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="v-footer">
      <div className="v-footer-inner">
        <span className="v-muted">© 2026 Vellum · 一張畫布，凝鍊你的思考</span>
        <div className="v-row v-gap-4">
          <a className="v-muted" style={{fontSize: 13}}>隱私權</a>
          <a className="v-muted" style={{fontSize: 13}}>服務條款</a>
          <a className="v-muted" style={{fontSize: 13}}>狀態</a>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Re-usable component atoms (used in frames + spec sheet)
   ============================================================ */

function Card({ variant = "default", className = "", children, style }) {
  const cls =
    variant === "elevated" ? "v-card elevated"
    : variant === "outlined" ? "v-card outlined"
    : "v-card";
  return <div className={cls + " " + className} style={style}>{children}</div>;
}

function Button({ variant = "primary", size = "md", icon, iconRight, children, ...rest }) {
  const cls = ["v-btn"];
  cls.push("v-btn-" + variant);
  if (size === "sm") cls.push("v-btn-sm");
  if (size === "lg") cls.push("v-btn-lg");
  return (
    <button className={cls.join(" ")} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

function Input({ label, hint, icon, error, value, placeholder, type = "text", suffix }) {
  return (
    <div>
      {label && <label className="v-label">{label}</label>}
      <div style={{position: "relative"}}>
        {icon && (
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)", display: "flex"
          }}>{icon}</span>
        )}
        <input
          className="v-input"
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          style={icon ? { paddingLeft: 38 } : null}
        />
        {suffix && (
          <span style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)"
          }}>{suffix}</span>
        )}
      </div>
      {hint && !error && <div style={{marginTop: 6, fontSize: 12}} className="v-muted">{hint}</div>}
      {error && <div style={{marginTop: 6, fontSize: 12}} className="v-accent-red">{error}</div>}
    </div>
  );
}

function Badge({ tone = "muted", children, dot }) {
  return (
    <span className={"v-badge v-badge-" + tone}>
      {dot && <span style={{
        width: 6, height: 6, borderRadius: 999,
        background: "currentColor", display: "inline-block"
      }} />}
      {children}
    </span>
  );
}

function Placeholder({ label, height = 140, style }) {
  return (
    <div className="v-placeholder" style={{ height, ...style }}>
      {label}
    </div>
  );
}

Object.assign(window, { ThemeShell, NavBar, Footer, Card, Button, Input, Badge, Placeholder });
