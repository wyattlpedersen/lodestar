/**
 * npm run snapshot — exports the current DB to data/demo-snapshot.json, the
 * checked-in offline dataset Demo Mode restores from with zero network calls
 * (Section 0 #6, F14). Run this after `npm run seed` so the shipped snapshot
 * reflects a fully-seeded universe.
 */
import fs from "node:fs";
import path from "node:path";
import { exportDatabase } from "../src/lib/data-management";

async function main() {
  const dump = await exportDatabase({ includeRawCache: false });
  const outPath = path.join(process.cwd(), "data", "demo-snapshot.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dump, null, 2));
  const counts = Object.entries(dump)
    .map(([k, v]) => `${k}: ${(v as unknown[]).length}`)
    .join(", ");
  console.log(`Wrote ${outPath}`);
  console.log(counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
