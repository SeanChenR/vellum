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

    // CSRF / origin allowlist. The dev proxy fronts the API on :3002 so the
    // browser's Origin header during /api/auth/sign-out (and other state-
    // mutating routes) is the proxy host. baseURL is added implicitly by
    // better-auth — listing the dev hosts unblocks Playwright runs and any
    // user hitting :3002 directly. Production should set BETTER_AUTH_URL
    // to the canonical host.
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      ...(Bun.env.BETTER_AUTH_URL ? [Bun.env.BETTER_AUTH_URL] : []),
    ],

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
      // Cookie cache lets better-auth verify a session purely from a signed
      // cookie without hitting the DB. We DISABLE it: revoke / sign-out
      // from another device must take effect immediately, which means
      // every protected request must consult the DB. Cost is one indexed
      // SELECT per request — acceptable for phase 1, the right correctness
      // tradeoff. Re-evaluate if profiling shows session lookup as a hot
      // path; the fix would be a short-TTL cache + cache-bust on revoke.
      cookieCache: {
        enabled: false,
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
