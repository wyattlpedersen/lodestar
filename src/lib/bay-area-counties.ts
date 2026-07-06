/**
 * City -> county lookup for the nine-county Bay Area plus Santa Cruz (per Section 9, F1).
 * ProPublica's API returns `city`/`state` but never `county`, so this static table is how
 * LODESTAR both (a) derives `organizations.county` on ingest and (b) filters the Bay Area
 * E&F preset. Real public geography, not analyst intelligence — not EXAMPLE-tagged.
 * Not exhaustive of every incorporated place; covers cities likely to appear as an E&F
 * org's registered address. Extend as new cities show up in search results.
 */
export const BAY_AREA_COUNTIES = [
  "San Francisco",
  "San Mateo",
  "Santa Clara",
  "Alameda",
  "Contra Costa",
  "Marin",
  "Sonoma",
  "Napa",
  "Solano",
  "Santa Cruz",
] as const;

export type BayAreaCounty = (typeof BAY_AREA_COUNTIES)[number];

const CITY_TO_COUNTY: Record<string, BayAreaCounty> = {
  "san francisco": "San Francisco",

  "san mateo": "San Mateo",
  "redwood city": "San Mateo",
  "menlo park": "San Mateo",
  "palo alto": "San Mateo",
  "burlingame": "San Mateo",
  "belmont": "San Mateo",
  "foster city": "San Mateo",
  "daly city": "San Mateo",
  "south san francisco": "San Mateo",
  "san bruno": "San Mateo",
  "millbrae": "San Mateo",
  "half moon bay": "San Mateo",
  "san carlos": "San Mateo",
  "atherton": "San Mateo",
  "woodside": "San Mateo",
  "pacifica": "San Mateo",
  "east palo alto": "San Mateo",

  "san jose": "Santa Clara",
  "santa clara": "Santa Clara",
  "sunnyvale": "Santa Clara",
  "mountain view": "Santa Clara",
  "cupertino": "Santa Clara",
  "milpitas": "Santa Clara",
  "los gatos": "Santa Clara",
  "saratoga": "Santa Clara",
  "gilroy": "Santa Clara",
  "morgan hill": "Santa Clara",
  "campbell": "Santa Clara",
  "los altos": "Santa Clara",
  "los altos hills": "Santa Clara",
  "stanford": "Santa Clara",

  "oakland": "Alameda",
  "berkeley": "Alameda",
  "fremont": "Alameda",
  "hayward": "Alameda",
  "alameda": "Alameda",
  "san leandro": "Alameda",
  "pleasanton": "Alameda",
  "dublin": "Alameda",
  "livermore": "Alameda",
  "union city": "Alameda",
  "newark": "Alameda",
  "emeryville": "Alameda",
  "albany": "Alameda",
  "piedmont": "Alameda",
  "castro valley": "Alameda",

  "concord": "Contra Costa",
  "richmond": "Contra Costa",
  "walnut creek": "Contra Costa",
  "antioch": "Contra Costa",
  "san ramon": "Contra Costa",
  "danville": "Contra Costa",
  "pittsburg": "Contra Costa",
  "martinez": "Contra Costa",
  "el cerrito": "Contra Costa",
  "orinda": "Contra Costa",
  "lafayette": "Contra Costa",
  "moraga": "Contra Costa",
  "pinole": "Contra Costa",
  "pleasant hill": "Contra Costa",
  "brentwood": "Contra Costa",

  "san rafael": "Marin",
  "novato": "Marin",
  "mill valley": "Marin",
  "sausalito": "Marin",
  "larkspur": "Marin",
  "corte madera": "Marin",
  "tiburon": "Marin",
  "fairfax": "Marin",
  "ross": "Marin",
  "belvedere": "Marin",

  "santa rosa": "Sonoma",
  "petaluma": "Sonoma",
  "rohnert park": "Sonoma",
  "sonoma": "Sonoma",
  "sebastopol": "Sonoma",
  "windsor": "Sonoma",
  "healdsburg": "Sonoma",
  "cotati": "Sonoma",

  "napa": "Napa",
  "st. helena": "Napa",
  "saint helena": "Napa",
  "calistoga": "Napa",
  "american canyon": "Napa",
  "yountville": "Napa",

  "vallejo": "Solano",
  "fairfield": "Solano",
  "vacaville": "Solano",
  "benicia": "Solano",
  "suisun city": "Solano",
  "dixon": "Solano",

  "santa cruz": "Santa Cruz",
  "watsonville": "Santa Cruz",
  "capitola": "Santa Cruz",
  "scotts valley": "Santa Cruz",
  "aptos": "Santa Cruz",
};

export function countyForCity(city: string | null | undefined): BayAreaCounty | null {
  if (!city) return null;
  return CITY_TO_COUNTY[city.trim().toLowerCase()] ?? null;
}

export function isBayAreaCity(city: string | null | undefined): boolean {
  return countyForCity(city) !== null;
}
