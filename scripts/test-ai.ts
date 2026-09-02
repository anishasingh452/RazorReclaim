import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "../src/lib/db/service-client";
import { runRootCauseReasoning } from "../src/lib/ai/root-cause";
import { runRecommendation } from "../src/lib/ai/recommend";

async function main() {
  const batchId = process.argv[2];
  if (!batchId) throw new Error("usage: tsx scripts/test-ai.ts <batchId>");

  const supabase = getServiceClient();
  const { data: cases, error } = await supabase
    .from("cases")
    .select("*")
    .eq("batch_id", batchId)
    .order("seq")
    .limit(3);
  if (error || !cases?.length) throw new Error(`No cases found: ${error?.message}`);

  for (const c of cases) {
    const { data: evidence } = await supabase.from("evidence").select("source, payload").eq("case_id", c.id);

    console.log("\n" + "=".repeat(70));
    console.log(`Case #${c.seq} — ${c.customer_name} — ₹${c.amount} — ${c.risk_type}`);
    console.log(`contact_attempts=${c.contact_attempts} days_since_failure=${c.days_since_failure}`);

    const rc = await runRootCauseReasoning({
      riskType: c.risk_type,
      amount: c.amount,
      customerTier: c.customer_tier,
      contactAttempts: c.contact_attempts,
      daysSinceFailure: c.days_since_failure,
      evidence: evidence ?? [],
    });
    console.log("\nROOT CAUSE:", JSON.stringify(rc.result, null, 2));

    const rec = await runRecommendation({
      riskType: c.risk_type,
      amount: c.amount,
      customerTier: c.customer_tier,
      contactAttempts: c.contact_attempts,
      daysSinceFailure: c.days_since_failure,
      rootCause: rc.result,
    });
    console.log("\nRECOMMENDATION:", JSON.stringify(rec.result, null, 2));
  }
}

main().catch((err) => {
  console.error("test-ai failed:", err);
  process.exit(1);
});
