import "server-only";
import { db } from "@/lib/db";
import { rawApiCache } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

const BASE_URL = "https://projects.propublica.org/nonprofits/api/v2";
const MIN_INTERVAL_MS = 1000;
const MAX_RETRIES = 4;

/** Serializes all outbound ProPublica requests to ~1/sec, in-process. */
class RequestQueue {
  private queue: Promise<unknown> = Promise.resolve();
  private lastStart = 0;

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const wait = Math.max(0, this.lastStart + MIN_INTERVAL_MS - Date.now());
      if (wait > 0) await sleep(wait);
      this.lastStart = Date.now();
      return fn();
    });
    // Keep the chain alive even if this call rejects, so later calls aren't blocked forever.
    this.queue = result.catch(() => undefined);
    return result as Promise<T>;
  }
}

const queue = new RequestQueue();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBackoff(url: string): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, {
      headers: { "User-Agent": "LODESTAR/1.0 (private-bank prospecting demo)" },
    });
    if (res.ok) {
      return res.json();
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const backoffMs = 1000 * Math.pow(2, attempt);
      await sleep(backoffMs);
      attempt += 1;
      continue;
    }
    throw new Error(`ProPublica API request failed: ${res.status} ${res.statusText} (${url})`);
  }
}

async function getCached(url: string): Promise<unknown | null> {
  const rows = await db
    .select()
    .from(rawApiCache)
    .where(eq(rawApiCache.url, url))
    .orderBy(desc(rawApiCache.fetchedAt))
    .limit(1);
  return rows[0]?.payload ?? null;
}

async function persist(url: string, payload: unknown) {
  await db.insert(rawApiCache).values({ url, payload: payload as object });
}

/**
 * Fetches a ProPublica URL, throttled to ~1/sec with exponential backoff on 429/5xx.
 * Reads from `raw_api_cache` first unless `force` is set; every network response is
 * persisted to the cache before being returned.
 */
export async function fetchProPublica(
  url: string,
  { force = false }: { force?: boolean } = {}
): Promise<unknown> {
  if (!force) {
    const cached = await getCached(url);
    if (cached !== null) return cached;
  }
  const payload = await queue.schedule(() => fetchWithBackoff(url));
  await persist(url, payload);
  return payload;
}

export interface SearchParams {
  q?: string;
  stateId?: string;
  nteeId?: number;
  cCode?: number;
  page?: number;
}

export function buildSearchUrl(params: SearchParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.stateId) sp.set("state[id]", params.stateId);
  if (params.nteeId != null) sp.set("ntee[id]", String(params.nteeId));
  if (params.cCode != null) sp.set("c_code[id]", String(params.cCode));
  if (params.page != null) sp.set("page", String(params.page));
  return `${BASE_URL}/search.json?${sp.toString()}`;
}

export function buildOrgDetailUrl(ein: string): string {
  return `${BASE_URL}/organizations/${ein}.json`;
}

export async function searchOrganizations(
  params: SearchParams,
  opts: { force?: boolean } = {}
) {
  return fetchProPublica(buildSearchUrl(params), opts) as Promise<ProPublicaSearchResponse>;
}

export async function getOrganizationDetail(
  ein: string,
  opts: { force?: boolean } = {}
) {
  return fetchProPublica(buildOrgDetailUrl(ein), opts) as Promise<ProPublicaOrgDetailResponse>;
}

// --- Real response shapes, verified live 2026-07-06 (see ASSUMPTIONS.md) ---

export interface ProPublicaSearchOrg {
  ein: number;
  strein: string;
  name: string;
  sub_name: string | null;
  city: string | null;
  state: string | null;
  ntee_code: string | null;
  raw_ntee_code: string | null;
  subseccd: number | null;
  has_subseccd: boolean;
  score: number;
}

export interface ProPublicaSearchResponse {
  total_results: number;
  organizations: ProPublicaSearchOrg[];
  num_pages: number;
  cur_page: number;
  page_offset: number;
  per_page: number;
}

export interface ProPublicaFiling {
  tax_prd: number;
  tax_prd_yr: number;
  formtype: number;
  formtype_str?: string;
  pdf_url: string | null;
  totrevenue?: number | null;
  totfuncexpns?: number | null;
  totassetsend?: number | null;
  totliabend?: number | null;
  grscontrgifts?: number | null;
  totcntrbgfts?: number | null;
  [key: string]: unknown;
}

export interface ProPublicaOrganization {
  id: number;
  ein: number;
  name: string;
  address?: string | null;
  city: string | null;
  state: string | null;
  zipcode?: string | null;
  ntee_code: string | null;
  subsection_code: number | null;
  foundation_code: number | null;
  asset_amount: number | null;
  income_amount: number | null;
  tax_period: string | null;
  [key: string]: unknown;
}

export interface ProPublicaOrgDetailResponse {
  organization: ProPublicaOrganization;
  filings_with_data: ProPublicaFiling[];
  filings_without_data: ProPublicaFiling[];
}
