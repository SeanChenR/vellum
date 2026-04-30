import { defineConfig } from "drizzle-kit";

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Set it in apps/api/.env (see .env.example).");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
});
