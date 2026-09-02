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
const { data: cases } = await supabase.from("cases").select("id").eq("batch_id", batchId);
const caseIds = cases.map((c) => c.id);

const { data: executions } = await supabase
  .from("executions")
  .select("case_id, action_type, provider, external_ref, status, request_payload, response_payload")
  .in("case_id", caseIds);

console.log(`EXECUTIONS (${executions.length}):`);
console.table(
  executions.map((e) => ({
    case_id: e.case_id.slice(0, 8),
    action: e.action_type,
    provider: e.provider,
    status: e.status,
    external_ref: e.external_ref,
  }))
);

const realOnes = executions.filter((e) => e.provider === "razorpay");
console.log(`\n${realOnes.length} real Razorpay execution(s):`);
realOnes.forEach((e) => {
  console.log(`  case ${e.case_id.slice(0, 8)}: ${JSON.stringify(e.request_payload)}`);
  console.log(`    response: ${JSON.stringify(e.response_payload)}`);
});
