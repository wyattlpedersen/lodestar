import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, filings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { hydrateOrganization } from "@/lib/propublica/ingest";
import { computeDerivedFinancials } from "@/lib/derived-financials";

export async function GET() {
  const orgs = await db.select().from(organizations).orderBy(organizations.name);

  const withDerived = await Promise.all(
    orgs.map(async (org) => {
      const orgFilings = await db
        .select()
        .from(filings)
        .where(eq(filings.ein, org.ein))
        .orderBy(desc(filings.taxYear));
      return {
        ...org,
        derived: computeDerivedFinancials(orgFilings),
        filingCount: orgFilings.length,
      };
    })
  );

  return NextResponse.json({ organizations: withDerived });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ein = body?.ein ? String(body.ein).trim() : null;
  if (!ein || !/^\d{9}$/.test(ein)) {
    return NextResponse.json(
      { error: "Body must include a 9-digit `ein`." },
      { status: 400 }
    );
  }

  try {
    const result = await hydrateOrganization(ein);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to hydrate org" },
      { status: 502 }
    );
  }
}
