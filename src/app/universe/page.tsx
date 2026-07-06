import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function UniversePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Universe Builder"
        description="Search ProPublica by name, run a filtered pull, or apply the Bay Area E&F preset."
      />
      <EmptyState
        icon={Compass}
        title="Your universe is empty"
        description="Run the Bay Area E&F preset to pull ~30 seed orgs, or search ProPublica for a specific organization to add it."
        action={
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90">
            Run Bay Area E&F preset
          </Button>
        }
      />
    </div>
  );
}
