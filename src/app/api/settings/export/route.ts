import { NextResponse } from "next/server";
import { exportDatabase } from "@/lib/data-management";

export async function GET() {
  const dump = await exportDatabase({ includeRawCache: true });
  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="lodestar-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
