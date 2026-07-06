import type { FilingLike } from "@/lib/derived-financials";
import { computeDerivedFinancials, filingAtYearsAgo } from "@/lib/derived-financials";
import { SIGNAL_TAXONOMY_BY_CODE } from "./taxonomy";

/**
 * No external market-data feed is in scope (Section 4 lists none), so the "70/30
 * proxy" benchmark PERFORMANCE_GAP compares against is a static long-run nominal
 * return assumption for a 70% equity / 30% bond blend. Logged in ASSUMPTIONS.md.
 */
export const ASSUMED_70_30_ANNUAL_RETURN = 0.07;

export interface AutoSignalCandidate {
  type: string;
  headline: string;
  detail: string;
  eventDate: string; // ISO yyyy-mm-dd
  basePoints: number;
  halfLifeDays: number | null;
  isPersistent: boolean;
}

function filingYearEndIso(taxYear: number, fyeMonth: number | null): string {
  const month = fyeMonth ?? 12;
  const lastDay = new Date(Date.UTC(taxYear, month, 0)).getUTCDate();
  return `${taxYear}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Pure function: given one org's filings (desc by year) and its manual facts,
 * returns every AUTO signal condition currently true. Reconciling these against
 * what's already stored (avoiding duplicate rows, dropping cleared persistent
 * conditions) is `syncAutoSignals`'s job — this function has no DB access.
 */
export function deriveAutoSignals(
  filings: FilingLike[],
  fyeMonth: number | null,
  factMap: Record<string, string>,
  today: Date
): AutoSignalCandidate[] {
  const candidates: AutoSignalCandidate[] = [];
  const latest = filings[0];
  if (!latest) return candidates;

  const derived = computeDerivedFinancials(filings);
  const latestEventDate = filingYearEndIso(latest.taxYear, fyeMonth);

  // PERFORMANCE_GAP (persistent)
  if (derived.cagr2yr != null) {
    const gap = derived.cagr2yr - ASSUMED_70_30_ANNUAL_RETURN;
    if (gap < -0.03) {
      const t = SIGNAL_TAXONOMY_BY_CODE.PERFORMANCE_GAP;
      candidates.push({
        type: "PERFORMANCE_GAP",
        headline: "Asset growth trails 70/30 benchmark proxy",
        detail: `2yr asset CAGR ${pct(derived.cagr2yr)} vs. ${pct(
          ASSUMED_70_30_ANNUAL_RETURN
        )} 70/30 proxy (${pct(gap)} gap)`,
        eventDate: filingYearEndIso(today.getUTCFullYear(), today.getUTCMonth() + 1),
        basePoints: t.basePoints,
        halfLifeDays: null,
        isPersistent: true,
      });
    }
  }

  // SPENDING_STRESS (persistent)
  const assets2yrAgo = filingAtYearsAgo(filings, latest.taxYear, 2)?.totalAssets ?? null;
  const twoYearDecline =
    assets2yrAgo != null && latest.totalAssets != null && latest.totalAssets < assets2yrAgo;
  if (derived.payoutRatioProxy != null && derived.payoutRatioProxy > 0.055 && twoYearDecline) {
    const t = SIGNAL_TAXONOMY_BY_CODE.SPENDING_STRESS;
    candidates.push({
      type: "SPENDING_STRESS",
      headline: "Payout proxy exceeds 5.5% amid a 2yr asset decline",
      detail: `Payout proxy ${pct(derived.payoutRatioProxy)}, assets down from prior 2yr filing`,
      eventDate: filingYearEndIso(today.getUTCFullYear(), today.getUTCMonth() + 1),
      basePoints: t.basePoints,
      halfLifeDays: null,
      isPersistent: true,
    });
  }

  // CONTRIB_SPIKE — requires 3 full prior years of contributions data, never estimated
  const priorYears = [1, 2, 3].map((n) => filingAtYearsAgo(filings, latest.taxYear, n));
  if (priorYears.every((f) => f?.contributions != null) && latest.contributions != null) {
    const avgPrior =
      priorYears.reduce((sum, f) => sum + (f!.contributions as number), 0) / 3;
    if (avgPrior > 0 && latest.contributions > 2 * avgPrior) {
      const t = SIGNAL_TAXONOMY_BY_CODE.CONTRIB_SPIKE;
      candidates.push({
        type: "CONTRIB_SPIKE",
        headline: "Contributions spike vs. trailing 3yr average",
        detail: `${latest.taxYear} contributions ${latest.contributions.toLocaleString()} vs. 3yr avg ${Math.round(
          avgPrior
        ).toLocaleString()}`,
        eventDate: latestEventDate,
        basePoints: t.basePoints,
        halfLifeDays: t.halfLifeDays,
        isPersistent: false,
      });
    }
  }

  // FEE_SPIKE — only fires when the analyst has entered both current and prior fee figures
  const feeNow = factMap.mgmt_fees_usd ? Number(factMap.mgmt_fees_usd) : null;
  const feePrior = factMap.mgmt_fees_usd_prior ? Number(factMap.mgmt_fees_usd_prior) : null;
  if (feeNow != null && feePrior != null && feePrior > 0 && feeNow / feePrior >= 1.5) {
    const t = SIGNAL_TAXONOMY_BY_CODE.FEE_SPIKE;
    candidates.push({
      type: "FEE_SPIKE",
      headline: "Mgmt/investment fees up 50%+ YoY",
      detail: `$${feeNow.toLocaleString()} vs. $${feePrior.toLocaleString()} prior year`,
      eventDate: `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(
        today.getUTCDate()
      ).padStart(2, "0")}`,
      basePoints: t.basePoints,
      halfLifeDays: t.halfLifeDays,
      isPersistent: false,
    });
  }

  // ASSET_DROP
  if (derived.yoyAssetsDelta != null && derived.yoyAssetsDelta <= -0.15) {
    const t = SIGNAL_TAXONOMY_BY_CODE.ASSET_DROP;
    candidates.push({
      type: "ASSET_DROP",
      headline: "Total assets down 15%+ YoY",
      detail: `YoY assets ${pct(derived.yoyAssetsDelta)}`,
      eventDate: latestEventDate,
      basePoints: t.basePoints,
      halfLifeDays: t.halfLifeDays,
      isPersistent: false,
    });
  }

  return candidates;
}
