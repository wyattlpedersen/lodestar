/**
 * npm run seed — builds the ~30-org Bay Area E&F seed universe (Section 10),
 * resolving each name to a real EIN via the live ProPublica search API (never
 * hardcoded — avoids transcription errors) and hydrating real filings for
 * each. Real data only, by default — no fabricated content mixed in.
 *
 * Pass `--examples` to also layer in EXAMPLE-tagged example intelligence
 * (signals, people, pipeline stages) on top, e.g. for a local rehearsal of
 * Path Finder / decay-curve / pipeline demos. This is intentionally NOT the
 * default: a public/live deployment should show only real IRS data, and
 * "what does the example intelligence look like" should be something you
 * opt into (locally, or via Settings's Example Content toggle, which calls
 * the same `addExampleContent`/`removeExampleContent` functions this script
 * uses) — not something baked into every fresh seed. Every EXAMPLE-tagged
 * row is clearly marked in the UI (dashed border + label) and excluded from
 * exports by default regardless.
 *
 * `npm run seed:examples` runs *only* the example-layering step against
 * whatever real orgs are already hydrated — no re-fetch, no ProPublica
 * calls, useful for building the demo snapshot without waiting through a
 * full re-seed.
 */
import fs from "node:fs";
import path from "node:path";
import { searchOrganizations } from "../src/lib/propublica/client";
import { hydrateOrganization } from "../src/lib/propublica/ingest";
import { addExampleContent, loadEinByNameFromDb } from "../src/lib/seed/example-content";

interface SeedOrgSpec {
  name: string;
  category: string;
  /** Override search query when the display name doesn't surface the right
   * entity (verified live — see ASSUMPTIONS.md). Falls back to `name`. */
  query?: string;
}

const SEED_ORGS: SeedOrgSpec[] = [
  // Private foundations
  { name: "William & Flora Hewlett Foundation", category: "private_foundation" },
  { name: "David and Lucile Packard Foundation", category: "private_foundation" },
  { name: "Gordon and Betty Moore Foundation", category: "private_foundation" },
  { name: "Koret Foundation", category: "private_foundation" },
  { name: "Walter and Elise Haas Fund", category: "private_foundation" },
  { name: "Heising-Simons Foundation", category: "private_foundation" },
  { name: "Sobrato Family Foundation", category: "private_foundation" },
  { name: "S.D. Bechtel Jr. Foundation", category: "private_foundation" },
  // Community foundations
  { name: "Silicon Valley Community Foundation", category: "community_foundation" },
  { name: "San Francisco Foundation", category: "community_foundation" },
  { name: "Marin Community Foundation", category: "community_foundation" },
  { name: "East Bay Community Foundation", category: "community_foundation" },
  // University-affiliated
  { name: "San Francisco State University Foundation", category: "university" },
  { name: "Tower Foundation of San Jose State University", category: "university" },
  { name: "University of San Francisco", category: "university" },
  {
    name: "Santa Clara University",
    category: "university",
    // "Santa Clara University" as a literal query surfaces "Jesuit Community
    // At Santa Clara University Inc" first — a religious-community entity,
    // not the university's corporate filer. Verified live: this query
    // surfaces the actual "President Board Of Trustees Santa Clara College".
    query: "President Board of Trustees Santa Clara",
  },
  { name: "Golden Gate University", category: "university" },
  // Health
  { name: "UCSF Foundation", category: "hospital_health" },
  { name: "John Muir Health Foundation", category: "hospital_health" },
  { name: "Sutter Health Foundation", category: "hospital_health" },
  // Cultural / operating
  { name: "San Francisco Museum of Modern Art", category: "cultural" },
  {
    name: "Fine Arts Museums of San Francisco",
    category: "cultural",
    // The full phrase surfaces a smaller "...Fund" entity in Lafayette first.
    // Verified live: "Fine Arts Museums" surfaces the real umbrella entity,
    // "Corporation Of The Fine Arts Museums", at position 2 in CA results.
    query: "Fine Arts Museums",
  },
  { name: "Asian Art Museum Foundation of San Francisco", category: "cultural" },
  { name: "San Francisco Symphony", category: "cultural" },
  { name: "San Francisco Opera", category: "cultural" },
  { name: "San Francisco Ballet", category: "cultural" },
  { name: "Exploratorium", category: "cultural" },
  { name: "California Academy of Sciences", category: "cultural" },
  { name: "Oakland Museum of California", category: "cultural" },
];

interface Resolution {
  spec: SeedOrgSpec;
  ein: string | null;
  matchedName: string | null;
  reason: string;
}

async function resolveOne(spec: SeedOrgSpec): Promise<Resolution> {
  try {
    const result = await searchOrganizations({ q: spec.query ?? spec.name, stateId: "CA" });
    const match = result.organizations.find((o) => o.state === "CA");
    if (!match) {
      return { spec, ein: null, matchedName: null, reason: "no CA match in search results" };
    }
    return { spec, ein: String(match.ein), matchedName: match.name, reason: "resolved" };
  } catch (err) {
    return {
      spec,
      ein: null,
      matchedName: null,
      reason: err instanceof Error ? err.message : "search failed",
    };
  }
}

function logResolutionsToAssumptions(resolutions: Resolution[]) {
  const assumptionsPath = path.join(process.cwd(), "ASSUMPTIONS.md");
  const startMarker = "<!-- SEED_LOG_START -->";
  const endMarker = "<!-- SEED_LOG_END -->";

  const lines: string[] = [startMarker];
  lines.push(`### Seed resolution log (\`npm run seed\`, last run ${new Date().toISOString()})`);
  lines.push("");
  lines.push("| Seed name | Resolved EIN | Matched name | Status |");
  lines.push("|---|---|---|---|");
  for (const r of resolutions) {
    lines.push(
      `| ${r.spec.name} | ${r.ein ?? "—"} | ${r.matchedName ?? "—"} | ${r.reason} |`
    );
  }
  lines.push(endMarker);
  const block = lines.join("\n");

  let content = fs.existsSync(assumptionsPath) ? fs.readFileSync(assumptionsPath, "utf-8") : "";
  if (content.includes(startMarker) && content.includes(endMarker)) {
    const before = content.slice(0, content.indexOf(startMarker));
    const after = content.slice(content.indexOf(endMarker) + endMarker.length);
    content = before + block + after;
  } else {
    content += `\n\n## Seed Resolution Log\n\n${block}\n`;
  }
  fs.writeFileSync(assumptionsPath, content);
}

async function main() {
  const includeExamples = process.argv.includes("--examples");
  const examplesOnly = process.argv.includes("--examples-only");

  if (examplesOnly) {
    console.log("Adding EXAMPLE-tagged example intelligence to already-hydrated orgs (no ProPublica calls)...");
    const einByName = await loadEinByNameFromDb();
    if (einByName.size === 0) {
      console.log("No matching seed orgs found in the DB yet — run `npm run seed` first.");
      process.exit(1);
    }
    await addExampleContent(einByName);
    console.log(`Done. Example intelligence added against ${einByName.size} matched orgs.`);
    process.exit(0);
  }

  console.log(`Resolving ${SEED_ORGS.length} seed orgs against the live ProPublica API...`);
  const resolutions: Resolution[] = [];
  for (const spec of SEED_ORGS) {
    const r = await resolveOne(spec);
    resolutions.push(r);
    console.log(
      r.ein ? `  ✓ ${spec.name} -> EIN ${r.ein} (${r.matchedName})` : `  ✗ ${spec.name}: ${r.reason}`
    );
  }
  logResolutionsToAssumptions(resolutions);

  const resolved = resolutions.filter((r): r is Resolution & { ein: string } => !!r.ein);
  console.log(`\nHydrating ${resolved.length} resolved orgs (throttled ~1/sec)...`);
  const einByName = new Map<string, string>();
  for (const r of resolved) {
    try {
      await hydrateOrganization(r.ein);
      einByName.set(r.spec.name, r.ein);
      console.log(`  ✓ hydrated ${r.spec.name}`);
    } catch (err) {
      console.log(`  ✗ failed to hydrate ${r.spec.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (includeExamples) {
    console.log("\nSeeding EXAMPLE-tagged example intelligence (signals, people, pipeline)...");
    await addExampleContent(einByName);
  } else {
    console.log(
      "\nSkipping EXAMPLE-tagged content (real-data-only seed). Run `npm run seed:examples` to add it."
    );
  }

  console.log(`\nDone. ${einByName.size} orgs hydrated with real IRS filings.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
