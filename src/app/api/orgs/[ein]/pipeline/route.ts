import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pipeline, signals } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const STAGE_ORDER = [
  "identified",
  "researched",
  "outreach",
  "meeting",
  "proposal",
  "won",
  "lost",
  "parked",
] as const;

/** Index used only to detect "moving past Researched" — won/lost/parked are terminal side-exits, not further along this ladder. */
const LADDER_INDEX: Record<string, number> = {
  identified: 0,
  researched: 1,
  outreach: 2,
  meeting: 3,
  proposal: 4,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const row = await db.query.pipeline.findFirst({ where: eq(pipeline.ein, ein) });
  return NextResponse.json({ pipeline: row ?? null });
}

/**
 * Upserts pipeline state. Moving from Researched to Outreach/Meeting/Proposal
 * requires a next action + date (Section 9 F10) — either already on file or
 * included in this request. An optional `debriefNote` can be converted into a
 * NEWS_MENTION signal in the same call, closing the "meetings generate intel"
 * loop (F10).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const body = await req.json().catch(() => null);
  const existing = await db.query.pipeline.findFirst({ where: eq(pipeline.ein, ein) });

  const nextStage = body?.stage ?? existing?.stage ?? "identified";
  const nextAction = body?.nextAction ?? existing?.nextAction ?? null;
  const nextActionDate = body?.nextActionDate ?? existing?.nextActionDate ?? null;

  const movingPastResearched =
    LADDER_INDEX[nextStage] != null && LADDER_INDEX[nextStage] > LADDER_INDEX.researched;
  if (movingPastResearched && (!nextAction || !nextActionDate)) {
    return NextResponse.json(
      { error: "A next action and date are required to move past Researched." },
      { status: 400 }
    );
  }

  const lastTouchDate = new Date().toISOString().slice(0, 10);
  const values = {
    ein,
    stage: nextStage,
    ownerNote: body?.ownerNote ?? existing?.ownerNote ?? null,
    nextAction,
    nextActionDate,
    lastTouchDate,
    updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  };

  await db
    .insert(pipeline)
    .values(values)
    .onConflictDoUpdate({ target: pipeline.ein, set: values });

  if (body?.debriefNote?.trim()) {
    await db.insert(signals).values({
      ein,
      type: "NEWS_MENTION",
      headline: `Debrief: ${body.debriefNote.trim().slice(0, 80)}`,
      detail: body.debriefNote.trim(),
      eventDate: new Date().toISOString().slice(0, 10),
      basePoints: 30,
      halfLifeDays: 120,
      isPersistent: false,
      isVerbalNote: true,
      active: true,
    });
  }

  return NextResponse.json({
    ein,
    stage: nextStage,
    ownerNote: values.ownerNote,
    nextAction,
    nextActionDate,
    lastTouchDate,
  });
}

export { STAGE_ORDER };
