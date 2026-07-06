import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { hydrateOrganization } from "@/lib/propublica/ingest";

/** Refreshes every org in the universe, force-refetching from ProPublica. Throttled to ~1/sec by the client's request queue. */
export async function POST() {
  const orgs = await db.select({ ein: organizations.ein }).from(organizations);
  let refreshed = 0;
  const failures: string[] = [];
  for (const org of orgs) {
    try {
      await hydrateOrganization(org.ein, { force: true });
      refreshed += 1;
    } catch {
      failures.push(org.ein);
    }
  }
  return NextResponse.json({ refreshed, total: orgs.length, failures });
}
