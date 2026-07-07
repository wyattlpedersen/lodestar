"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { EmptyState } from "@/components/empty-state";
import { Share2, Star, Landmark, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OrgNodeData {
  id: string;
  type: "org";
  ein: string;
  label: string;
  latestAssets: number | null;
  orgType: string | null;
}
interface PersonNodeData {
  id: string;
  type: "person";
  personId: number;
  label: string;
  isKnownContact: boolean;
  isJpmAlum: boolean;
  isPrincipalUhnw: boolean;
  boardCount: number;
  tag: string | null;
}
type NodeData = (OrgNodeData | PersonNodeData) & SimulationNodeDatum;
interface LinkData extends SimulationLinkDatum<NodeData> {
  role: string | null;
}

function orgRadius(assets: number | null): number {
  if (!assets) return 7;
  if (assets >= 1_000_000_000) return 15;
  if (assets >= 100_000_000) return 12;
  if (assets >= 25_000_000) return 9.5;
  return 7.5;
}

function personRadius(boardCount: number): number {
  return 5 + Math.min(boardCount, 5) * 1.4;
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function NetworkGraph() {
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const nodeRefs = React.useRef<Map<string, SVGGElement>>(new Map());
  const linkRefs = React.useRef<Map<number, SVGLineElement>>(new Map());
  const simRef = React.useRef<Simulation<NodeData, LinkData> | null>(null);
  // Static graph structure lives in state (read during render). Live x/y
  // positions from the simulation are mutated in-place on these same node
  // objects and pushed to the DOM imperatively via refs on every tick — that
  // path intentionally bypasses React for performance and never touches render.
  const [graphData, setGraphData] = React.useState<{ nodes: NodeData[]; links: LinkData[] } | null>(null);
  const [adjacency, setAdjacency] = React.useState<Map<string, Set<string>>>(new Map());

  const [loading, setLoading] = React.useState(true);
  const [empty, setEmpty] = React.useState(false);
  const [selected, setSelected] = React.useState<NodeData | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [transform, setTransform] = React.useState({ x: 0, y: 0, k: 1 });
  const dragState = React.useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  React.useEffect(() => {
    fetch("/api/network")
      .then((r) => r.json())
      .then((raw: { nodes: (OrgNodeData | PersonNodeData)[]; links: { source: string; target: string; role: string | null }[] }) => {
        if (raw.nodes.length === 0) {
          setEmpty(true);
          return;
        }

        const width = containerRef.current?.clientWidth ?? 900;
        const height = containerRef.current?.clientHeight ?? 600;

        const nodes: NodeData[] = raw.nodes.map((n) => ({ ...n }));
        const links: LinkData[] = raw.links.map((l) => ({ ...l, role: l.role }));

        const adjacency = new Map<string, Set<string>>();
        for (const l of links) {
          const s = typeof l.source === "string" ? l.source : (l.source as NodeData).id;
          const t = typeof l.target === "string" ? l.target : (l.target as NodeData).id;
          if (!adjacency.has(s)) adjacency.set(s, new Set());
          if (!adjacency.has(t)) adjacency.set(t, new Set());
          adjacency.get(s)!.add(t);
          adjacency.get(t)!.add(s);
        }
        setAdjacency(adjacency);
        setGraphData({ nodes, links });

        const sim = forceSimulation(nodes)
          .force(
            "link",
            forceLink<NodeData, LinkData>(links)
              .id((d) => d.id)
              .distance(70)
          )
          .force("charge", forceManyBody().strength(-160))
          .force("center", forceCenter(width / 2, height / 2))
          .force(
            "collide",
            forceCollide<NodeData>((d) =>
              (d.type === "org" ? orgRadius(d.latestAssets) : personRadius(d.boardCount)) + 6
            )
          );

        sim.on("tick", () => {
          for (const n of nodes) {
            const el = nodeRefs.current.get(n.id);
            if (el) el.setAttribute("transform", `translate(${n.x ?? 0}, ${n.y ?? 0})`);
          }
          links.forEach((l, i) => {
            const el = linkRefs.current.get(i);
            if (!el) return;
            const s = l.source as NodeData;
            const t = l.target as NodeData;
            el.setAttribute("x1", String(s.x ?? 0));
            el.setAttribute("y1", String(s.y ?? 0));
            el.setAttribute("x2", String(t.x ?? 0));
            el.setAttribute("y2", String(t.y ?? 0));
          });
        });

        simRef.current = sim;
        setLoading(false);
      });

    return () => {
      simRef.current?.stop();
    };
  }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setTransform((t) => {
      const k = Math.min(3, Math.max(0.3, t.k * (e.deltaY > 0 ? 0.92 : 1.08)));
      return { ...t, k };
    });
  }

  function onMouseDown(e: React.MouseEvent) {
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }
  function onMouseUp() {
    dragState.current.dragging = false;
  }

  function resetView() {
    setTransform({ x: 0, y: 0, k: 1 });
  }

  if (empty) {
    return (
      <EmptyState
        icon={Share2}
        title="No trustee network yet"
        description="Add people and board affiliations from an org's People tab to start mapping the network."
      />
    );
  }

  return (
    <div className="relative flex h-full">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-background"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {loading ? (
          <p className="p-6 text-xs text-muted-foreground">Loading network…</p>
        ) : (
          <svg ref={svgRef} className="size-full cursor-grab active:cursor-grabbing">
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              <g>
                {graphData?.links.map((l, i) => {
                  const sId = typeof l.source === "string" ? l.source : (l.source as NodeData).id;
                  const tId = typeof l.target === "string" ? l.target : (l.target as NodeData).id;
                  const dim = hoveredId != null && sId !== hoveredId && tId !== hoveredId;
                  return (
                    <line
                      key={i}
                      ref={(el) => {
                        if (el) linkRefs.current.set(i, el);
                      }}
                      stroke="var(--border)"
                      strokeOpacity={dim ? 0.05 : 0.35}
                      strokeWidth={1}
                    />
                  );
                })}
              </g>
              <g>
                {graphData?.nodes.map((n) => {
                  const dim = hoveredId != null && n.id !== hoveredId && !adjacency.get(hoveredId)?.has(n.id);
                  return (
                  <g
                    key={n.id}
                    ref={(el) => {
                      if (el) nodeRefs.current.set(n.id, el);
                    }}
                    className="cursor-pointer"
                    style={{ opacity: dim ? 0.15 : 1 }}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (n.type === "org") router.push(`/org/${n.ein}`);
                      else setSelected(n);
                    }}
                  >
                    {n.type === "org" ? (
                      <rect
                        x={-orgRadius(n.latestAssets)}
                        y={-orgRadius(n.latestAssets)}
                        width={orgRadius(n.latestAssets) * 2}
                        height={orgRadius(n.latestAssets) * 2}
                        rx={3}
                        style={{ fill: "var(--slate-chrome)", fillOpacity: 0.85 }}
                        stroke="var(--border)"
                      />
                    ) : (
                      <circle
                        r={personRadius(n.boardCount)}
                        style={{
                          fill: n.isKnownContact ? "var(--signal-positive)" : "var(--muted-foreground)",
                          fillOpacity: n.isKnownContact ? 0.9 : 0.6,
                        }}
                        stroke={n.isJpmAlum ? "var(--tier-2)" : "none"}
                        strokeWidth={2}
                      />
                    )}
                    <title>
                      {n.label}
                      {n.type === "org" ? ` (${fmtUsd(n.latestAssets)} in assets)` : ""}
                      {n.type === "person" && n.boardCount >= 3 ? ` (super-connector, ${n.boardCount} boards)` : ""}
                    </title>
                  </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        <div className="no-print absolute right-3 top-3 flex flex-col gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setTransform((t) => ({ ...t, k: Math.min(3, t.k * 1.2) }))}>
            <ZoomIn className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.3, t.k * 0.8) }))}>
            <ZoomOut className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={resetView}>
            <Maximize2 className="size-3.5" />
          </Button>
        </div>

        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/90 px-3 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: "var(--slate-chrome)" }} />
            Organization (sized by assets)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--muted-foreground)" }} />
            Trustee
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--signal-positive)" }} />
            Known contact
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block size-2.5 rounded-full border-2"
              style={{ borderColor: "var(--tier-2)" }}
            />
            JPM alum
          </span>
          <span>Bigger circle = sits on more boards</span>
        </div>
      </div>

      {selected && selected.type === "person" && (
        <div className="no-print w-64 shrink-0 border-l border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-medium">{selected.label}</span>
            {selected.tag === "EXAMPLE" && (
              <Badge variant="outline" className="border-dashed text-[9px]">
                EXAMPLE
              </Badge>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            {selected.isKnownContact && (
              <div className="flex items-center gap-1.5 text-signal-positive">
                <Star className="size-3" /> Known contact
              </div>
            )}
            {selected.isJpmAlum && (
              <div className="flex items-center gap-1.5">
                <Landmark className="size-3" /> JPM alum
              </div>
            )}
            {selected.boardCount >= 3 && (
              <div className="text-gold">Super-connector — sits on {selected.boardCount} boards</div>
            )}
            <div className="pt-2 text-muted-foreground">
              Connected orgs: {adjacency.get(selected.id)?.size ?? 0}
            </div>
            <ul className="mt-1 space-y-0.5">
              {[...(adjacency.get(selected.id) ?? [])].map((id) => {
                const node = graphData?.nodes.find((n) => n.id === id);
                if (!node || node.type !== "org") return null;
                return (
                  <li key={id}>
                    <button
                      className="text-left hover:underline"
                      onClick={() => router.push(`/org/${node.ein}`)}
                    >
                      {node.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
