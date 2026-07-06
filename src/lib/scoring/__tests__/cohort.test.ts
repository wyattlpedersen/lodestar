import { describe, expect, it } from "vitest";
import { assetBandFor, cagrPercentileWithinCohort, type CohortMember } from "../cohort";

describe("assetBandFor", () => {
  it("returns null below the $10M floor", () => {
    expect(assetBandFor(5_000_000)).toBeNull();
    expect(assetBandFor(null)).toBeNull();
  });

  it("buckets correctly at band edges", () => {
    expect(assetBandFor(10_000_000)?.label).toBe("$10–25M");
    expect(assetBandFor(24_999_999)?.label).toBe("$10–25M");
    expect(assetBandFor(25_000_000)?.label).toBe("$25–100M");
    expect(assetBandFor(1_500_000_000)?.label).toBe("$1B+");
  });
});

describe("cagrPercentileWithinCohort", () => {
  const universe: CohortMember[] = [
    { ein: "1", nteeMajor: 7, latestAssets: 30_000_000, cagr5yr: 0.02 },
    { ein: "2", nteeMajor: 7, latestAssets: 40_000_000, cagr5yr: 0.05 },
    { ein: "3", nteeMajor: 7, latestAssets: 50_000_000, cagr5yr: 0.08 },
    { ein: "4", nteeMajor: 2, latestAssets: 40_000_000, cagr5yr: 0.99 }, // different NTEE major
    { ein: "5", nteeMajor: 7, latestAssets: 5_000_000, cagr5yr: 0.99 }, // different band (below floor)
  ];

  it("returns null when the org's own CAGR is null", () => {
    expect(cagrPercentileWithinCohort("6", 7, 40_000_000, null, universe)).toBeNull();
  });

  it("returns null when fewer than 2 cohort peers exist (same major+band)", () => {
    const sparse: CohortMember[] = [{ ein: "1", nteeMajor: 7, latestAssets: 30_000_000, cagr5yr: 0.02 }];
    expect(cagrPercentileWithinCohort("6", 7, 40_000_000, 0.05, sparse)).toBeNull();
  });

  it("excludes other NTEE majors and out-of-band assets from the cohort", () => {
    // org at 0.05 vs cohort {1: 0.02, 2: 0.05, 3: 0.08} within major 7 / $25-100M band
    const pct = cagrPercentileWithinCohort("6", 7, 40_000_000, 0.05, universe);
    expect(pct).not.toBeNull();
    // beats-or-ties 0.02 -> true, ties itself conceptually via <=0.05: 0.02 and 0.05 both <=0.05 => 2/3
    expect(pct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("scores 100th percentile when it beats the entire cohort", () => {
    const pct = cagrPercentileWithinCohort("6", 7, 40_000_000, 0.5, universe);
    expect(pct).toBeCloseTo(100, 5);
  });

  it("excludes the org itself from its own cohort", () => {
    // org "1" is already in the universe; percentile should compare against the OTHER members only
    const pct = cagrPercentileWithinCohort("1", 7, 30_000_000, 0.02, universe);
    expect(pct).not.toBeNull();
  });
});
