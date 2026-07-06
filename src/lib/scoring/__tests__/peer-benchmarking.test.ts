import { describe, expect, it } from "vitest";
import { computePeerBenchmark, contributionVolatility, type PeerCohortMember } from "../peer-benchmarking";
import type { FilingLike } from "@/lib/derived-financials";

function filing(taxYear: number, contributions: number | null): FilingLike {
  return {
    taxYear,
    totalRevenue: null,
    totalExpenses: null,
    totalAssets: null,
    totalLiabilities: null,
    contributions,
  };
}

describe("contributionVolatility", () => {
  it("returns null with fewer than 2 YoY deltas", () => {
    expect(contributionVolatility([filing(2023, 100), filing(2022, 90)])).toBeNull();
  });

  it("is zero for perfectly steady contributions", () => {
    const filings = [filing(2023, 100), filing(2022, 100), filing(2021, 100), filing(2020, 100)];
    expect(contributionVolatility(filings)).toBeCloseTo(0, 5);
  });

  it("is higher for more erratic contributions", () => {
    const steady = [filing(2023, 100), filing(2022, 100), filing(2021, 100), filing(2020, 100)];
    const erratic = [filing(2023, 200), filing(2022, 50), filing(2021, 300), filing(2020, 40)];
    const steadyVol = contributionVolatility(steady)!;
    const erraticVol = contributionVolatility(erratic)!;
    expect(erraticVol).toBeGreaterThan(steadyVol);
  });
});

describe("computePeerBenchmark", () => {
  const cohort: PeerCohortMember[] = [
    { ein: "1", nteeMajor: 7, latestAssets: 30_000_000, cagr5yr: 0.02, payoutRatioProxy: 0.05, feeRatio: 0.005, contributionVolatility: 0.1 },
    { ein: "2", nteeMajor: 7, latestAssets: 40_000_000, cagr5yr: 0.05, payoutRatioProxy: 0.06, feeRatio: 0.008, contributionVolatility: 0.2 },
    { ein: "3", nteeMajor: 7, latestAssets: 50_000_000, cagr5yr: 0.08, payoutRatioProxy: 0.07, feeRatio: 0.01, contributionVolatility: 0.3 },
  ];

  it("computes percentiles for all 4 metrics against the same-band cohort", () => {
    const me: PeerCohortMember = {
      ein: "me",
      nteeMajor: 7,
      latestAssets: 45_000_000,
      cagr5yr: 0.06,
      payoutRatioProxy: 0.065,
      feeRatio: 0.009,
      contributionVolatility: 0.15,
    };
    const result = computePeerBenchmark(me, cohort);
    expect(result).toHaveLength(4);
    const cagr = result.find((r) => r.key === "cagr5yr")!;
    expect(cagr.percentile).not.toBeNull();
  });

  it("returns null percentiles when the org has no assets (no cohort band)", () => {
    const me: PeerCohortMember = {
      ein: "me",
      nteeMajor: 7,
      latestAssets: null,
      cagr5yr: 0.06,
      payoutRatioProxy: 0.065,
      feeRatio: 0.009,
      contributionVolatility: 0.15,
    };
    const result = computePeerBenchmark(me, cohort);
    expect(result.every((r) => r.percentile === null)).toBe(true);
  });

  it("returns a null percentile for a metric the org itself has no value for", () => {
    const me: PeerCohortMember = {
      ein: "me",
      nteeMajor: 7,
      latestAssets: 45_000_000,
      cagr5yr: null,
      payoutRatioProxy: 0.065,
      feeRatio: null,
      contributionVolatility: 0.15,
    };
    const result = computePeerBenchmark(me, cohort);
    expect(result.find((r) => r.key === "cagr5yr")?.percentile).toBeNull();
    expect(result.find((r) => r.key === "feeRatio")?.percentile).toBeNull();
  });
});
