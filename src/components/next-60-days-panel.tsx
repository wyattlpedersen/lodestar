"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Event {
  ein: string;
  name: string;
  event: string;
  windowStart: string;
  windowEnd: string;
}

const EVENT_LABEL: Record<string, string> = {
  pre_fye_window: "Pre-FYE planning window",
  post_audit_window: "Post-audit outreach window",
  expected_filing: "Expected filing window",
};

export function Next60DaysPanel() {
  const [events, setEvents] = React.useState<Event[] | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/next-60-days")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []));
  }, []);

  if (!events || events.length === 0) return null;

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-6 py-2 text-xs text-muted-foreground hover:bg-muted/30"
      >
        <CalendarClock className="size-3.5" />
        <span>
          Next 60 days: {events.length} org{events.length === 1 ? "" : "s"} entering a window
        </span>
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto px-6 pb-2">
          {events.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2 py-1 text-xs">
              <Link href={`/org/${e.ein}`} className="hover:underline">
                {e.name}
              </Link>
              <span className="text-muted-foreground">
                {EVENT_LABEL[e.event] ?? e.event} · {e.windowStart} – {e.windowEnd}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
