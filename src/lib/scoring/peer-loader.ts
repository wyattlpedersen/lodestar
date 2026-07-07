import { db } from "@/lib/db";
import { filings as filingsTable, manualFacts as manualFactsTable, organizations } from "@/lib/db/schema";
import { computeDerivedFinancials, type FilingLike } from "@/lib/derived-financials";
import { computePeerBenchmark, contributionVolatility, type PeerCohortMember } from "./peer-benchmarking";
import { assetBandFor, sameCohort } from "./cohort";
import { nteeMajorLabel } from "@/lib/propublica/ntee";

export interface PeerListEntry {
  ein: string;
  name: string;
  latestAssets: number | null;
  cagr5yr: number | null;
  payoutRatioProxy: number | null;
}

export interface PeerBenchmarkResult {
  metrics: ReturnType<typeof computePeerBenchmark>;
  cohortLabel: string | null;
  peers: PeerListEntry[];
}

export async function loadPeerBenchmark(ein: string): Promise<PeerBenchmarkResult | null> {
  const [orgs, allFilings, allFacts] = await Promise.all([
    db.select().from(organizations),
    db.select().from(filingsTable),
    db.select().from(manualFactsTable),
  ]);

  const filingsByEin = new Map<string, typeof allFilings>();
  for (const f of allFilings) {
    if (!filingsByEin.has(f.ein)) filingsByEin.set(f.ein, []);
    filingsByEin.get(f.ein)!.push(f);
  }
  const factsByEin = new Map<string, typeof allFacts>();
  for (const f of allFacts) {
    if (!factsByEin.has(f.ein)) factsByEin.set(f.ein, []);
    factsByEin.get(f.ein)!.push(f);
  }

  const cohort: (PeerCohortMember & { name: string })[] = orgs.map((org) => {
    const orgFilings = (filingsByEin.get(org.ein) ?? []) as FilingLike[];
    const derived = computeDerivedFinancials(orgFilings);
    const facts = Object.fromEntries((factsByEin.get(org.ein) ?? []).map((f) => [f.key, f.value]));
    const feeRatio = facts.mgmt_fees_usd && org.latestAssets ? Number(facts.mgmt_fees_usd) / org.latestAssets : null;
    return {
      ein: org.ein,
      name: org.name,
      nteeMajor: org.nteeMajor,
      latestAssets: org.latestAssets,
      cagr5yr: derived.cagr5yr,
      payoutRatioProxy: derived.payoutRatioProxy,
      feeRatio,
      contributionVolatility: contributionVolatility(orgFilings),
    };
  });

  const me = cohort.find((m) => m.ein === ein);
  if (!me) return null;

  const metrics = computePeerBenchmark(me, cohort);

  const band = assetBandFor(me.latestAssets);
  const cohortLabel = band ? `${nteeMajorLabel(me.nteeMajor)} · ${band.label} in assets` : null;

  const peers: PeerListEntry[] = band
    ? cohort
        .filter((m) => sameCohort(ein, me.nteeMajor, band.label, m))
        .sort((a, b) => (b.latestAssets ?? 0) - (a.latestAssets ?? 0))
        .slice(0, 10)
        .map((m) => ({
          ein: m.ein,
          name: m.name,
          latestAssets: m.latestAssets,
          cagr5yr: m.cagr5yr,
          payoutRatioProxy: m.payoutRatioProxy,
        }))
    : [];

  return { metrics, cohortLabel, peers };
}
