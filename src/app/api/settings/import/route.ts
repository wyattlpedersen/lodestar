import { NextRequest, NextResponse } from "next/server";
import { importDatabase } from "@/lib/data-management";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  await importDatabase(body);
  return NextResponse.json({ imported: true });
}
