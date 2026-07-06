import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Building2 } from "lucide-react";

export default async function OrgDossierPage({
  params,
}: {
  params: Promise<{ ein: string }>;
}) {
  const { ein } = await params;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`EIN ${ein}`}
        description="Org Dossier"
      />
      <EmptyState
        icon={Building2}
        title="Org not found"
        description="This EIN isn't in your universe yet. Add it from the Universe Builder to hydrate its filings and start scoring."
      />
    </div>
  );
}
