import { db } from "@/lib/db";
import { affiliations, organizations, people, pipeline } from "@/lib/db/schema";
import { buildTrusteeGraph, RELATIONSHIP_PIPELINE_STAGES } from "./trustee-graph";

export async function loadTrusteeGraphContext() {
  const [allAffiliations, allPeople, allPipeline, allOrgs] = await Promise.all([
    db.select().from(affiliations),
    db.select().from(people),
    db.select().from(pipeline),
    db.select({ ein: organizations.ein, name: organizations.name }).from(organizations),
  ]);

  const graph = buildTrusteeGraph(
    allAffiliations.map((a) => ({ personId: a.personId, ein: a.ein, isCurrent: a.isCurrent })),
    allPeople.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      isKnownContact: p.isKnownContact,
      isJpmAlum: p.isJpmAlum,
      isPrincipalUhnw: p.isPrincipalUhnw,
    }))
  );

  const relationshipEins = new Set(
    allPipeline.filter((p) => RELATIONSHIP_PIPELINE_STAGES.has(p.stage)).map((p) => p.ein)
  );
  const orgNames = new Map(allOrgs.map((o) => [o.ein, o.name]));

  return { graph, relationshipEins, orgNames };
}
