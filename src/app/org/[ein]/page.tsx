import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { organizations, filings, manualFacts, settings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computeDerivedFinancials } from "@/lib/derived-financials";
import { nteeMajorLabel } from "@/lib/propublica/ntee";
import { buildScoringInputsForUniverse } from "@/lib/scoring/context";
import { DEFAULT_WEIGHT_PROFILE } from "@/lib/scoring/weights";
import type { WeightProfile } from "@/lib/scoring/types";
import { OrgDossier } from "./org-dossier";

export default async function OrgDossierPage({
  params,
}: {
  params: Promise<{ ein: string }>;
}) {
  const { ein } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.ein, ein),
  });

  if (!org) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={`EIN ${ein}`} description="Org Dossier" />
        <EmptyState
          icon={Building2}
          title="Org not found"
          description="This EIN isn't in your universe yet. Add it from the Universe Builder to hydrate its filings and start scoring."
        />
      </div>
    );
  }

  const [orgFilings, facts, inputs, weightRow] = await Promise.all([
    db.select().from(filings).where(eq(filings.ein, ein)).orderBy(desc(filings.taxYear)),
    db.select().from(manualFacts).where(eq(manualFacts.ein, ein)),
    buildScoringInputsForUniverse(),
    db.query.settings.findFirst({ where: eq(settings.key, "active_weight_profile") }),
  ]);

  const derived = computeDerivedFinancials(orgFilings);
  const weightProfile =
    (weightRow?.value as { name: string; weights: WeightProfile } | undefined) ?? {
      name: "Balanced",
      weights: DEFAULT_WEIGHT_PROFILE,
    };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={org.name}
        description={`EIN ${org.ein} · ${nteeMajorLabel(org.nteeMajor)} · ${
          org.city ?? "—"
        }, ${org.state ?? "—"}${org.county ? ` (${org.county} County)` : ""}`}
      />
      <OrgDossier
        org={org}
        filings={orgFilings}
        manualFacts={facts}
        derived={derived}
        inputs={inputs}
        activeWeights={weightProfile.weights}
        activePresetName={weightProfile.name}
      />
    </div>
  );
}
