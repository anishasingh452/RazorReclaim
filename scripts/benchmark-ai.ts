import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "../src/lib/db/service-client";
import { runRootCauseReasoning } from "../src/lib/ai/root-cause";
import { runRecommendation } from "../src/lib/ai/recommend";
import { resolveProvider, currentModelName } from "../src/lib/ai/provider";

interface CallMetric {
  caseSeq: number;
  stage: "root_cause" | "recommend";
  ms: number;
  ok: boolean;
  error?: string;
}

async function main() {
  const batchId = process.argv[2];
  const limit = Number(process.argv[3] ?? "5");
  if (!batchId) throw new Error("usage: tsx scripts/benchmark-ai.ts <batchId> [caseCount]");

  console.log(`Provider: ${resolveProvider()} | Model: ${currentModelName()}`);

  const supabase = getServiceClient();
  const { data: cases, error } = await supabase
    .from("cases")
    .select("*")
    .eq("batch_id", batchId)
    .order("seq")
    .limit(limit);
  if (error || !cases?.length) throw new Error(`No cases found: ${error?.message}`);

  const metrics: CallMetric[] = [];
  const batchStart = Date.now();

  for (const c of cases) {
    const { data: evidence } = await supabase.from("evidence").select("source, payload").eq("case_id", c.id);

    console.log(`\ncase #${c.seq} (${c.risk_type}, ₹${c.amount})`);

    let t0 = Date.now();
    let rootCauseResult;
    try {
      rootCauseResult = await runRootCauseReasoning({
        riskType: c.risk_type,
        amount: c.amount,
        customerTier: c.customer_tier,
        contactAttempts: c.contact_attempts,
        daysSinceFailure: c.days_since_failure,
        evidence: evidence ?? [],
      });
      const ms = Date.now() - t0;
      metrics.push({ caseSeq: c.seq, stage: "root_cause", ms, ok: true });
      console.log(`  root_cause  ${ms}ms  -> ${rootCauseResult.result.category} / ${rootCauseResult.result.qualitative_recovery_probability}`);
      console.log(`    evidence_summary: ${JSON.stringify(rootCauseResult.result.evidence_summary)}`);
    } catch (err) {
      const ms = Date.now() - t0;
      metrics.push({ caseSeq: c.seq, stage: "root_cause", ms, ok: false, error: String(err) });
      console.log(`  root_cause  ${ms}ms  -> FAILED: ${err}`);
      continue; // can't run recommend without root cause
    }

    t0 = Date.now();
    try {
      const rec = await runRecommendation({
        riskType: c.risk_type,
        amount: c.amount,
        customerTier: c.customer_tier,
        contactAttempts: c.contact_attempts,
        daysSinceFailure: c.days_since_failure,
        rootCause: rootCauseResult.result,
      });
      const ms = Date.now() - t0;
      metrics.push({ caseSeq: c.seq, stage: "recommend", ms, ok: true });
      console.log(`  recommend   ${ms}ms  -> ${rec.result.suggested_action}`);
      console.log(`    evidence_summary: ${JSON.stringify(rec.result.evidence_summary)}`);
    } catch (err) {
      const ms = Date.now() - t0;
      metrics.push({ caseSeq: c.seq, stage: "recommend", ms, ok: false, error: String(err) });
      console.log(`  recommend   ${ms}ms  -> FAILED: ${err}`);
    }
  }

  const totalMs = Date.now() - batchStart;
  const ok = metrics.filter((m) => m.ok);
  const failed = metrics.filter((m) => !m.ok);
  const avgMs = ok.length ? ok.reduce((s, m) => s + m.ms, 0) / ok.length : 0;
  const successRate = metrics.length ? (ok.length / metrics.length) * 100 : 0;
  const throughputPerSec = metrics.length ? metrics.length / (totalMs / 1000) : 0;

  console.log("\n" + "=".repeat(60));
  console.log("BENCHMARK SUMMARY");
  console.log("=".repeat(60));
  console.log(`Cases:                 ${cases.length}`);
  console.log(`LLM calls attempted:   ${metrics.length}`);
  console.log(`Valid schema success:  ${ok.length}/${metrics.length} (${successRate.toFixed(1)}%)`);
  console.log(`Avg latency per call:  ${avgMs.toFixed(0)}ms`);
  console.log(`Total batch time:      ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`);
  console.log(`Throughput:            ${throughputPerSec.toFixed(2)} calls/sec`);
  if (failed.length) {
    console.log(`\nFailures:`);
    failed.forEach((f) => console.log(`  case #${f.caseSeq} [${f.stage}]: ${f.error}`));
  }

  const projected150 = (avgMs * 2 * 150) / 1000;
  console.log(`\nProjected time for a 150-case batch @ this avg latency, concurrency=1: ${projected150.toFixed(0)}s (${(projected150 / 60).toFixed(1)} min)`);
}

main().catch((err) => {
  console.error("benchmark-ai failed:", err);
  process.exit(1);
});
