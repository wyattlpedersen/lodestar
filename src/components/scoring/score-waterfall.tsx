"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PillarResult } from "@/lib/scoring/types";

const PILLAR_COLORS: Record<string, string> = {
  mim: "oklch(0.78 0.13 85)", // gold — the "why call now" pillar gets the signature hue
  fit: "oklch(0.64 0.09 235)",
  access: "oklch(0.62 0.12 200)",
  need: "oklch(0.68 0.16 45)",
  wealth: "oklch(0.66 0.1 320)",
  growth: "oklch(0.68 0.14 165)",
};

const PROVENANCE_STYLE: Record<string, string> = {
  API: "text-slate-chrome border-slate-chrome/40",
  MANUAL: "text-foreground border-border",
  DERIVED: "text-muted-foreground border-border",
  EXAMPLE: "text-signal-stale border-signal-stale/50 border-dashed",
};

export function ScoreWaterfall({ pillars, total }: { pillars: PillarResult[]; total: number }) {
  const [mounted, setMounted] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <span className="text-xs text-muted-foreground">Score waterfall</span>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {total.toFixed(1)}
        </span>
      </div>

      <div className="flex h-6 w-full overflow-hidden rounded-sm bg-muted">
        {pillars.map((p) => (
          <div
            key={p.key}
            className="h-full transition-[width] duration-700 ease-out"
            style={{
              width: mounted ? `${p.weightedContribution}%` : "0%",
              backgroundColor: PILLAR_COLORS[p.key],
            }}
            title={`${p.label}: ${p.weightedContribution.toFixed(1)}`}
          />
        ))}
      </div>

      <div className="divide-y divide-border rounded-md border border-border">
        {pillars.map((p) => {
          const isOpen = expanded.has(p.key);
          return (
            <div key={p.key}>
              <button
                onClick={() => toggle(p.key)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PILLAR_COLORS[p.key] }}
                  />
                  <span className="text-sm font-medium">{p.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    raw {p.rawScore.toFixed(0)} · contributes{" "}
                    {p.weightedContribution.toFixed(1)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </div>
              </button>
              {isOpen && (
                <div className="space-y-1.5 bg-muted/20 px-3 py-2">
                  {p.factors.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-muted-foreground">{f.label}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        {f.detail && (
                          <span className="font-mono text-[10px] text-muted-foreground/70">
                            {f.detail}
                          </span>
                        )}
                        <span className="font-mono tabular-nums">
                          {f.points > 0 ? "+" : ""}
                          {f.points}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 rounded-sm px-1 text-[9px] font-mono",
                            PROVENANCE_STYLE[f.provenance]
                          )}
                        >
                          {f.provenance}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
