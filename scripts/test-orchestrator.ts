import { config } from "dotenv";
config({ path: ".env.local" });

import { runBatch } from "../src/lib/orchestrator/batch-orchestrator";

async function main() {
  const batchId = process.argv[2];
  const concurrency = Number(process.argv[3] ?? "6");
  if (!batchId) throw new Error("usage: tsx scripts/test-orchestrator.ts <batchId> [concurrency]");

  let eventCount = 0;
  const t0 = Date.now();

  const summary = await runBatch({
    batchId,
    concurrency,
    onEvent: (event) => {
      eventCount++;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[${elapsed}s] ${event.type} case=${event.caseId?.slice(0, 8) ?? "-"} stage=${event.stage} status=${event.status}`);
    },
  });

  console.log("\n" + "=".repeat(60));
  console.log("BATCH RUN SUMMARY");
  console.log("=".repeat(60));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Total events emitted: ${eventCount}`);
}

main().catch((err) => {
  console.error("test-orchestrator failed:", err);
  process.exit(1);
});
