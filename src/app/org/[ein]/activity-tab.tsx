"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Activity } from "lucide-react";

interface PipelineState {
  stage: string;
  ownerNote: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lastTouchDate: string | null;
}

export function ActivityTab({ ein }: { ein: string }) {
  const [state, setState] = React.useState<PipelineState | null>(null);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/orgs/${ein}/pipeline`)
      .then((r) => r.json())
      .then((d) => {
        setState(d.pipeline);
        setNote(d.pipeline?.ownerNote ?? "");
      })
      .finally(() => setLoading(false));
  }, [ein]);

  async function saveNote() {
    const res = await fetch(`/api/orgs/${ein}/pipeline`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerNote: note }),
    });
    if (res.ok) toast.success("Note saved.");
  }

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;

  if (!state) {
    return (
      <EmptyState
        icon={Activity}
        title="Not in the pipeline yet"
        description="Orgs enter the pipeline automatically once added to your universe."
      />
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {state.stage}
        </Badge>
        <Link href="/pipeline" className="text-xs text-gold hover:underline">
          View on Kanban
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Next action</div>
          <div>{state.nextAction ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Next action date</div>
          <div className="font-mono">{state.nextActionDate ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Last touch</div>
          <div className="font-mono">{state.lastTouchDate ?? "—"}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Owner note</div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="text-xs" />
        <Button size="sm" onClick={saveNote} className="bg-gold text-gold-foreground hover:bg-gold/90">
          Save note
        </Button>
      </div>
    </div>
  );
}
