import { describe, expect, it } from "vitest";
import {
  pillarAccessConnectivity,
  pillarGrowthExpansion,
  pillarMoneyInMotion,
  pillarNeedVulnerability,
  pillarScaleMandateFit,
  pillarWealthAdjacency,
  scaleMandateBase,
} from "../pillars";
import type {
  AccessFactors,
  GrowthFactors,
  NeedVulnerabilityFacts,
  SignalInput,
  WealthAdjacencyFactors,
} from "../types";

const today = new Date("2026-07-06T00:00:00Z");

function signal(overrides: Partial<SignalInput>): SignalInput {
  return {
    id: 1,
    type: "RFP_ANNOUNCED",
    headline: "Test",
    basePoints: 100,
    halfLifeDays: 90,
    isPersistent: false,
    eventDate: "2026-07-06",
    active: true,
    hasSourceUrl: true,
    ...overrides,
  };
}

describe("pillarMoneyInMotion", () => {
  it("sums decayed points across active signals and caps at 100", () => {
    const signals = [
      signal({ id: 1, basePoints: 100, eventDate: "2026-07-06" }),
      signal({ id: 2, basePoints: 90, eventDate: "2026-07-06" }),
    ];
    const result = pillarMoneyInMotion(signals, today, 0.3);
    expect(result.rawScore).toBe(100); // 190 raw, capped
  });

  it("ignores inactive signals", () => {
    const signals = [signal({ id: 1, basePoints: 50, active: false })];
    const result = pillarMoneyInMotion(signals, today, 0.3);
    expect(result.rawScore).toBe(0);
    expect(result.factors).toHaveLength(0);
  });

  it("scales weightedContribution by the given pillar weight", () => {
    const signals = [signal({ id: 1, basePoints: 60, eventDate: "2026-07-06" })];
    const result = pillarMoneyInMotion(signals, today, 0.5);
    expect(result.rawScore).toBe(60);
    expect(result.weightedContribution).toBeCloseTo(30, 5); // 60/100 * 0.5 * 100
  });

  it("tags EXAMPLE-seeded signals with EXAMPLE provenance", () => {
    const signals = [signal({ id: 1, tag: "EXAMPLE" })];
    const result = pillarMoneyInMotion(signals, today, 0.3);
    expect(result.factors[0].provenance).toBe("EXAMPLE");
  });

  it("tags AUTO-derived signal codes as API provenance", () => {
    const signals = [signal({ id: 1, type: "ASSET_DROP" })];
    const result = pillarMoneyInMotion(signals, today, 0.3);
    expect(result.factors[0].provenance).toBe("API");
  });
});

describe("scaleMandateBase (piecewise asset bands)", () => {
  it.each([
    [null, 0],
    [5_000_000, 20],
    [9_999_999, 20],
    [10_000_000, 50],
    [24_999_999, 50],
    [25_000_000, 90],
    [99_999_999, 90],
    [100_000_000, 100],
    [499_999_999, 100],
    [500_000_000, 80],
    [999_999_999, 80],
    [1_000_000_000, 55],
    [2_000_000_000, 55],
  ])("assets=%p -> base %p", (assets, expected) => {
    expect(scaleMandateBase(assets)).toBe(expected);
  });
});

describe("pillarScaleMandateFit", () => {
  it("sets channelFlag only when assets exceed $1B", () => {
    expect(pillarScaleMandateFit(2_000_000_000, null, 0.2).channelFlag).toBe(
      "COORDINATE_INSTITUTIONAL"
    );
    expect(pillarScaleMandateFit(999_000_000, null, 0.2).channelFlag).toBeNull();
    expect(pillarScaleMandateFit(1_000_000_000, null, 0.2).channelFlag).toBeNull(); // exactly 1B is not "> $1B"
  });

  it("applies the +5 org-type modifier and caps at 100", () => {
    const result = pillarScaleMandateFit(200_000_000, "university", 0.2);
    expect(result.rawScore).toBe(100); // 100 base + 5, capped
  });

  it("stacks org-type modifier on a mid-band score without exceeding 100", () => {
    const result = pillarScaleMandateFit(50_000_000, "private_foundation", 0.2);
    expect(result.rawScore).toBe(95); // 90 + 5
  });
});

describe("pillarAccessConnectivity", () => {
  const base = (overrides: Partial<AccessFactors>): AccessFactors => ({
    hasWarmPath: false,
    hasSecondDegreePath: false,
    jpmAlumOnBoard: false,
    superConnectorOnBoard: false,
    hqInCoverageMetro: false,
    ...overrides,
  });

  it("takes the max of the three base rows: warm path wins over second-degree", () => {
    const result = pillarAccessConnectivity(
      base({ hasWarmPath: true, hasSecondDegreePath: true }),
      0.15
    );
    expect(result.rawScore).toBe(60);
  });

  it("falls back to the no-path base of 10 when neither path exists", () => {
    const result = pillarAccessConnectivity(base({}), 0.15);
    expect(result.rawScore).toBe(10);
  });

  it("adds all modifiers and caps at 100", () => {
    const result = pillarAccessConnectivity(
      base({
        hasWarmPath: true,
        jpmAlumOnBoard: true,
        superConnectorOnBoard: true,
        hqInCoverageMetro: true,
      }),
      0.15
    );
    // 60 + 20 + 15 + 10 = 105 -> capped
    expect(result.rawScore).toBe(100);
  });
});

describe("pillarNeedVulnerability", () => {
  const base = (overrides: Partial<NeedVulnerabilityFacts>): NeedVulnerabilityFacts => ({
    feeRatio: null,
    hasCompensatedInvestmentOfficer: null,
    pctCashPublicEquities: null,
    singleManagerConcentration: null,
    ...overrides,
  });

  it("scores 0 with no manual fields entered (missing data, not zero-value data)", () => {
    const result = pillarNeedVulnerability(base({}), 60_000_000, 0.15);
    expect(result.rawScore).toBe(0);
  });

  it("fee ratio >= 0.90% earns +40; 0.60-0.89% earns +20; below earns 0", () => {
    expect(pillarNeedVulnerability(base({ feeRatio: 0.012 }), null, 0.15).rawScore).toBe(40);
    expect(pillarNeedVulnerability(base({ feeRatio: 0.007 }), null, 0.15).rawScore).toBe(20);
    expect(pillarNeedVulnerability(base({ feeRatio: 0.003 }), null, 0.15).rawScore).toBe(0);
  });

  it("no investment officer only fires when assets >= $50M", () => {
    const facts = base({ hasCompensatedInvestmentOfficer: false });
    expect(pillarNeedVulnerability(facts, 60_000_000, 0.15).rawScore).toBe(30);
    expect(pillarNeedVulnerability(facts, 40_000_000, 0.15).rawScore).toBe(0);
  });

  it("stacks all factors and caps at 100", () => {
    const facts = base({
      feeRatio: 0.02,
      hasCompensatedInvestmentOfficer: false,
      pctCashPublicEquities: 0.8,
      singleManagerConcentration: true,
    });
    // 40 + 30 + 25 + 15 = 110 -> capped
    expect(pillarNeedVulnerability(facts, 100_000_000, 0.15).rawScore).toBe(100);
  });
});

describe("pillarWealthAdjacency", () => {
  const base = (overrides: Partial<WealthAdjacencyFactors>): WealthAdjacencyFactors => ({
    livingFounderContributing: false,
    founderLiquiditySignalActive: false,
    familyMembersOnBoardCount: 0,
    corporateFoundationWithCSuite: false,
    principalUhnwTrusteeCount: 0,
    ...overrides,
  });

  it("caps the UHNW-trustee bonus at +20 regardless of count", () => {
    const r5 = pillarWealthAdjacency(base({ principalUhnwTrusteeCount: 5 }), 0.1);
    expect(r5.rawScore).toBe(20);
    const r2 = pillarWealthAdjacency(base({ principalUhnwTrusteeCount: 2 }), 0.1);
    expect(r2.rawScore).toBe(20);
    const r1 = pillarWealthAdjacency(base({ principalUhnwTrusteeCount: 1 }), 0.1);
    expect(r1.rawScore).toBe(10);
  });

  it("family-on-board bonus requires >= 2 members, not just >= 1", () => {
    expect(pillarWealthAdjacency(base({ familyMembersOnBoardCount: 1 }), 0.1).rawScore).toBe(0);
    expect(pillarWealthAdjacency(base({ familyMembersOnBoardCount: 2 }), 0.1).rawScore).toBe(20);
  });

  it("stacks all factors and caps at 100", () => {
    const facts = base({
      livingFounderContributing: true,
      founderLiquiditySignalActive: true,
      familyMembersOnBoardCount: 3,
      corporateFoundationWithCSuite: true,
      principalUhnwTrusteeCount: 4,
    });
    // 40 + 25 + 20 + 15 + 20(capped) = 120 -> capped at 100
    expect(pillarWealthAdjacency(facts, 0.1).rawScore).toBe(100);
  });
});

describe("pillarGrowthExpansion", () => {
  const base = (overrides: Partial<GrowthFactors>): GrowthFactors => ({
    cagr5yrPercentile: null,
    contributionMomentumPositiveAccelerating: false,
    creditTreasuryFit: false,
    custodyDafPlannedGivingFit: false,
    ...overrides,
  });

  it("scales the CAGR percentile linearly onto a 0-40 range", () => {
    expect(pillarGrowthExpansion(base({ cagr5yrPercentile: 0 }), 0.1).rawScore).toBe(0);
    expect(pillarGrowthExpansion(base({ cagr5yrPercentile: 50 }), 0.1).rawScore).toBe(20);
    expect(pillarGrowthExpansion(base({ cagr5yrPercentile: 100 }), 0.1).rawScore).toBe(40);
  });

  it("never fabricates a percentile contribution when null", () => {
    expect(pillarGrowthExpansion(base({}), 0.1).rawScore).toBe(0);
  });

  it("stacks all four factors up to exactly 100", () => {
    const result = pillarGrowthExpansion(
      base({
        cagr5yrPercentile: 100,
        contributionMomentumPositiveAccelerating: true,
        creditTreasuryFit: true,
        custodyDafPlannedGivingFit: true,
      }),
      0.1
    );
    expect(result.rawScore).toBe(100);
  });
});
