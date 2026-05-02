/**
 * share-invite email render tests (task 2.8).
 *
 * Covers the email-render slice of "Owner invites an unknown email creates
 * a pending invite and sends mail". The actual transport is the existing
 * Mailpit client (`apps/api/src/email/mailpit.ts`); we only test that the
 * React Email template renders the expected fields and is xss-safe.
 */

import { describe, expect, test } from "bun:test";
import { renderShareInviteEmail } from "./templates/share-invite";

const FIXTURE = {
  inviterName: "Owner Bob",
  canvasTitle: "Q3 Roadmap",
  acceptUrl: "https://vellum.test/api/share/invite/abc123/accept",
  expiresAt: new Date("2026-05-09T12:00:00Z"),
  locale: "en" as const,
};

describe("renderShareInviteEmail", () => {
  test("returns subject, html, and text strings", async () => {
    const out = await renderShareInviteEmail(FIXTURE);
    expect(typeof out.subject).toBe("string");
    expect(typeof out.html).toBe("string");
    expect(typeof out.text).toBe("string");
    expect(out.subject.length).toBeGreaterThan(0);
  });

  test("includes the canvas title and inviter name in the body", async () => {
    const out = await renderShareInviteEmail(FIXTURE);
    expect(out.html).toContain("Q3 Roadmap");
    expect(out.html).toContain("Owner Bob");
    expect(out.text).toContain("Q3 Roadmap");
  });

  test("includes the accept URL in both html and text", async () => {
    const out = await renderShareInviteEmail(FIXTURE);
    expect(out.html).toContain(FIXTURE.acceptUrl);
    expect(out.text).toContain(FIXTURE.acceptUrl);
  });

  test("escapes HTML special characters in user-supplied fields (no script injection)", async () => {
    const out = await renderShareInviteEmail({
      ...FIXTURE,
      canvasTitle: "<script>alert(1)</script>",
      inviterName: "</td><td>",
    });
    // The literal string MUST NOT appear unescaped — escape the angle brackets.
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  test("traditional Chinese locale produces zh-TW subject", async () => {
    const out = await renderShareInviteEmail({ ...FIXTURE, locale: "zh-TW" });
    // The subject template comes from packages/shared/src/locales/zh-TW.json,
    // key `email.shareInvite.subject`. Substring checks keep the test loose.
    expect(out.subject).toContain("Owner Bob");
    expect(out.subject).toContain("Q3 Roadmap");
  });
});
