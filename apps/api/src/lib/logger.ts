import pino from "pino";

const isDev = Bun.env.NODE_ENV !== "production";

export const logger = pino({
  level: Bun.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  formatters: {
    level: (label) => ({ level: label }),
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
