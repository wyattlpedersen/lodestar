import type { PillarResult, ScoreResult, ScoringInput, WeightProfile } from "./types";
import { normalizeWeights } from "./weights";
import {
  pillarAccessConnectivity,
  pillarGrowthExpansion,
  pillarMoneyInMotion,
  pillarNeedVulnerability,
  pillarScaleMandateFit,
  pillarWealthAdjacency,
} from "./pillars";
import { computeConfidence } from "./confidence";
import { applyConfidenceGate, tierFromScore } from "./tiers";

export function computeScore(
  input: ScoringInput,
  weights: WeightProfile,
  today: Date = new Date(),
  weightProfileName = "Custom"
): ScoreResult {
  const w = normalizeWeights(weights);

  const mim = pillarMoneyInMotion(input.signals, today, w.mim);
  const fit = pillarScaleMandateFit(input.latestAssets, input.orgType, w.fit);
  const access = pillarAccessConnectivity(input.access, w.access);
  const need = pillarNeedVulnerability(input.need, input.latestAssets, w.need);
  const wealth = pillarWealthAdjacency(input.wealth, w.wealth);
  const growth = pillarGrowthExpansion(input.growth, w.growth);

  const pillars: PillarResult[] = [mim, fit, access, need, wealth, growth];
  const total = Math.round(
    pillars.reduce((sum, p) => sum + p.weightedContribution, 0) * 10
  ) / 10;

  const { score: confidence, grade: confidenceGrade } = computeConfidence(input.confidence);
  const rawTier = tierFromScore(total);
  const { tier, tierPending } = applyConfidenceGate(rawTier, confidenceGrade);

  return {
    ein: input.ein,
    total,
    tier,
    tierPending,
    confidence,
    confidenceGrade,
    pillars,
    channelFlag: fit.channelFlag,
    weightProfile: w,
    weightProfileName,
  };
}
