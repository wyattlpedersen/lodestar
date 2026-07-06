import type { NeedVulnerabilityFacts } from "@/lib/scoring/types";

export interface Objection {
  objection: string;
  counter: string;
}

/**
 * Three canned objections with profile-tailored counters (Section 9 F9). The
 * counter wording adapts to whatever manual-assisted facts are on file; the
 * objection set itself is fixed (all three always show — spec calls for
 * "3 canned objections + responses", with the *responses* selected by profile).
 */
export function buildObjectionPrep(need: NeedVulnerabilityFacts): Objection[] {
  const feeCounter =
    need.feeRatio != null && need.feeRatio >= 0.006
      ? `Your current fee ratio runs ${(need.feeRatio * 100).toFixed(
          2
        )}% of assets — worth a benchmark conversation even if the relationship stays put.`
      : "Even a strong consultant relationship benefits from a periodic outside benchmark — no obligation, just data.";

  const internalTeamCounter =
    need.hasCompensatedInvestmentOfficer === false
      ? "Without a dedicated compensated investment officer, most committees find real value in an institutional partner handling implementation while staying in the decision seat."
      : "A strong internal team and an institutional partner aren't mutually exclusive — many peers use both for different parts of the mandate.";

  const simplicityCounter =
    need.pctCashPublicEquities != null && need.pctCashPublicEquities >= 0.6
      ? `A simple allocation is a reasonable choice — though at ~${(
          need.pctCashPublicEquities * 100
        ).toFixed(0)}% cash and public equities, there may be room to add diversification without adding much complexity.`
      : "Simplicity is a legitimate strategy — the conversation worth having is whether it's costing return versus a modestly more diversified approach.";

  return [
    {
      objection: "We're happy with our current consultant.",
      counter: feeCounter,
    },
    {
      objection: "We have an internal team handling this.",
      counter: internalTeamCounter,
    },
    {
      objection: "We keep our portfolio simple on purpose.",
      counter: simplicityCounter,
    },
  ];
}
