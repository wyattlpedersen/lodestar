"use client";

import { LineChart, Line, XAxis, YAxis, ReferenceDot, ResponsiveContainer, Tooltip } from "recharts";
import { decayedPoints } from "@/lib/scoring/decay";
import type { SignalInput } from "@/lib/scoring/types";

export function DecayCurve({ signal, today }: { signal: SignalInput; today: Date }) {
  if (signal.isPersistent) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border text-[11px] text-muted-foreground">
        Persistent — recomputed from current financials, not time-decayed
      </div>
    );
  }

  const halfLife = signal.halfLifeDays ?? 180;
  const horizon = halfLife * 3;
  const eventDate = new Date(signal.eventDate + "T00:00:00Z");
  const points = Array.from({ length: 25 }, (_, i) => {
    const dayOffset = (horizon / 24) * i;
    const date = new Date(eventDate.getTime() + dayOffset * 86400000);
    return {
      day: Math.round(dayOffset),
      value: decayedPoints({ ...signal, eventDate: signal.eventDate }, date),
    };
  });

  const todayOffset = Math.round((today.getTime() - eventDate.getTime()) / 86400000);
  const todayValue = decayedPoints(signal, today);

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="day" type="number" domain={[0, horizon]} hide />
          <YAxis hide domain={[0, signal.basePoints]} />
          <Tooltip
            formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))}
            labelFormatter={(d) => `day ${d}`}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--signal-stale)"
            strokeWidth={1.5}
            dot={false}
          />
          {todayOffset >= 0 && todayOffset <= horizon && (
            <ReferenceDot
              x={todayOffset}
              y={todayValue}
              r={3}
              fill="var(--gold)"
              stroke="var(--gold)"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
