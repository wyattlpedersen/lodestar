import "server-only";
import { db } from "@/lib/db";
import {
  filings as filingsTable,
  manualFacts as manualFactsTable,
  organizations,
  signals as signalsTable,
} from "@/lib/db/schema";
import { computeDerivedFinancials, type FilingLike } from "@/lib/derived-financials";
import { cagrPercentileWithinCohort, type CohortMember } from "./cohort";
import type { ScoringInput } from "./types";

function monthsBetween(taxYear: number, fyeMonth: number | null, today: Date): number {
  const fyeEnd = new Date(Date.UTC(taxYear, (fyeMonth ?? 12) - 1, 28));
  const months =
    (today.getUTCFullYear() - fyeEnd.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - fyeEnd.getUTCMonth());
  return Math.max(0, months);
}

function groupBy<T, K extends string | number>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/**
 * Loads the entire universe's organizations/filings/signals/manual_facts in four
 * bulk queries (not one-per-org), then builds a `ScoringInput` for every org from
 * in-memory data. This is what both the Rankings Board (score everyone) and a
 * single Dossier's Score tab (score one org, but still needs the full cohort for
 * percentile math) run against.
 *
 * People/affiliations-derived factors (warm path, super-connector, wealth
 * trustee counts) default to false/0 until Phase 3 wires the trustee graph in.
 */
export async function buildScoringInputsForUniverse(
  today: Date = new Date()
): Promise<ScoringInput[]> {
  const [orgs, allFilings, allSignals, allFacts] = await Promise.all([
    db.select().from(organizations),
    db.select().from(filingsTable),
    db.select().from(signalsTable),
    db.select().from(manualFactsTable),
  ]);

  const filingsByEin = groupBy(allFilings, (f) => f.ein);
  const signalsByEin = groupBy(allSignals, (s) => s.ein);
  const factsByEin = groupBy(allFacts, (f) => f.ein);

  const derivedByEin = new Map<string, ReturnType<typeof computeDerivedFinancials>>();
  for (const org of orgs) {
    const orgFilings = (filingsByEin.get(org.ein) ?? [])
      .slice()
      .sort((a, b) => b.taxYear - a.taxYear);
    derivedByEin.set(org.ein, computeDerivedFinancials(orgFilings as FilingLike[]));
  }

  const cohortMembers: CohortMember[] = orgs.map((o) => ({
    ein: o.ein,
    nteeMajor: o.nteeMajor,
    latestAssets: o.latestAssets,
    cagr5yr: derivedByEin.get(o.ein)?.cagr5yr ?? null,
  }));

  return orgs.map((org) => {
    const orgFilings = (filingsByEin.get(org.ein) ?? [])
      .slice()
      .sort((a, b) => b.taxYear - a.taxYear);
    const orgSignals = signalsByEin.get(org.ein) ?? [];
    const facts = factsByEin.get(org.ein) ?? [];
    const factMap = Object.fromEntries(facts.map((f) => [f.key, f.value]));
    const derived = derivedByEin.get(org.ein)!;
    const latest = orgFilings[0];

    const cagr5yrPercentile = cagrPercentileWithinCohort(
      org.ein,
      org.nteeMajor,
      org.latestAssets,
      derived.cagr5yr,
      cohortMembers
    );

    const latestFilingAgeMonths = latest ? monthsBetween(latest.taxYear, org.fyeMonth, today) : null;
    const yearsWithFinancialData = orgFilings.filter((f) => f.totalAssets != null).length;
    const activeSignalsWithSourceCount = orgSignals.filter((s) => s.active && !!s.sourceUrl).length;

    const feeRatio =
      factMap.mgmt_fees_usd && org.latestAssets
        ? Number(factMap.mgmt_fees_usd) / org.latestAssets
        : null;

    const yoyContribUp = derived.yoyContributionsDelta != null && derived.yoyContributionsDelta > 0;

    const input: ScoringInput = {
      ein: org.ein,
      name: org.name,
      orgType: org.orgType,
      latestAssets: org.latestAssets,
      signals: orgSignals.map((s) => ({
        id: s.id,
        type: s.type,
        headline: s.headline,
        basePoints: s.basePoints,
        halfLifeDays: s.halfLifeDays,
        isPersistent: s.isPersistent,
        eventDate: s.eventDate,
        active: s.active,
        hasSourceUrl: !!s.sourceUrl,
        tag: s.tag,
      })),
      access: {
        hasWarmPath: false,
        hasSecondDegreePath: false,
        jpmAlumOnBoard: false,
        superConnectorOnBoard: false,
        hqInCoverageMetro: org.county != null,
      },
      wealth: {
        livingFounderContributing: factMap.founder_living === "true",
        founderLiquiditySignalActive: orgSignals.some(
          (s) => s.type === "FOUNDER_LIQUIDITY" && s.active
        ),
        familyMembersOnBoardCount: 0,
        corporateFoundationWithCSuite: false,
        principalUhnwTrusteeCount: 0,
      },
      need: {
        feeRatio,
        hasCompensatedInvestmentOfficer:
          factMap.has_paid_cio != null ? factMap.has_paid_cio === "true" : null,
        pctCashPublicEquities:
          factMap.pct_cash_public != null ? Number(factMap.pct_cash_public) : null,
        singleManagerConcentration:
          factMap.single_manager != null ? factMap.single_manager === "true" : null,
      },
      growth: {
        cagr5yrPercentile,
        contributionMomentumPositiveAccelerating: yoyContribUp,
        creditTreasuryFit:
          org.orgType === "university" ||
          org.orgType === "hospital_health" ||
          (latest?.totalLiabilities != null &&
            latest?.totalAssets != null &&
            latest.totalAssets > 0 &&
            latest.totalLiabilities / latest.totalAssets > 0.3),
        custodyDafPlannedGivingFit: org.orgType === "community_foundation",
      },
      confidence: {
        latestFilingAgeMonths,
        yearsWithFinancialData,
        activeSignalsWithSourceCount,
        analystVerified: org.verified,
      },
      derived: { cagr3yr: derived.cagr3yr, cagr5yr: derived.cagr5yr },
    };

    return input;
  });
}

export async function buildScoringInput(
  ein: string,
  today: Date = new Date()
): Promise<ScoringInput | null> {
  const all = await buildScoringInputsForUniverse(today);
  return all.find((i) => i.ein === ein) ?? null;
}
