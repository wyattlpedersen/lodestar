import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { UniverseBuilder } from "./universe-builder";

export default async function UniversePage() {
  const existing = await db
    .select({ ein: organizations.ein })
    .from(organizations);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Universe Builder"
        description="Search ProPublica by name, run a filtered pull, or apply the Bay Area E&F preset."
      />
      <UniverseBuilder existingEins={existing.map((o) => o.ein)} />
    </div>
  );
}
