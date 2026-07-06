import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { organizations, filings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computeDerivedFinancials } from "@/lib/derived-financials";
import { nteeMajorLabel } from "@/lib/propublica/ntee";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export default async function OrgDossierPage({
  params,
}: {
  params: Promise<{ ein: string }>;
}) {
  const { ein } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.ein, ein),
  });

  if (!org) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={`EIN ${ein}`} description="Org Dossier" />
        <EmptyState
          icon={Building2}
          title="Org not found"
          description="This EIN isn't in your universe yet. Add it from the Universe Builder to hydrate its filings and start scoring."
        />
      </div>
    );
  }

  const orgFilings = await db
    .select()
    .from(filings)
    .where(eq(filings.ein, ein))
    .orderBy(desc(filings.taxYear));

  const derived = computeDerivedFinancials(orgFilings);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={org.name}
        description={`EIN ${org.ein} · ${nteeMajorLabel(org.nteeMajor)} · ${
          org.city ?? "—"
        }, ${org.state ?? "—"}${org.county ? ` (${org.county} County)` : ""}`}
      />

      <div className="grid grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-4">
        {[
          { label: "Latest assets", value: fmtUsd(org.latestAssets) },
          { label: "Latest filing year", value: org.latestFilingYear ?? "—" },
          { label: "YoY asset delta", value: fmtPct(derived.yoyAssetsDelta) },
          { label: "Payout ratio (proxy)", value: fmtPct(derived.payoutRatioProxy) },
        ].map((stat) => (
          <div key={stat.label} className="bg-background px-6 py-4">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="mt-1 font-mono text-lg tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-sm font-medium">Filings</h2>
          <Badge variant="outline" className="font-mono text-[10px]">
            API
          </Badge>
        </div>
        {orgFilings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No structured filings extracted yet for this org.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tax year</TableHead>
                <TableHead>Form</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Liabilities</TableHead>
                <TableHead className="text-right">Contributions</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgFilings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono tabular-nums">{f.taxYear}</TableCell>
                  <TableCell>{f.formType}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtUsd(f.totalRevenue)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtUsd(f.totalExpenses)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtUsd(f.totalAssets)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtUsd(f.totalLiabilities)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmtUsd(f.contributions)}
                  </TableCell>
                  <TableCell>
                    {f.pdfUrl && (
                      <a
                        href={f.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
