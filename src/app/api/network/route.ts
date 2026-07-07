import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { affiliations, organizations, people } from "@/lib/db/schema";
import { superConnectorCount, buildTrusteeGraph } from "@/lib/graph/trustee-graph";

/**
 * Whole-universe trustee network — every current org<->person affiliation,
 * for the Network visualization. Distinct from the per-org Path Finder,
 * which only BFS's from one target org.
 */
export async function GET() {
  const [allOrgs, allPeople, allAffiliations] = await Promise.all([
    db
      .select({
        ein: organizations.ein,
        name: organizations.name,
        latestAssets: organizations.latestAssets,
        orgType: organizations.orgType,
      })
      .from(organizations),
    db.select().from(people),
    db.select().from(affiliations),
  ]);

  const current = allAffiliations.filter((a) => a.isCurrent);
  const graph = buildTrusteeGraph(
    current.map((a) => ({ personId: a.personId, ein: a.ein, isCurrent: a.isCurrent })),
    allPeople.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      isKnownContact: p.isKnownContact,
      isJpmAlum: p.isJpmAlum,
      isPrincipalUhnw: p.isPrincipalUhnw,
    }))
  );

  // Only include orgs/people that actually appear in at least one current affiliation.
  const involvedEins = new Set(current.map((a) => a.ein));
  const involvedPersonIds = new Set(current.map((a) => a.personId));

  const nodes = [
    ...allOrgs
      .filter((o) => involvedEins.has(o.ein))
      .map((o) => ({
        id: `org:${o.ein}`,
        type: "org" as const,
        ein: o.ein,
        label: o.name,
        latestAssets: o.latestAssets,
        orgType: o.orgType,
      })),
    ...allPeople
      .filter((p) => involvedPersonIds.has(p.id))
      .map((p) => ({
        id: `person:${p.id}`,
        type: "person" as const,
        personId: p.id,
        label: p.fullName,
        isKnownContact: p.isKnownContact,
        isJpmAlum: p.isJpmAlum,
        isPrincipalUhnw: p.isPrincipalUhnw,
        boardCount: superConnectorCount(graph, p.id),
        tag: p.tag,
      })),
  ];

  const links = current.map((a) => ({
    source: `org:${a.ein}`,
    target: `person:${a.personId}`,
    role: a.role,
  }));

  return NextResponse.json({ nodes, links });
}
