import { describe, expect, it } from "vitest";
import { decayedPoints, decayFraction, daysBetween } from "../decay";
import type { SignalInput } from "../types";

function signal(overrides: Partial<SignalInput> = {}): SignalInput {
  return {
    id: 1,
    type: "RFP_ANNOUNCED",
    headline: "Test signal",
    basePoints: 100,
    halfLifeDays: 90,
    isPersistent: false,
    eventDate: "2026-01-01",
    active: true,
    hasSourceUrl: true,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("computes whole-day differences in UTC", () => {
    expect(daysBetween("2026-01-01", new Date("2026-01-11T00:00:00Z"))).toBe(10);
  });
});

describe("decayedPoints", () => {
  it("returns full base points at day 0", () => {
    const s = signal({ eventDate: "2026-07-06" });
    expect(decayedPoints(s, new Date("2026-07-06T00:00:00Z"))).toBeCloseTo(100, 5);
  });

  it("halves at exactly one half-life", () => {
    const s = signal({ basePoints: 100, halfLifeDays: 90, eventDate: "2026-01-01" });
    const today = new Date("2026-04-01T00:00:00Z"); // 90 days later
    expect(decayedPoints(s, today)).toBeCloseTo(50, 1);
  });

  it("quarters at two half-lives", () => {
    const s = signal({ basePoints: 100, halfLifeDays: 90, eventDate: "2026-01-01" });
    const today = new Date("2026-06-30T00:00:00Z"); // 180 days later
    expect(decayedPoints(s, today)).toBeCloseTo(25, 1);
  });

  it("never goes negative or divides by zero as time extends far out", () => {
    const s = signal({ basePoints: 100, halfLifeDays: 30, eventDate: "2020-01-01" });
    const points = decayedPoints(s, new Date("2026-07-06T00:00:00Z"));
    expect(points).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(points)).toBe(true);
  });

  it("persistent signals are not decayed regardless of age", () => {
    const s = signal({
      basePoints: 60,
      halfLifeDays: null,
      isPersistent: true,
      eventDate: "2010-01-01",
    });
    expect(decayedPoints(s, new Date("2026-07-06T00:00:00Z"))).toBe(60);
  });

  it("treats a missing half-life on a non-persistent signal as non-decaying", () => {
    const s = signal({ basePoints: 45, halfLifeDays: null, isPersistent: false, eventDate: "2020-01-01" });
    expect(decayedPoints(s, new Date("2026-07-06T00:00:00Z"))).toBe(45);
  });

  it("does not decay (or invert) a future-dated signal", () => {
    const s = signal({ basePoints: 80, halfLifeDays: 90, eventDate: "2027-01-01" });
    expect(decayedPoints(s, new Date("2026-07-06T00:00:00Z"))).toBe(80);
  });
});

describe("decayFraction", () => {
  it("is 1.0 at day zero and 0.5 at one half-life", () => {
    const s = signal({ basePoints: 100, halfLifeDays: 90, eventDate: "2026-01-01" });
    expect(decayFraction(s, new Date("2026-01-01T00:00:00Z"))).toBeCloseTo(1, 5);
    expect(decayFraction(s, new Date("2026-04-01T00:00:00Z"))).toBeCloseTo(0.5, 1);
  });

  it("handles a zero-base-points signal without NaN", () => {
    const s = signal({ basePoints: 0 });
    expect(decayFraction(s, new Date())).toBe(0);
  });
});
