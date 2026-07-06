import { describe, expect, it } from "vitest";
import { applyConfidenceGate, tierFromScore } from "../tiers";

describe("tierFromScore boundaries", () => {
  it.each([
    [100, "TIER_1"],
    [80, "TIER_1"],
    [79.9, "TIER_2"],
    [65, "TIER_2"],
    [64.9, "TIER_3"],
    [50, "TIER_3"],
    [49.9, "WATCHLIST"],
    [0, "WATCHLIST"],
  ])("score %p -> %p", (score, expected) => {
    expect(tierFromScore(score as number)).toBe(expected);
  });
});

describe("applyConfidenceGate", () => {
  it("holds Tier 1 with a pending flag when confidence is C", () => {
    const result = applyConfidenceGate("TIER_1", "C");
    expect(result.tier).toBe("TIER_1");
    expect(result.tierPending).toBe(true);
  });

  it("clears Tier 1 to non-pending for confidence A or B", () => {
    expect(applyConfidenceGate("TIER_1", "A").tierPending).toBe(false);
    expect(applyConfidenceGate("TIER_1", "B").tierPending).toBe(false);
  });

  it("never pends non-Tier-1 tiers regardless of confidence", () => {
    expect(applyConfidenceGate("TIER_2", "C").tierPending).toBe(false);
    expect(applyConfidenceGate("WATCHLIST", "C").tierPending).toBe(false);
  });
});
