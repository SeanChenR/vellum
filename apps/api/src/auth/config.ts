/**
 * better-auth instance configuration.
 *
 * Design.md Decision 1: Use better-auth with Drizzle adapter — no custom
 * OAuth state machine.
 * Design.md Decision 4: Session cookie attributes: HttpOnly / Secure /
 * SameSite=Lax / Path=/.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { getDb } from "../db/index";
import { users, sessions, accounts, verifications } from "../db/schema";
import { renderMagicLinkEmail } from "../email/templates/magic-link";
import { logger } from "../lib/logger";
import type { EmailService } from "@vellum/shared/email/types";

export function createAuth(emailService: EmailService) {
  const db = getDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { users, sessions, accounts, verifications },
      usePlural: true,
    }),

    secret: Bun.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
    baseURL: Bun.env.BETTER_AUTH_URL ?? "http://localhost:3000",

    socialProviders: {
      google: {
        clientId: Bun.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: Bun.env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },

    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url, token: _token }, _request) => {
          // _token is already in the URL; don't log it separately
          logger.info({ email, action: "magic-link-send" }, "sending magic link");

          let locale: "zh-TW" | "en" = "zh-TW";
          try {
            const userRow = await db.query.users.findFirst({
              where: (u, { eq }) => eq(u.email, email),
              columns: { locale: true },
            });
            if (userRow?.locale === "en") locale = "en";
          } catch {
            // fallback to zh-TW
          }

          const { html, text } = await renderMagicLinkEmail({ url, locale });

          await emailService.send({
            to: email,
            subject: locale === "en" ? "Your Vellum sign-in link" : "您的 Vellum 登入連結",
            html,
            text,
          });
        },
      }),
    ],

    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      },
    },

    // Session cookie security attributes
    advanced: {
      cookiePrefix: "vellum",
      useSecureCookies: Bun.env.NODE_ENV === "production",
      cookies: {
        session_token: {
          name: "vellum.session_token",
          attributes: {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: Bun.env.NODE_ENV === "production",
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
