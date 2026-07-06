import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { filings, organizations, pipeline, settings, signals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computeDerivedFinancials } from "@/lib/derived-financials";
import { buildScoringInputsForUniverse } from "@/lib/scoring/context";
import { computeScore } from "@/lib/scoring/engine";
import { DEFAULT_WEIGHT_PROFILE } from "@/lib/scoring/weights";
import type { WeightProfile } from "@/lib/scoring/types";
import { nteeMajorLabel } from "@/lib/propublica/ntee";
import { loadTrusteeGraphContext } from "@/lib/graph/loader";
import { findPath } from "@/lib/graph/trustee-graph";
import { loadPeerBenchmark } from "@/lib/scoring/peer-loader";
import { assetBandFor } from "@/lib/scoring/cohort";
import { generateReasonToCall } from "@/lib/reason-to-call";
import { buildObjectionPrep } from "@/lib/briefing/objection-prep";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;

  const org = await db.query.organizations.findFirst({ where: eq(organizations.ein, ein) });
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const [orgFilings, activeSignals, pipelineRow, weightRow, inputs, pathCtx, peerMetrics] =
    await Promise.all([
      db.select().from(filings).where(eq(filings.ein, ein)).orderBy(desc(filings.taxYear)),
      db
        .select()
        .from(signals)
        .where(eq(signals.ein, ein))
        .orderBy(desc(signals.eventDate)),
      db.query.pipeline.findFirst({ where: eq(pipeline.ein, ein) }),
      db.query.settings.findFirst({ where: eq(settings.key, "active_weight_profile") }),
      buildScoringInputsForUniverse(),
      loadTrusteeGraphContext(),
      loadPeerBenchmark(ein),
    ]);

  const derived = computeDerivedFinancials(orgFilings);
  const weightProfile =
    (weightRow?.value as { name: string; weights: WeightProfile } | undefined) ?? {
      name: "Balanced",
      weights: DEFAULT_WEIGHT_PROFILE,
    };

  const input = inputs.find((i) => i.ein === ein);
  const scoreResult = input
    ? computeScore(input, weightProfile.weights, new Date(), weightProfile.name)
    : null;

  const path = findPath(pathCtx.graph, ein, pathCtx.relationshipEins, pathCtx.orgNames);

  const activeOnly = activeSignals.filter((s) => s.active);
  const topSignal = input
    ? [...input.signals]
        .filter((s) => s.active)
        .sort((a, b) => b.basePoints - a.basePoints)[0] ?? null
    : null;

  const reasonToCall = generateReasonToCall({
    orgName: org.name,
    orgType: org.orgType,
    assetBandLabel: assetBandFor(org.latestAssets)?.label ?? null,
    topSignalType: topSignal?.type ?? null,
    topSignalHeadline: topSignal?.headline ?? null,
  });

  const objectionPrep = input ? buildObjectionPrep(input.need) : [];

  return NextResponse.json({
    organization: org,
    nteeMajorLabel: nteeMajorLabel(org.nteeMajor),
    filings: orgFilings.slice(0, 5),
    derived,
    score: scoreResult,
    signals: activeOnly,
    path,
    peerMetrics,
    pipeline: pipelineRow ?? null,
    reasonToCall,
    objectionPrep,
  });
}
