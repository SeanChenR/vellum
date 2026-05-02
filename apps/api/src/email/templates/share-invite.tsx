/**
 * Share-invite email template — React Email component.
 *
 * Sent when an owner invites an email that does not yet match a registered
 * user. The recipient clicks the accept button → magic-link login → server
 * inserts canvas_shares row → canvas opens.
 *
 * Spec: sharing — "Owner invites an unknown email creates a pending invite
 * and sends mail"
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
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export interface ShareInviteEmailArgs {
  inviterName: string;
  canvasTitle: string;
  acceptUrl: string;
  expiresAt: Date;
  locale?: "zh-TW" | "en";
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const copy = {
  "zh-TW": {
    subjectFmt: (inviter: string, title: string) =>
      `${inviter} 邀請您共同編輯畫布「${title}」`,
    preview: "Vellum canvas 邀請",
    greeting: "您好，",
    body: (inviter: string, title: string) =>
      `${inviter} 邀請您一起編輯畫布「${title}」。點下方按鈕即可開始協作。`,
    cta: "開啟畫布",
    fallback: "若按鈕無法點擊，請複製以下連結至瀏覽器：",
    expiry: "此邀請將於 7 天內失效。",
  },
  en: {
    subjectFmt: (inviter: string, title: string) =>
      `${inviter} invited you to "${title}" on Vellum`,
    preview: "Vellum canvas invitation",
    greeting: "Hi,",
    body: (inviter: string, title: string) =>
      `${inviter} invited you to collaborate on the canvas "${title}". Click the button below to accept and start editing.`,
    cta: "Open canvas",
    fallback: "If the button doesn't work, copy and paste this URL into your browser:",
    expiry: "This invite expires in 7 days.",
  },
} as const;

function ShareInviteEmail({
  inviterName,
  canvasTitle,
  acceptUrl,
  locale = "en",
}: ShareInviteEmailArgs) {
  const t = copy[locale];
  return (
    <Html lang={locale === "zh-TW" ? "zh-TW" : "en"}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body
        style={{
          backgroundColor: "#fff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 24px" }}>
          <Section>
            <Text style={{ fontSize: "16px", color: "#0f172a" }}>{t.greeting}</Text>
            <Text style={{ fontSize: "16px", color: "#0f172a" }}>
              {t.body(inviterName, canvasTitle)}
            </Text>
            <Button
              href={acceptUrl}
              style={{
                backgroundColor: "#0f172a",
                color: "#fff",
                padding: "12px 24px",
                borderRadius: "8px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {t.cta}
            </Button>
            <Text style={{ fontSize: "14px", color: "#64748b", marginTop: "24px" }}>
              {t.fallback}
            </Text>
            <Link href={acceptUrl} style={{ fontSize: "14px", color: "#2563eb", wordBreak: "break-all" }}>
              {acceptUrl}
            </Link>
            <Text style={{ fontSize: "13px", color: "#94a3b8", marginTop: "24px" }}>
              {t.expiry}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Render the email to `{ subject, html, text }`. Subject is built from
 * locale-specific format string and respects HTML escaping in user fields
 * via React's default text-node behaviour.
 */
export async function renderShareInviteEmail(
  args: ShareInviteEmailArgs,
): Promise<RenderedEmail> {
  const t = copy[args.locale ?? "en"];
  const subject = t.subjectFmt(args.inviterName, args.canvasTitle);
  const element = <ShareInviteEmail {...args} />;
  const html = renderToStaticMarkup(element);
  // Plain-text variant: stripped HTML body containing the canvas title +
  // accept URL + expiry note. Built deliberately rather than HTML-stripping
  // so spam filters see clean intent.
  const text = [
    t.greeting,
    "",
    t.body(args.inviterName, args.canvasTitle),
    "",
    args.acceptUrl,
    "",
    t.expiry,
  ].join("\n");
  return { subject, html, text };
}

export default ShareInviteEmail;
