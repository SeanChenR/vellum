/**
 * Magic Link email template — React Email component.
 *
 * Renders a bilingual (zh-TW / en) magic-link email with html and text output.
 * Use `renderMagicLinkEmail({ url, locale })` to get `{ html, text }`.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/components";
import * as React from "react";

interface MagicLinkEmailProps {
  url: string;
  locale?: "zh-TW" | "en";
}

const copy = {
  "zh-TW": {
    preview: "您的 Vellum 登入連結",
    greeting: "您好！",
    body: "點擊下方按鈕以登入 Vellum。此連結在 15 分鐘後過期，且僅限一次使用。",
    cta: "登入 Vellum",
    fallback: "若按鈕無法點擊，請複製以下連結至瀏覽器：",
    expiry: "此連結 15 分鐘後失效。",
  },
  en: {
    preview: "Your Vellum sign-in link",
    greeting: "Hi there!",
    body: "Click the button below to sign in to Vellum. This link expires in 15 minutes and can only be used once.",
    cta: "Sign in to Vellum",
    fallback: "If the button doesn't work, copy and paste this URL into your browser:",
    expiry: "This link expires in 15 minutes.",
  },
} as const;

export function MagicLinkEmail({ url, locale = "zh-TW" }: MagicLinkEmailProps) {
  const t = copy[locale];

  return (
    <Html lang={locale === "zh-TW" ? "zh-TW" : "en"}>
      <Head />
      <Preview>{String(t.preview)}</Preview>
      <Body
        style={{
          backgroundColor: "#f9f9f7",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          margin: "0",
          padding: "40px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            maxWidth: "480px",
            margin: "0 auto",
            padding: "40px",
          }}
        >
          <Text style={{ fontSize: "24px", fontWeight: "600", color: "#1a1a2e" }}>Vellum</Text>

          <Text style={{ fontSize: "16px", color: "#4a4a6a" }}>{t.greeting}</Text>

          <Text style={{ fontSize: "16px", color: "#4a4a6a", lineHeight: "1.6" }}>{t.body}</Text>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={url}
              style={{
                backgroundColor: "#1a1a2e",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: "600",
                padding: "12px 32px",
                textDecoration: "none",
              }}
            >
              {t.cta}
            </Button>
          </Section>

          <Text style={{ fontSize: "13px", color: "#9a9ab0" }}>{t.fallback}</Text>

          <Link href={url} style={{ color: "#6b6bf7", fontSize: "13px", wordBreak: "break-all" }}>
            {url}
          </Link>

          <Text style={{ fontSize: "12px", color: "#c0c0d8", marginTop: "24px" }}>{t.expiry}</Text>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Render the magic-link email to `{ html, text }`.
 */
export async function renderMagicLinkEmail(opts: {
  url: string;
  locale?: "zh-TW" | "en";
}): Promise<{ html: string; text: string }> {
  const element = React.createElement(MagicLinkEmail, opts);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}
