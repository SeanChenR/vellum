/**
 * EmailService — thin interface for sending transactional emails.
 *
 * Concrete implementations:
 *   - Phase 1: `MailpitEmailService` (apps/api/src/email/mailpit.ts)
 *   - Phase 2: `ResendEmailService` (apps/api/src/email/resend.ts)
 *
 * The better-auth magicLink plugin receives this interface so swapping
 * the provider never requires touching the auth config.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  send(options: SendEmailOptions): Promise<void>;
}
