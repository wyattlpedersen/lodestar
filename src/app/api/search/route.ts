import { NextRequest, NextResponse } from "next/server";
import { searchOrganizations } from "@/lib/propublica/client";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? undefined;
  const stateId = sp.get("state") ?? "CA";
  const nteeId = sp.get("ntee") ? Number(sp.get("ntee")) : undefined;
  const page = sp.get("page") ? Number(sp.get("page")) : undefined;

  if (!q && nteeId == null) {
    return NextResponse.json(
      { error: "Provide at least a `q` search term or an `ntee` major group." },
      { status: 400 }
    );
  }

  try {
    const result = await searchOrganizations({ q, stateId, nteeId, page });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 502 }
    );
  }
}
