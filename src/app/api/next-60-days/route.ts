import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { next60DaysEvents } from "@/lib/fiscal-calendar";

export async function GET() {
  const orgs = await db.select().from(organizations);
  const events = next60DaysEvents(
    orgs.map((o) => ({ ein: o.ein, name: o.name, fyeMonth: o.fyeMonth, latestFilingYear: o.latestFilingYear })),
    new Date()
  );
  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      windowStart: e.windowStart.toISOString().slice(0, 10),
      windowEnd: e.windowEnd.toISOString().slice(0, 10),
    })),
  });
}
