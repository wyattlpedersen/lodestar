"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Compass, Upload, Loader2, X } from "lucide-react";

interface SearchOrg {
  ein: number;
  name: string;
  city: string | null;
  state: string | null;
  ntee_code: string | null;
}

interface Candidate {
  ein: string;
  name: string;
  city: string | null;
  state: string | null;
  nteeCode: string | null;
  county: string | null;
}

type Row = { ein: string; name: string; city: string | null; nteeCode: string | null };

export function UniverseBuilder({ existingEins }: { existingEins: string[] }) {
  const router = useRouter();
  const existing = React.useMemo(() => new Set(existingEins), [existingEins]);

  const [query, setQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [presetLoading, setPresetLoading] = React.useState(false);

  const [progress, setProgress] = React.useState<{
    total: number;
    done: number;
    active: boolean;
  } | null>(null);
  const cancelRef = React.useRef(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&state=CA`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      const mapped: Row[] = (data.organizations as SearchOrg[]).map((o) => ({
        ein: String(o.ein),
        name: o.name,
        city: o.city,
        nteeCode: o.ntee_code,
      }));
      setRows(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function runPreset() {
    setPresetLoading(true);
    try {
      const res = await fetch("/api/universe/preset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preset pull failed");
      const candidates = data.candidates as Candidate[];
      setRows(
        candidates.map((c) => ({
          ein: c.ein,
          name: c.name,
          city: c.city,
          nteeCode: c.nteeCode,
        }))
      );
      toast.success(`Found ${candidates.length} Bay Area candidates`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preset pull failed");
    } finally {
      setPresetLoading(false);
    }
  }

  function toggle(ein: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ein)) next.delete(ein);
      else next.add(ein);
      return next;
    });
  }

  function toggleAll() {
    const selectable = rows.filter((r) => !existing.has(r.ein)).map((r) => r.ein);
    setSelected((prev) =>
      prev.size === selectable.length ? new Set() : new Set(selectable)
    );
  }

  async function addToUniverse(eins: string[]) {
    const deduped = Array.from(new Set(eins)).filter((e) => !existing.has(e));
    if (deduped.length === 0) return;
    cancelRef.current = false;
    setProgress({ total: deduped.length, done: 0, active: true });

    let failures = 0;
    for (const ein of deduped) {
      if (cancelRef.current) break;
      try {
        const res = await fetch("/api/orgs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ein }),
        });
        if (!res.ok) failures += 1;
      } catch {
        failures += 1;
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    setProgress((p) => (p ? { ...p, active: false } : p));
    if (failures > 0) {
      toast.warning(`Added with ${failures} failure(s) — see console for details.`);
    } else if (!cancelRef.current) {
      toast.success("Universe updated.");
    }
    setSelected(new Set());
    router.refresh();
  }

  function cancelAdd() {
    cancelRef.current = true;
  }

  async function handleCsvFile(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return;
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const einIdx = header.indexOf("ein");
    const nameIdx = header.indexOf("name");

    if (einIdx >= 0) {
      const eins = lines
        .slice(1)
        .map((l) => l.split(",")[einIdx]?.replace(/\D/g, "").trim())
        .filter((e): e is string => !!e && /^\d{9}$/.test(e));
      await addToUniverse(eins);
      return;
    }

    if (nameIdx >= 0) {
      toast.info(
        "Name-only CSV detected — search and add each org manually to confirm the right match before hydrating."
      );
      const names = lines.slice(1).map((l) => l.split(",")[nameIdx]?.trim()).filter(Boolean);
      if (names[0]) setQuery(names[0]);
      return;
    }

    toast.error("CSV must have an `ein` or `name` column.");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="flex flex-1 min-w-64 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ProPublica by org name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        <Button
          onClick={runPreset}
          disabled={presetLoading}
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          {presetLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Compass className="size-4" />
          )}
          Bay Area E&F preset
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          Import CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {progress && (
        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-6 py-2.5">
          <Progress
            value={(progress.done / progress.total) * 100}
            className="h-1.5 max-w-xs"
          />
          <span className="font-mono text-xs text-muted-foreground">
            {progress.done}/{progress.total} hydrated
          </span>
          {progress.active && (
            <Button variant="ghost" size="xs" onClick={cancelAdd}>
              <X className="size-3.5" />
              Cancel
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-sm text-muted-foreground">
            <p>Search by name or run the Bay Area E&F preset to see candidates here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={
                      selected.size > 0 &&
                      selected.size === rows.filter((r) => !existing.has(r.ein)).length
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>EIN</TableHead>
                <TableHead>City</TableHead>
                <TableHead>NTEE</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const inUniverse = existing.has(r.ein);
                return (
                  <TableRow key={r.ein} className={inUniverse ? "opacity-50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.ein)}
                        disabled={inUniverse}
                        onCheckedChange={() => toggle(r.ein)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.ein}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.city}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.nteeCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      {inUniverse && <Badge variant="secondary">Added</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <Button
            onClick={() => addToUniverse(Array.from(selected))}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            Add to universe
          </Button>
        </div>
      )}
    </div>
  );
}
