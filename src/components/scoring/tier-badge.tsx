import { Badge } from "@/components/ui/badge";
import { TIER_LABELS } from "@/lib/scoring/tiers";
import type { Tier } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

export const TIER_BADGE_CLASS: Record<Tier, string> = {
  TIER_1: "bg-gold/15 text-gold border-gold/40",
  TIER_2: "bg-tier-2/15 text-tier-2 border-tier-2/40",
  TIER_3: "bg-tier-3/15 text-tier-3 border-tier-3/40",
  WATCHLIST: "bg-tier-watchlist/15 text-tier-watchlist border-tier-watchlist/40",
};

const TIER_SHORT: Record<Tier, string> = {
  TIER_1: "T1",
  TIER_2: "T2",
  TIER_3: "T3",
  WATCHLIST: "Watch",
};

export function TierBadge({
  tier,
  pending,
  short = false,
}: {
  tier: Tier;
  pending?: boolean;
  short?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-md px-2 py-0.5 text-xs font-medium", TIER_BADGE_CLASS[tier])}
    >
      {short ? TIER_SHORT[tier] : TIER_LABELS[tier]}
      {pending ? " (pending)" : ""}
    </Badge>
  );
}
