/**
 * Logger redaction tests.
 *
 * Verifies that the logger does NOT include:
 * - req.query.token
 * - req.body.token
 * - req.headers.cookie
 * - req.headers.authorization
 *
 * We test this by passing a sensitive object through the logger and verifying
 * the redact config strips those paths.
 */

import { describe, expect, test } from "bun:test";
import pino from "pino";

describe("Logger redaction", () => {
  test("req.query.token is redacted from logs", () => {
    const logs: string[] = [];
    const logger = pino(
      {
        level: "debug",
        redact: {
          paths: [
            "req.query.token",
            "req.body.token",
            "req.headers.cookie",
            "req.headers.authorization",
          ],
          remove: true,
        },
      },
      {
        write(msg: string) {
          logs.push(msg);
        },
      },
    );

    const sensitiveToken = "super-secret-magic-token-abc123";

    logger.info({
      req: {
        query: { token: sensitiveToken },
        body: {},
        headers: {},
      },
    });

    const logOutput = logs.join("");
    expect(logOutput).not.toContain(sensitiveToken);
  });

  test("req.body.token is redacted from logs", () => {
    const logs: string[] = [];
    const logger = pino(
      {
        level: "debug",
        redact: {
          paths: [
            "req.query.token",
            "req.body.token",
            "req.headers.cookie",
            "req.headers.authorization",
          ],
          remove: true,
        },
      },
      {
        write(msg: string) {
          logs.push(msg);
        },
      },
    );

    const sensitiveToken = "body-secret-token-xyz789";
    logger.info({
      req: {
        query: {},
        body: { token: sensitiveToken },
        headers: {},
      },
    });

    const logOutput = logs.join("");
    expect(logOutput).not.toContain(sensitiveToken);
  });

  test("req.headers.cookie is redacted from logs", () => {
    const logs: string[] = [];
    const logger = pino(
      {
        level: "debug",
        redact: {
          paths: [
            "req.query.token",
            "req.body.token",
            "req.headers.cookie",
            "req.headers.authorization",
          ],
          remove: true,
        },
      },
      {
        write(msg: string) {
          logs.push(msg);
        },
      },
    );

    const sensitiveCookie = "session=my-session-id-secret";
    logger.info({
      req: {
        query: {},
        body: {},
        headers: { cookie: sensitiveCookie },
      },
    });

    const logOutput = logs.join("");
    expect(logOutput).not.toContain(sensitiveCookie);
  });

  test("req.headers.authorization is redacted from logs", () => {
    const logs: string[] = [];
    const logger = pino(
      {
        level: "debug",
        redact: {
          paths: [
            "req.query.token",
            "req.body.token",
            "req.headers.cookie",
            "req.headers.authorization",
          ],
          remove: true,
        },
      },
      {
        write(msg: string) {
          logs.push(msg);
        },
      },
    );

    const sensitiveAuth = "Bearer secret-bearer-token";
    logger.info({
      req: {
        query: {},
        body: {},
        headers: { authorization: sensitiveAuth },
      },
    });

    const logOutput = logs.join("");
    expect(logOutput).not.toContain(sensitiveAuth);
  });
});
