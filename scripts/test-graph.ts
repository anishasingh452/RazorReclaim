import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "../src/lib/db/service-client";
import { runCaseGraph } from "../src/lib/langgraph/run-case";

async function main() {
  const batchId = process.argv[2];
  const limit = Number(process.argv[3] ?? "3");
  if (!batchId) throw new Error("usage: tsx scripts/test-graph.ts <batchId> [limit]");

  const supabase = getServiceClient();
  const { data: cases, error } = await supabase
    .from("cases")
    .select("id, seq, customer_name, amount, risk_type, contact_attempts")
    .eq("batch_id", batchId)
    .order("seq")
    .limit(limit);
  if (error || !cases?.length) throw new Error(`No cases found: ${error?.message}`);

  for (const c of cases) {
    console.log("\n" + "=".repeat(70));
    console.log(`Running graph for case #${c.seq} — ${c.customer_name} — ₹${c.amount} — ${c.risk_type} (attempts=${c.contact_attempts})`);
    const t0 = Date.now();
    const result = await runCaseGraph(c.id);
    const ms = Date.now() - t0;

    console.log(`Completed in ${ms}ms`);
    console.log("  root cause:", result.rootCause?.category, `(${result.rootCause?.qualitative_recovery_probability})`);
    console.log("  LLM suggested:", result.recommendation?.suggested_action);
    console.log("  ERV winner:  ", result.selectedImpact?.action_type, `ERV=₹${result.selectedImpact?.expected_recovery_value}`);
    console.log("  policy final:", result.finalAction, `allowed=${result.policyDecision?.allowed}`);
    console.log("  execution:   ", result.executionResult?.status, result.executionResult?.provider);
    console.log("  verification:", result.verification ? `verified=${result.verification.verified} amount=₹${result.verification.amount_recovered}` : "n/a");
  }
}

main().catch((err) => {
  console.error("test-graph failed:", err);
  process.exit(1);
});
