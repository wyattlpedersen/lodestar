"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import type { organizations, filings as filingsTable, manualFacts as manualFactsTable } from "@/lib/db/schema";
import type { DerivedFinancials } from "@/lib/derived-financials";

type Org = typeof organizations.$inferSelect;
type Filing = typeof filingsTable.$inferSelect;
type ManualFact = typeof manualFactsTable.$inferSelect;

function fmtUsd(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function OverviewTab({
  org,
  filings,
  manualFacts,
  derived,
}: {
  org: Org;
  filings: Filing[];
  manualFacts: ManualFact[];
  derived: DerivedFinancials;
}) {
  const factMap = React.useMemo(
    () => Object.fromEntries(manualFacts.map((f) => [f.key, f.value])),
    [manualFacts]
  );

  const [mgmtFees, setMgmtFees] = React.useState(factMap.mgmt_fees_usd ?? "");
  const [mgmtFeesPrior, setMgmtFeesPrior] = React.useState(factMap.mgmt_fees_usd_prior ?? "");
  const [hasCio, setHasCio] = React.useState(factMap.has_paid_cio ?? "");
  const [pctCash, setPctCash] = React.useState(factMap.pct_cash_public ?? "");
  const [singleManager, setSingleManager] = React.useState(factMap.single_manager === "true");
  const [verified, setVerified] = React.useState(org.verified);
  const [saving, setSaving] = React.useState(false);

  const chartData = filings
    .slice()
    .sort((a, b) => a.taxYear - b.taxYear)
    .slice(-5)
    .map((f) => ({
      year: f.taxYear,
      Assets: f.totalAssets,
      Revenue: f.totalRevenue,
      Expenses: f.totalExpenses,
    }));

  const latestPdf = filings.find((f) => f.pdfUrl)?.pdfUrl;

  async function saveFact(key: string, value: string) {
    await fetch(`/api/orgs/${org.ein}/facts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all([
        mgmtFees && saveFact("mgmt_fees_usd", mgmtFees),
        mgmtFeesPrior && saveFact("mgmt_fees_usd_prior", mgmtFeesPrior),
        hasCio && saveFact("has_paid_cio", hasCio),
        pctCash && saveFact("pct_cash_public", String(Number(pctCash) / 100)),
        saveFact("single_manager", String(singleManager)),
      ]);
      toast.success("Manual facts saved — rescore to see the updated Need & Vulnerability pillar.");
    } catch {
      toast.error("Failed to save manual facts.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVerified(next: boolean) {
    setVerified(next);
    await fetch(`/api/orgs/${org.ein}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: next }),
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-display text-sm font-medium">5-year financials</h3>
            <Badge variant="outline" className="font-mono text-[10px]">
              API
            </Badge>
          </div>
          {chartData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="assetsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v) => fmtUsd(v)}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v) => fmtUsd(typeof v === "number" ? v : null)}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Assets"
                    stroke="var(--gold)"
                    fill="url(#assetsGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No filing history yet.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "YoY assets", value: fmtPct(derived.yoyAssetsDelta) },
            { label: "3yr CAGR", value: fmtPct(derived.cagr3yr) },
            { label: "5yr CAGR", value: fmtPct(derived.cagr5yr) },
            { label: "Payout ratio (proxy)", value: fmtPct(derived.payoutRatioProxy) },
          ].map((s) => (
            <div key={s.label} className="rounded-md border border-border px-3 py-2">
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
              <div className="font-mono text-sm tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 lg:border-l lg:border-border lg:pl-6">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-medium">Manual-assisted fields</h3>
          <Badge variant="outline" className="font-mono text-[10px]">
            MANUAL
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          The API doesn&apos;t extract fees, staffing, or asset mix. Read the 990 and
          enter what you find — LODESTAR computes ratios and benchmarks from there.
        </p>
        {latestPdf && (
          <a
            href={latestPdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
          >
            Read the latest 990 <ExternalLink className="size-3" />
          </a>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Mgmt & investment fees, $ (Part IX / 990-PF Part I)</Label>
            <Input
              type="number"
              value={mgmtFees}
              onChange={(e) => setMgmtFees(e.target.value)}
              placeholder="e.g. 850000"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prior-year fees, $ (optional — powers the FEE_SPIKE signal)</Label>
            <Input
              type="number"
              value={mgmtFeesPrior}
              onChange={(e) => setMgmtFeesPrior(e.target.value)}
              placeholder="e.g. 550000"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Compensated investment officer?</Label>
            <div className="flex gap-2">
              {["true", "false"].map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="xs"
                  variant={hasCio === v ? "default" : "outline"}
                  onClick={() => setHasCio(v)}
                  className={hasCio === v ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}
                >
                  {v === "true" ? "Yes" : "No"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Approx. % cash & public equities</Label>
            <Input
              type="number"
              value={pctCash}
              onChange={(e) => setPctCash(e.target.value)}
              placeholder="e.g. 70"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={singleManager}
              onCheckedChange={(v) => setSingleManager(v === true)}
            />
            <Label className="text-xs">Single-manager / single-consultant concentration</Label>
          </div>
          <Button
            size="sm"
            onClick={saveAll}
            disabled={saving}
            className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
          >
            Save manual facts
          </Button>
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Checkbox checked={verified} onCheckedChange={(v) => toggleVerified(v === true)} />
          <Label className="text-xs">Analyst verified (Confidence +10)</Label>
        </div>
      </div>
    </div>
  );
}
