import type { SignalInput } from "./types";

export function daysBetween(fromIso: string, today: Date): number {
  const from = new Date(fromIso + "T00:00:00Z");
  const diffMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - from.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/** Decayed point value of a single signal on `today` (Section 7.1). */
export function decayedPoints(signal: SignalInput, today: Date): number {
  if (signal.isPersistent) return signal.basePoints;
  if (!signal.halfLifeDays || signal.halfLifeDays <= 0) return signal.basePoints;
  const days = daysBetween(signal.eventDate, today);
  if (days < 0) return signal.basePoints; // future-dated signal, not yet decaying
  return signal.basePoints * Math.pow(0.5, days / signal.halfLifeDays);
}

/** Fraction (0-1) of a signal's original value remaining — powers the decay-curve UI. */
export function decayFraction(signal: SignalInput, today: Date): number {
  if (signal.basePoints === 0) return 0;
  return decayedPoints(signal, today) / signal.basePoints;
}
