"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Printer, Copy } from "lucide-react";
import { TierBadge } from "@/components/scoring/tier-badge";
import { ComplianceFooter } from "@/components/compliance-footer";
import type { ScoreResult } from "@/lib/scoring/types";
import type { PathResult } from "@/lib/graph/trustee-graph";
import type { PeerMetric } from "@/lib/scoring/peer-benchmarking";
import type { Objection } from "@/lib/briefing/objection-prep";

interface BriefingData {
  organization: {
    name: string;
    ein: string;
    city: string | null;
    state: string | null;
    county: string | null;
    latestAssets: number | null;
    orgType: string | null;
    channelFlag: string | null;
  };
  nteeMajorLabel: string;
  filings: { taxYear: number; totalAssets: number | null }[];
  derived: { cagr5yr: number | null; payoutRatioProxy: number | null };
  score: ScoreResult | null;
  signals: {
    id: number;
    type: string;
    headline: string;
    sourceUrl: string | null;
    tag: string | null;
    eventDate: string;
  }[];
  path: PathResult | null;
  peerMetrics: PeerMetric[] | null;
  pipeline: { nextAction: string | null; nextActionDate: string | null } | null;
  reasonToCall: { angle: string; talkingPoints: string[] };
  objectionPrep: Objection[];
}

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function BriefingTab({ ein }: { ein: string }) {
  const [data, setData] = React.useState<BriefingData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [angle, setAngle] = React.useState("");
  const [includeExamples, setIncludeExamples] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/orgs/${ein}/briefing`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setAngle(d.reasonToCall?.angle ?? "");
      })
      .finally(() => setLoading(false));
  }, [ein]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-xs text-muted-foreground">Couldn&apos;t load briefing data.</p>;

  const shownSignals = data.signals.filter((s) => includeExamples || s.tag !== "EXAMPLE");

  async function copyAngle() {
    await navigator.clipboard.writeText(angle);
    toast.success("Copied to clipboard.");
  }

  return (
    <div>
      <div className="no-print mb-4 flex items-center gap-3">
        <Button onClick={() => window.print()} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Printer className="size-3.5" />
          Print / save as PDF
        </Button>
        <div className="flex items-center gap-2">
          <Switch checked={includeExamples} onCheckedChange={setIncludeExamples} />
          <Label className="text-xs">Include EXAMPLE-tagged content</Label>
        </div>
      </div>

      <div className="briefing-page mx-auto max-w-2xl space-y-5 rounded-md border border-border bg-background p-6 text-sm print:border-0 print:p-0 print:text-black">
        <header className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <div className="font-display text-lg font-semibold">{data.organization.name}</div>
            <div className="text-xs text-muted-foreground print:text-black">
              EIN {data.organization.ein} · {data.nteeMajorLabel} ·{" "}
              {data.organization.city}, {data.organization.state}
              {data.organization.county ? ` (${data.organization.county} County)` : ""}
            </div>
          </div>
          <div className="text-right text-[10px] text-muted-foreground print:text-black">
            Generated {new Date().toLocaleDateString()}
          </div>
        </header>

        {data.score && (
          <section className="flex flex-wrap items-center gap-2">
            <TierBadge tier={data.score.tier} pending={data.score.tierPending} />
            <span className="font-mono text-lg font-semibold">{data.score.total.toFixed(1)}</span>
            <Badge variant="outline" className="text-xs">
              Confidence {data.score.confidenceGrade}
            </Badge>
            {data.organization.channelFlag && (
              <Badge variant="outline" className="border-signal-stale/50 text-signal-stale text-xs">
                Coordinate with institutional coverage
              </Badge>
            )}
          </section>
        )}

        <section className="grid grid-cols-4 gap-3 border-y border-border py-3 text-xs">
          <div>
            <div className="text-muted-foreground print:text-black">Assets</div>
            <div className="font-mono">{fmtUsd(data.organization.latestAssets)}</div>
          </div>
          <div>
            <div className="text-muted-foreground print:text-black">5yr CAGR</div>
            <div className="font-mono">{fmtPct(data.derived.cagr5yr)}</div>
          </div>
          <div>
            <div className="text-muted-foreground print:text-black">Payout (proxy)</div>
            <div className="font-mono">{fmtPct(data.derived.payoutRatioProxy)}</div>
          </div>
          <div>
            <div className="text-muted-foreground print:text-black">Org type</div>
            <div>{data.organization.orgType?.replace(/_/g, " ") ?? "—"}</div>
          </div>
        </section>

        {data.score && (
          <section className="break-inside-avoid">
            <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
              Score waterfall
            </h3>
            <div className="flex h-4 w-full overflow-hidden rounded-sm bg-muted print:border print:border-black/20">
              {data.score.pillars.map((p, i) => (
                <div
                  key={p.key}
                  className="h-full"
                  style={{
                    width: `${p.weightedContribution}%`,
                    backgroundColor: `oklch(${0.55 + i * 0.05} 0.1 ${60 + i * 40})`,
                  }}
                />
              ))}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground print:text-black">
              {data.score.pillars.map((p) => (
                <div key={p.key} className="flex justify-between">
                  <span>{p.label}</span>
                  <span className="font-mono">{p.weightedContribution.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="break-inside-avoid">
          <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
            Active signals
          </h3>
          {shownSignals.length === 0 ? (
            <p className="text-xs text-muted-foreground print:text-black">None logged.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {shownSignals.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span>
                    {s.headline}
                    {s.tag === "EXAMPLE" && (
                      <span className="ml-1 text-[9px] text-signal-stale">(EXAMPLE)</span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground print:text-black">
                    {s.eventDate}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="break-inside-avoid">
          <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
            People & warm path
          </h3>
          {data.path ? (
            <p className="text-xs">
              {data.path.chain.map((c) => c.label).join(" → ")}{" "}
              <span className="text-muted-foreground print:text-black">
                ({data.path.hops} hop{data.path.hops === 1 ? "" : "s"})
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground print:text-black">No warm path identified yet.</p>
          )}
        </section>

        {data.peerMetrics && (
          <section className="break-inside-avoid">
            <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
              Peer percentile
            </h3>
            <table className="w-full text-xs">
              <tbody>
                {data.peerMetrics.map((m) => (
                  <tr key={m.key} className="border-b border-border/50 print:border-black/10">
                    <td className="py-0.5">{m.label}</td>
                    <td className="py-0.5 text-right font-mono">
                      {m.percentile != null ? `${m.percentile.toFixed(0)}th pct` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="break-inside-avoid">
          <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
            Reason to call
          </h3>
          <Textarea
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            className="no-print mb-2 text-xs"
            rows={3}
          />
          <p className="hidden text-xs print:block">{angle}</p>
          <Button variant="outline" size="xs" onClick={copyAngle} className="no-print mb-2">
            <Copy className="size-3" /> Copy
          </Button>
          <ul className="list-inside list-disc space-y-0.5 text-xs">
            {data.reasonToCall.talkingPoints.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="break-inside-avoid">
          <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
            Objection prep
          </h3>
          <div className="space-y-1.5 text-xs">
            {data.objectionPrep.map((o, i) => (
              <div key={i}>
                <div className="font-medium">&ldquo;{o.objection}&rdquo;</div>
                <div className="text-muted-foreground print:text-black">{o.counter}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="break-inside-avoid">
          <h3 className="mb-1.5 font-display text-xs font-semibold uppercase tracking-wide">
            Next actions
          </h3>
          <p className="text-xs">
            {data.pipeline?.nextAction
              ? `${data.pipeline.nextAction} — ${data.pipeline.nextActionDate}`
              : "No next action set yet."}
          </p>
        </section>

        <footer className="space-y-1 border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground print:text-black">
            Data grade: Confidence {data.score?.confidenceGrade ?? "—"} ({data.score?.confidence ?? 0}
            /100) — {data.score?.confidenceGrade === "A" ? "high" : data.score?.confidenceGrade === "B" ? "moderate" : "low"}{" "}
            confidence in the inputs behind this score.
          </p>
          <ComplianceFooter />
        </footer>
      </div>
    </div>
  );
}
