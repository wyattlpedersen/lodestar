import type {
  AccessFactors,
  FactorRow,
  GrowthFactors,
  NeedVulnerabilityFacts,
  PillarResult,
  SignalInput,
  WealthAdjacencyFactors,
} from "./types";
import { decayedPoints } from "./decay";
import { isAutoSignal } from "@/lib/signals/taxonomy";
import type { OrgType } from "@/lib/propublica/mapper";

export const cap100 = (n: number) => Math.min(100, Math.max(0, n));

function weighted(rawScore: number, weight: number): number {
  return (rawScore / 100) * weight * 100;
}

// --- Pillar 1: Money in Motion --------------------------------------------

export function pillarMoneyInMotion(
  signals: SignalInput[],
  today: Date,
  weight: number
): PillarResult {
  const active = signals.filter((s) => s.active);
  const factors: FactorRow[] = active.map((s) => ({
    label: s.headline,
    points: Math.round(decayedPoints(s, today) * 10) / 10,
    provenance: s.tag === "EXAMPLE" ? "EXAMPLE" : isAutoSignal(s.type) ? "API" : "MANUAL",
    detail: s.isPersistent
      ? `${s.type} — persistent, recomputed from current financials`
      : `${s.type} — base ${s.basePoints}, half-life ${s.halfLifeDays}d`,
  }));
  const rawScore = cap100(factors.reduce((sum, f) => sum + f.points, 0));
  return {
    key: "mim",
    label: "Money in Motion",
    rawScore,
    weightedContribution: weighted(rawScore, weight),
    factors,
  };
}

// --- Pillar 2: Scale & Mandate Fit -----------------------------------------

export function scaleMandateBase(assets: number | null): number {
  if (assets == null) return 0;
  if (assets < 10_000_000) return 20;
  if (assets < 25_000_000) return 50;
  if (assets < 100_000_000) return 90;
  if (assets < 500_000_000) return 100;
  if (assets < 1_000_000_000) return 80;
  return 55;
}

export function pillarScaleMandateFit(
  assets: number | null,
  orgType: OrgType | null,
  weight: number
): PillarResult & { channelFlag: "COORDINATE_INSTITUTIONAL" | null } {
  const base = scaleMandateBase(assets);
  const overBillion = assets != null && assets > 1_000_000_000;
  const factors: FactorRow[] = [
    {
      label: "Asset band",
      points: base,
      provenance: "API",
      detail: assets != null ? `Latest assets ${assets.toLocaleString()}` : "No assets on file",
    },
  ];

  let bonus = 0;
  if (orgType === "private_foundation") {
    bonus += 5;
    factors.push({ label: "Private foundation (990-PF disclosure richness)", points: 5, provenance: "API" });
  }
  if (orgType === "community_foundation") {
    bonus += 5;
    factors.push({ label: "Community foundation (DAF/custody angle)", points: 5, provenance: "API" });
  }
  if (orgType === "university" || orgType === "hospital_health") {
    bonus += 5;
    factors.push({ label: "University/hospital (credit & treasury angle)", points: 5, provenance: "API" });
  }

  const rawScore = cap100(base + bonus);
  return {
    key: "fit",
    label: "Scale & Mandate Fit",
    rawScore,
    weightedContribution: weighted(rawScore, weight),
    factors,
    channelFlag: overBillion ? "COORDINATE_INSTITUTIONAL" : null,
  };
}

// --- Pillar 3: Access & Connectivity ---------------------------------------

export function pillarAccessConnectivity(
  access: AccessFactors,
  weight: number
): PillarResult {
  const warmBase = access.hasWarmPath ? 60 : 0;
  const secondDegreeBase = access.hasSecondDegreePath ? 35 : 0;
  const noPathBase = !access.hasWarmPath && !access.hasSecondDegreePath ? 10 : 0;
  const base = Math.max(warmBase, secondDegreeBase, noPathBase);

  const factors: FactorRow[] = [
    {
      label: access.hasWarmPath
        ? "Named warm path (known contact)"
        : access.hasSecondDegreePath
        ? "Second-degree path (shared trustee)"
        : "No path identified",
      points: base,
      provenance: "MANUAL",
    },
  ];

  let bonus = 0;
  if (access.jpmAlumOnBoard) {
    bonus += 20;
    factors.push({ label: "JPM alum on board/staff", points: 20, provenance: "MANUAL" });
  }
  if (access.superConnectorOnBoard) {
    bonus += 15;
    factors.push({ label: "Super-connector trustee (3+ universe boards)", points: 15, provenance: "DERIVED" });
  }
  if (access.hqInCoverageMetro) {
    bonus += 10;
    factors.push({ label: "HQ in Bay Area coverage metro", points: 10, provenance: "API" });
  }

  const rawScore = cap100(base + bonus);
  return {
    key: "access",
    label: "Access & Connectivity",
    rawScore,
    weightedContribution: weighted(rawScore, weight),
    factors,
  };
}

// --- Pillar 4: Need & Vulnerability -----------------------------------------

export function pillarNeedVulnerability(
  need: NeedVulnerabilityFacts,
  assets: number | null,
  weight: number
): PillarResult {
  const factors: FactorRow[] = [];
  let score = 0;

  if (need.feeRatio != null) {
    if (need.feeRatio >= 0.009) {
      score += 40;
      factors.push({ label: "Fee ratio ≥ 0.90%", points: 40, provenance: "MANUAL", detail: `${(need.feeRatio * 100).toFixed(2)}%` });
    } else if (need.feeRatio >= 0.006) {
      score += 20;
      factors.push({ label: "Fee ratio 0.60–0.89%", points: 20, provenance: "MANUAL", detail: `${(need.feeRatio * 100).toFixed(2)}%` });
    }
  }

  const assetsAbove50M = assets != null && assets >= 50_000_000;
  if (need.hasCompensatedInvestmentOfficer === false && assetsAbove50M) {
    score += 30;
    factors.push({ label: "No compensated investment officer (assets ≥ $50M)", points: 30, provenance: "MANUAL" });
  }

  if (need.pctCashPublicEquities != null && need.pctCashPublicEquities >= 0.6 && assetsAbove50M) {
    score += 25;
    factors.push({
      label: "Unsophisticated mix (≥60% cash + public equities, assets ≥ $50M)",
      points: 25,
      provenance: "MANUAL",
      detail: `${(need.pctCashPublicEquities * 100).toFixed(0)}%`,
    });
  }

  if (need.singleManagerConcentration === true) {
    score += 15;
    factors.push({ label: "Single-manager/consultant concentration", points: 15, provenance: "MANUAL" });
  }

  if (factors.length === 0) {
    factors.push({
      label: "No manual-assisted fields entered yet",
      points: 0,
      provenance: "MANUAL",
      detail: "Read the 990 and enter fee/mix data on the Overview tab to score this pillar.",
    });
  }

  const rawScore = cap100(score);
  return {
    key: "need",
    label: "Need & Vulnerability",
    rawScore,
    weightedContribution: weighted(rawScore, weight),
    factors,
  };
}

// --- Pillar 5: Wealth Adjacency ---------------------------------------------

export function pillarWealthAdjacency(
  wealth: WealthAdjacencyFactors,
  weight: number
): PillarResult {
  const factors: FactorRow[] = [];
  let score = 0;

  if (wealth.livingFounderContributing) {
    score += 40;
    factors.push({ label: "Living founder/primary donor actively contributing", points: 40, provenance: "MANUAL" });
  }
  if (wealth.founderLiquiditySignalActive) {
    score += 25;
    factors.push({ label: "Founder liquidity event within 24 months", points: 25, provenance: "MANUAL" });
  }
  if (wealth.familyMembersOnBoardCount >= 2) {
    score += 20;
    factors.push({ label: "≥2 family members on board", points: 20, provenance: "MANUAL" });
  }
  if (wealth.corporateFoundationWithCSuite) {
    score += 15;
    factors.push({ label: "Corporate foundation with C-suite trustees", points: 15, provenance: "MANUAL" });
  }
  const uhnwPoints = Math.min(20, wealth.principalUhnwTrusteeCount * 10);
  if (uhnwPoints > 0) {
    score += uhnwPoints;
    factors.push({
      label: `Principal UHNW trustee(s) (${wealth.principalUhnwTrusteeCount})`,
      points: uhnwPoints,
      provenance: "MANUAL",
    });
  }

  if (factors.length === 0) {
    factors.push({ label: "No wealth-adjacency intel logged yet", points: 0, provenance: "MANUAL" });
  }

  const rawScore = cap100(score);
  return {
    key: "wealth",
    label: "Wealth Adjacency",
    rawScore,
    weightedContribution: weighted(rawScore, weight),
    factors,
  };
}

// --- Pillar 6: Growth & Expansion --------------------------------------------

export function pillarGrowthExpansion(
  growth: GrowthFactors,
  weight: number
): PillarResult {
  const factors: FactorRow[] = [];
  let score = 0;

  if (growth.cagr5yrPercentile != null) {
    const pts = (cap100(growth.cagr5yrPercentile) / 100) * 40;
    score += pts;
    factors.push({
      label: "5yr net-asset CAGR percentile within cohort",
      points: Math.round(pts * 10) / 10,
      provenance: "DERIVED",
      detail: `${growth.cagr5yrPercentile.toFixed(0)}th percentile`,
    });
  } else {
    factors.push({ label: "5yr CAGR percentile unavailable (insufficient cohort/filing history)", points: 0, provenance: "DERIVED" });
  }

  if (growth.contributionMomentumPositiveAccelerating) {
    score += 20;
    factors.push({ label: "Contribution momentum positive & accelerating", points: 20, provenance: "DERIVED" });
  }
  if (growth.creditTreasuryFit) {
    score += 20;
    factors.push({ label: "Credit/treasury fit (university, hospital, or real-asset-heavy)", points: 20, provenance: "API" });
  }
  if (growth.custodyDafPlannedGivingFit) {
    score += 20;
    factors.push({ label: "Custody / DAF / planned-giving program fit", points: 20, provenance: "API" });
  }

  const rawScore = cap100(score);
  return {
    key: "growth",
    label: "Growth & Expansion",
    rawScore,
    weightedContribution: weighted(rawScore, weight),
    factors,
  };
}
