export interface FilingLike {
  taxYear: number;
  totalRevenue: number | null;
  totalExpenses: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  contributions: number | null;
}

export interface DerivedFinancials {
  yoyAssetsDelta: number | null;
  yoyRevenueDelta: number | null;
  yoyExpensesDelta: number | null;
  yoyContributionsDelta: number | null;
  cagr3yr: number | null;
  cagr5yr: number | null;
  payoutRatioProxy: number | null;
}

function pctDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function cagr(
  filings: FilingLike[],
  latest: FilingLike,
  years: number
): number | null {
  const target = filings.find((f) => f.taxYear === latest.taxYear - years);
  if (!target || target.totalAssets == null || latest.totalAssets == null) return null;
  if (target.totalAssets <= 0 || latest.totalAssets <= 0) return null;
  return Math.pow(latest.totalAssets / target.totalAssets, 1 / years) - 1;
}

/**
 * `filings` must be sorted descending by taxYear (most recent first), matching
 * `mapFilings`'s output order. CAGR requires an exact filing at latest-N years —
 * we never interpolate or estimate a missing year (Section 5 requirement).
 */
export function computeDerivedFinancials(
  filings: FilingLike[]
): DerivedFinancials {
  const latest = filings[0];
  if (!latest) {
    return {
      yoyAssetsDelta: null,
      yoyRevenueDelta: null,
      yoyExpensesDelta: null,
      yoyContributionsDelta: null,
      cagr3yr: null,
      cagr5yr: null,
      payoutRatioProxy: null,
    };
  }

  const prior = filings.find((f) => f.taxYear === latest.taxYear - 1) ?? null;

  const avgAssets =
    latest.totalAssets != null && prior?.totalAssets != null
      ? (latest.totalAssets + prior.totalAssets) / 2
      : latest.totalAssets;

  const payoutRatioProxy =
    latest.totalExpenses != null && avgAssets != null && avgAssets > 0
      ? latest.totalExpenses / avgAssets
      : null;

  return {
    yoyAssetsDelta: pctDelta(latest.totalAssets, prior?.totalAssets ?? null),
    yoyRevenueDelta: pctDelta(latest.totalRevenue, prior?.totalRevenue ?? null),
    yoyExpensesDelta: pctDelta(latest.totalExpenses, prior?.totalExpenses ?? null),
    yoyContributionsDelta: pctDelta(
      latest.contributions,
      prior?.contributions ?? null
    ),
    cagr3yr: cagr(filings, latest, 3),
    cagr5yr: cagr(filings, latest, 5),
    payoutRatioProxy,
  };
}
