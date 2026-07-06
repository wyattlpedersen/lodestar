import type { ConfidenceGrade, ConfidenceInputs, FactorRow } from "./types";

function filingAgeScore(ageMonths: number | null): number {
  if (ageMonths == null) return 0;
  if (ageMonths <= 18) return 40;
  if (ageMonths <= 30) return 25;
  return 10;
}

export function computeConfidence(inputs: ConfidenceInputs): {
  score: number;
  grade: ConfidenceGrade;
  factors: FactorRow[];
} {
  const factors: FactorRow[] = [];

  const ageScore = filingAgeScore(inputs.latestFilingAgeMonths);
  factors.push({
    label: "Latest filing recency",
    points: ageScore,
    provenance: "API",
    detail:
      inputs.latestFilingAgeMonths != null
        ? `${inputs.latestFilingAgeMonths.toFixed(0)} months old`
        : "No filing on file",
  });

  const fieldsScore = inputs.yearsWithFinancialData >= 3 ? 30 : 0;
  factors.push({
    label: "Required financial fields present ≥3 years",
    points: fieldsScore,
    provenance: "API",
    detail: `${inputs.yearsWithFinancialData} year(s) of data`,
  });

  const signalsScore = inputs.activeSignalsWithSourceCount >= 2 ? 20 : 0;
  factors.push({
    label: "≥2 active signals with source URLs",
    points: signalsScore,
    provenance: "MANUAL",
    detail: `${inputs.activeSignalsWithSourceCount} sourced signal(s)`,
  });

  const verifiedScore = inputs.analystVerified ? 10 : 0;
  factors.push({
    label: "Analyst verified",
    points: verifiedScore,
    provenance: "MANUAL",
  });

  const score = ageScore + fieldsScore + signalsScore + verifiedScore;
  const grade: ConfidenceGrade = score >= 80 ? "A" : score >= 55 ? "B" : "C";

  return { score, grade, factors };
}
