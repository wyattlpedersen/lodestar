import { db } from "@/lib/db";
import { organizations, filings, pipeline } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getOrganizationDetail } from "./client";
import { mapOrganization, mapFilings } from "./mapper";
import { syncAutoSignals } from "@/lib/signals/sync";

/**
 * Fetches (cache-first, unless `force`) and persists one org's detail + filings.
 * Filings are fully API-derived, so each hydration replaces them wholesale; the
 * `organizations` row is upserted so `created_at` and any future manual overrides
 * on non-API columns survive a refresh.
 */
export async function hydrateOrganization(ein: string, opts: { force?: boolean } = {}) {
  const detail = await getOrganizationDetail(ein, opts);
  const mappedOrg = mapOrganization(detail);
  const mappedFilings = mapFilings(detail);

  await db
    .insert(organizations)
    .values({
      ein: mappedOrg.ein,
      name: mappedOrg.name,
      nteeCode: mappedOrg.nteeCode,
      nteeMajor: mappedOrg.nteeMajor,
      subsection: mappedOrg.subsection,
      city: mappedOrg.city,
      county: mappedOrg.county,
      state: mappedOrg.state,
      fyeMonth: mappedOrg.fyeMonth,
      orgType: mappedOrg.orgType,
      latestAssets: mappedOrg.latestAssets,
      latestFilingYear: mappedOrg.latestFilingYear,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .onConflictDoUpdate({
      target: organizations.ein,
      set: {
        name: mappedOrg.name,
        nteeCode: mappedOrg.nteeCode,
        nteeMajor: mappedOrg.nteeMajor,
        subsection: mappedOrg.subsection,
        city: mappedOrg.city,
        county: mappedOrg.county,
        state: mappedOrg.state,
        fyeMonth: mappedOrg.fyeMonth,
        orgType: mappedOrg.orgType,
        latestAssets: mappedOrg.latestAssets,
        latestFilingYear: mappedOrg.latestFilingYear,
        updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      },
    });

  await db.delete(filings).where(eq(filings.ein, mappedOrg.ein));
  if (mappedFilings.length > 0) {
    await db.insert(filings).values(
      mappedFilings.map((f) => ({
        ein: mappedOrg.ein,
        taxYear: f.taxYear,
        formType: f.formType,
        totalRevenue: f.totalRevenue,
        totalExpenses: f.totalExpenses,
        totalAssets: f.totalAssets,
        totalLiabilities: f.totalLiabilities,
        contributions: f.contributions,
        pdfUrl: f.pdfUrl,
      }))
    );
  }

  await db
    .insert(pipeline)
    .values({ ein: mappedOrg.ein, stage: "identified" })
    .onConflictDoNothing();

  const autoSignals = await syncAutoSignals(mappedOrg.ein);

  return { organization: mappedOrg, filings: mappedFilings, autoSignals };
}
