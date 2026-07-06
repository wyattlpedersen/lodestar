import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { importDatabase } from "@/lib/data-management";

/** Restores the checked-in data/demo-snapshot.json — zero network calls (Section 0 #6). */
export async function POST() {
  const snapshotPath = path.join(process.cwd(), "data", "demo-snapshot.json");
  if (!fs.existsSync(snapshotPath)) {
    return NextResponse.json(
      { error: "No demo snapshot found. Run `npm run seed && npm run snapshot` first." },
      { status: 404 }
    );
  }
  const dump = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  await importDatabase(dump);
  return NextResponse.json({ loaded: true });
}
