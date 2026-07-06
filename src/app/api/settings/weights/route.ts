import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_WEIGHT_PROFILE, normalizeWeights } from "@/lib/scoring/weights";
import type { WeightProfile } from "@/lib/scoring/types";

const SETTINGS_KEY = "active_weight_profile";

export async function GET() {
  const row = await db.query.settings.findFirst({
    where: eq(settings.key, SETTINGS_KEY),
  });
  const value = (row?.value as { name: string; weights: WeightProfile } | undefined) ?? {
    name: "Balanced",
    weights: DEFAULT_WEIGHT_PROFILE,
  };
  return NextResponse.json(value);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.weights) {
    return NextResponse.json({ error: "Body must include `weights`." }, { status: 400 });
  }
  const weights = normalizeWeights(body.weights as WeightProfile);
  const name = typeof body.name === "string" ? body.name : "Custom";

  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: { name, weights } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { name, weights } } });

  return NextResponse.json({ name, weights });
}
