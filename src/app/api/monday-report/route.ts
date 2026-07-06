import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, pipeline, scores, settings, signals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildScoringInputsForUniverse } from "@/lib/scoring/context";
import { computeScore } from "@/lib/scoring/engine";
import { DEFAULT_WEIGHT_PROFILE } from "@/lib/scoring/weights";
import type { PillarResult, WeightProfile } from "@/lib/scoring/types";
import { next60DaysEvents } from "@/lib/fiscal-calendar";

const DAY_MS = 86400000;

export async function GET() {
  const today = new Date();
  const [inputs, weightRow, allScores, allSignals, allPipeline, orgs] = await Promise.all([
    buildScoringInputsForUniverse(today),
    db.query.settings.findFirst({ where: eq(settings.key, "active_weight_profile") }),
    db.select().from(scores),
    db.select().from(signals),
    db.select().from(pipeline),
    db.select().from(organizations),
  ]);

  const weightProfile =
    (weightRow?.value as { name: string; weights: WeightProfile } | undefined) ?? {
      name: "Balanced",
      weights: DEFAULT_WEIGHT_PROFILE,
    };

  const results = inputs
    .map((i) => computeScore(i, weightProfile.weights, today, weightProfile.name))
    .sort((a, b) => b.total - a.total);

  const nameByEin = new Map(orgs.map((o) => [o.ein, o.name]));
  const top10 = results.slice(0, 10).map((r) => ({
    ein: r.ein,
    name: nameByEin.get(r.ein) ?? r.ein,
    total: r.total,
    tier: r.tier,
  }));

  // Movers: compare each org's latest persisted score to its oldest score from the last 7 days.
  const scoresByEin = new Map<string, typeof allScores>();
  for (const s of allScores) {
    if (!scoresByEin.has(s.ein)) scoresByEin.set(s.ein, []);
    scoresByEin.get(s.ein)!.push(s);
  }
  const weekAgo = new Date(today.getTime() - 7 * DAY_MS);
  const movers: {
    ein: string;
    name: string;
    delta: number;
    from: number;
    to: number;
    drivingPillar: string | null;
  }[] = [];
  for (const [ein, rows] of scoresByEin) {
    const sorted = rows.slice().sort((a, b) => a.computedAt.localeCompare(b.computedAt));
    const latest = sorted[sorted.length - 1];
    const baseline = sorted.find((r) => new Date(r.computedAt) >= weekAgo) ?? sorted[0];
    if (!latest || !baseline || latest.id === baseline.id) continue;
    const delta = latest.total - baseline.total;
    if (Math.abs(delta) < 0.01) continue;

    const latestPillars = latest.pillarBreakdown as PillarResult[];
    const baselinePillars = baseline.pillarBreakdown as PillarResult[];
    let drivingPillar: string | null = null;
    let maxDiff = 0;
    for (const p of latestPillars) {
      const prior = baselinePillars.find((bp) => bp.key === p.key);
      const diff = Math.abs(p.weightedContribution - (prior?.weightedContribution ?? 0));
      if (diff > maxDiff) {
        maxDiff = diff;
        drivingPillar = p.label;
      }
    }

    movers.push({ ein, name: nameByEin.get(ein) ?? ein, delta, from: baseline.total, to: latest.total, drivingPillar });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const newSignalsThisWeek = allSignals.filter((s) => new Date(s.createdAt) >= weekAgo);

  const tier1Eins = new Set(results.filter((r) => r.tier === "TIER_1").map((r) => r.ein));
  const pipelineByEin = new Map(allPipeline.map((p) => [p.ein, p]));
  const staleTier1 = [...tier1Eins]
    .map((ein) => ({ ein, name: nameByEin.get(ein) ?? ein, pipeline: pipelineByEin.get(ein) }))
    .filter((o) => {
      if (!o.pipeline?.lastTouchDate) return true;
      const days = (today.getTime() - new Date(o.pipeline.lastTouchDate).getTime()) / DAY_MS;
      return days >= 14;
    });

  const next60Days = next60DaysEvents(
    orgs.map((o) => ({ ein: o.ein, name: o.name, fyeMonth: o.fyeMonth, latestFilingYear: o.latestFilingYear })),
    today
  );

  const stageCounts: Record<string, number> = {};
  for (const p of allPipeline) {
    stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
  }

  return NextResponse.json({
    generatedAt: today.toISOString(),
    top10,
    movers: movers.slice(0, 10),
    newSignalsThisWeek: newSignalsThisWeek.map((s) => ({
      ein: s.ein,
      name: nameByEin.get(s.ein) ?? s.ein,
      headline: s.headline,
      type: s.type,
      tag: s.tag,
    })),
    staleTier1,
    next60Days: next60Days.slice(0, 15).map((e) => ({
      ...e,
      windowStart: e.windowStart.toISOString().slice(0, 10),
      windowEnd: e.windowEnd.toISOString().slice(0, 10),
    })),
    stageCounts,
  });
}
