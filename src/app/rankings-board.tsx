"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SlidersHorizontal, RefreshCw, AlertTriangle } from "lucide-react";
import { computeScore } from "@/lib/scoring/engine";
import type { ScoreResult, ScoringInput, WeightProfile } from "@/lib/scoring/types";
import { WeightsPanel } from "@/components/scoring/weights-panel";
import { TierBadge } from "@/components/scoring/tier-badge";
import { Sparkline } from "@/components/scoring/sparkline";
import { EmptyState } from "@/components/empty-state";
import { LayoutGrid } from "lucide-react";

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

const TIER_OPTIONS = ["All", "TIER_1", "TIER_2", "TIER_3", "WATCHLIST"] as const;
const ORG_TYPE_OPTIONS = [
  "All",
  "private_foundation",
  "community_foundation",
  "university",
  "hospital_health",
  "cultural",
  "other_operating",
] as const;

export function RankingsBoard() {
  const [loading, setLoading] = React.useState(true);
  const [inputs, setInputs] = React.useState<ScoringInput[]>([]);
  const [history, setHistory] = React.useState<Record<string, { computedAt: string; total: number }[]>>({});
  const [weights, setWeights] = React.useState<WeightProfile | null>(null);
  const [presetName, setPresetName] = React.useState("Balanced");
  const [weightsOpen, setWeightsOpen] = React.useState(false);
  const [rescoring, setRescoring] = React.useState(false);

  const [tierFilter, setTierFilter] = React.useState<string>("All");
  const [orgTypeFilter, setOrgTypeFilter] = React.useState<string>("All");
  const [warmPathOnly, setWarmPathOnly] = React.useState(false);
  const [staleTier1Only, setStaleTier1Only] = React.useState(false);
  const [pipelineByEin, setPipelineByEin] = React.useState<
    Record<string, { lastTouchDate: string | null; nextAction: string | null; nextActionDate: string | null }>
  >({});

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    Promise.all([
      fetch("/api/scoring").then((r) => r.json()),
      fetch("/api/pipeline").then((r) => r.json()),
    ])
      .then(([data, pipelineData]) => {
        setInputs(data.inputs);
        setHistory(data.history ?? {});
        setWeights(data.weightProfile.weights);
        setPresetName(data.weightProfile.name);
        const byEin: typeof pipelineByEin = {};
        for (const p of pipelineData.pipeline ?? []) {
          byEin[p.ein] = { lastTouchDate: p.lastTouchDate, nextAction: p.nextAction, nextActionDate: p.nextActionDate };
        }
        setPipelineByEin(byEin);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleWeightsChange(w: WeightProfile, name: string) {
    setWeights(w);
    setPresetName(name);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch("/api/settings/weights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights: w, name }),
      }).catch(() => {});
    }, 400);
  }

  async function rescoreAll() {
    if (!weights) return;
    setRescoring(true);
    try {
      const res = await fetch("/api/scoring/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightProfile: { name: presetName, weights } }),
      });
      if (!res.ok) throw new Error("Rescore failed");
      toast.success("Universe rescored — history updated.");
      const data = await fetch("/api/scoring").then((r) => r.json());
      setHistory(data.history ?? {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rescore failed");
    } finally {
      setRescoring(false);
    }
  }

  const today = React.useMemo(() => new Date(), []);

  const results: ScoreResult[] = React.useMemo(() => {
    if (!weights) return [];
    return inputs
      .map((i) => computeScore(i, weights, today, presetName))
      .sort((a, b) => b.total - a.total);
  }, [inputs, weights, presetName, today]);

  const filtered = results.filter((r) => {
    if (tierFilter !== "All" && r.tier !== tierFilter) return false;
    if (orgTypeFilter !== "All") {
      const input = inputs.find((i) => i.ein === r.ein);
      if (input?.orgType !== orgTypeFilter) return false;
    }
    if (warmPathOnly) {
      const input = inputs.find((i) => i.ein === r.ein);
      if (!input?.access.hasWarmPath) return false;
    }
    if (staleTier1Only) {
      if (r.tier !== "TIER_1") return false;
      const lastTouch = pipelineByEin[r.ein]?.lastTouchDate;
      const days = lastTouch ? (today.getTime() - new Date(lastTouch).getTime()) / 86400000 : Infinity;
      if (days < 14) return false;
    }
    return true;
  });

  const router = useRouter();
  const [activeRowRaw, setActiveRow] = React.useState(0);
  // Clamp during render rather than via a setState-in-effect (avoids an extra render pass).
  const activeRow = filtered.length === 0 ? 0 : Math.min(activeRowRaw, filtered.length - 1);

  React.useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || filtered.length === 0) return;
      if (e.key === "j") {
        e.preventDefault();
        setActiveRow((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setActiveRow((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const row = filtered[activeRow];
        if (row) router.push(`/org/${row.ein}`);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [filtered, activeRow, router]);

  if (loading) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (inputs.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="No organizations in your universe yet"
        description="Build your universe with a Bay Area E&F preset pull, or search ProPublica by name to add orgs one at a time."
        action={
          <Button
            render={<Link href="/universe" />}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            Build the universe
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-2.5">
        <Select value={tierFilter} onValueChange={(v) => v && setTierFilter(v)}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t === "All" ? "All tiers" : t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={orgTypeFilter} onValueChange={(v) => v && setOrgTypeFilter(v)}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORG_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t === "All" ? "All org types" : t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={warmPathOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setWarmPathOnly((v) => !v)}
          className={warmPathOnly ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}
        >
          Has warm path
        </Button>
        <Button
          variant={staleTier1Only ? "default" : "outline"}
          size="sm"
          onClick={() => setStaleTier1Only((v) => !v)}
          className={staleTier1Only ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}
        >
          Stale Tier 1 (14d)
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {results.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeightsOpen((v) => !v)}>
            <SlidersHorizontal className="size-3.5" />
            Weights ({presetName})
          </Button>
          <Button variant="outline" size="sm" onClick={rescoreAll} disabled={rescoring}>
            <RefreshCw className={rescoring ? "size-3.5 animate-spin" : "size-3.5"} />
            Rescore all
          </Button>
        </div>
      </div>

      {weightsOpen && weights && (
        <div className="border-b border-border bg-muted/20 px-6 py-4">
          <div className="max-w-md">
            <WeightsPanel weights={weights} presetName={presetName} onChange={handleWeightsChange} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>7d trend</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead className="text-right">Assets</TableHead>
              <TableHead>Top signal</TableHead>
              <TableHead>Last touch</TableHead>
              <TableHead>Next action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, idx) => {
              const input = inputs.find((i) => i.ein === r.ein);
              const h = history[r.ein] ?? [];
              const sparkValues = h.map((p) => p.total);
              const delta =
                h.length >= 2 ? h[h.length - 1].total - h[0].total : null;
              const topSignal = r.pillars
                .find((p) => p.key === "mim")
                ?.factors.slice()
                .sort((a, b) => b.points - a.points)[0];

              return (
                <TableRow
                  key={r.ein}
                  className={
                    "cursor-pointer" + (idx === activeRow ? " bg-muted/60" : "")
                  }
                  onClick={() => {
                    setActiveRow(idx);
                    router.push(`/org/${r.ein}`);
                  }}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {input?.name}
                      {r.channelFlag && (
                        <AlertTriangle
                          className="size-3 text-signal-stale"
                          aria-label="Coordinate with institutional coverage"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TierBadge tier={r.tier} pending={r.tierPending} short />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.total.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Sparkline values={sparkValues} />
                      {delta != null && (
                        <span
                          className={
                            "font-mono text-[10px] tabular-nums " +
                            (delta >= 0 ? "text-signal-positive" : "text-signal-stale")
                          }
                        >
                          {delta >= 0 ? "+" : ""}
                          {delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {r.confidenceGrade}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtUsd(input?.latestAssets ?? null)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                    {topSignal ? topSignal.label : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {pipelineByEin[r.ein]?.lastTouchDate ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate text-[11px] text-muted-foreground">
                    {pipelineByEin[r.ein]?.nextActionDate
                      ? `${pipelineByEin[r.ein]?.nextAction ?? ""} (${pipelineByEin[r.ein]?.nextActionDate})`
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
