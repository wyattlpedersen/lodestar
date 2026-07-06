import { describe, expect, it } from "vitest";
import {
  entersWithin,
  expectedNextFilingRange,
  next60DaysEvents,
  nextFyeOnOrAfter,
  outreachWindows,
} from "../fiscal-calendar";

describe("nextFyeOnOrAfter", () => {
  it("returns this year's FYE if not yet passed", () => {
    const today = new Date("2026-01-15T00:00:00Z");
    const fye = nextFyeOnOrAfter(12, today);
    expect(fye.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("rolls to next year's FYE if already passed", () => {
    const today = new Date("2026-07-06T00:00:00Z");
    const fye = nextFyeOnOrAfter(6, today); // June FYE, already passed for 2026
    expect(fye.toISOString().slice(0, 10)).toBe("2027-06-30");
  });

  it("handles a same-day FYE as not-yet-passed", () => {
    const today = new Date("2026-12-31T00:00:00Z");
    const fye = nextFyeOnOrAfter(12, today);
    expect(fye.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("expectedNextFilingRange", () => {
  it("spans FYE+11 to FYE+16 months for the year after the latest filing", () => {
    // latest filing 2023 -> next unseen fiscal year is 2024, FYE Dec 31 2024
    const range = expectedNextFilingRange(2023, 12);
    expect(range.start.toISOString().slice(0, 10)).toBe("2025-11-30");
    expect(range.end.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("defaults to a December FYE when none is on file", () => {
    const range = expectedNextFilingRange(2023, null);
    expect(range.start.getUTCMonth()).toBe(10); // November (0-indexed)
  });
});

describe("outreachWindows", () => {
  it("pre-FYE window sits 60-90 days before the FYE", () => {
    const today = new Date("2026-01-01T00:00:00Z");
    const windows = outreachWindows(12, today);
    const daysBefore = (windows.fyeDate.getTime() - windows.preFye.start.getTime()) / 86400000;
    expect(daysBefore).toBe(90);
  });

  it("post-audit window sits 30-60 days after the assumed 4-month audit completion", () => {
    // June FYE avoids month-length clamping ambiguity: Jun 30 + 4mo = Oct 30 exactly.
    const today = new Date("2026-01-01T00:00:00Z");
    const windows = outreachWindows(6, today);
    expect(windows.fyeDate.toISOString().slice(0, 10)).toBe("2026-06-30");
    // audit complete = Jun 30 + 4mo = Oct 30; window = [+30d, +60d] from there
    expect(windows.postAudit.start.toISOString().slice(0, 10)).toBe("2026-11-29");
    expect(windows.postAudit.end.toISOString().slice(0, 10)).toBe("2026-12-29");
  });
});

describe("entersWithin", () => {
  it("true when the window starts within the horizon", () => {
    const today = new Date("2026-01-01T00:00:00Z");
    expect(
      entersWithin({ start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-02-15T00:00:00Z") }, today, 60)
    ).toBe(true);
  });

  it("false when the window starts beyond the horizon", () => {
    const today = new Date("2026-01-01T00:00:00Z");
    expect(
      entersWithin({ start: new Date("2026-06-01T00:00:00Z"), end: new Date("2026-06-15T00:00:00Z") }, today, 60)
    ).toBe(false);
  });

  it("false for a window that already started in the past", () => {
    const today = new Date("2026-06-01T00:00:00Z");
    expect(
      entersWithin({ start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-01-15T00:00:00Z") }, today, 60)
    ).toBe(false);
  });
});

describe("next60DaysEvents", () => {
  it("surfaces orgs entering a window within 60 days, sorted by date", () => {
    const today = new Date("2026-07-06T00:00:00Z");
    // FYE Oct 31 2026 -> pre-FYE window starts Aug 2 2026, which is within 60 days of Jul 6 2026.
    const orgs = [
      { ein: "1", name: "Org A (pre-FYE soon)", fyeMonth: 10, latestFilingYear: 2024 },
      { ein: "2", name: "Org B (nothing soon)", fyeMonth: 2, latestFilingYear: 2024 },
    ];
    const events = next60DaysEvents(orgs, today);
    expect(events.some((e) => e.ein === "1" && e.event === "pre_fye_window")).toBe(true);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].windowStart.getTime()).toBeGreaterThanOrEqual(
        events[i - 1].windowStart.getTime()
      );
    }
  });

  it("omits orgs with no filing history from the expected-filing event", () => {
    const today = new Date("2026-07-06T00:00:00Z");
    const orgs = [{ ein: "1", name: "No Filings Org", fyeMonth: 12, latestFilingYear: null }];
    const events = next60DaysEvents(orgs, today);
    expect(events.every((e) => e.event !== "expected_filing")).toBe(true);
  });
});
