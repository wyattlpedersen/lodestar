/**
 * Fiscal calendar intelligence (Section 9, F7). All dates are UTC day-granularity.
 *
 * Assumptions (see ASSUMPTIONS.md):
 * - "Expected next public 990" range = next fiscal year end (FYE) + 11 to +16
 *   months, the honestly-labeled typical ProPublica extraction lag.
 * - "Expected audit completion" (no such field exists in 990 data) is
 *   approximated as FYE + 4 months, a common nonprofit audited-financials
 *   turnaround; the post-audit outreach window is [that + 30, that + 60] days.
 * - Pre-FYE budget/planning window is [FYE - 90, FYE - 60] days.
 */

function fyeDateForYear(fyeMonth: number, year: number): Date {
  const lastDay = new Date(Date.UTC(year, fyeMonth, 0)).getUTCDate();
  return new Date(Date.UTC(year, fyeMonth - 1, lastDay));
}

/** Adds calendar months, clamping to the last valid day of the target month (e.g. Jan 31 + 1mo = Feb 28/29, never rolling into March). */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/** The next FYE date at or after `today` (this year's FYE if not yet passed, else next year's). */
export function nextFyeOnOrAfter(fyeMonth: number, today: Date): Date {
  let candidate = fyeDateForYear(fyeMonth, today.getUTCFullYear());
  if (candidate < today) {
    candidate = fyeDateForYear(fyeMonth, today.getUTCFullYear() + 1);
  }
  return candidate;
}

export interface DateRange {
  start: Date;
  end: Date;
}

/** Range in which the *next* filing (for the fiscal year after `latestFilingYear`) is expected to become public. */
export function expectedNextFilingRange(
  latestFilingYear: number,
  fyeMonth: number | null
): DateRange {
  const month = fyeMonth ?? 12;
  const nextFye = fyeDateForYear(month, latestFilingYear + 1);
  return { start: addMonths(nextFye, 11), end: addMonths(nextFye, 16) };
}

export interface OutreachWindows {
  preFye: DateRange;
  postAudit: DateRange;
  fyeDate: Date;
}

/** This cycle's pre-FYE and post-audit outreach windows, anchored to the next upcoming FYE. */
export function outreachWindows(fyeMonth: number | null, today: Date): OutreachWindows {
  const month = fyeMonth ?? 12;
  const fyeDate = nextFyeOnOrAfter(month, today);
  const auditComplete = addMonths(fyeDate, 4);
  return {
    fyeDate,
    preFye: { start: addDays(fyeDate, -90), end: addDays(fyeDate, -60) },
    postAudit: { start: addDays(auditComplete, 30), end: addDays(auditComplete, 60) },
  };
}

/** Does `range.start` fall within the next `horizonDays` days from `today`? */
export function entersWithin(range: DateRange, today: Date, horizonDays = 60): boolean {
  const horizon = addDays(today, horizonDays);
  return range.start >= today && range.start <= horizon;
}

export interface Next60DaysEntry {
  ein: string;
  name: string;
  event: "pre_fye_window" | "post_audit_window" | "expected_filing";
  windowStart: Date;
  windowEnd: Date;
}

export function next60DaysEvents(
  orgs: { ein: string; name: string; fyeMonth: number | null; latestFilingYear: number | null }[],
  today: Date = new Date()
): Next60DaysEntry[] {
  const entries: Next60DaysEntry[] = [];
  for (const org of orgs) {
    const windows = outreachWindows(org.fyeMonth, today);
    if (entersWithin(windows.preFye, today)) {
      entries.push({
        ein: org.ein,
        name: org.name,
        event: "pre_fye_window",
        windowStart: windows.preFye.start,
        windowEnd: windows.preFye.end,
      });
    }
    if (entersWithin(windows.postAudit, today)) {
      entries.push({
        ein: org.ein,
        name: org.name,
        event: "post_audit_window",
        windowStart: windows.postAudit.start,
        windowEnd: windows.postAudit.end,
      });
    }
    if (org.latestFilingYear != null) {
      const filingRange = expectedNextFilingRange(org.latestFilingYear, org.fyeMonth);
      if (entersWithin(filingRange, today)) {
        entries.push({
          ein: org.ein,
          name: org.name,
          event: "expected_filing",
          windowStart: filingRange.start,
          windowEnd: filingRange.end,
        });
      }
    }
  }
  return entries.sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime());
}
