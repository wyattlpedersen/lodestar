import { PageHeader } from "@/components/page-header";
import { NetworkGraph } from "./network-graph";

export default function NetworkPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Trustee Network"
        description="The whole universe's org-trustee graph — drag to pan, scroll to zoom, hover to trace a connection."
      />
      <div className="flex-1 overflow-hidden">
        <NetworkGraph />
      </div>
    </div>
  );
}
