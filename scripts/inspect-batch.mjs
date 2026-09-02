import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const batchId = process.argv[2];
const { data: batch } = await supabase.from("batches").select("*").eq("id", batchId).single();
console.log("BATCH:", batch);

const { data: cases } = await supabase
  .from("cases")
  .select("seq, customer_name, customer_email, customer_tier, amount, risk_type, contact_attempts, days_since_failure, status")
  .eq("batch_id", batchId)
  .order("seq");
console.log(`\nCASES (${cases.length}):`);
console.table(cases);

const riskTypeCounts = cases.reduce((acc, c) => ((acc[c.risk_type] = (acc[c.risk_type] || 0) + 1), acc), {});
console.log("\nRisk type distribution:", riskTypeCounts);

const { data: evidence } = await supabase
  .from("evidence")
  .select("case_id, source, payload")
  .in("case_id", cases.length ? (await supabase.from("cases").select("id").eq("batch_id", batchId)).data.map((c) => c.id) : []);
console.log(`\nEVIDENCE rows: ${evidence.length}`);
console.log("Sample evidence[0]:", JSON.stringify(evidence[0], null, 2));
console.log("Sample evidence[1]:", JSON.stringify(evidence[1], null, 2));
