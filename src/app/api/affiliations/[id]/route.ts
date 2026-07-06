import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { affiliations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(affiliations).where(eq(affiliations.id, Number(id)));
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const patch: Partial<typeof affiliations.$inferInsert> = {};
  if (typeof body?.isCurrent === "boolean") patch.isCurrent = body.isCurrent;
  if (typeof body?.role === "string") patch.role = body.role;

  await db.update(affiliations).set(patch).where(eq(affiliations.id, Number(id)));
  return NextResponse.json({ id: Number(id), ...patch });
}
