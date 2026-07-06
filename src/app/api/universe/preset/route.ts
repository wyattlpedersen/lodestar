import { NextResponse } from "next/server";
import { searchOrganizations } from "@/lib/propublica/client";
import { isBayAreaCity, countyForCity } from "@/lib/bay-area-counties";

/**
 * "Bay Area E&F Preset" (F1): pulls the first two result pages (state=CA, 501(c)(3))
 * for each NTEE major group relevant to endowments & foundations, then filters to
 * Bay Area counties by city. Most private/community foundations file under NTEE
 * major 7 ("T" — Philanthropy/Grantmaking), confirmed live: Hewlett is T21, Moore
 * is T20, Silicon Valley Community Foundation is T31. Majors 9 (mutual/membership)
 * and 10 (unknown) are excluded as out of scope.
 *
 * This is a bounded sample (2 pages x ~25 results x 8 majors), not an exhaustive
 * crawl of every CA 501(c)(3) — a full crawl across majors this broad would be
 * thousands of pages. Search only; hydration is a separate bulk step the user
 * triggers per Section 9 F1.
 */
const RELEVANT_NTEE_MAJORS = [1, 2, 3, 4, 5, 6, 7, 8];
const PAGES_PER_MAJOR = 2;

export async function POST() {
  const seen = new Map<string, { ein: string; name: string; city: string | null; state: string | null; nteeCode: string | null; county: string | null }>();

  for (const nteeId of RELEVANT_NTEE_MAJORS) {
    for (let page = 0; page < PAGES_PER_MAJOR; page++) {
      try {
        const res = await searchOrganizations({ stateId: "CA", nteeId, cCode: 3, page });
        for (const org of res.organizations) {
          if (!isBayAreaCity(org.city)) continue;
          const ein = String(org.ein);
          if (seen.has(ein)) continue;
          seen.set(ein, {
            ein,
            name: org.name,
            city: org.city,
            state: org.state,
            nteeCode: org.ntee_code,
            county: countyForCity(org.city),
          });
        }
        if (page >= res.num_pages - 1) break;
      } catch {
        // One major group failing shouldn't kill the whole preset pull.
        continue;
      }
    }
  }

  return NextResponse.json({ candidates: Array.from(seen.values()) });
}
