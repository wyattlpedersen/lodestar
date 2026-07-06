import { NextRequest, NextResponse } from "next/server";
import { findPath } from "@/lib/graph/trustee-graph";
import { loadTrusteeGraphContext } from "@/lib/graph/loader";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const { graph, relationshipEins, orgNames } = await loadTrusteeGraphContext();
  const path = findPath(graph, ein, relationshipEins, orgNames);
  return NextResponse.json({ path });
}
