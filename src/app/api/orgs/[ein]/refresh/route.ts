import { NextResponse } from "next/server";
import { hydrateOrganization } from "@/lib/propublica/ingest";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  try {
    const result = await hydrateOrganization(ein, { force: true });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 502 }
    );
  }
}
