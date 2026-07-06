import type { ConfidenceGrade, Tier } from "./types";

export function tierFromScore(total: number): Tier {
  if (total >= 80) return "TIER_1";
  if (total >= 65) return "TIER_2";
  if (total >= 50) return "TIER_3";
  return "WATCHLIST";
}

/**
 * Tier 1 requires Confidence >= B (Section 7.8). A Confidence-C org that scores
 * >= 80 still surfaces as Tier 1, but flagged pending verification rather than
 * demoted — the score stands, the trust in it doesn't, yet.
 */
export function applyConfidenceGate(
  tier: Tier,
  confidenceGrade: ConfidenceGrade
): { tier: Tier; tierPending: boolean } {
  if (tier === "TIER_1" && confidenceGrade === "C") {
    return { tier, tierPending: true };
  }
  return { tier, tierPending: false };
}

export const TIER_LABELS: Record<Tier, string> = {
  TIER_1: "Tier 1 — Engage now",
  TIER_2: "Tier 2 — Active cultivation",
  TIER_3: "Tier 3 — Nurture",
  WATCHLIST: "Watchlist",
};
