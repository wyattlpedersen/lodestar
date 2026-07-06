"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, RefreshCw, PlayCircle } from "lucide-react";

export function DataManagement() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingDemo, setLoadingDemo] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function exportJson() {
    window.location.href = "/api/settings/export";
  }

  async function importJson(file: File) {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const res = await fetch("/api/settings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Import failed");
      toast.success("Database restored from backup. Reloading...");
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error("Invalid or corrupt backup file.");
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/orgs/refresh-all", { method: "POST" });
      const data = await res.json();
      toast.success(`Refreshed ${data.refreshed}/${data.total} orgs.`);
    } catch {
      toast.error("Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadDemoSnapshot() {
    setLoadingDemo(true);
    try {
      const res = await fetch("/api/settings/demo-mode", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Demo mode failed");
      toast.success("Demo snapshot loaded — zero network calls. Reloading...");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo mode failed");
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div className="max-w-md space-y-4 p-6">
      <div>
        <h2 className="mb-1 font-display text-sm font-medium">Data management</h2>
        <p className="text-xs text-muted-foreground">
          Refresh live data, back up or restore the full database, or load the
          bundled offline demo snapshot.
        </p>
      </div>

      <div className="space-y-2">
        <Button variant="outline" className="w-full justify-start" onClick={refreshAll} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          Refresh all orgs (throttled)
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={exportJson}>
          <Download className="size-3.5" />
          Export full database (JSON)
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Import database (JSON)
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importJson(file);
            e.target.value = "";
          }}
        />
        <Button
          className="w-full justify-start bg-gold text-gold-foreground hover:bg-gold/90"
          onClick={loadDemoSnapshot}
          disabled={loadingDemo}
        >
          <PlayCircle className="size-3.5" />
          Load Demo Mode snapshot (offline)
        </Button>
      </div>
    </div>
  );
}
