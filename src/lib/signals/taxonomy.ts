export type SignalEntryMode = "Manual" | "AUTO";

export interface SignalTaxonomyEntry {
  code: string;
  event: string;
  basePoints: number;
  halfLifeDays: number | null; // null = persistent (recomputed, not decayed)
  isPersistent: boolean;
  entry: SignalEntryMode;
}

/** Section 8 — Signal Taxonomy (Money in Motion), verbatim from the build spec. */
export const SIGNAL_TAXONOMY: SignalTaxonomyEntry[] = [
  { code: "RFP_ANNOUNCED", event: "OCIO / consultant / manager RFP live", basePoints: 100, halfLifeDays: 90, isPersistent: false, entry: "Manual" },
  { code: "MAJOR_GIFT", event: "Gift or bequest > 10% of assets", basePoints: 90, halfLifeDays: 180, isPersistent: false, entry: "Manual" },
  { code: "LEADERSHIP_CHANGE_INV", event: "CIO / investment head transition", basePoints: 85, halfLifeDays: 180, isPersistent: false, entry: "Manual" },
  { code: "FOUNDER_LIQUIDITY", event: "Founder's company IPO / acquisition", basePoints: 80, halfLifeDays: 540, isPersistent: false, entry: "Manual" },
  { code: "CAMPAIGN_COMPLETE", event: "Capital campaign closed (assets landing)", basePoints: 75, halfLifeDays: 270, isPersistent: false, entry: "Manual" },
  { code: "LEADERSHIP_CHANGE_EXEC", event: "ED / CEO / CFO transition", basePoints: 70, halfLifeDays: 180, isPersistent: false, entry: "Manual" },
  { code: "MERGER", event: "Merger, affiliation, or wind-down transfer", basePoints: 70, halfLifeDays: 365, isPersistent: false, entry: "Manual" },
  { code: "CONSULTANT_HIRED", event: "New consultant engaged", basePoints: 65, halfLifeDays: 365, isPersistent: false, entry: "Manual" },
  { code: "PERFORMANCE_GAP", event: "Asset growth trails 70/30 proxy by >300bps (2yr)", basePoints: 60, halfLifeDays: null, isPersistent: true, entry: "AUTO" },
  { code: "CONTRIB_SPIKE", event: "Contributions > 2x trailing 3yr average", basePoints: 55, halfLifeDays: 270, isPersistent: false, entry: "AUTO" },
  { code: "SPENDING_STRESS", event: "Payout proxy > 5.5% AND 2yr asset decline", basePoints: 55, halfLifeDays: null, isPersistent: true, entry: "AUTO" },
  { code: "BOARD_TURNOVER", event: "Chair or treasurer change", basePoints: 50, halfLifeDays: 180, isPersistent: false, entry: "Manual" },
  { code: "FEE_SPIKE", event: "Professional/mgmt fees +50% YoY (where entered)", basePoints: 50, halfLifeDays: 365, isPersistent: false, entry: "AUTO" },
  { code: "CAMPAIGN_LAUNCH", event: "Capital campaign announced (future assets)", basePoints: 45, halfLifeDays: 365, isPersistent: false, entry: "Manual" },
  { code: "ASSET_DROP", event: "Total assets -15% YoY", basePoints: 45, halfLifeDays: 365, isPersistent: false, entry: "AUTO" },
  { code: "NEWS_MENTION", event: "Relevant news: expansion, asset sale, litigation", basePoints: 30, halfLifeDays: 120, isPersistent: false, entry: "Manual" },
];

export const SIGNAL_TAXONOMY_BY_CODE = Object.fromEntries(
  SIGNAL_TAXONOMY.map((s) => [s.code, s])
);

export function isAutoSignal(code: string): boolean {
  return SIGNAL_TAXONOMY_BY_CODE[code]?.entry === "AUTO";
}
