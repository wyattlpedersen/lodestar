import { describe, expect, it } from "vitest";
import { computeConfidence } from "../confidence";
import type { ConfidenceInputs } from "../types";

const base = (overrides: Partial<ConfidenceInputs>): ConfidenceInputs => ({
  latestFilingAgeMonths: 10,
  yearsWithFinancialData: 5,
  activeSignalsWithSourceCount: 3,
  analystVerified: true,
  ...overrides,
});

describe("computeConfidence", () => {
  it("awards full marks across the board for a pristine profile", () => {
    const { score, grade } = computeConfidence(base({}));
    expect(score).toBe(100);
    expect(grade).toBe("A");
  });

  it("filing recency: <=18mo -> 40, <=30mo -> 25, older -> 10", () => {
    const r18 = computeConfidence(base({ latestFilingAgeMonths: 18, yearsWithFinancialData: 0, activeSignalsWithSourceCount: 0, analystVerified: false }));
    expect(r18.score).toBe(40);
    const r30 = computeConfidence(base({ latestFilingAgeMonths: 30, yearsWithFinancialData: 0, activeSignalsWithSourceCount: 0, analystVerified: false }));
    expect(r30.score).toBe(25);
    const r99 = computeConfidence(base({ latestFilingAgeMonths: 99, yearsWithFinancialData: 0, activeSignalsWithSourceCount: 0, analystVerified: false }));
    expect(r99.score).toBe(10);
  });

  it("financial-fields bonus requires exactly >= 3 years, not more", () => {
    const two = computeConfidence(base({ yearsWithFinancialData: 2, latestFilingAgeMonths: null, activeSignalsWithSourceCount: 0, analystVerified: false }));
    const three = computeConfidence(base({ yearsWithFinancialData: 3, latestFilingAgeMonths: null, activeSignalsWithSourceCount: 0, analystVerified: false }));
    expect(two.score).toBe(0);
    expect(three.score).toBe(30);
  });

  it("sourced-signal bonus requires exactly >= 2, not 1", () => {
    const one = computeConfidence(base({ activeSignalsWithSourceCount: 1, latestFilingAgeMonths: null, yearsWithFinancialData: 0, analystVerified: false }));
    const twoSignals = computeConfidence(base({ activeSignalsWithSourceCount: 2, latestFilingAgeMonths: null, yearsWithFinancialData: 0, analystVerified: false }));
    expect(one.score).toBe(0);
    expect(twoSignals.score).toBe(20);
  });

  it("grade boundaries: A >= 80, B >= 55, C < 55", () => {
    expect(computeConfidence(base({ latestFilingAgeMonths: 10, yearsWithFinancialData: 5, activeSignalsWithSourceCount: 3, analystVerified: true })).grade).toBe("A");
    // 40 (recent) + 30 (fields) = 70 -> exactly a B
    expect(
      computeConfidence({
        latestFilingAgeMonths: 10,
        yearsWithFinancialData: 5,
        activeSignalsWithSourceCount: 0,
        analystVerified: false,
      }).grade
    ).toBe("B");
    // only filing recency (40) -> C
    expect(
      computeConfidence({
        latestFilingAgeMonths: 10,
        yearsWithFinancialData: 0,
        activeSignalsWithSourceCount: 0,
        analystVerified: false,
      }).grade
    ).toBe("C");
  });

  it("handles a fully missing profile gracefully", () => {
    const result = computeConfidence({
      latestFilingAgeMonths: null,
      yearsWithFinancialData: 0,
      activeSignalsWithSourceCount: 0,
      analystVerified: false,
    });
    expect(result.score).toBe(0);
    expect(result.grade).toBe("C");
  });
});
