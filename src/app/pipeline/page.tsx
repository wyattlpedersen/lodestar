import { PageHeader } from "@/components/page-header";
import { PipelineBoard } from "./pipeline-board";

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pipeline"
        description="Identified → Researched → Outreach → Meeting → Proposal → Won / Lost / Parked."
      />
      <div className="flex-1 overflow-hidden">
        <PipelineBoard />
      </div>
    </div>
  );
}
