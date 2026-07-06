import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHT_PROFILE,
  WEIGHT_PRESETS,
  normalizeWeights,
  weightsSumTo1,
} from "../weights";

describe("weight presets", () => {
  it("every named preset sums to 1.0", () => {
    for (const [name, weights] of Object.entries(WEIGHT_PRESETS)) {
      expect(weightsSumTo1(weights), `${name} should sum to 1`).toBe(true);
    }
  });

  it("default profile is Balanced", () => {
    expect(DEFAULT_WEIGHT_PROFILE).toEqual(WEIGHT_PRESETS.Balanced);
  });
});

describe("normalizeWeights", () => {
  it("leaves an already-normalized profile unchanged", () => {
    const normalized = normalizeWeights(WEIGHT_PRESETS.Balanced);
    expect(weightsSumTo1(normalized)).toBe(true);
    expect(normalized.mim).toBeCloseTo(0.3, 6);
  });

  it("rescales an arbitrary profile so components sum to exactly 1", () => {
    const result = normalizeWeights({
      mim: 3,
      fit: 2,
      access: 1,
      need: 1,
      wealth: 1,
      growth: 2,
    });
    expect(weightsSumTo1(result)).toBe(true);
    expect(result.mim).toBeCloseTo(0.3, 6);
    expect(result.fit).toBeCloseTo(0.2, 6);
  });

  it("preserves relative proportions after normalization", () => {
    const result = normalizeWeights({
      mim: 10,
      fit: 10,
      access: 10,
      need: 10,
      wealth: 10,
      growth: 10,
    });
    // all equal inputs -> all equal outputs at 1/6
    for (const v of Object.values(result)) {
      expect(v).toBeCloseTo(1 / 6, 6);
    }
  });

  it("falls back to the default profile when all weights are zero", () => {
    const result = normalizeWeights({ mim: 0, fit: 0, access: 0, need: 0, wealth: 0, growth: 0 });
    expect(result).toEqual(DEFAULT_WEIGHT_PROFILE);
  });

  it("handles a single non-zero weight by putting all mass on it", () => {
    const result = normalizeWeights({ mim: 5, fit: 0, access: 0, need: 0, wealth: 0, growth: 0 });
    expect(result.mim).toBeCloseTo(1, 6);
    expect(result.fit).toBe(0);
  });
});
