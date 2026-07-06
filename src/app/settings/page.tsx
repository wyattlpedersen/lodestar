import { PageHeader } from "@/components/page-header";
import { SettingsWeights } from "./settings-weights";
import { DataManagement } from "./data-management";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        description="Weight presets, data refresh, import/export, and Demo Mode."
      />
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        <SettingsWeights />
        <DataManagement />
      </div>
    </div>
  );
}
