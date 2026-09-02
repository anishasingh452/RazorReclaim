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

const tables = [
  "batches",
  "cases",
  "evidence",
  "decisions",
  "impact_scores",
  "policy_checks",
  "executions",
  "verifications",
  "approvals",
  "audit_log",
];

for (const t of tables) {
  const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`FAIL  ${t}: ${error.message}`);
  } else {
    console.log(`OK    ${t} (rows: ${count})`);
  }
}
