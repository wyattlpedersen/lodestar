import { defineConfig } from "drizzle-kit";

const DB_PATH = "./data/lodestar.db";

/**
 * "turso" dialect works against both a local file (default, for dev) and a
 * remote hosted libSQL/Turso database when TURSO_DATABASE_URL is set (prod) —
 * same push command either way.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? `file:${DB_PATH}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
