import { NextRequest, NextResponse } from "next/server";
import {
  addExampleContent,
  hasExampleContent,
  loadEinByNameFromDb,
  removeExampleContent,
} from "@/lib/seed/example-content";

export async function GET() {
  const enabled = await hasExampleContent();
  return NextResponse.json({ enabled });
}

/** Toggles EXAMPLE-tagged demo intelligence on/off — DB-only, no ProPublica calls either way. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Body must include boolean `enabled`." }, { status: 400 });
  }

  if (body.enabled) {
    const einByName = await loadEinByNameFromDb();
    if (einByName.size === 0) {
      return NextResponse.json(
        { error: "No matching seed orgs found yet — build your universe first." },
        { status: 400 }
      );
    }
    await addExampleContent(einByName);
  } else {
    await removeExampleContent();
  }

  return NextResponse.json({ enabled: body.enabled });
}
