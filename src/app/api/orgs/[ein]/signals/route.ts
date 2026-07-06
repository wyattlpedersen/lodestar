import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { SIGNAL_TAXONOMY_BY_CODE } from "@/lib/signals/taxonomy";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const rows = await db
    .select()
    .from(signals)
    .where(eq(signals.ein, ein))
    .orderBy(desc(signals.eventDate));
  return NextResponse.json({ signals: rows });
}

/** Quick-add (Section 8): org, type, date, headline, source URL — under 30 seconds. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const body = await req.json().catch(() => null);

  const taxonomyEntry = SIGNAL_TAXONOMY_BY_CODE[body?.type];
  if (!taxonomyEntry) {
    return NextResponse.json({ error: "Unknown signal `type`." }, { status: 400 });
  }
  if (!body?.headline?.trim() || !body?.eventDate) {
    return NextResponse.json({ error: "`headline` and `eventDate` are required." }, { status: 400 });
  }

  const sourceUrl = body?.sourceUrl?.trim() || null;
  const isVerbalNote = !!body?.isVerbalNote;
  if (!sourceUrl && !isVerbalNote) {
    return NextResponse.json(
      { error: "Provide a source URL, or check 'verbal/internal note'." },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(signals)
    .values({
      ein,
      type: taxonomyEntry.code,
      headline: body.headline.trim(),
      detail: body?.detail ?? null,
      eventDate: body.eventDate,
      basePoints: taxonomyEntry.basePoints,
      halfLifeDays: taxonomyEntry.halfLifeDays,
      isPersistent: taxonomyEntry.isPersistent,
      sourceUrl,
      isVerbalNote,
      tag: body?.tag ?? null,
      active: true,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
