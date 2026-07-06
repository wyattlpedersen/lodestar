/**
 * ProPublica's `ntee[id]` major-group integers map to NTEE letter-code prefixes.
 * Confirmed live against the search API on 2026-07-06 — see ASSUMPTIONS.md.
 */
export const NTEE_MAJOR_GROUPS: { id: number; label: string; letters: string[] }[] = [
  { id: 1, label: "Arts, Culture & Humanities", letters: ["A"] },
  { id: 2, label: "Education", letters: ["B"] },
  { id: 3, label: "Environment & Animal-Related", letters: ["C", "D"] },
  { id: 4, label: "Health", letters: ["E", "F", "G", "H"] },
  { id: 5, label: "Human Services", letters: ["I", "J", "K", "L", "M", "N", "O", "P"] },
  { id: 6, label: "International, Foreign Affairs", letters: ["Q"] },
  { id: 7, label: "Public, Societal Benefit", letters: ["R", "S", "T", "U", "V", "W"] },
  { id: 8, label: "Religion Related", letters: ["X"] },
  { id: 9, label: "Mutual/Membership Benefit", letters: ["Y"] },
  { id: 10, label: "Unknown", letters: ["Z"] },
];

export function nteeMajorFromCode(nteeCode: string | null | undefined): number | null {
  if (!nteeCode) return null;
  const letter = nteeCode.trim().charAt(0).toUpperCase();
  const group = NTEE_MAJOR_GROUPS.find((g) => g.letters.includes(letter));
  return group?.id ?? null;
}

export function nteeMajorLabel(major: number | null | undefined): string {
  if (major == null) return "Unclassified";
  return NTEE_MAJOR_GROUPS.find((g) => g.id === major)?.label ?? "Unclassified";
}
