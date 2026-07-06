import "server-only";
import { db } from "@/lib/db";
import { organizations, filings, manualFacts, signals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { deriveAutoSignals } from "./auto-derive";
import type { FilingLike } from "@/lib/derived-financials";

const PERSISTENT_AUTO_TYPES = ["PERFORMANCE_GAP", "SPENDING_STRESS"];
const DECAYING_AUTO_TYPES = ["CONTRIB_SPIKE", "FEE_SPIKE", "ASSET_DROP"];
const ALL_AUTO_TYPES = [...PERSISTENT_AUTO_TYPES, ...DECAYING_AUTO_TYPES];

/**
 * Recomputes AUTO signals for one org from its current filings + manual facts,
 * and reconciles them against what's already stored:
 * - Persistent types (PERFORMANCE_GAP, SPENDING_STRESS): exactly one row per
 *   type. Recomputed in place while the condition holds; auto-deactivated the
 *   moment it clears (Section 5/8 — "dropped automatically when the condition
 *   clears").
 * - Decaying types (CONTRIB_SPIKE, FEE_SPIKE, ASSET_DROP): a new row per newly
 *   detected event, deduped by (ein, type, eventDate) so re-running this on
 *   every refresh doesn't spam duplicate signals for the same filing year.
 */
export async function syncAutoSignals(
  ein: string,
  today: Date = new Date()
): Promise<{ added: number; updated: number; cleared: number }> {
  const [org, orgFilings, facts, existing] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.ein, ein) }),
    db.select().from(filings).where(eq(filings.ein, ein)).orderBy(desc(filings.taxYear)),
    db.select().from(manualFacts).where(eq(manualFacts.ein, ein)),
    db.select().from(signals).where(eq(signals.ein, ein)),
  ]);
  if (!org) return { added: 0, updated: 0, cleared: 0 };

  const factMap = Object.fromEntries(facts.map((f) => [f.key, f.value]));
  const candidates = deriveAutoSignals(orgFilings as FilingLike[], org.fyeMonth, factMap, today);

  let added = 0;
  let updated = 0;
  let cleared = 0;

  for (const type of PERSISTENT_AUTO_TYPES) {
    const candidate = candidates.find((c) => c.type === type);
    const existingActive = existing.find((s) => s.type === type && s.active);

    if (candidate) {
      if (existingActive) {
        await db
          .update(signals)
          .set({ headline: candidate.headline, detail: candidate.detail, basePoints: candidate.basePoints })
          .where(eq(signals.id, existingActive.id));
        updated += 1;
      } else {
        await db.insert(signals).values({
          ein,
          type: candidate.type,
          headline: candidate.headline,
          detail: candidate.detail,
          eventDate: candidate.eventDate,
          basePoints: candidate.basePoints,
          halfLifeDays: candidate.halfLifeDays,
          isPersistent: true,
          active: true,
        });
        added += 1;
      }
    } else if (existingActive) {
      await db
        .update(signals)
        .set({ active: false, detail: `${existingActive.detail ?? ""} — condition cleared on recompute` })
        .where(eq(signals.id, existingActive.id));
      cleared += 1;
    }
  }

  for (const type of DECAYING_AUTO_TYPES) {
    const candidate = candidates.find((c) => c.type === type);
    if (!candidate) continue;
    const alreadyExists = existing.some(
      (s) => s.type === type && s.eventDate === candidate.eventDate
    );
    if (alreadyExists) continue;

    await db.insert(signals).values({
      ein,
      type: candidate.type,
      headline: candidate.headline,
      detail: candidate.detail,
      eventDate: candidate.eventDate,
      basePoints: candidate.basePoints,
      halfLifeDays: candidate.halfLifeDays,
      isPersistent: false,
      active: true,
    });
    added += 1;
  }

  return { added, updated, cleared };
}

export { ALL_AUTO_TYPES };
