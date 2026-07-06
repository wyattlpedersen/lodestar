import type { OrgType } from "@/lib/propublica/mapper";

export interface ReasonToCallContext {
  orgName: string;
  orgType: OrgType | null;
  assetBandLabel: string | null;
  topSignalType: string | null;
  topSignalHeadline: string | null;
}

export interface ReasonToCall {
  angle: string;
  talkingPoints: [string, string, string];
}

const ORG_TYPE_LABEL: Record<OrgType, string> = {
  private_foundation: "foundation",
  community_foundation: "community foundation",
  university: "institution",
  hospital_health: "system",
  cultural: "institution",
  other_operating: "organization",
};

function orgWord(orgType: OrgType | null): string {
  return orgType ? ORG_TYPE_LABEL[orgType] : "organization";
}

/**
 * Deterministic templates (no LLM, Section 9 F8) — one per Signal Taxonomy code
 * plus a no-signal fallback. Each returns a 2-sentence forwardable angle and 3
 * talking points; the UI renders these as an editable draft, never auto-sent.
 */
const TEMPLATES: Record<string, (ctx: ReasonToCallContext) => ReasonToCall> = {
  RFP_ANNOUNCED: (ctx) => ({
    angle: `Given ${ctx.orgName}'s open OCIO/consultant search, most committees are actively comparing structures right now. Before the finalist list closes, worth 20 minutes on how we'd approach a ${
      ctx.assetBandLabel ?? "similarly-sized"
    } ${orgWord(ctx.orgType)}'s mandate?`,
    talkingPoints: [
      "Ask where they are in the RFP timeline and who else is at the table.",
      "Bring one differentiated data point on OCIO structures for peer institutions.",
      "Offer a no-obligation portfolio read as a low-friction way in.",
    ],
  }),
  MAJOR_GIFT: (ctx) => ({
    angle: `${ctx.orgName} just received a gift large enough to meaningfully shift its balance sheet. That's exactly the moment governance conversations about investment policy tend to restart.`,
    talkingPoints: [
      "Ask how the gift is earmarked and whether IPS updates are underway.",
      "Offer a benchmarking read on peer allocation for a similarly-sized balance sheet.",
      "Gauge whether existing managers are being reevaluated post-gift.",
    ],
  }),
  LEADERSHIP_CHANGE_INV: (ctx) => ({
    angle: `A new investment head at ${ctx.orgName} usually means a fresh look at every existing relationship within the first two quarters. Early conversations shape that review before it hardens into the status quo.`,
    talkingPoints: [
      "Congratulate on the appointment and ask about near-term priorities.",
      "Offer a no-pressure intro meeting before their manager review cycle starts.",
      "Share how peer institutions have navigated a similar CIO transition.",
    ],
  }),
  FOUNDER_LIQUIDITY: (ctx) => ({
    angle: `The liquidity event at ${ctx.orgName}'s founding company creates a private-wealth conversation alongside the institutional one — worth approaching both threads together.`,
    talkingPoints: [
      "Ask whether the founder or family has engaged wealth advisors yet.",
      "Position the institutional relationship as a door to a broader family conversation.",
      "Move quickly — liquidity-event windows for new relationships close fast.",
    ],
  }),
  CAMPAIGN_COMPLETE: (ctx) => ({
    angle: `${ctx.orgName}'s capital campaign just closed, which means real assets are about to land on the balance sheet. Getting in before deployment decisions are made is the whole game here.`,
    talkingPoints: [
      "Ask about the timeline for deploying newly-raised capital.",
      "Offer a spending-policy or asset-allocation read tailored to the new asset base.",
      "Identify who owns the investment decision post-campaign.",
    ],
  }),
  LEADERSHIP_CHANGE_EXEC: (ctx) => ({
    angle: `A new ED/CEO/CFO at ${ctx.orgName} often triggers a broader operational review, investment relationships included. Best to be a known quantity before that review starts.`,
    talkingPoints: [
      "Congratulate and ask about their 90-day priorities.",
      "Offer a light-touch briefing on the current investment landscape.",
      "Ask who else on the team owns the investment relationship day to day.",
    ],
  }),
  MERGER: (ctx) => ({
    angle: `A merger or affiliation at ${ctx.orgName} usually forces a consolidation of financial relationships — an opening for whichever provider shows up first with a clear plan.`,
    talkingPoints: [
      "Ask how the combined entity plans to consolidate investment management.",
      "Offer a comparison of the two legacy portfolios' allocations.",
      "Identify the surviving decision-maker on the investment committee.",
    ],
  }),
  CONSULTANT_HIRED: (ctx) => ({
    angle: `${ctx.orgName} just engaged a new consultant, which means the manager roster is likely under review. Worth reaching out while that review is still forming, not after.`,
    talkingPoints: [
      "Ask what mandate the new consultant has been given.",
      "Offer materials framed for a consultant-led evaluation process.",
      "Confirm whether existing managers are being asked to re-pitch.",
    ],
  }),
  PERFORMANCE_GAP: (ctx) => ({
    angle: `${ctx.orgName}'s asset growth has trailed a simple 70/30 benchmark by a meaningful margin over the last two years — a fact-based, non-adversarial opening for a portfolio conversation.`,
    talkingPoints: [
      "Lead with the benchmark comparison, not a sales pitch.",
      "Ask what's driving the gap — fees, allocation, or manager selection.",
      "Offer a complimentary allocation read against comparable peers.",
    ],
  }),
  CONTRIB_SPIKE: (ctx) => ({
    angle: `${ctx.orgName} just posted a contributions spike well above its trailing average — new money that likely needs an investment thesis before it becomes routine.`,
    talkingPoints: [
      "Ask about the source and any restrictions on the new contributions.",
      "Offer to help think through deployment timing.",
      "Check whether this changes the org's overall risk capacity.",
    ],
  }),
  SPENDING_STRESS: (ctx) => ({
    angle: `${ctx.orgName}'s payout ratio is running hot against a declining asset base — a sustainability conversation that's likely already on the board's mind.`,
    talkingPoints: [
      "Ask how the board is thinking about long-term spending policy.",
      "Offer a spending-rate stress test against the current portfolio.",
      "Approach with empathy — this is a hard conversation for the ED/CFO.",
    ],
  }),
  BOARD_TURNOVER: (ctx) => ({
    angle: `A new board chair or treasurer at ${ctx.orgName} is a natural moment to reintroduce (or introduce) the relationship before committee dynamics settle.`,
    talkingPoints: [
      "Ask about the new chair/treasurer's background and priorities.",
      "Offer a brief orientation on the current investment program.",
      "Identify whether other board seats are also turning over soon.",
    ],
  }),
  FEE_SPIKE: (ctx) => ({
    angle: `${ctx.orgName}'s professional and management fees jumped sharply year over year — a fee-compression conversation that leads with value, not criticism.`,
    talkingPoints: [
      "Lead with a fee-ratio benchmark against comparable peers.",
      "Ask what's driving the increase — new managers, complexity, or scope.",
      "Offer a no-obligation fee/value review.",
    ],
  }),
  CAMPAIGN_LAUNCH: (ctx) => ({
    angle: `${ctx.orgName} just launched a capital campaign — future assets are coming, and the investment plan for them is worth shaping early rather than after the money lands.`,
    talkingPoints: [
      "Ask about the campaign's target and expected timeline to close.",
      "Offer scenario planning for how the raised capital might be invested.",
      "Position this as a long-lead relationship, not an immediate ask.",
    ],
  }),
  ASSET_DROP: (ctx) => ({
    angle: `${ctx.orgName}'s total assets are down sharply year over year — worth understanding whether that's markets, spending, or something structural before assuming either.`,
    talkingPoints: [
      "Ask what's driving the decline before offering any read.",
      "Offer a diagnostic on allocation versus peers over the same period.",
      "Approach carefully — this may be a sensitive topic internally.",
    ],
  }),
  NEWS_MENTION: (ctx) => ({
    angle: `Recent news on ${ctx.orgName} (expansion, asset sale, or otherwise) is a natural, low-pressure reason to reconnect and see how it's affecting their financial planning.`,
    talkingPoints: [
      "Reference the news item specifically — show you're paying attention.",
      "Ask an open question about how it changes their near-term priorities.",
      "Keep the tone conversational, not transactional.",
    ],
  }),
};

const FALLBACK: (ctx: ReasonToCallContext) => ReasonToCall = (ctx) => ({
  angle: `${ctx.orgName} doesn't have an active timing signal on file yet, but its profile as a ${
    ctx.assetBandLabel ?? "sized"
  } ${orgWord(ctx.orgType)} makes it worth a standing check-in.`,
  talkingPoints: [
    "Ask what's changed since the last public filing.",
    "Offer a peer-benchmarking read as a value-first opener.",
    "Log whatever you learn as a signal so the score reflects it.",
  ],
});

export function generateReasonToCall(ctx: ReasonToCallContext): ReasonToCall {
  const template = ctx.topSignalType ? TEMPLATES[ctx.topSignalType] : undefined;
  return (template ?? FALLBACK)(ctx);
}

export const REASON_TO_CALL_TEMPLATE_COUNT = Object.keys(TEMPLATES).length;
