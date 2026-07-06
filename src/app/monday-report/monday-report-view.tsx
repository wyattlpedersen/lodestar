"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Printer } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Mail } from "lucide-react";
import { TierBadge } from "@/components/scoring/tier-badge";
import { ComplianceFooter } from "@/components/compliance-footer";
import type { Tier } from "@/lib/scoring/types";

interface ReportData {
  generatedAt: string;
  top10: { ein: string; name: string; total: number; tier: Tier }[];
  movers: { ein: string; name: string; delta: number; from: number; to: number; drivingPillar: string | null }[];
  newSignalsThisWeek: { ein: string; name: string; headline: string; type: string; tag: string | null }[];
  staleTier1: { ein: string; name: string }[];
  next60Days: { ein: string; name: string; event: string; windowStart: string; windowEnd: string }[];
  stageCounts: Record<string, number>;
}

const EVENT_LABEL: Record<string, string> = {
  pre_fye_window: "Pre-FYE planning window",
  post_audit_window: "Post-audit outreach window",
  expected_filing: "Expected filing window",
};

function toPlainText(d: ReportData): string {
  const lines: string[] = [];
  lines.push(`MONDAY MORNING REPORT — ${new Date(d.generatedAt).toLocaleDateString()}`);
  lines.push("");
  lines.push("TOP 10 BY SCORE");
  d.top10.forEach((o, i) => lines.push(`${i + 1}. ${o.name} — ${o.total.toFixed(1)} (${o.tier.replace("_", " ")})`));
  lines.push("");
  lines.push("BIGGEST 7-DAY MOVERS");
  if (d.movers.length === 0) lines.push("No movers yet — rescore over consecutive days to populate this.");
  d.movers.forEach((m) =>
    lines.push(
      `${m.name}: ${m.from.toFixed(1)} -> ${m.to.toFixed(1)} (${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(
        1
      )}), driven by ${m.drivingPillar ?? "—"}`
    )
  );
  lines.push("");
  lines.push("NEW SIGNALS THIS WEEK");
  if (d.newSignalsThisWeek.length === 0) lines.push("None logged this week.");
  d.newSignalsThisWeek.forEach((s) => lines.push(`${s.name}: ${s.headline}`));
  lines.push("");
  lines.push("TIER 1 — UNTOUCHED 14+ DAYS");
  if (d.staleTier1.length === 0) lines.push("None — Tier 1 pipeline is current.");
  d.staleTier1.forEach((o) => lines.push(`${o.name}`));
  lines.push("");
  lines.push("NEXT 60 DAYS");
  d.next60Days.forEach((e) =>
    lines.push(`${e.name}: ${EVENT_LABEL[e.event] ?? e.event} (${e.windowStart} – ${e.windowEnd})`)
  );
  lines.push("");
  lines.push("PIPELINE STAGE COUNTS");
  Object.entries(d.stageCounts).forEach(([stage, count]) => lines.push(`${stage}: ${count}`));
  return lines.join("\n");
}

export function MondayReportView() {
  const [data, setData] = React.useState<ReportData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/monday-report")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-xs text-muted-foreground">Loading…</p>;

  if (!data || data.top10.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Nothing to report yet"
        description="Once your universe has scored orgs and a week of history, the Monday Report generates itself here."
      />
    );
  }

  async function copyAsText() {
    if (!data) return;
    await navigator.clipboard.writeText(toPlainText(data));
    toast.success("Copied — paste directly into an email.");
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={copyAsText} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Copy className="size-3.5" />
          Copy as text
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Print
        </Button>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 text-sm">
        <header>
          <h1 className="font-display text-lg font-semibold">Monday Morning Report</h1>
          <p className="text-xs text-muted-foreground">{new Date(data.generatedAt).toLocaleString()}</p>
        </header>

        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide">Top 10 by score</h2>
          <ol className="space-y-1">
            {data.top10.map((o, i) => (
              <li key={o.ein} className="flex items-center justify-between gap-2 text-xs">
                <span>
                  {i + 1}.{" "}
                  <Link href={`/org/${o.ein}`} className="hover:underline">
                    {o.name}
                  </Link>
                </span>
                <span className="flex items-center gap-2">
                  <TierBadge tier={o.tier} short />
                  <span className="font-mono">{o.total.toFixed(1)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide">Biggest 7-day movers</h2>
          {data.movers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No movers yet — rescore over consecutive days to populate this.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data.movers.map((m) => (
                <li key={m.ein} className="flex items-center justify-between gap-2">
                  <span>{m.name}</span>
                  <span
                    className={
                      "font-mono " + (m.delta >= 0 ? "text-signal-positive" : "text-signal-stale")
                    }
                  >
                    {m.delta >= 0 ? "+" : ""}
                    {m.delta.toFixed(1)} ({m.drivingPillar ?? "—"})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide">New signals this week</h2>
          {data.newSignalsThisWeek.length === 0 ? (
            <p className="text-xs text-muted-foreground">None logged this week.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data.newSignalsThisWeek.map((s, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="font-medium">{s.name}:</span> {s.headline}
                  {s.tag === "EXAMPLE" && (
                    <Badge variant="outline" className="border-dashed text-[9px]">
                      EXAMPLE
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide">
            Tier 1 — untouched 14+ days
          </h2>
          {data.staleTier1.length === 0 ? (
            <p className="text-xs text-muted-foreground">None — Tier 1 pipeline is current.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data.staleTier1.map((o) => (
                <li key={o.ein}>{o.name}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide">Next 60 days</h2>
          {data.next60Days.length === 0 ? (
            <p className="text-xs text-muted-foreground">No calendar windows opening in the next 60 days.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {data.next60Days.map((e, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>
                    {e.name} — {EVENT_LABEL[e.event] ?? e.event}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {e.windowStart} – {e.windowEnd}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wide">Pipeline stage counts</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.stageCounts).map(([stage, count]) => (
              <Badge key={stage} variant="outline" className="text-xs capitalize">
                {stage}: {count}
              </Badge>
            ))}
          </div>
        </section>

        <footer className="border-t border-border pt-3">
          <ComplianceFooter />
        </footer>
      </div>
    </div>
  );
}
