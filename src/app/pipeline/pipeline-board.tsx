"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { KanbanSquare } from "lucide-react";

interface PipelineRow {
  ein: string;
  stage: string;
  ownerNote: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lastTouchDate: string | null;
  name: string;
  latestAssets: number | null;
}

const COLUMNS: { stage: string; label: string }[] = [
  { stage: "identified", label: "Identified" },
  { stage: "researched", label: "Researched" },
  { stage: "outreach", label: "Outreach" },
  { stage: "meeting", label: "Meeting" },
  { stage: "proposal", label: "Proposal" },
  { stage: "won", label: "Won" },
  { stage: "lost", label: "Lost" },
  { stage: "parked", label: "Parked" },
];

const REQUIRES_NEXT_ACTION = new Set(["outreach", "meeting", "proposal"]);

export function PipelineBoard() {
  const [rows, setRows] = React.useState<PipelineRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [pendingMove, setPendingMove] = React.useState<{ ein: string; stage: string } | null>(null);
  const [nextAction, setNextAction] = React.useState("");
  const [nextActionDate, setNextActionDate] = React.useState("");
  const [debriefNote, setDebriefNote] = React.useState("");

  const load = React.useCallback(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((data) => setRows(data.pipeline ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function move(ein: string, stage: string, extra: Record<string, string> = {}) {
    const res = await fetch(`/api/orgs/${ein}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, ...extra }),
    });
    if (!res.ok) {
      const data = await res.json();
      if (data.error?.includes("next action")) {
        setPendingMove({ ein, stage });
        return;
      }
      toast.error(data.error ?? "Move failed");
      return;
    }
    toast.success("Pipeline updated.");
    load();
  }

  function onDrop(stage: string, e: React.DragEvent) {
    e.preventDefault();
    const ein = e.dataTransfer.getData("text/ein");
    if (!ein) return;
    if (REQUIRES_NEXT_ACTION.has(stage)) {
      setPendingMove({ ein, stage });
    } else {
      move(ein, stage);
    }
  }

  async function confirmPendingMove() {
    if (!pendingMove) return;
    if (!nextAction.trim() || !nextActionDate) {
      toast.error("Next action and date are required.");
      return;
    }
    await move(pendingMove.ein, pendingMove.stage, {
      nextAction,
      nextActionDate,
      debriefNote,
    });
    setPendingMove(null);
    setNextAction("");
    setNextActionDate("");
    setDebriefNote("");
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="No orgs in the pipeline yet"
        description="Add an org to your universe, then set its stage from here to start tracking it."
      />
    );
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {COLUMNS.map((col) => {
        const cards = rows.filter((r) => r.stage === col.stage);
        return (
          <div
            key={col.stage}
            className="flex w-56 shrink-0 flex-col rounded-md border border-border bg-muted/10"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(col.stage, e)}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-medium">{col.label}</span>
              <Badge variant="outline" className="text-[10px]">
                {cards.length}
              </Badge>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {cards.map((r) => (
                <div
                  key={r.ein}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/ein", r.ein)}
                  className="cursor-grab rounded-md border border-border bg-background p-2.5 active:cursor-grabbing"
                >
                  <Link href={`/org/${r.ein}`} className="text-xs font-medium hover:underline">
                    {r.name}
                  </Link>
                  {r.nextActionDate && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Next: {r.nextAction} · {r.nextActionDate}
                    </div>
                  )}
                  {r.lastTouchDate && (
                    <div className="text-[10px] text-muted-foreground/70">
                      Last touch {r.lastTouchDate}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={!!pendingMove} onOpenChange={(o) => !o && setPendingMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Next action required</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Moving past Researched requires a next action and date.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Next action</Label>
              <Input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Call CIO re: OCIO search"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Debrief note (optional — becomes a signal)</Label>
              <Textarea
                value={debriefNote}
                onChange={(e) => setDebriefNote(e.target.value)}
                placeholder="What happened in this meeting?"
                className="text-xs"
              />
            </div>
            <Button
              onClick={confirmPendingMove}
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
            >
              Confirm move
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
