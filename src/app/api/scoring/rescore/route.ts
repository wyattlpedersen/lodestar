import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, scores } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildScoringInputsForUniverse } from "@/lib/scoring/context";
import { computeScore } from "@/lib/scoring/engine";

/**
 * Persists a fresh score row per org (append-only, powers sparklines & the
 * Monday Report movers list) and syncs `organizations.channel_flag`. Triggered
 * by the "Rescore all" command-palette action, or automatically when the app
 * detects the latest score is >24h stale (Section 7).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const weightProfile = body?.weightProfile as
    | { name: string; weights: import("@/lib/scoring/types").WeightProfile }
    | undefined;

  const inputs = await buildScoringInputsForUniverse();
  if (!weightProfile) {
    return NextResponse.json({ error: "Body must include `weightProfile`." }, { status: 400 });
  }

  const now = new Date();
  const results = inputs.map((input) =>
    computeScore(input, weightProfile.weights, now, weightProfile.name)
  );

  for (const result of results) {
    await db.insert(scores).values({
      ein: result.ein,
      pillarBreakdown: result.pillars as unknown as object,
      total: result.total,
      tier: result.tier,
      confidence: result.confidence,
      confidenceGrade: result.confidenceGrade,
      weightProfile: result.weightProfileName,
    });
    await db
      .update(organizations)
      .set({ channelFlag: result.channelFlag })
      .where(eq(organizations.ein, result.ein));
  }

  return NextResponse.json({ scored: results.length, computedAt: now.toISOString() });
}
