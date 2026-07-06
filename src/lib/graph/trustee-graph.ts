/** Pipeline stages treated as an "existing relationship" for Access pillar / Path Finder purposes (Section 7.3 / F6) — see ASSUMPTIONS.md. */
export const RELATIONSHIP_PIPELINE_STAGES = new Set(["meeting", "proposal", "won"]);

export interface AffiliationEdge {
  personId: number;
  ein: string;
  isCurrent: boolean;
}

export interface PersonNode {
  id: number;
  fullName: string;
  isKnownContact: boolean;
  isJpmAlum: boolean;
  isPrincipalUhnw: boolean;
}

export interface TrusteeGraph {
  orgToPeople: Map<string, number[]>;
  personToOrgs: Map<number, string[]>;
  peopleById: Map<number, PersonNode>;
}

/** Builds the bipartite org<->person graph from *current* affiliations only. */
export function buildTrusteeGraph(
  affiliations: AffiliationEdge[],
  people: PersonNode[]
): TrusteeGraph {
  const orgToPeople = new Map<string, number[]>();
  const personToOrgs = new Map<number, string[]>();
  const peopleById = new Map(people.map((p) => [p.id, p]));

  for (const a of affiliations) {
    if (!a.isCurrent) continue;
    if (!orgToPeople.has(a.ein)) orgToPeople.set(a.ein, []);
    if (!orgToPeople.get(a.ein)!.includes(a.personId)) orgToPeople.get(a.ein)!.push(a.personId);

    if (!personToOrgs.has(a.personId)) personToOrgs.set(a.personId, []);
    if (!personToOrgs.get(a.personId)!.includes(a.ein)) personToOrgs.get(a.personId)!.push(a.ein);
  }

  return { orgToPeople, personToOrgs, peopleById };
}

/** Count of distinct current-universe boards a person sits on. */
export function superConnectorCount(graph: TrusteeGraph, personId: number): number {
  return graph.personToOrgs.get(personId)?.length ?? 0;
}

export function isSuperConnector(graph: TrusteeGraph, personId: number): boolean {
  return superConnectorCount(graph, personId) >= 3;
}

export function boardMembers(graph: TrusteeGraph, ein: string): PersonNode[] {
  return (graph.orgToPeople.get(ein) ?? [])
    .map((pid) => graph.peopleById.get(pid))
    .filter((p): p is PersonNode => !!p);
}

export function hasWarmPath(graph: TrusteeGraph, ein: string): boolean {
  return boardMembers(graph, ein).some((p) => p.isKnownContact);
}

export function hasJpmAlumOnBoard(graph: TrusteeGraph, ein: string): boolean {
  return boardMembers(graph, ein).some((p) => p.isJpmAlum);
}

export function hasSuperConnectorOnBoard(graph: TrusteeGraph, ein: string): boolean {
  return boardMembers(graph, ein).some((p) => isSuperConnector(graph, p.id));
}

export function principalUhnwTrusteeCount(graph: TrusteeGraph, ein: string): number {
  return boardMembers(graph, ein).filter((p) => p.isPrincipalUhnw).length;
}

/**
 * "Second-degree path": target shares a board member with some OTHER org that
 * is itself relationship-marked (Section 7.3's literal phrasing).
 */
export function hasSecondDegreePath(
  graph: TrusteeGraph,
  ein: string,
  relationshipEins: Set<string>
): boolean {
  for (const personId of graph.orgToPeople.get(ein) ?? []) {
    const otherOrgs = graph.personToOrgs.get(personId) ?? [];
    if (otherOrgs.some((other) => other !== ein && relationshipEins.has(other))) {
      return true;
    }
  }
  return false;
}

export type PathAnchorType = "known_contact" | "existing_relationship";

export interface PathChainNode {
  type: "org" | "person";
  id: string | number;
  label: string;
}

export interface PathResult {
  anchorType: PathAnchorType;
  hops: number;
  chain: PathChainNode[];
}

/**
 * BFS over the org<->person bipartite graph, <=`maxHops` edges from the target
 * org, returning the shortest chain that reaches either a known-contact person
 * or an org marked "existing relationship". BFS guarantees the first match
 * found is the shortest (F6 Path Finder).
 */
export function findPath(
  graph: TrusteeGraph,
  targetEin: string,
  relationshipEins: Set<string>,
  orgNames: Map<string, string>,
  maxHops = 3
): PathResult | null {
  type QueueItem = {
    type: "org" | "person";
    id: string | number;
    chain: PathChainNode[];
  };

  const startLabel = orgNames.get(targetEin) ?? targetEin;
  const queue: QueueItem[] = [
    { type: "org", id: targetEin, chain: [{ type: "org", id: targetEin, label: startLabel }] },
  ];
  const visitedOrgs = new Set<string>([targetEin]);
  const visitedPeople = new Set<number>();

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const hops = current.chain.length - 1;
    if (hops >= maxHops) continue;

    if (current.type === "org") {
      const people = graph.orgToPeople.get(current.id as string) ?? [];
      for (const personId of people) {
        if (visitedPeople.has(personId)) continue;
        visitedPeople.add(personId);
        const person = graph.peopleById.get(personId);
        if (!person) continue;
        const chain: PathChainNode[] = [
          ...current.chain,
          { type: "person", id: personId, label: person.fullName },
        ];
        if (person.isKnownContact) {
          return { anchorType: "known_contact", hops: chain.length - 1, chain };
        }
        queue.push({ type: "person", id: personId, chain });
      }
    } else {
      const orgs = graph.personToOrgs.get(current.id as number) ?? [];
      for (const ein of orgs) {
        if (visitedOrgs.has(ein)) continue;
        visitedOrgs.add(ein);
        const chain: PathChainNode[] = [
          ...current.chain,
          { type: "org", id: ein, label: orgNames.get(ein) ?? ein },
        ];
        if (relationshipEins.has(ein)) {
          return { anchorType: "existing_relationship", hops: chain.length - 1, chain };
        }
        queue.push({ type: "org", id: ein, chain });
      }
    }
  }

  return null;
}
