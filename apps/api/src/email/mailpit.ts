/**
 * MailpitEmailService — SMTP email service using nodemailer.
 *
 * Connects to a local Mailpit SMTP server (or any SMTP server in Phase 2).
 * Implements the `EmailService` interface from packages/shared.
 *
 * Design.md Decision 3: EmailService abstraction allows swapping Mailpit for
 * Resend in Phase 2 by creating a new implementation without touching
 * better-auth config.
 */

import nodemailer from "nodemailer";
import type { EmailService, SendEmailOptions } from "@vellum/shared/email/types";

export interface MailpitEnv {
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_FROM: string;
}

export class MailpitEmailService implements EmailService {
  readonly #transport: ReturnType<typeof nodemailer.createTransport>;
  readonly #from: string;

  constructor(env: MailpitEnv) {
    this.#from = env.SMTP_FROM;
    this.#transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: false,
      // Mailpit accepts any auth in dev mode
      auth: undefined,
    });
  }

  async send(opts: SendEmailOptions): Promise<void> {
    await this.#transport.sendMail({
      from: this.#from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  }
}

/**
 * Factory function — creates a MailpitEmailService from env variables.
 */
export function createMailpitEmailService(
  env: MailpitEnv,
): MailpitEmailService {
  return new MailpitEmailService(env);
}
