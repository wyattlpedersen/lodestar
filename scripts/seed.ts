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
 * opt into (locally, or via Settings -> Demo Mode, which restores a snapshot
 * built with `npm run seed:examples`) — not something baked into every
 * fresh seed. Every EXAMPLE-tagged row is clearly marked in the UI (dashed
 * border + label) and excluded from exports by default regardless.
 *
 * `npm run seed:examples` runs *only* the example-layering step against
 * whatever real orgs are already hydrated — no re-fetch, no ProPublica
 * calls, useful for building the demo snapshot without waiting through a
 * full re-seed.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { affiliations, organizations, people, pipeline, signals } from "../src/lib/db/schema";
import { searchOrganizations } from "../src/lib/propublica/client";
import { hydrateOrganization } from "../src/lib/propublica/ingest";

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

const today = new Date();
const isoDaysAgo = (days: number) => {
  const d = new Date(today.getTime() - days * 86400000);
  return d.toISOString().slice(0, 10);
};

async function seedExampleIntelligence(einByName: Map<string, string>) {
  const einOf = (partial: string): string | null => {
    for (const [name, ein] of einByName) {
      if (name.toLowerCase().includes(partial.toLowerCase())) return ein;
    }
    return null;
  };

  const hewlett = einOf("hewlett");
  const packard = einOf("packard");
  const moore = einOf("moore");
  const sfmoma = einOf("museum of modern art");
  const asianArt = einOf("asian art");
  const symphony = einOf("symphony");
  const svcf = einOf("silicon valley community");
  const sfFoundation = einOf("san francisco foundation");
  const ucsf = einOf("ucsf");
  const exploratorium = einOf("exploratorium");

  // --- EXAMPLE signals: spread across types/dates, including one nearly-decayed ---
  const exampleSignals: {
    ein: string | null;
    type: string;
    headline: string;
    detail: string;
    eventDate: string;
    basePoints: number;
    halfLifeDays: number | null;
    isPersistent: boolean;
    isVerbalNote: boolean;
  }[] = [
    {
      ein: hewlett,
      type: "LEADERSHIP_CHANGE_INV",
      headline: "EXAMPLE: New CIO named after national search",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(20),
      basePoints: 85,
      halfLifeDays: 180,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: packard,
      type: "RFP_ANNOUNCED",
      headline: "EXAMPLE: OCIO search announced at board meeting",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(10),
      basePoints: 100,
      halfLifeDays: 90,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: moore,
      type: "MAJOR_GIFT",
      headline: "EXAMPLE: Bequest received from founding family",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(45),
      basePoints: 90,
      halfLifeDays: 180,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: sfmoma,
      type: "BOARD_TURNOVER",
      headline: "EXAMPLE: New board treasurer elected",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(60),
      basePoints: 50,
      halfLifeDays: 180,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: asianArt,
      type: "CONSULTANT_HIRED",
      headline: "EXAMPLE: New investment consultant engaged",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(30),
      basePoints: 65,
      halfLifeDays: 365,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: symphony,
      type: "CAMPAIGN_LAUNCH",
      headline: "EXAMPLE: Capital campaign announced",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(15),
      basePoints: 45,
      halfLifeDays: 365,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: svcf,
      type: "LEADERSHIP_CHANGE_EXEC",
      headline: "EXAMPLE: New CEO takes over from longtime founder",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(90),
      basePoints: 70,
      halfLifeDays: 180,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: sfFoundation,
      type: "FOUNDER_LIQUIDITY",
      headline: "EXAMPLE: Major donor's company acquired",
      detail: "Illustrative example signal for demo purposes only.",
      eventDate: isoDaysAgo(200),
      basePoints: 80,
      halfLifeDays: 540,
      isPersistent: false,
      isVerbalNote: true,
    },
    {
      ein: ucsf,
      // Nearly fully decayed — logged near the end of its 120-day half-life window (~119 days old)
      type: "NEWS_MENTION",
      headline: "EXAMPLE: Local news coverage of facility expansion",
      detail: "Illustrative example signal, deliberately near-decayed to show staleness in the demo.",
      eventDate: isoDaysAgo(119),
      basePoints: 30,
      halfLifeDays: 120,
      isPersistent: false,
      isVerbalNote: true,
    },
  ];

  for (const s of exampleSignals) {
    if (!s.ein) continue;
    await db.insert(signals).values({
      ein: s.ein,
      type: s.type,
      headline: s.headline,
      detail: s.detail,
      eventDate: s.eventDate,
      basePoints: s.basePoints,
      halfLifeDays: s.halfLifeDays,
      isPersistent: s.isPersistent,
      isVerbalNote: s.isVerbalNote,
      active: true,
      tag: "EXAMPLE",
    });
  }

  // --- EXAMPLE people + affiliations: engineered for a real 2-hop Path Finder demo,
  // a 3-board super-connector, and 2 known-contact flags ---
  const examplePeople: {
    fullName: string;
    isKnownContact: boolean;
    isJpmAlum: boolean;
    isPrincipalUhnw: boolean;
  }[] = [
    { fullName: "EXAMPLE: Eleanor Vance", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: true }, // super-connector, 3 boards
    { fullName: "EXAMPLE: Marcus Chen", isKnownContact: true, isJpmAlum: false, isPrincipalUhnw: false }, // known contact #1
    { fullName: "EXAMPLE: Priya Ramanathan", isKnownContact: true, isJpmAlum: true, isPrincipalUhnw: false }, // known contact #2, also JPM alum
    { fullName: "EXAMPLE: David Okafor", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: false },
    { fullName: "EXAMPLE: Susan Whitfield", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: true },
    { fullName: "EXAMPLE: Robert Kim", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: false },
    { fullName: "EXAMPLE: Linda Martinez", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: false },
    { fullName: "EXAMPLE: James Sato", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: false },
  ];

  const insertedPeople: { id: number; fullName: string }[] = [];
  for (const p of examplePeople) {
    const [row] = await db
      .insert(people)
      .values({ ...p, tag: "EXAMPLE" })
      .returning();
    insertedPeople.push(row);
  }
  const personId = (name: string) => insertedPeople.find((p) => p.fullName === name)!.id;

  // Mark SFMOMA as an "existing relationship" so a shared trustee gives another
  // org a real second-degree path (Section 7.3 / F6).
  if (sfmoma) {
    await db
      .insert(pipeline)
      .values({ ein: sfmoma, stage: "meeting" })
      .onConflictDoUpdate({ target: pipeline.ein, set: { stage: "meeting" } });
  }

  const affiliationRows: {
    personId: number;
    ein: string;
    role: string;
    isCurrent: boolean;
  }[] = [];

  // Eleanor Vance: super-connector across 3 boards.
  for (const ein of [hewlett, sfmoma, symphony].filter((e): e is string => !!e)) {
    affiliationRows.push({ personId: personId("EXAMPLE: Eleanor Vance"), ein, role: "Trustee", isCurrent: true });
  }
  // Marcus Chen: known contact, direct 1-hop warm path onto Packard's board.
  if (packard) {
    affiliationRows.push({ personId: personId("EXAMPLE: Marcus Chen"), ein: packard, role: "Board Chair", isCurrent: true });
  }
  // Priya Ramanathan: known contact + JPM alum, on Moore's board.
  if (moore) {
    affiliationRows.push({ personId: personId("EXAMPLE: Priya Ramanathan"), ein: moore, role: "Treasurer", isCurrent: true });
  }
  // David Okafor: shared trustee linking Asian Art Museum <-> SFMOMA (2-hop demo).
  if (asianArt && sfmoma) {
    affiliationRows.push({ personId: personId("EXAMPLE: David Okafor"), ein: asianArt, role: "Trustee", isCurrent: true });
    affiliationRows.push({ personId: personId("EXAMPLE: David Okafor"), ein: sfmoma, role: "Trustee", isCurrent: true });
  }
  // Susan Whitfield: principal UHNW trustee, family member on Exploratorium's board.
  if (exploratorium) {
    affiliationRows.push({
      personId: personId("EXAMPLE: Susan Whitfield"),
      ein: exploratorium,
      role: "Family member, Trustee",
      isCurrent: true,
    });
  }
  if (svcf) {
    affiliationRows.push({ personId: personId("EXAMPLE: Robert Kim"), ein: svcf, role: "Trustee", isCurrent: true });
  }
  if (sfFoundation) {
    affiliationRows.push({ personId: personId("EXAMPLE: Linda Martinez"), ein: sfFoundation, role: "Trustee", isCurrent: true });
  }
  if (ucsf) {
    affiliationRows.push({ personId: personId("EXAMPLE: James Sato"), ein: ucsf, role: "Trustee", isCurrent: true });
  }

  for (const a of affiliationRows) {
    await db.insert(affiliations).values({
      ...a,
      sourceUrl: null,
      isVerbalNote: true,
      tag: "EXAMPLE",
    });
  }

  // --- Pipeline: spread a handful of orgs across stages beyond the default "identified" ---
  type PipelineStage = typeof pipeline.$inferInsert.stage;
  const stageAssignments: {
    ein: string | null;
    stage: PipelineStage;
    nextAction?: string;
    nextActionDate?: string;
  }[] = [
    { ein: hewlett, stage: "researched" },
    { ein: packard, stage: "outreach", nextAction: "Call board chair re: OCIO search", nextActionDate: isoDaysAgo(-7) },
    { ein: moore, stage: "meeting", nextAction: "Follow up post-meeting", nextActionDate: isoDaysAgo(-3) },
    { ein: svcf, stage: "proposal", nextAction: "Send proposal deck", nextActionDate: isoDaysAgo(-14) },
    { ein: sfFoundation, stage: "won" },
    { ein: ucsf, stage: "parked" },
    { ein: exploratorium, stage: "lost" },
  ];
  for (const s of stageAssignments) {
    if (!s.ein) continue;
    await db
      .insert(pipeline)
      .values({
        ein: s.ein,
        stage: s.stage,
        nextAction: s.nextAction ?? null,
        nextActionDate: s.nextActionDate ?? null,
        lastTouchDate: today.toISOString().slice(0, 10),
      })
      .onConflictDoUpdate({
        target: pipeline.ein,
        set: {
          stage: s.stage,
          nextAction: s.nextAction ?? null,
          nextActionDate: s.nextActionDate ?? null,
          lastTouchDate: today.toISOString().slice(0, 10),
        },
      });
  }
}

const SEED_NAME_KEYWORDS = [
  "hewlett",
  "packard",
  "moore",
  "museum of modern art",
  "asian art",
  "symphony",
  "silicon valley community",
  "san francisco foundation",
  "ucsf",
  "exploratorium",
];

/** Builds the einByName map that seedExampleIntelligence's keyword matching needs, from whatever is already hydrated — no re-fetch. */
async function loadEinByNameFromDb(): Promise<Map<string, string>> {
  const allOrgs = await db.select({ ein: organizations.ein, name: organizations.name }).from(organizations);
  const relevant = allOrgs.filter((o) =>
    SEED_NAME_KEYWORDS.some((kw) => o.name.toLowerCase().includes(kw))
  );
  return new Map(relevant.map((o) => [o.name, o.ein]));
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
    await seedExampleIntelligence(einByName);
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
    await seedExampleIntelligence(einByName);
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
