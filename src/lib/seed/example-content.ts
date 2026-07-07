/**
 * EXAMPLE-tagged demo intelligence — signals, people, affiliations, and
 * pipeline-stage changes layered onto already-hydrated real orgs. Shared
 * between `scripts/seed.ts` (`npm run seed:examples`, CLI) and the Settings
 * page's on/off toggle (`/api/settings/example-content`, no ProPublica
 * calls either way — this only touches orgs already in the DB).
 *
 * Both `addExampleContent` and `removeExampleContent` are idempotent: adding
 * always clears any prior EXAMPLE rows first, so toggling on/off repeatedly
 * never duplicates data.
 */
import { db } from "@/lib/db";
import { affiliations, organizations, people, pipeline, signals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const today = () => new Date();
const isoDaysAgo = (days: number) => {
  const d = new Date(today().getTime() - days * 86400000);
  return d.toISOString().slice(0, 10);
};

export const SEED_NAME_KEYWORDS = [
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

/** Builds the einByName map the keyword matching below needs, from whatever orgs are already hydrated — no re-fetch, no ProPublica calls. */
export async function loadEinByNameFromDb(): Promise<Map<string, string>> {
  const allOrgs = await db.select({ ein: organizations.ein, name: organizations.name }).from(organizations);
  const relevant = allOrgs.filter((o) =>
    SEED_NAME_KEYWORDS.some((kw) => o.name.toLowerCase().includes(kw))
  );
  return new Map(relevant.map((o) => [o.name, o.ein]));
}

/** Is any EXAMPLE-tagged content currently present? Powers the Settings toggle's initial state. */
export async function hasExampleContent(): Promise<boolean> {
  const row = await db.query.signals.findFirst({ where: eq(signals.tag, "EXAMPLE") });
  return !!row;
}

/** Deletes all EXAMPLE-tagged signals/people/affiliations and resets every pipeline card back to Identified. */
export async function removeExampleContent(): Promise<void> {
  await db.delete(signals).where(eq(signals.tag, "EXAMPLE"));
  await db.delete(people).where(eq(people.tag, "EXAMPLE"));
  await db.delete(affiliations).where(eq(affiliations.tag, "EXAMPLE"));

  const allPipeline = await db.select().from(pipeline);
  for (const row of allPipeline) {
    await db
      .update(pipeline)
      .set({ stage: "identified", ownerNote: null, nextAction: null, nextActionDate: null, lastTouchDate: null })
      .where(eq(pipeline.ein, row.ein));
  }
}

/**
 * Layers EXAMPLE-tagged signals, people, affiliations, and pipeline-stage
 * changes onto already-hydrated real orgs, engineered so the demo shows:
 * a real 2-hop Path Finder chain, a 3-board super-connector, 2 known
 * contacts, one deliberately near-decayed signal, and pipeline cards spread
 * across all 8 stages. Idempotent — clears any existing EXAMPLE content
 * first, so calling this twice never duplicates rows.
 */
export async function addExampleContent(einByName: Map<string, string>): Promise<void> {
  await removeExampleContent();

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
        lastTouchDate: today().toISOString().slice(0, 10),
      })
      .onConflictDoUpdate({
        target: pipeline.ein,
        set: {
          stage: s.stage,
          nextAction: s.nextAction ?? null,
          nextActionDate: s.nextActionDate ?? null,
          lastTouchDate: today().toISOString().slice(0, 10),
        },
      });
  }
}
