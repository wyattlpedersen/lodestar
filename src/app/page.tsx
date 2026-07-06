import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { LayoutGrid } from "lucide-react";
import Link from "next/link";

export default function RankingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Rankings"
        description="Every org in your universe, scored and ranked. Adjust weights to re-rank live."
      />
      <EmptyState
        icon={LayoutGrid}
        title="No organizations in your universe yet"
        description="Build your universe with a Bay Area E&F preset pull, or search ProPublica by name to add orgs one at a time."
        action={
          <Button
            render={<Link href="/universe" />}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            Build the universe
          </Button>
        }
      />
    </div>
  );
}
