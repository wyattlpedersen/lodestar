import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Edit fields, or expire (active=false) with an audit note appended to `detail`. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const signalId = Number(id);

  const existing = await db.query.signals.findFirst({ where: eq(signals.id, signalId) });
  if (!existing) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  const patch: Partial<typeof signals.$inferInsert> = {};
  if (typeof body?.headline === "string") patch.headline = body.headline;
  if (typeof body?.detail === "string") patch.detail = body.detail;
  if (typeof body?.eventDate === "string") patch.eventDate = body.eventDate;
  if (typeof body?.sourceUrl === "string") patch.sourceUrl = body.sourceUrl;

  if (typeof body?.active === "boolean") {
    patch.active = body.active;
    if (body.active === false && body?.auditNote) {
      patch.detail = `${existing.detail ?? ""} — expired: ${body.auditNote}`.trim();
    }
  }

  await db.update(signals).set(patch).where(eq(signals.id, signalId));
  return NextResponse.json({ id: signalId, ...patch });
}

/** Hard delete — for an auditable soft-remove, PATCH `active: false` with an `auditNote` instead. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(signals).where(eq(signals.id, Number(id)));
  return NextResponse.json({ deleted: true });
}
