import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualFacts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const ALLOWED_KEYS = new Set([
  "mgmt_fees_usd",
  "has_paid_cio",
  "pct_cash_public",
  "single_manager",
  "board_meeting_cadence",
  "known_consultant",
  "founder_living",
]);

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const body = await req.json().catch(() => null);
  const key = body?.key;
  const value = body?.value;
  const note = body?.note ?? null;

  if (!ALLOWED_KEYS.has(key) || value == null) {
    return NextResponse.json({ error: "Invalid `key` or missing `value`." }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(manualFacts)
    .where(and(eq(manualFacts.ein, ein), eq(manualFacts.key, key)));

  if (existing.length > 0) {
    await db
      .update(manualFacts)
      .set({ value: String(value), note })
      .where(and(eq(manualFacts.ein, ein), eq(manualFacts.key, key)));
  } else {
    await db.insert(manualFacts).values({ ein, key, value: String(value), note });
  }

  return NextResponse.json({ ein, key, value: String(value) });
}
