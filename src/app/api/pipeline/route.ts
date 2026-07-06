import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, pipeline } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      ein: pipeline.ein,
      stage: pipeline.stage,
      ownerNote: pipeline.ownerNote,
      nextAction: pipeline.nextAction,
      nextActionDate: pipeline.nextActionDate,
      lastTouchDate: pipeline.lastTouchDate,
      updatedAt: pipeline.updatedAt,
      name: organizations.name,
      latestAssets: organizations.latestAssets,
    })
    .from(pipeline)
    .innerJoin(organizations, eq(pipeline.ein, organizations.ein));

  return NextResponse.json({ pipeline: rows });
}
