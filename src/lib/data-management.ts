import { db } from "@/lib/db";
import {
  affiliations,
  filings,
  manualFacts,
  organizations,
  people,
  pipeline,
  rawApiCache,
  scores,
  settings,
  signals,
} from "@/lib/db/schema";
import { sql } from "drizzle-orm";

const TABLES = {
  organizations,
  filings,
  manualFacts,
  people,
  affiliations,
  signals,
  scores,
  pipeline,
  settings,
} as const;

/** Exports every app table as plain JSON. `raw_api_cache` is excluded by default — pure API cache, reconstructable via refresh, and often large. */
export async function exportDatabase(
  { includeRawCache = false }: { includeRawCache?: boolean } = {}
): Promise<Record<string, unknown[]>> {
  const dump: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(TABLES)) {
    dump[name] = await db.select().from(table);
  }
  if (includeRawCache) {
    dump.rawApiCache = await db.select().from(rawApiCache);
  }
  return dump;
}

/** Wipes and restores every table from a prior `exportDatabase` dump (children first, respecting FKs). */
export async function importDatabase(dump: Record<string, unknown[]>): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    const deleteOrder = [
      scores,
      affiliations,
      manualFacts,
      signals,
      pipeline,
      filings,
      people,
      organizations,
      settings,
      rawApiCache,
    ];
    for (const table of deleteOrder) {
      await db.delete(table);
    }

    const insertOrder: [string, ReturnType<typeof db.insert>][] = [
      ["organizations", db.insert(organizations)],
      ["people", db.insert(people)],
      ["filings", db.insert(filings)],
      ["manualFacts", db.insert(manualFacts)],
      ["affiliations", db.insert(affiliations)],
      ["signals", db.insert(signals)],
      ["scores", db.insert(scores)],
      ["pipeline", db.insert(pipeline)],
      ["settings", db.insert(settings)],
      ["rawApiCache", db.insert(rawApiCache)],
    ];
    for (const [name, insertBuilder] of insertOrder) {
      const rows = dump[name];
      if (!rows || rows.length === 0) continue;
      await insertBuilder.values(rows as never);
    }
  } finally {
    await db.run(sql`PRAGMA foreign_keys = ON`);
  }
}
