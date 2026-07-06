import { NextResponse } from "next/server";
import { buildScoringInputsForUniverse } from "@/lib/scoring/context";
import { db } from "@/lib/db";
import { scores, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_WEIGHT_PROFILE } from "@/lib/scoring/weights";
import type { WeightProfile } from "@/lib/scoring/types";

export async function GET() {
  const [inputs, weightRow, allScores] = await Promise.all([
    buildScoringInputsForUniverse(),
    db.query.settings.findFirst({ where: eq(settings.key, "active_weight_profile") }),
    db.select().from(scores),
  ]);

  const weightProfile =
    (weightRow?.value as { name: string; weights: WeightProfile } | undefined) ?? {
      name: "Balanced",
      weights: DEFAULT_WEIGHT_PROFILE,
    };

  const history: Record<string, { computedAt: string; total: number }[]> = {};
  for (const row of allScores) {
    (history[row.ein] ??= []).push({ computedAt: row.computedAt, total: row.total });
  }
  for (const ein of Object.keys(history)) {
    history[ein].sort((a, b) => a.computedAt.localeCompare(b.computedAt));
    history[ein] = history[ein].slice(-10);
  }

  return NextResponse.json({ inputs, weightProfile, history, computedAt: new Date().toISOString() });
}
