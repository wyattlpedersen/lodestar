"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Building2 } from "lucide-react";
import type { PeerMetric } from "@/lib/scoring/peer-benchmarking";

function fmtValue(metric: PeerMetric): string {
  if (metric.value == null) return "—";
  if (metric.key === "feeRatio" || metric.key === "payoutRatioProxy" || metric.key === "cagr5yr") {
    return `${(metric.value * 100).toFixed(1)}%`;
  }
  return metric.value.toFixed(2);
}

export function PeersTab({ ein }: { ein: string }) {
  const [metrics, setMetrics] = React.useState<PeerMetric[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/orgs/${ein}/peers`)
      .then((r) => r.json())
      .then((data) => setMetrics(data.metrics ?? null))
      .finally(() => setLoading(false));
  }, [ein]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;

  if (!metrics || metrics.every((m) => m.percentile == null)) {
    return (
      <EmptyState
        icon={Building2}
        title="No peer cohort yet"
        description="Peer percentiles need at least 2 other orgs in the same NTEE major and asset band. Build out the universe to unlock this."
      />
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-xs text-muted-foreground">
        Cohort = same NTEE major + asset band, within your current universe.
      </p>
      {metrics.map((m) => (
        <div key={m.key} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              {m.label}
              <Badge variant="outline" className="text-[9px] font-mono">
                {m.provenance}
              </Badge>
            </span>
            <span className="font-mono tabular-nums text-muted-foreground">{fmtValue(m)}</span>
          </div>
          {m.percentile != null ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${m.percentile}%` }}
              />
            </div>
          ) : (
            <div className="h-2 w-full rounded-full border border-dashed border-border" />
          )}
          <div className="text-[10px] text-muted-foreground">
            {m.percentile != null
              ? `${m.percentile.toFixed(0)}th percentile within cohort`
              : "Not enough cohort data yet"}
          </div>
        </div>
      ))}
    </div>
  );
}
