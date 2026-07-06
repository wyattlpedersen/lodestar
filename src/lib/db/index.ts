import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "lodestar.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

declare global {
  var __lodestarSqlite: Database.Database | undefined;
}

const sqlite = global.__lodestarSqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  global.__lodestarSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
