import { beforeEach, describe, expect, mock, test } from "bun:test";

// ---------------------------------------------------------------------------
// Mock nodemailer before importing the module under test
// ---------------------------------------------------------------------------

const mockSendMail = mock(async (_opts: unknown) => {
  return { messageId: "test-id" };
});

const mockCreateTransport = mock((_config: unknown) => ({
  sendMail: mockSendMail,
}));

mock.module("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

// Must import AFTER mock.module
const { createMailpitEmailService } = await import("./mailpit");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MailpitEmailService", () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    mockCreateTransport.mockClear();
  });

  test("send() passes correct options to transport.sendMail", async () => {
    const svc = createMailpitEmailService({
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      SMTP_FROM: "noreply@vellum.local",
    });

    const opts = {
      to: "user@example.com",
      subject: "Your magic link",
      html: "<p>Click here</p>",
      text: "Click here",
    };

    await svc.send(opts);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const callArg = mockSendMail.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg?.["to"]).toBe(opts.to);
    expect(callArg?.["subject"]).toBe(opts.subject);
    expect(callArg?.["html"]).toBe(opts.html);
    expect(callArg?.["text"]).toBe(opts.text);
    expect(callArg?.["from"]).toBe("noreply@vellum.local");
  });

  test("send() throws when transport.sendMail rejects", async () => {
    mockSendMail.mockImplementation(async () => {
      throw new Error("SMTP connection refused");
    });

    const svc = createMailpitEmailService({
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      SMTP_FROM: "noreply@vellum.local",
    });

    await expect(
      svc.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      }),
    ).rejects.toThrow("SMTP connection refused");
  });
});
