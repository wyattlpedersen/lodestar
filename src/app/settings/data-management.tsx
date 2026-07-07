"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Upload, RefreshCw, PlayCircle } from "lucide-react";

export function DataManagement() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingDemo, setLoadingDemo] = React.useState(false);
  const [exampleContentOn, setExampleContentOn] = React.useState(false);
  const [exampleLoading, setExampleLoading] = React.useState(true);
  const [togglingExample, setTogglingExample] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/api/settings/example-content")
      .then((r) => r.json())
      .then((d) => setExampleContentOn(!!d.enabled))
      .finally(() => setExampleLoading(false));
  }, []);

  async function toggleExampleContent(next: boolean) {
    setTogglingExample(true);
    try {
      const res = await fetch("/api/settings/example-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to toggle example content");
      setExampleContentOn(next);
      toast.success(
        next
          ? "Example content added — signals, people, and pipeline cards tagged EXAMPLE."
          : "Example content removed. Real data untouched."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle example content");
    } finally {
      setTogglingExample(false);
    }
  }

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
          Refresh live data, back up or restore the full database, or toggle
          example content on and off.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div>
          <Label className="text-xs font-medium">Example content</Label>
          <p className="text-[11px] text-muted-foreground">
            Adds EXAMPLE-tagged signals, people, and pipeline cards on top of
            your real orgs — safe to switch on and off any time, real data is
            never touched.
          </p>
        </div>
        <Switch
          checked={exampleContentOn}
          disabled={exampleLoading || togglingExample}
          onCheckedChange={toggleExampleContent}
        />
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
          variant="outline"
          className="w-full justify-start"
          onClick={loadDemoSnapshot}
          disabled={loadingDemo}
        >
          <PlayCircle className="size-3.5" />
          Restore full offline snapshot (no network)
        </Button>
        <p className="px-1 text-[10px] text-muted-foreground">
          That last one replaces the entire database from the bundled
          snapshot — use it when there&apos;s no network at all. For
          switching example content on/off day to day, use the toggle above.
        </p>
      </div>
    </div>
  );
}
