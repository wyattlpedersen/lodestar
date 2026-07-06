import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, filings, manualFacts } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computeDerivedFinancials } from "@/lib/derived-financials";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.ein, ein),
  });
  if (!org) {
    return NextResponse.json({ error: "Org not found in universe" }, { status: 404 });
  }

  const orgFilings = await db
    .select()
    .from(filings)
    .where(eq(filings.ein, ein))
    .orderBy(desc(filings.taxYear));

  const facts = await db
    .select()
    .from(manualFacts)
    .where(eq(manualFacts.ein, ein));

  return NextResponse.json({
    organization: org,
    filings: orgFilings,
    manualFacts: facts,
    derived: computeDerivedFinancials(orgFilings),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.verified !== "boolean") {
    return NextResponse.json({ error: "Body must include boolean `verified`." }, { status: 400 });
  }
  await db.update(organizations).set({ verified: body.verified }).where(eq(organizations.ein, ein));
  return NextResponse.json({ ein, verified: body.verified });
}
