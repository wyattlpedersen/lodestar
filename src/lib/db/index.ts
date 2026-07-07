import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "lodestar.db");

/**
 * Local dev (and Demo Mode) use a plain SQLite file via libSQL's local-file
 * engine — no native binary, no build step. Set TURSO_DATABASE_URL (+
 * TURSO_AUTH_TOKEN) in production to point at a hosted libSQL/Turso database
 * instead; same client, same schema, same queries either way.
 */
const isRemote = !!process.env.TURSO_DATABASE_URL;
if (!isRemote) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

declare global {
  var __lodestarClient: Client | undefined;
}

const client =
  global.__lodestarClient ??
  createClient({
    url: process.env.TURSO_DATABASE_URL ?? `file:${DB_PATH}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (!isRemote) {
  // WAL mode is a local-file concept only; Turso manages its own storage engine remotely.
  client.execute("PRAGMA journal_mode = WAL").catch(() => {});
}
client.execute("PRAGMA foreign_keys = ON").catch(() => {});

if (process.env.NODE_ENV !== "production") {
  global.__lodestarClient = client;
}

export const db = drizzle(client, { schema });
export { client };
