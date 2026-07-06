import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Mail } from "lucide-react";

export default function MondayReportPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Monday Morning Report"
        description="Top movers, new signals, stale Tier 1s, and the next-60-day calendar — forwardable to an MD unedited."
      />
      <EmptyState
        icon={Mail}
        title="Nothing to report yet"
        description="Once your universe has scored orgs and a week of history, the Monday Report generates itself here."
      />
    </div>
  );
}
