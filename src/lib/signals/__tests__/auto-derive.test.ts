import { describe, expect, it } from "vitest";
import { deriveAutoSignals, ASSUMED_70_30_ANNUAL_RETURN } from "../auto-derive";
import type { FilingLike } from "@/lib/derived-financials";

const today = new Date("2026-07-06T00:00:00Z");

function filing(overrides: Partial<FilingLike> & { taxYear: number }): FilingLike {
  return {
    totalRevenue: 1_000_000,
    totalExpenses: 500_000,
    totalAssets: 10_000_000,
    totalLiabilities: 100_000,
    contributions: 100_000,
    ...overrides,
  };
}

describe("deriveAutoSignals — ASSET_DROP", () => {
  it("fires when assets drop >= 15% YoY", () => {
    const filings = [
      filing({ taxYear: 2023, totalAssets: 8_000_000 }),
      filing({ taxYear: 2022, totalAssets: 10_000_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "ASSET_DROP")).toBe(true);
  });

  it("does not fire on a 10% drop", () => {
    const filings = [
      filing({ taxYear: 2023, totalAssets: 9_000_000 }),
      filing({ taxYear: 2022, totalAssets: 10_000_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "ASSET_DROP")).toBe(false);
  });
});

describe("deriveAutoSignals — CONTRIB_SPIKE", () => {
  it("fires when contributions exceed 2x the trailing 3yr average", () => {
    const filings = [
      filing({ taxYear: 2023, contributions: 500_000 }),
      filing({ taxYear: 2022, contributions: 100_000 }),
      filing({ taxYear: 2021, contributions: 100_000 }),
      filing({ taxYear: 2020, contributions: 100_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "CONTRIB_SPIKE")).toBe(true);
  });

  it("never fabricates when fewer than 3 full prior years exist", () => {
    const filings = [
      filing({ taxYear: 2023, contributions: 500_000 }),
      filing({ taxYear: 2022, contributions: 100_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "CONTRIB_SPIKE")).toBe(false);
  });

  it("does not fire when a prior year's contribution figure is null", () => {
    const filings = [
      filing({ taxYear: 2023, contributions: 500_000 }),
      filing({ taxYear: 2022, contributions: 100_000 }),
      filing({ taxYear: 2021, contributions: null }),
      filing({ taxYear: 2020, contributions: 100_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "CONTRIB_SPIKE")).toBe(false);
  });
});

describe("deriveAutoSignals — SPENDING_STRESS (persistent)", () => {
  it("fires when payout proxy > 5.5% and assets declined over 2 years", () => {
    const filings = [
      filing({ taxYear: 2023, totalAssets: 8_000_000, totalExpenses: 500_000 }),
      filing({ taxYear: 2022, totalAssets: 9_000_000, totalExpenses: 500_000 }),
      filing({ taxYear: 2021, totalAssets: 10_000_000, totalExpenses: 500_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    const stress = signals.find((s) => s.type === "SPENDING_STRESS");
    expect(stress).toBeDefined();
    expect(stress?.isPersistent).toBe(true);
    expect(stress?.halfLifeDays).toBeNull();
  });

  it("does not fire when assets are flat/growing even with a high payout ratio", () => {
    const filings = [
      filing({ taxYear: 2023, totalAssets: 11_000_000, totalExpenses: 700_000 }),
      filing({ taxYear: 2022, totalAssets: 10_500_000, totalExpenses: 700_000 }),
      filing({ taxYear: 2021, totalAssets: 10_000_000, totalExpenses: 700_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "SPENDING_STRESS")).toBe(false);
  });
});

describe("deriveAutoSignals — PERFORMANCE_GAP (persistent)", () => {
  it("fires when 2yr CAGR trails the 70/30 proxy by more than 300bps", () => {
    // 2yr CAGR here is deeply negative, well below benchmark - 3%
    const filings = [
      filing({ taxYear: 2023, totalAssets: 8_000_000 }),
      filing({ taxYear: 2022, totalAssets: 9_000_000 }),
      filing({ taxYear: 2021, totalAssets: 10_000_000 }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "PERFORMANCE_GAP")).toBe(true);
  });

  it("does not fire when 2yr CAGR is within 300bps of the benchmark", () => {
    // Construct assets so 2yr CAGR ~= ASSUMED_70_30_ANNUAL_RETURN
    const start = 10_000_000;
    const end = start * Math.pow(1 + ASSUMED_70_30_ANNUAL_RETURN, 2);
    const filings = [
      filing({ taxYear: 2023, totalAssets: end }),
      filing({ taxYear: 2022, totalAssets: start * (1 + ASSUMED_70_30_ANNUAL_RETURN) }),
      filing({ taxYear: 2021, totalAssets: start }),
    ];
    const signals = deriveAutoSignals(filings, 12, {}, today);
    expect(signals.some((s) => s.type === "PERFORMANCE_GAP")).toBe(false);
  });
});

describe("deriveAutoSignals — FEE_SPIKE", () => {
  it("only fires when both current and prior manual fee figures are entered", () => {
    const filings = [filing({ taxYear: 2023 })];
    const noFacts = deriveAutoSignals(filings, 12, {}, today);
    expect(noFacts.some((s) => s.type === "FEE_SPIKE")).toBe(false);

    const withFacts = deriveAutoSignals(
      filings,
      12,
      { mgmt_fees_usd: "150000", mgmt_fees_usd_prior: "90000" },
      today
    );
    expect(withFacts.some((s) => s.type === "FEE_SPIKE")).toBe(true);
  });

  it("does not fire below a 50% increase", () => {
    const filings = [filing({ taxYear: 2023 })];
    const signals = deriveAutoSignals(
      filings,
      12,
      { mgmt_fees_usd: "120000", mgmt_fees_usd_prior: "100000" },
      today
    );
    expect(signals.some((s) => s.type === "FEE_SPIKE")).toBe(false);
  });
});

describe("deriveAutoSignals — empty filings", () => {
  it("returns no candidates when there are no filings", () => {
    expect(deriveAutoSignals([], 12, {}, today)).toEqual([]);
  });
});
