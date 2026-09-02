import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "../src/lib/db/service-client";
import { runRootCauseReasoning } from "../src/lib/ai/root-cause";
import { currentModelName } from "../src/lib/ai/provider";

async function main() {
  const batchId = process.argv[2];
  const concurrency = Number(process.argv[3] ?? "8");
  if (!batchId) throw new Error("usage: tsx scripts/benchmark-concurrency.ts <batchId> [concurrency]");

  console.log(`Model: ${currentModelName()} | concurrency=${concurrency}`);

  const supabase = getServiceClient();
  const { data: cases, error } = await supabase
    .from("cases")
    .select("*")
    .eq("batch_id", batchId)
    .order("seq")
    .limit(concurrency);
  if (error || !cases?.length) throw new Error(`No cases found: ${error?.message}`);

  const t0 = Date.now();
  const results = await Promise.allSettled(
    cases.map(async (c) => {
      const { data: evidence } = await supabase.from("evidence").select("source, payload").eq("case_id", c.id);
      return runRootCauseReasoning({
        riskType: c.risk_type,
        amount: c.amount,
        customerTier: c.customer_tier,
        contactAttempts: c.contact_attempts,
        daysSinceFailure: c.days_since_failure,
        evidence: evidence ?? [],
      });
    })
  );
  const ms = Date.now() - t0;

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");

  console.log(`\n${cases.length} calls fired concurrently (concurrency=${concurrency})`);
  console.log(`Wall time: ${ms}ms`);
  console.log(`Success: ${ok}/${cases.length}`);
  if (failed.length) {
    failed.forEach((f) => {
      if (f.status === "rejected") console.log(`  FAILED: ${f.reason}`);
    });
  }
  console.log(`\nEffective throughput: ${(cases.length / (ms / 1000)).toFixed(2)} calls/sec`);
  console.log(`Projected 300-call batch (150 cases x 2) at this throughput: ${((300 / cases.length) * (ms / 1000)).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("benchmark-concurrency failed:", err);
  process.exit(1);
});
