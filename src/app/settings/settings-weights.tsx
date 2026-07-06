"use client";

import * as React from "react";
import { WeightsPanel } from "@/components/scoring/weights-panel";
import { DEFAULT_WEIGHT_PROFILE } from "@/lib/scoring/weights";
import type { WeightProfile } from "@/lib/scoring/types";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsWeights() {
  const [loading, setLoading] = React.useState(true);
  const [weights, setWeights] = React.useState<WeightProfile>(DEFAULT_WEIGHT_PROFILE);
  const [presetName, setPresetName] = React.useState("Balanced");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    fetch("/api/settings/weights")
      .then((r) => r.json())
      .then((data) => {
        setWeights(data.weights);
        setPresetName(data.name);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(w: WeightProfile, name: string) {
    setWeights(w);
    setPresetName(name);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("/api/settings/weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights: w, name }),
      }).catch(() => {});
    }, 400);
  }

  if (loading) {
    return (
      <div className="max-w-md space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-md p-6">
      <h2 className="mb-1 font-display text-sm font-medium">Scoring weights</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Drives the Rankings Board and every org&apos;s score waterfall. Changes
        apply the next time a page loads or rescores.
      </p>
      <WeightsPanel weights={weights} presetName={presetName} onChange={handleChange} />
    </div>
  );
}
