import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { people } from "@/lib/db/schema";

export async function GET() {
  const rows = await db.select().from(people).orderBy(people.fullName);
  return NextResponse.json({ people: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = body?.fullName?.trim();
  if (!fullName) {
    return NextResponse.json({ error: "`fullName` is required." }, { status: 400 });
  }

  const [row] = await db
    .insert(people)
    .values({
      fullName,
      notes: body?.notes ?? null,
      isKnownContact: !!body?.isKnownContact,
      isJpmAlum: !!body?.isJpmAlum,
      isPrincipalUhnw: !!body?.isPrincipalUhnw,
      tag: body?.tag ?? null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
