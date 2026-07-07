"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ComplianceFooter } from "@/components/compliance-footer";
import { Building2, Printer } from "lucide-react";
import type { PeerMetric } from "@/lib/scoring/peer-benchmarking";
import type { PeerListEntry } from "@/lib/scoring/peer-loader";

function fmtValue(metric: PeerMetric): string {
  if (metric.value == null) return "—";
  if (metric.key === "feeRatio" || metric.key === "payoutRatioProxy" || metric.key === "cagr5yr") {
    return `${(metric.value * 100).toFixed(1)}%`;
  }
  return metric.value.toFixed(2);
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

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

interface PeerData {
  metrics: PeerMetric[];
  cohortLabel: string | null;
  peers: PeerListEntry[];
}

export function PeersTab({ ein, orgName }: { ein: string; orgName: string }) {
  const [data, setData] = React.useState<PeerData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/orgs/${ein}/peers`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [ein]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;

  if (!data || data.metrics.every((m) => m.percentile == null)) {
    return (
      <EmptyState
        icon={Building2}
        title="No peer cohort yet"
        description="Peer percentiles need at least 2 other orgs in the same NTEE major and asset band. Build out the universe to unlock this."
      />
    );
  }

  const { metrics, cohortLabel, peers } = data;

  return (
    <div>
      <div className="no-print mb-4">
        <Button onClick={() => window.print()} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Printer className="size-3.5" />
          Print peer one-pager
        </Button>
      </div>

      {/* This is a standalone door-opener artifact (Section 9 F11) — value-first,
          printable on its own, distinct from the full Briefing Book. */}
      <div className="peer-onepager mx-auto max-w-2xl space-y-5 rounded-md border border-border bg-background p-6 text-sm print:border-0 print:p-0 print:text-black">
        <header className="border-b border-border pb-3">
          <div className="font-display text-lg font-semibold">How {orgName} compares</div>
          <div className="text-xs text-muted-foreground print:text-black">
            {cohortLabel ? `Peer cohort: ${cohortLabel}` : "Peer cohort"} · generated{" "}
            {new Date().toLocaleDateString()}
          </div>
        </header>

        <section className="space-y-5">
          {metrics.map((m) => (
            <div key={m.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  {m.label}
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {m.provenance}
                  </Badge>
                </span>
                <span className="font-mono tabular-nums text-muted-foreground print:text-black">
                  {fmtValue(m)}
                </span>
              </div>
              {m.percentile != null ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted print:border print:border-black/20">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${m.percentile}%` }} />
                </div>
              ) : (
                <div className="h-2 w-full rounded-full border border-dashed border-border" />
              )}
              <div className="text-[10px] text-muted-foreground print:text-black">
                {m.percentile != null
                  ? `${m.percentile.toFixed(0)}th percentile within cohort`
                  : "Not enough cohort data yet"}
              </div>
            </div>
          ))}
        </section>

        {peers.length > 0 && (
          <section className="break-inside-avoid">
            <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
              Peer cohort ({peers.length})
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground print:text-black">
                  <th className="py-1 font-normal">Organization</th>
                  <th className="py-1 text-right font-normal">Assets</th>
                  <th className="py-1 text-right font-normal">5yr CAGR</th>
                  <th className="py-1 text-right font-normal">Payout (proxy)</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr
                    key={p.ein}
                    className={
                      "border-b border-border/50 print:border-black/10" +
                      (p.name === orgName ? " font-semibold" : "")
                    }
                  >
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-right font-mono">{fmtUsd(p.latestAssets)}</td>
                    <td className="py-1 text-right font-mono">{fmtPct(p.cagr5yr)}</td>
                    <td className="py-1 text-right font-mono">{fmtPct(p.payoutRatioProxy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="border-t border-border pt-3">
          <ComplianceFooter />
        </footer>
      </div>
    </div>
  );
}
