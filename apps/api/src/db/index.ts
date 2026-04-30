import { drizzle } from "drizzle-orm/bun-sql";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

/**
 * Lazy-initialised Drizzle client over Bun's native Postgres driver.
 *
 * Throws if DATABASE_URL is missing — DB-touching code paths are expected
 * to surface this loudly rather than silently fall back.
 */
export function getDb(): Database {
  if (!cached) {
    const url = Bun.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Set it in apps/api/.env (see .env.example).");
    }
    cached = drizzle(url, { schema });
  }
  return cached;
}

export { schema };
export type { Database };
