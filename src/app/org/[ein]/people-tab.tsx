"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Route, Star, Landmark, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { PathResult } from "@/lib/graph/trustee-graph";

interface AffiliationRow {
  id: number;
  personId: number;
  role: string | null;
  isCurrent: boolean;
  sourceUrl: string | null;
  isVerbalNote: boolean;
  tag: string | null;
  fullName: string;
  isKnownContact: boolean;
  isJpmAlum: boolean;
  isPrincipalUhnw: boolean;
  boardCount: number;
}

export function PeopleTab({ ein }: { ein: string }) {
  const [rows, setRows] = React.useState<AffiliationRow[]>([]);
  const [path, setPath] = React.useState<PathResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [isVerbalNote, setIsVerbalNote] = React.useState(false);
  const [isKnownContact, setIsKnownContact] = React.useState(false);
  const [isJpmAlum, setIsJpmAlum] = React.useState(false);
  const [isPrincipalUhnw, setIsPrincipalUhnw] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    Promise.all([
      fetch(`/api/orgs/${ein}/affiliations`).then((r) => r.json()),
      fetch(`/api/orgs/${ein}/path`).then((r) => r.json()),
    ])
      .then(([aff, p]) => {
        setRows(aff.affiliations ?? []);
        setPath(p.path ?? null);
      })
      .finally(() => setLoading(false));
  }, [ein]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!fullName.trim() || (!sourceUrl.trim() && !isVerbalNote)) {
      toast.error("Name and a source URL (or verbal note) are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${ein}/affiliations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          role,
          sourceUrl,
          isVerbalNote,
          isKnownContact,
          isJpmAlum,
          isPrincipalUhnw,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add person");
      }
      toast.success("Person added to the board.");
      setOpen(false);
      setFullName("");
      setRole("");
      setSourceUrl("");
      setIsVerbalNote(false);
      setIsKnownContact(false);
      setIsJpmAlum(false);
      setIsPrincipalUhnw(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    await fetch(`/api/affiliations/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Route className="size-3.5 text-muted-foreground" />
          <h3 className="font-display text-sm font-medium">Path Finder</h3>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : path ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/20 p-3 text-sm">
            <span className="text-muted-foreground">You</span>
            {path.chain.map((node, i) => (
              <React.Fragment key={i}>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">
                  {node.label}
                  {i === path.chain.length - 1 && path.anchorType === "existing_relationship" && (
                    <span className="ml-1 text-[10px] text-signal-positive">(existing relationship)</span>
                  )}
                </span>
              </React.Fragment>
            ))}
            <Badge variant="outline" className="ml-2 text-[10px]">
              {path.hops} hop{path.hops === 1 ? "" : "s"}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No warm path found within 3 hops yet — log known contacts and their
            boards to build one.
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-medium">Board & staff</h3>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button size="sm" onClick={() => setOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="size-3.5" />
              Add person
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a board/staff member</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Board Chair, Family member"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source URL</Label>
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-xs"
                    disabled={isVerbalNote}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={isVerbalNote} onCheckedChange={(v) => setIsVerbalNote(v === true)} />
                  <Label className="text-xs">Verbal / internal note (no source URL)</Label>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={isKnownContact} onCheckedChange={(v) => setIsKnownContact(v === true)} />
                    <Label className="text-[11px]">Known contact</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={isJpmAlum} onCheckedChange={(v) => setIsJpmAlum(v === true)} />
                    <Label className="text-[11px]">JPM alum</Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={isPrincipalUhnw} onCheckedChange={(v) => setIsPrincipalUhnw(v === true)} />
                    <Label className="text-[11px]">Principal UHNW</Label>
                  </div>
                </div>
                <Button onClick={submit} disabled={submitting} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No board or staff logged yet"
            description="Add the first person to start building the trustee graph."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {r.fullName}
                    {r.isKnownContact && (
                      <Badge variant="outline" className="gap-0.5 text-[9px]">
                        <Star className="size-2.5" /> known contact
                      </Badge>
                    )}
                    {r.isJpmAlum && (
                      <Badge variant="outline" className="gap-0.5 text-[9px]">
                        <Landmark className="size-2.5" /> JPM alum
                      </Badge>
                    )}
                    {r.boardCount >= 3 && (
                      <Badge variant="outline" className="gap-0.5 text-[9px] text-gold border-gold/40">
                        super-connector ({r.boardCount})
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.role ?? "Role not specified"}
                    {!r.isCurrent && " · former"}
                  </div>
                </div>
                <Button variant="ghost" size="icon-xs" onClick={() => remove(r.id)}>
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
