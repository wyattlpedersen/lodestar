import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { affiliations, people } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loadTrusteeGraphContext } from "@/lib/graph/loader";
import { superConnectorCount } from "@/lib/graph/trustee-graph";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const [rows, { graph }] = await Promise.all([
    db
      .select({
        id: affiliations.id,
        personId: affiliations.personId,
        role: affiliations.role,
        isCurrent: affiliations.isCurrent,
        sourceUrl: affiliations.sourceUrl,
        isVerbalNote: affiliations.isVerbalNote,
        tag: affiliations.tag,
        fullName: people.fullName,
        isKnownContact: people.isKnownContact,
        isJpmAlum: people.isJpmAlum,
        isPrincipalUhnw: people.isPrincipalUhnw,
      })
      .from(affiliations)
      .innerJoin(people, eq(affiliations.personId, people.id))
      .where(eq(affiliations.ein, ein)),
    loadTrusteeGraphContext(),
  ]);

  const withBoardCount = rows.map((r) => ({
    ...r,
    boardCount: superConnectorCount(graph, r.personId),
  }));

  return NextResponse.json({ affiliations: withBoardCount });
}

/**
 * Fast entry (Section 9 F6): pass either an existing `personId` or a `fullName`
 * to create the person inline in the same call. Source URL required unless
 * `isVerbalNote` is set (Section 11 compliance guardrail #3).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const body = await req.json().catch(() => null);

  const sourceUrl = body?.sourceUrl?.trim() || null;
  const isVerbalNote = !!body?.isVerbalNote;
  if (!sourceUrl && !isVerbalNote) {
    return NextResponse.json(
      { error: "Provide a source URL, or check 'verbal/internal note'." },
      { status: 400 }
    );
  }

  let personId: number | undefined = body?.personId;

  if (!personId) {
    const fullName = body?.fullName?.trim();
    if (!fullName) {
      return NextResponse.json(
        { error: "Provide `personId` or `fullName`." },
        { status: 400 }
      );
    }
    const [person] = await db
      .insert(people)
      .values({
        fullName,
        isKnownContact: !!body?.isKnownContact,
        isJpmAlum: !!body?.isJpmAlum,
        isPrincipalUhnw: !!body?.isPrincipalUhnw,
      })
      .returning();
    personId = person.id;
  }

  const [row] = await db
    .insert(affiliations)
    .values({
      personId,
      ein,
      role: body?.role ?? null,
      isCurrent: body?.isCurrent !== false,
      sourceUrl,
      isVerbalNote,
      tag: body?.tag ?? null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
