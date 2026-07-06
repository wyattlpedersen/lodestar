import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { KanbanSquare } from "lucide-react";

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pipeline"
        description="Identified → Researched → Outreach → Meeting → Proposal → Won / Lost / Parked."
      />
      <EmptyState
        icon={KanbanSquare}
        title="No orgs in the pipeline yet"
        description="Add an org to your universe and move it into Identified from its Dossier to start tracking it here."
      />
    </div>
  );
}
