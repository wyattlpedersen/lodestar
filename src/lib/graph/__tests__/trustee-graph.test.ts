import { describe, expect, it } from "vitest";
import {
  buildTrusteeGraph,
  findPath,
  hasJpmAlumOnBoard,
  hasSecondDegreePath,
  hasSuperConnectorOnBoard,
  hasWarmPath,
  isSuperConnector,
  principalUhnwTrusteeCount,
  superConnectorCount,
  type AffiliationEdge,
  type PersonNode,
} from "../trustee-graph";

const people: PersonNode[] = [
  { id: 1, fullName: "Jane Doe", isKnownContact: true, isJpmAlum: false, isPrincipalUhnw: false },
  { id: 2, fullName: "John Smith", isKnownContact: false, isJpmAlum: true, isPrincipalUhnw: false },
  { id: 3, fullName: "Alice Connector", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: false },
  { id: 4, fullName: "Bob Rich", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: true },
  { id: 5, fullName: "Carol Rich", isKnownContact: false, isJpmAlum: false, isPrincipalUhnw: true },
];

// Alice (id 3) sits on 3 boards -> super-connector. Jane (1) only on org "A".
const affiliations: AffiliationEdge[] = [
  { personId: 1, ein: "A", isCurrent: true },
  { personId: 2, ein: "B", isCurrent: true },
  { personId: 3, ein: "A", isCurrent: true },
  { personId: 3, ein: "C", isCurrent: true },
  { personId: 3, ein: "D", isCurrent: true },
  { personId: 4, ein: "B", isCurrent: true },
  { personId: 5, ein: "B", isCurrent: true },
  { personId: 1, ein: "E", isCurrent: false }, // not current — should be excluded
];

const orgNames = new Map([
  ["A", "Org A"],
  ["B", "Org B"],
  ["C", "Org C"],
  ["D", "Org D"],
  ["E", "Org E"],
]);

describe("buildTrusteeGraph + super-connector index", () => {
  const graph = buildTrusteeGraph(affiliations, people);

  it("counts distinct current boards per person", () => {
    expect(superConnectorCount(graph, 3)).toBe(3); // Alice: A, C, D
    expect(superConnectorCount(graph, 1)).toBe(1); // Jane: only A (E excluded, not current)
  });

  it("flags super-connectors at >=3 boards, not 2", () => {
    expect(isSuperConnector(graph, 3)).toBe(true);
    const twoboarder: AffiliationEdge[] = [
      { personId: 9, ein: "X", isCurrent: true },
      { personId: 9, ein: "Y", isCurrent: true },
    ];
    const g2 = buildTrusteeGraph(twoboarder, []);
    expect(isSuperConnector(g2, 9)).toBe(false);
  });

  it("excludes non-current affiliations from the graph entirely", () => {
    expect(graph.orgToPeople.get("E")).toBeUndefined();
  });
});

describe("board-level factors", () => {
  const graph = buildTrusteeGraph(affiliations, people);

  it("hasWarmPath: true only when a known-contact person sits on the board", () => {
    expect(hasWarmPath(graph, "A")).toBe(true); // Jane
    expect(hasWarmPath(graph, "B")).toBe(false);
  });

  it("hasJpmAlumOnBoard", () => {
    expect(hasJpmAlumOnBoard(graph, "B")).toBe(true); // John
    expect(hasJpmAlumOnBoard(graph, "A")).toBe(false);
  });

  it("hasSuperConnectorOnBoard reflects Alice's 3-board status", () => {
    expect(hasSuperConnectorOnBoard(graph, "A")).toBe(true);
    expect(hasSuperConnectorOnBoard(graph, "C")).toBe(true);
    expect(hasSuperConnectorOnBoard(graph, "B")).toBe(false);
  });

  it("principalUhnwTrusteeCount counts flagged trustees on that org's board", () => {
    expect(principalUhnwTrusteeCount(graph, "B")).toBe(2); // Bob + Carol
    expect(principalUhnwTrusteeCount(graph, "A")).toBe(0);
  });
});

describe("hasSecondDegreePath", () => {
  const graph = buildTrusteeGraph(affiliations, people);

  it("true when a shared trustee also sits on a relationship-marked org", () => {
    // Alice sits on A and C; if C is relationship-marked, A gets a second-degree path
    expect(hasSecondDegreePath(graph, "A", new Set(["C"]))).toBe(true);
  });

  it("false when no shared trustee connects to any relationship-marked org", () => {
    expect(hasSecondDegreePath(graph, "A", new Set(["B"]))).toBe(false);
  });

  it("does not count the org's own relationship-marked status via itself", () => {
    expect(hasSecondDegreePath(graph, "A", new Set(["A"]))).toBe(false);
  });
});

describe("findPath (BFS path finder)", () => {
  const graph = buildTrusteeGraph(affiliations, people);

  it("finds a direct 1-hop known-contact path", () => {
    const result = findPath(graph, "A", new Set(), orgNames);
    expect(result?.anchorType).toBe("known_contact");
    expect(result?.hops).toBe(1);
    expect(result?.chain.map((c) => c.label)).toEqual(["Org A", "Jane Doe"]);
  });

  it("finds a 2-hop second-degree path to a relationship-marked org via a shared trustee", () => {
    // From D: Alice sits on D, and also on C. If C is relationship-marked...
    const result = findPath(graph, "D", new Set(["C"]), orgNames);
    expect(result?.anchorType).toBe("existing_relationship");
    expect(result?.hops).toBe(2);
    expect(result?.chain.map((c) => c.label)).toEqual(["Org D", "Alice Connector", "Org C"]);
  });

  it("returns null when no path exists within maxHops", () => {
    const isolated = buildTrusteeGraph([], people);
    expect(findPath(isolated, "Z", new Set(["C"]), orgNames)).toBeNull();
  });

  it("prefers the shortest path when both a 1-hop and longer path exist", () => {
    const result = findPath(graph, "A", new Set(["D"]), orgNames);
    // A has direct known-contact (1 hop) via Jane; should return that, not the longer existing-relationship path via Alice->D
    expect(result?.anchorType).toBe("known_contact");
    expect(result?.hops).toBe(1);
  });

  it("respects the maxHops bound", () => {
    // B's only 2nd-degree reach is via John (not known contact) to nowhere new within 1 hop from B other than back to B.
    const result = findPath(graph, "B", new Set(["Z_not_reachable"]), orgNames, 1);
    expect(result).toBeNull();
  });
});
