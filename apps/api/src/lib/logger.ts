import pino from "pino";

const isDev = Bun.env.NODE_ENV !== "production";

export const logger = pino({
  level: Bun.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  formatters: {
    level: (label) => ({ level: label }),
  },
  /**
   * Redact sensitive fields from all log lines.
   *
   * Per design.md Risk section: magic-link tokens must never appear in logs —
   * an exposed token is equivalent to an exposed password.
   */
  redact: {
    paths: [
      "req.query.token",
      "req.body.token",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    remove: true,
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
