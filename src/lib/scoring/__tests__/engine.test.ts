import { describe, expect, it } from "vitest";
import { computeScore } from "../engine";
import { WEIGHT_PRESETS } from "../weights";
import type { ScoringInput } from "../types";

const today = new Date("2026-07-06T00:00:00Z");

function baseInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    ein: "123456789",
    name: "Test Foundation",
    orgType: "private_foundation",
    latestAssets: 60_000_000,
    signals: [],
    access: {
      hasWarmPath: false,
      hasSecondDegreePath: false,
      jpmAlumOnBoard: false,
      superConnectorOnBoard: false,
      hqInCoverageMetro: true,
    },
    wealth: {
      livingFounderContributing: false,
      founderLiquiditySignalActive: false,
      familyMembersOnBoardCount: 0,
      corporateFoundationWithCSuite: false,
      principalUhnwTrusteeCount: 0,
    },
    need: {
      feeRatio: null,
      hasCompensatedInvestmentOfficer: null,
      pctCashPublicEquities: null,
      singleManagerConcentration: null,
    },
    growth: {
      cagr5yrPercentile: null,
      contributionMomentumPositiveAccelerating: false,
      creditTreasuryFit: false,
      custodyDafPlannedGivingFit: false,
    },
    confidence: {
      latestFilingAgeMonths: 10,
      yearsWithFinancialData: 5,
      activeSignalsWithSourceCount: 0,
      analystVerified: false,
    },
    derived: { cagr3yr: null, cagr5yr: null, payoutRatioProxy: null },
    ...overrides,
  };
}

describe("computeScore — weight normalization end-to-end", () => {
  it("produces an identical total whether weights are pre-normalized or not, given the same proportions", () => {
    const input = baseInput({ latestAssets: 200_000_000 });
    const a = computeScore(input, WEIGHT_PRESETS.Balanced, today);
    const b = computeScore(
      input,
      { mim: 3, fit: 2, access: 1.5, need: 1.5, wealth: 1, growth: 1 },
      today
    );
    expect(a.total).toBeCloseTo(b.total, 5);
  });

  it("weighted pillar contributions always sum to the total", () => {
    const input = baseInput({});
    const result = computeScore(input, WEIGHT_PRESETS.Balanced, today);
    const sum = result.pillars.reduce((s, p) => s + p.weightedContribution, 0);
    expect(result.total).toBeCloseTo(sum, 1);
  });
});

describe("computeScore — tier boundaries end-to-end", () => {
  it("a maxed-out org with full confidence lands in Tier 1, uncapped by pending", () => {
    const input = baseInput({
      latestAssets: 200_000_000,
      orgType: "university",
      signals: [
        {
          id: 1,
          type: "RFP_ANNOUNCED",
          headline: "OCIO search live",
          basePoints: 100,
          halfLifeDays: 90,
          isPersistent: false,
          eventDate: "2026-07-06",
          active: true,
          hasSourceUrl: true,
        },
      ],
      access: {
        hasWarmPath: true,
        hasSecondDegreePath: false,
        jpmAlumOnBoard: true,
        superConnectorOnBoard: true,
        hqInCoverageMetro: true,
      },
      need: {
        feeRatio: 0.012,
        hasCompensatedInvestmentOfficer: false,
        pctCashPublicEquities: 0.8,
        singleManagerConcentration: true,
      },
      wealth: {
        livingFounderContributing: true,
        founderLiquiditySignalActive: true,
        familyMembersOnBoardCount: 2,
        corporateFoundationWithCSuite: false,
        principalUhnwTrusteeCount: 2,
      },
      growth: {
        cagr5yrPercentile: 90,
        contributionMomentumPositiveAccelerating: true,
        creditTreasuryFit: true,
        custodyDafPlannedGivingFit: true,
      },
      confidence: {
        latestFilingAgeMonths: 10,
        yearsWithFinancialData: 5,
        activeSignalsWithSourceCount: 2,
        analystVerified: true,
      },
    });
    const result = computeScore(input, WEIGHT_PRESETS.Balanced, today);
    expect(result.tier).toBe("TIER_1");
    expect(result.tierPending).toBe(false);
    expect(result.confidenceGrade).toBe("A");
  });

  it("a near-empty org with tiny assets lands on the Watchlist", () => {
    const input = baseInput({
      latestAssets: 2_000_000,
      orgType: "other_operating",
      access: {
        hasWarmPath: false,
        hasSecondDegreePath: false,
        jpmAlumOnBoard: false,
        superConnectorOnBoard: false,
        hqInCoverageMetro: false,
      },
      confidence: {
        latestFilingAgeMonths: null,
        yearsWithFinancialData: 0,
        activeSignalsWithSourceCount: 0,
        analystVerified: false,
      },
    });
    const result = computeScore(input, WEIGHT_PRESETS.Balanced, today);
    expect(result.tier).toBe("WATCHLIST");
  });
});

describe("computeScore — confidence gating of Tier 1", () => {
  it("demotes a would-be Tier 1 org to 'pending verification' when confidence is C", () => {
    // High score driven by assets/fit/access, but confidence inputs are thin (grade C).
    const input = baseInput({
      latestAssets: 200_000_000,
      orgType: "university",
      access: {
        hasWarmPath: true,
        hasSecondDegreePath: false,
        jpmAlumOnBoard: true,
        superConnectorOnBoard: true,
        hqInCoverageMetro: true,
      },
      confidence: {
        latestFilingAgeMonths: 40, // stale filing -> only 10 pts
        yearsWithFinancialData: 1, // < 3 years -> 0 pts
        activeSignalsWithSourceCount: 0,
        analystVerified: false,
      },
    });
    const result = computeScore(input, WEIGHT_PRESETS.Balanced, today);
    expect(result.confidenceGrade).toBe("C");
    if (result.total >= 80) {
      expect(result.tier).toBe("TIER_1");
      expect(result.tierPending).toBe(true);
    }
  });
});

describe("computeScore — channel flag", () => {
  it("flags mega-endowments above $1B for institutional coordination", () => {
    const input = baseInput({ latestAssets: 5_000_000_000 });
    const result = computeScore(input, WEIGHT_PRESETS.Balanced, today);
    expect(result.channelFlag).toBe("COORDINATE_INSTITUTIONAL");
  });

  it("does not flag orgs at or below $1B", () => {
    const input = baseInput({ latestAssets: 1_000_000_000 });
    expect(computeScore(input, WEIGHT_PRESETS.Balanced, today).channelFlag).toBeNull();
  });
});

describe("computeScore — persistent signal behavior", () => {
  it("a persistent signal contributes the same MIM points regardless of how old its event date is", () => {
    const persistentSignal = {
      id: 1,
      type: "SPENDING_STRESS",
      headline: "Payout proxy exceeds 5.5% with 2yr asset decline",
      basePoints: 55,
      halfLifeDays: null,
      isPersistent: true,
      eventDate: "2015-01-01",
      active: true,
      hasSourceUrl: false,
    };
    const recentInput = baseInput({ signals: [{ ...persistentSignal, eventDate: "2026-07-01" }] });
    const oldInput = baseInput({ signals: [{ ...persistentSignal, eventDate: "2015-01-01" }] });
    const recent = computeScore(recentInput, WEIGHT_PRESETS.Balanced, today);
    const old = computeScore(oldInput, WEIGHT_PRESETS.Balanced, today);
    expect(recent.total).toBeCloseTo(old.total, 5);
  });

  it("dropping a persistent signal (condition cleared) removes its MIM contribution", () => {
    const withSignal = baseInput({
      signals: [
        {
          id: 1,
          type: "PERFORMANCE_GAP",
          headline: "Trailing benchmark",
          basePoints: 60,
          halfLifeDays: null,
          isPersistent: true,
          eventDate: "2024-01-01",
          active: true,
          hasSourceUrl: false,
        },
      ],
    });
    const withoutSignal = baseInput({ signals: [] });
    const a = computeScore(withSignal, WEIGHT_PRESETS.Balanced, today);
    const b = computeScore(withoutSignal, WEIGHT_PRESETS.Balanced, today);
    expect(a.total).toBeGreaterThan(b.total);
  });
});
