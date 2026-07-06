import { PageHeader } from "@/components/page-header";
import { MondayReportView } from "./monday-report-view";

export default function MondayReportPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="no-print">
        <PageHeader
          title="Monday Morning Report"
          description="Top movers, new signals, stale Tier 1s, and the next-60-day calendar — forwardable to an MD unedited."
        />
      </div>
      <MondayReportView />
    </div>
  );
}
