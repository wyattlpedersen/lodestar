import type {
  ProPublicaFiling,
  ProPublicaOrgDetailResponse,
} from "./client";
import { nteeMajorFromCode } from "./ntee";
import { countyForCity } from "@/lib/bay-area-counties";

export type OrgType =
  | "private_foundation"
  | "community_foundation"
  | "university"
  | "hospital_health"
  | "cultural"
  | "other_operating";

export interface MappedOrganization {
  ein: string;
  name: string;
  nteeCode: string | null;
  nteeMajor: number | null;
  subsection: number | null;
  city: string | null;
  county: string | null;
  state: string | null;
  fyeMonth: number | null;
  orgType: OrgType;
  latestAssets: number | null;
  latestFilingYear: number | null;
}

export interface MappedFiling {
  taxYear: number;
  formType: string;
  totalRevenue: number | null;
  totalExpenses: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  contributions: number | null;
  pdfUrl: string | null;
}

/** ProPublica `formtype` -> a human label. `formtype_str` isn't always present, so we keep our own map. */
const FORM_TYPE_LABELS: Record<number, string> = {
  0: "990",
  1: "990-EZ",
  2: "990-PF",
};

function formTypeLabel(formtype: number, fallback?: string): string {
  return FORM_TYPE_LABELS[formtype] ?? fallback ?? `form-${formtype}`;
}

/**
 * Contributions field name differs by form type (see ASSUMPTIONS.md):
 * 990-PF uses `grscontrgifts`, standard 990 uses `totcntrbgfts`. Take whichever exists.
 */
function contributionsOf(f: ProPublicaFiling): number | null {
  if (typeof f.grscontrgifts === "number") return f.grscontrgifts;
  if (typeof f.totcntrbgfts === "number") return f.totcntrbgfts;
  return null;
}

export function mapFilings(detail: ProPublicaOrgDetailResponse): MappedFiling[] {
  return detail.filings_with_data
    .filter((f) => f.tax_prd_yr != null)
    .map((f) => ({
      taxYear: f.tax_prd_yr,
      formType: formTypeLabel(f.formtype, f.formtype_str),
      totalRevenue: f.totrevenue ?? null,
      totalExpenses: f.totfuncexpns ?? null,
      totalAssets: f.totassetsend ?? null,
      totalLiabilities: f.totliabend ?? null,
      contributions: contributionsOf(f),
      pdfUrl: f.pdf_url ?? null,
    }))
    .sort((a, b) => b.taxYear - a.taxYear);
}

/**
 * The API gives no direct org-type taxonomy, so this is a name/NTEE/foundation-code
 * heuristic — logged as an assumption. `foundation_code` 2-4 roughly correspond to
 * private-foundation IRS classifications; everything else falls back to keyword and
 * NTEE-based guesses.
 */
function inferOrgType(
  name: string,
  nteeCode: string | null,
  foundationCode: number | null
): OrgType {
  const n = name.toLowerCase();
  if (n.includes("community foundation")) return "community_foundation";
  if (
    n.includes("university") ||
    n.includes("college") ||
    (nteeCode?.startsWith("B4") ?? false) ||
    (nteeCode?.startsWith("B5") ?? false)
  )
    return "university";
  if (
    n.includes("hospital") ||
    n.includes("health") ||
    n.includes("medical") ||
    (nteeCode?.startsWith("E") ?? false)
  )
    return "hospital_health";
  if (foundationCode != null && [2, 3, 4].includes(foundationCode))
    return "private_foundation";
  if (
    n.includes("museum") ||
    n.includes("symphony") ||
    n.includes("opera") ||
    n.includes("ballet") ||
    n.includes("art") ||
    (nteeCode?.startsWith("A") ?? false)
  )
    return "cultural";
  return "other_operating";
}

export function mapOrganization(
  detail: ProPublicaOrgDetailResponse
): MappedOrganization {
  const org = detail.organization;
  const filings = mapFilings(detail);
  const latest = filings[0];
  const ein = String(org.ein);
  const nteeCode = org.ntee_code ?? null;
  const accountingPeriod =
    typeof org.accounting_period === "number" ? org.accounting_period : null;
  const taxPeriod = typeof org.tax_period === "string" ? org.tax_period : null;
  const fyeMonth =
    accountingPeriod ?? (taxPeriod ? Number(taxPeriod.slice(5, 7)) : null);

  return {
    ein,
    name: org.name,
    nteeCode,
    nteeMajor: nteeMajorFromCode(nteeCode),
    subsection: typeof org.subsection_code === "number" ? org.subsection_code : null,
    city: org.city ?? null,
    county: countyForCity(org.city),
    state: org.state ?? null,
    fyeMonth: fyeMonth ?? null,
    orgType: inferOrgType(
      org.name,
      nteeCode,
      typeof org.foundation_code === "number" ? org.foundation_code : null
    ),
    latestAssets: latest?.totalAssets ?? (typeof org.asset_amount === "number" ? org.asset_amount : null),
    latestFilingYear: latest?.taxYear ?? null,
  };
}
