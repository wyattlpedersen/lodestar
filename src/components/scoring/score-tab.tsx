"use client";

import * as React from "react";
import { computeScore } from "@/lib/scoring/engine";
import { normalizeWeights } from "@/lib/scoring/weights";
import type { ScoringInput, WeightProfile } from "@/lib/scoring/types";
import { ScoreWaterfall } from "./score-waterfall";
import { WeightsPanel } from "./weights-panel";
import { TierBadge } from "./tier-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScoreTab({
  ein,
  inputs,
  activeWeights,
  activePresetName,
}: {
  ein: string;
  inputs: ScoringInput[];
  activeWeights: WeightProfile;
  activePresetName: string;
}) {
  const [whatIf, setWhatIf] = React.useState(false);
  const [draftWeights, setDraftWeights] = React.useState(activeWeights);
  const [draftPresetName, setDraftPresetName] = React.useState(activePresetName);
  const today = React.useMemo(() => new Date(), []);

  const baseline = React.useMemo(() => {
    const results = inputs
      .map((i) => computeScore(i, activeWeights, today, activePresetName))
      .sort((a, b) => b.total - a.total);
    const rank = results.findIndex((r) => r.ein === ein) + 1;
    const mine = results.find((r) => r.ein === ein)!;
    return { rank, total: results.length, mine };
  }, [inputs, activeWeights, activePresetName, ein, today]);

  const draft = React.useMemo(() => {
    if (!whatIf) return null;
    const results = inputs
      .map((i) => computeScore(i, draftWeights, today, draftPresetName))
      .sort((a, b) => b.total - a.total);
    const rank = results.findIndex((r) => r.ein === ein) + 1;
    const mine = results.find((r) => r.ein === ein)!;
    return { rank, total: results.length, mine };
  }, [whatIf, inputs, draftWeights, draftPresetName, ein, today]);

  const shown = draft?.mine ?? baseline.mine;
  const shownRank = draft?.rank ?? baseline.rank;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={shown.tier} pending={shown.tierPending} />
          <Badge variant="outline" className="text-xs">
            Confidence {shown.confidenceGrade} ({shown.confidence})
          </Badge>
          {shown.channelFlag && (
            <Badge variant="outline" className="border-signal-stale/50 text-signal-stale text-xs">
              Coordinate with institutional coverage
            </Badge>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            Rank #{shownRank} of {baseline.total}
            {draft && draft.rank !== baseline.rank && (
              <span
                className={cn(
                  "ml-1",
                  draft.rank < baseline.rank ? "text-signal-positive" : "text-signal-stale"
                )}
              >
                ({draft.rank < baseline.rank ? "↑" : "↓"} from #{baseline.rank})
              </span>
            )}
          </span>
        </div>

        <ScoreWaterfall pillars={shown.pillars} total={shown.total} />

        {draft && (
          <p className="text-xs text-muted-foreground">
            What-if preview only — not saved. Baseline ({activePresetName}): {baseline.mine.total.toFixed(1)}.
          </p>
        )}
      </div>

      <div className="lg:border-l lg:border-border lg:pl-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium">What-If</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setWhatIf((v) => !v);
              if (!whatIf) {
                setDraftWeights(activeWeights);
                setDraftPresetName(activePresetName);
              }
            }}
          >
            {whatIf ? <X className="size-3.5" /> : <SlidersHorizontal className="size-3.5" />}
            {whatIf ? "Close" : "Try weights"}
          </Button>
        </div>
        {whatIf ? (
          <WeightsPanel
            weights={draftWeights}
            presetName={draftPresetName}
            onChange={(w, name) => {
              setDraftWeights(normalizeWeights(w));
              setDraftPresetName(name);
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Drag weight sliders to see this org&apos;s rank move live, without
            saving anything.
          </p>
        )}
      </div>
    </div>
  );
}
