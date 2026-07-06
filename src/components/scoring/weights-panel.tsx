"use client";

import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEIGHT_PRESETS, normalizeWeights } from "@/lib/scoring/weights";
import { PILLAR_KEYS, type PillarKey, type WeightProfile } from "@/lib/scoring/types";

const PILLAR_LABELS: Record<PillarKey, string> = {
  mim: "Money in Motion",
  fit: "Scale & Mandate Fit",
  access: "Access & Connectivity",
  need: "Need & Vulnerability",
  wealth: "Wealth Adjacency",
  growth: "Growth & Expansion",
};

export function WeightsPanel({
  weights,
  presetName,
  onChange,
}: {
  weights: WeightProfile;
  presetName: string;
  onChange: (weights: WeightProfile, presetName: string) => void;
}) {
  const normalized = normalizeWeights(weights);

  function handlePreset(name: string) {
    onChange(WEIGHT_PRESETS[name], name);
  }

  function handleSlider(key: PillarKey, value: number) {
    onChange({ ...weights, [key]: value }, "Custom");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">Weight preset</span>
        <Select value={presetName} onValueChange={(v) => v && handlePreset(v)}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(WEIGHT_PRESETS).map((name) => (
              <SelectItem key={name} value={name} className="text-xs">
                {name}
              </SelectItem>
            ))}
            <SelectItem value="Custom" disabled className="text-xs">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {PILLAR_KEYS.map((key) => (
          <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>{PILLAR_LABELS[key]}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {Math.round(normalized[key] * 100)}%
                </span>
              </div>
              <Slider
                value={[weights[key] * 100]}
                max={60}
                step={1}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v;
                  handleSlider(key, n / 100);
                }}
                className="[&_[data-slot=slider-range]]:bg-gold [&_[data-slot=slider-thumb]]:border-gold"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Weights renormalize to 100% automatically — the ratios between sliders are
        what drive the rank.
      </p>
    </div>
  );
}
