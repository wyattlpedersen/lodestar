import { db } from "@/lib/db";
import { filings as filingsTable, manualFacts as manualFactsTable, organizations } from "@/lib/db/schema";
import { computeDerivedFinancials, type FilingLike } from "@/lib/derived-financials";
import { computePeerBenchmark, contributionVolatility, type PeerCohortMember } from "./peer-benchmarking";

export async function loadPeerBenchmark(ein: string) {
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

  const cohort: PeerCohortMember[] = orgs.map((org) => {
    const orgFilings = (filingsByEin.get(org.ein) ?? []) as FilingLike[];
    const derived = computeDerivedFinancials(orgFilings);
    const facts = Object.fromEntries((factsByEin.get(org.ein) ?? []).map((f) => [f.key, f.value]));
    const feeRatio = facts.mgmt_fees_usd && org.latestAssets ? Number(facts.mgmt_fees_usd) / org.latestAssets : null;
    return {
      ein: org.ein,
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

  return computePeerBenchmark(me, cohort);
}
