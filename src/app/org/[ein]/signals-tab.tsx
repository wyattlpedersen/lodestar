"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ExternalLink, X } from "lucide-react";
import { SIGNAL_TAXONOMY } from "@/lib/signals/taxonomy";
import { decayedPoints } from "@/lib/scoring/decay";
import { DecayCurve } from "@/components/scoring/decay-curve";
import { EmptyState } from "@/components/empty-state";
import { Radar } from "lucide-react";
import type { signals as signalsTable } from "@/lib/db/schema";

type Signal = typeof signalsTable.$inferSelect;

export function SignalsTab({ ein }: { ein: string }) {
  const [signals, setSignals] = React.useState<Signal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const today = React.useMemo(() => new Date(), []);

  const [type, setType] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [eventDate, setEventDate] = React.useState(() => today.toISOString().slice(0, 10));
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [isVerbalNote, setIsVerbalNote] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    fetch(`/api/orgs/${ein}/signals`)
      .then((r) => r.json())
      .then((data) => setSignals(data.signals ?? []))
      .finally(() => setLoading(false));
  }, [ein]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!type || !headline.trim() || (!sourceUrl.trim() && !isVerbalNote)) {
      toast.error("Type, headline, and a source URL (or verbal note) are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${ein}/signals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, headline, eventDate, sourceUrl, isVerbalNote }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to log signal");
      }
      toast.success("Signal logged.");
      setOpen(false);
      setType("");
      setHeadline("");
      setSourceUrl("");
      setIsVerbalNote(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log signal");
    } finally {
      setSubmitting(false);
    }
  }

  async function expire(id: number) {
    await fetch(`/api/signals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false, auditNote: "manually expired" }),
    });
    load();
  }

  const sorted = signals.slice().sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium">Signal timeline</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={() => setOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="size-3.5" />
            Log signal
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log a signal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={(v) => v && setType(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select signal type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SIGNAL_TAXONOMY.map((t) => (
                      <SelectItem key={t.code} value={t.code} className="text-xs">
                        {t.event} ({t.entry})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Headline</Label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. CIO departs for peer institution"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Event date</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
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
              <Button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
              >
                Save signal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No signals yet"
          description="Log the first one with the button above, or ⌘K."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((s) => {
            const points = decayedPoints(
              {
                id: s.id,
                type: s.type,
                headline: s.headline,
                basePoints: s.basePoints,
                halfLifeDays: s.halfLifeDays,
                isPersistent: s.isPersistent,
                eventDate: s.eventDate,
                active: s.active,
                hasSourceUrl: !!s.sourceUrl,
                tag: s.tag,
              },
              today
            );
            return (
              <div
                key={s.id}
                className={`rounded-md border border-border p-3 ${!s.active ? "opacity-50" : ""} ${
                  s.tag === "EXAMPLE" ? "border-dashed border-signal-stale/50" : ""
                }`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{s.headline}</span>
                      {s.tag === "EXAMPLE" && (
                        <Badge variant="outline" className="border-dashed text-[9px]">
                          EXAMPLE
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{s.type}</span>
                      <span>·</span>
                      <span>{s.eventDate}</span>
                      {s.sourceUrl && (
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 hover:text-foreground"
                        >
                          source <ExternalLink className="size-2.5" />
                        </a>
                      )}
                      {s.isVerbalNote && <span>(verbal note)</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular-nums text-gold">
                      +{points.toFixed(1)}
                    </span>
                    {s.active && (
                      <Button variant="ghost" size="icon-xs" onClick={() => expire(s.id)}>
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <DecayCurve
                  signal={{
                    id: s.id,
                    type: s.type,
                    headline: s.headline,
                    basePoints: s.basePoints,
                    halfLifeDays: s.halfLifeDays,
                    isPersistent: s.isPersistent,
                    eventDate: s.eventDate,
                    active: s.active,
                    hasSourceUrl: !!s.sourceUrl,
                  }}
                  today={today}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
