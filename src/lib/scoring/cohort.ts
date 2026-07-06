/** Peer cohort = same NTEE major + asset band (Section 7.6, reused by F11 Peer Benchmarking). */
export const ASSET_BANDS = [
  { label: "$10–25M", min: 10_000_000, max: 25_000_000 },
  { label: "$25–100M", min: 25_000_000, max: 100_000_000 },
  { label: "$100–500M", min: 100_000_000, max: 500_000_000 },
  { label: "$500M–1B", min: 500_000_000, max: 1_000_000_000 },
  { label: "$1B+", min: 1_000_000_000, max: Infinity },
] as const;

export function assetBandFor(assets: number | null): (typeof ASSET_BANDS)[number] | null {
  if (assets == null || assets < ASSET_BANDS[0].min) return null;
  return ASSET_BANDS.find((b) => assets >= b.min && assets < b.max) ?? ASSET_BANDS[ASSET_BANDS.length - 1];
}

export interface CohortMember {
  ein: string;
  nteeMajor: number | null;
  latestAssets: number | null;
  cagr5yr: number | null;
}

/** Generic percentile-within-cohort: what % of `values` does `value` beat-or-tie? Requires >=2 comparison points. */
export function percentileOf(value: number, values: number[]): number | null {
  if (values.length < 2) return null;
  const betterOrEqual = values.filter((v) => v <= value).length;
  return (betterOrEqual / values.length) * 100;
}

export function sameCohort(
  ein: string,
  nteeMajor: number | null,
  bandLabel: string,
  m: { ein: string; nteeMajor: number | null; latestAssets: number | null }
): boolean {
  return m.ein !== ein && m.nteeMajor === nteeMajor && assetBandFor(m.latestAssets)?.label === bandLabel;
}

/**
 * Percentile of `orgCagr` within its cohort's CAGR distribution (0-100, higher is
 * better). Requires at least 2 other cohort members with a CAGR value — otherwise
 * `null` (never fabricate a percentile from an empty or single-org cohort).
 */
export function cagrPercentileWithinCohort(
  ein: string,
  nteeMajor: number | null,
  assets: number | null,
  orgCagr: number | null,
  universe: CohortMember[]
): number | null {
  if (orgCagr == null) return null;
  const band = assetBandFor(assets);
  if (!band) return null;

  const cohort = universe.filter(
    (m) =>
      m.ein !== ein &&
      m.nteeMajor === nteeMajor &&
      assetBandFor(m.latestAssets)?.label === band.label &&
      m.cagr5yr != null
  );
  if (cohort.length < 2) return null;

  const values = cohort.map((m) => m.cagr5yr as number);
  const betterOrEqual = values.filter((v) => v <= orgCagr).length;
  return (betterOrEqual / values.length) * 100;
}
