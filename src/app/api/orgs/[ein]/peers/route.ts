import { NextRequest, NextResponse } from "next/server";
import { loadPeerBenchmark } from "@/lib/scoring/peer-loader";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ein: string }> }
) {
  const { ein } = await params;
  const metrics = await loadPeerBenchmark(ein);
  if (!metrics) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }
  return NextResponse.json({ metrics });
}
