import type { FilingLike } from "@/lib/derived-financials";
import { assetBandFor, percentileOf, sameCohort } from "./cohort";

export interface PeerCohortMember {
  ein: string;
  nteeMajor: number | null;
  latestAssets: number | null;
  cagr5yr: number | null;
  payoutRatioProxy: number | null;
  feeRatio: number | null;
  contributionVolatility: number | null;
}

export interface PeerMetric {
  key: "cagr5yr" | "payoutRatioProxy" | "contributionVolatility" | "feeRatio";
  label: string;
  value: number | null;
  percentile: number | null; // 0-100, higher = better for cagr5yr; for the others, higher = more of that metric (context-dependent, see label)
  provenance: "API" | "MANUAL";
}

/** Population stdev of YoY contribution % deltas — requires >=3 years of contributions data. */
export function contributionVolatility(filings: FilingLike[]): number | null {
  const sorted = filings.slice().sort((a, b) => b.taxYear - a.taxYear);
  const deltas: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i].contributions;
    const prev = sorted[i + 1].contributions;
    if (cur != null && prev != null && prev !== 0) {
      deltas.push((cur - prev) / Math.abs(prev));
    }
  }
  if (deltas.length < 2) return null;
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deltas.length;
  return Math.sqrt(variance);
}

export function computePeerBenchmark(
  member: PeerCohortMember,
  cohort: PeerCohortMember[]
): PeerMetric[] {
  const band = assetBandFor(member.latestAssets);
  const peers = band
    ? cohort.filter((m) => sameCohort(member.ein, member.nteeMajor, band.label, m))
    : [];

  function pct(selector: (m: PeerCohortMember) => number | null, myValue: number | null): number | null {
    if (myValue == null) return null;
    const values = peers.map(selector).filter((v): v is number => v != null);
    return percentileOf(myValue, values);
  }

  return [
    {
      key: "cagr5yr",
      label: "5yr net-asset CAGR",
      value: member.cagr5yr,
      percentile: pct((m) => m.cagr5yr, member.cagr5yr),
      provenance: "API",
    },
    {
      key: "payoutRatioProxy",
      label: "Payout ratio (proxy)",
      value: member.payoutRatioProxy,
      percentile: pct((m) => m.payoutRatioProxy, member.payoutRatioProxy),
      provenance: "API",
    },
    {
      key: "contributionVolatility",
      label: "Contribution volatility",
      value: member.contributionVolatility,
      percentile: pct((m) => m.contributionVolatility, member.contributionVolatility),
      provenance: "API",
    },
    {
      key: "feeRatio",
      label: "Fee ratio",
      value: member.feeRatio,
      percentile: pct((m) => m.feeRatio, member.feeRatio),
      provenance: "MANUAL",
    },
  ];
}
