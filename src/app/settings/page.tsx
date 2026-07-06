import { PageHeader } from "@/components/page-header";
import { SettingsWeights } from "./settings-weights";

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        description="Weight presets, data refresh, import/export, and Demo Mode."
      />
      <div className="flex-1 overflow-y-auto">
        <SettingsWeights />
        <div className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
          Data management (refresh all, export/import, Demo Mode) arrives with
          Phase 5 — Polish & demo hardening.
        </div>
      </div>
    </div>
  );
}
