import type { OrgType } from "@/lib/propublica/mapper";
import type { DerivedFinancials } from "@/lib/derived-financials";

export interface WeightProfile {
  mim: number;
  fit: number;
  access: number;
  need: number;
  wealth: number;
  growth: number;
}

export const PILLAR_KEYS = [
  "mim",
  "fit",
  "access",
  "need",
  "wealth",
  "growth",
] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];

export interface SignalInput {
  id: number;
  type: string;
  headline: string;
  basePoints: number;
  halfLifeDays: number | null;
  isPersistent: boolean;
  eventDate: string; // ISO date (yyyy-mm-dd)
  active: boolean;
  hasSourceUrl: boolean;
  tag?: string | null;
}

export interface AccessFactors {
  /** Named warm contact directly linked to this org (Section 7.3 base row 1). */
  hasWarmPath: boolean;
  /** Shared board member with a relationship-marked org, within 2 hops (base row 2). */
  hasSecondDegreePath: boolean;
  jpmAlumOnBoard: boolean;
  superConnectorOnBoard: boolean;
  hqInCoverageMetro: boolean;
}

export interface WealthAdjacencyFactors {
  livingFounderContributing: boolean;
  founderLiquiditySignalActive: boolean;
  familyMembersOnBoardCount: number;
  corporateFoundationWithCSuite: boolean;
  principalUhnwTrusteeCount: number;
}

export interface NeedVulnerabilityFacts {
  feeRatio: number | null; // mgmt & inv fees / avg assets
  hasCompensatedInvestmentOfficer: boolean | null; // null = not entered
  pctCashPublicEquities: number | null;
  singleManagerConcentration: boolean | null;
}

export interface GrowthFactors {
  cagr5yrPercentile: number | null; // 0-100 percentile within cohort
  contributionMomentumPositiveAccelerating: boolean;
  creditTreasuryFit: boolean;
  custodyDafPlannedGivingFit: boolean;
}

export interface ConfidenceInputs {
  latestFilingAgeMonths: number | null;
  yearsWithFinancialData: number;
  activeSignalsWithSourceCount: number;
  analystVerified: boolean;
}

export interface ScoringInput {
  ein: string;
  name: string;
  orgType: OrgType | null;
  latestAssets: number | null;
  signals: SignalInput[];
  access: AccessFactors;
  wealth: WealthAdjacencyFactors;
  need: NeedVulnerabilityFacts;
  growth: GrowthFactors;
  confidence: ConfidenceInputs;
  derived: Pick<DerivedFinancials, "cagr3yr" | "cagr5yr">;
}

export interface FactorRow {
  label: string;
  points: number;
  provenance: "API" | "MANUAL" | "EXAMPLE" | "DERIVED";
  detail?: string;
}

export interface PillarResult {
  key: PillarKey;
  label: string;
  rawScore: number; // 0-100, pre-weight
  weightedContribution: number; // 0-100 scale contribution to total
  factors: FactorRow[];
}

export type Tier = "TIER_1" | "TIER_2" | "TIER_3" | "WATCHLIST";
export type ConfidenceGrade = "A" | "B" | "C";

export interface ScoreResult {
  ein: string;
  total: number;
  tier: Tier;
  tierPending: boolean; // Tier 1 held pending verification due to Confidence C
  confidence: number;
  confidenceGrade: ConfidenceGrade;
  pillars: PillarResult[];
  channelFlag: "COORDINATE_INSTITUTIONAL" | null;
  weightProfile: WeightProfile;
  weightProfileName: string;
}
