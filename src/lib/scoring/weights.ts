import type { WeightProfile } from "./types";

export const WEIGHT_PRESETS: Record<string, WeightProfile> = {
  Balanced: { mim: 0.3, fit: 0.2, access: 0.15, need: 0.15, wealth: 0.1, growth: 0.1 },
  "Event Hunter": { mim: 0.45, fit: 0.15, access: 0.1, need: 0.1, wealth: 0.1, growth: 0.1 },
  "Relationship-Led": { mim: 0.2, fit: 0.15, access: 0.35, need: 0.1, wealth: 0.15, growth: 0.05 },
  "Fee Compressor": { mim: 0.2, fit: 0.2, access: 0.1, need: 0.35, wealth: 0.1, growth: 0.05 },
  "Wealth Gateway": { mim: 0.2, fit: 0.15, access: 0.2, need: 0.1, wealth: 0.3, growth: 0.05 },
};

export const DEFAULT_WEIGHT_PROFILE: WeightProfile = WEIGHT_PRESETS.Balanced;

const EPS = 1e-9;

/** Renormalizes a weight profile so its components always sum to exactly 1.0. */
export function normalizeWeights(weights: WeightProfile): WeightProfile {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum <= EPS) return { ...DEFAULT_WEIGHT_PROFILE };
  const entries = Object.entries(weights) as [keyof WeightProfile, number][];
  return Object.fromEntries(
    entries.map(([k, v]) => [k, v / sum])
  ) as unknown as WeightProfile;
}

export function weightsSumTo1(weights: WeightProfile, tolerance = 1e-6): boolean {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) <= tolerance;
}
