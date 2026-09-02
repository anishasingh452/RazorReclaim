import { config } from "dotenv";
config({ path: ".env.local" });

import { seedBatch } from "../src/lib/generator/seed-batch";

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : fallback;
  };

  const name = getArg("--name", "Demo Batch");
  const seed = getArg("--seed", `seed-${Date.now()}`);
  const caseCount = Number(getArg("--count", "150"));

  console.log(`Seeding batch "${name}" | seed=${seed} | count=${caseCount}`);
  const result = await seedBatch({ name, seed, caseCount });

  console.log("Batch created:");
  console.log(`  id:            ${result.batch.id}`);
  console.log(`  cases:         ${result.caseCount}`);
  console.log(`  total at risk: ₹${result.totalAtRisk.toLocaleString("en-IN")}`);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
