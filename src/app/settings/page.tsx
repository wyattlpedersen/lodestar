import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        description="Weight presets, data refresh, import/export, and Demo Mode."
      />
      <EmptyState
        icon={SettingsIcon}
        title="Settings arrive with the scoring engine"
        description="Weight sliders, presets, and data management tools will appear here once the scoring engine is built."
      />
    </div>
  );
}
