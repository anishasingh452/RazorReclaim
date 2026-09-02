import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "../src/lib/db/service-client";
import { verifyChain, type ChainedAuditRow } from "../src/lib/audit/hash-chain";
import { getPortfolioRanking } from "../src/lib/portfolio/priority-optimizer";

async function main() {
  const batchId = process.argv[2];
  if (!batchId) throw new Error("usage: tsx scripts/verify-e2e-integrity.ts <batchId>");

  const supabase = getServiceClient();
  const { data: cases } = await supabase.from("cases").select("id").eq("batch_id", batchId).limit(3);
  if (!cases) throw new Error("no cases found");

  for (const c of cases) {
    const { data: audit } = await supabase
      .from("audit_log")
      .select("*")
      .eq("case_id", c.id)
      .order("created_at");
    const brokenAt = verifyChain((audit ?? []) as unknown as ChainedAuditRow[]);
    console.log(`Case ${c.id}: ${audit?.length} events, hash chain ${brokenAt === null ? "INTACT" : `BROKEN at index ${brokenAt}`}`);
  }

  const ranking = await getPortfolioRanking(batchId);
  console.log(`\nPortfolio ranking (${ranking.length} cases):`);
  console.table(ranking.map((r) => ({ case: r.caseId.slice(0, 8), erv: r.selectedErv, days: r.daysSinceFailure, priority: r.priorityScore })));
}

main().catch((err) => {
  console.error("verify-e2e-integrity failed:", err);
  process.exit(1);
});
