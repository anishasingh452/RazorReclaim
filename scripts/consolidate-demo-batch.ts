import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "@/lib/db/service-client";

/**
 * Moves a handful of existing cases into one batch so a demo can show a
 * realistic portfolio without switching batches mid-presentation.
 *
 * Re-parenting is safe because a batch owns nothing directly: every child
 * row — decisions, impact_scores, policy_checks, agent_proposals,
 * agent_conflicts, no_action_decisions, executions, verifications,
 * voice_interactions, promises_to_pay, scheduled_actions, approvals,
 * evidence and audit_log — keys off `case_id`, never `batch_id`. The
 * Conflicts feed and the Portfolio ranking both scope through
 * `cases.batch_id`, so they follow the case automatically. `signals` is the
 * one table that also carries `batch_id`, so it is repointed here too.
 *
 * Nothing about a case's history is rewritten: no audit row is touched, so
 * every per-case hash chain stays exactly as it was.
 *
 *   npx tsx scripts/consolidate-demo-batch.ts            # dry run
 *   npx tsx scripts/consolidate-demo-batch.ts --apply
 */

const TARGET_BATCH = "d8a29e6d-6992-468a-bc99-de76d97766b6"; // Final Demo Showcase

/** Cases pinned to the front of the batch, in the order they get presented. */
const SPINE = [
  "5a504961-0654-4ee0-97a7-f4ca80a66d46", // Isha Kapoor      ₹1,59,053   escalate / approval
  "bb3eeb3b-79c1-47e7-b00d-910bddad82b2", // Aditi Joshi      ₹2,730.27   stop / why-not-to-act
  "4e3a599c-f16f-4caa-ab00-aa0f0420dc2c", // Aditi Joshi      ₹3,317.66   wait & retry / memory
  "77e4a169-3f94-4cd4-b7ed-0dfcff931f8e", // Simran Kapoor    ₹67,862.66  voice / promise-to-pay
  "94042d78-8eba-411e-be99-2c611f39ba4b", // Ananya Sharma    ₹4,036.58   Razorpay payment link
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same rules the batch orchestrator uses when it finishes a run. */
async function recomputeBatchTotals(batchId: string, apply: boolean) {
  const db = getServiceClient();
  const { data: cases } = await db.from("cases").select("id, amount").eq("batch_id", batchId);
  const ids = (cases ?? []).map((c) => c.id);

  const totalAtRisk = round2((cases ?? []).reduce((s, c) => s + Number(c.amount), 0));
  let totalRecovered = 0;
  let totalErv = 0;

  if (ids.length) {
    const { data: v } = await db.from("verifications").select("amount_recovered, verified, case_id").in("case_id", ids);
    totalRecovered = round2(
      (v ?? []).filter((x) => x.verified).reduce((s, x) => s + Number(x.amount_recovered), 0)
    );
    const { data: s } = await db
      .from("impact_scores")
      .select("expected_recovery_value, case_id")
      .in("case_id", ids)
      .eq("selected", true);
    totalErv = round2((s ?? []).reduce((acc, x) => acc + Number(x.expected_recovery_value), 0));
  }

  const { data: b } = await db.from("batches").select("name").eq("id", batchId).single();
  console.log(
    `  ${b?.name}: ${ids.length} cases · at risk ₹${totalAtRisk.toLocaleString("en-IN")} · ERV ₹${totalErv.toLocaleString("en-IN")} · recovered ₹${totalRecovered.toLocaleString("en-IN")}`
  );

  if (apply) {
    await db
      .from("batches")
      .update({
        total_cases: ids.length,
        total_at_risk: totalAtRisk,
        total_expected_recovery_value: totalErv,
        total_recovered: totalRecovered,
      })
      .eq("id", batchId);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getServiceClient();

  const { data: spineCases } = await db
    .from("cases")
    .select("id, batch_id, customer_name, amount, status, final_action")
    .in("id", SPINE);
  if (spineCases?.length !== SPINE.length) {
    throw new Error(`expected ${SPINE.length} spine cases, found ${spineCases?.length ?? 0}`);
  }

  const sourceBatches = new Set(spineCases.map((c) => c.batch_id).filter((b) => b !== TARGET_BATCH));

  console.log(apply ? "APPLYING\n" : "DRY RUN (pass --apply to write)\n");
  console.log("Cases to move:");
  for (const id of SPINE) {
    const c = spineCases.find((x) => x.id === id)!;
    console.log(
      `  seq ${SPINE.indexOf(id)}  ${c.customer_name.padEnd(16)} ₹${Number(c.amount).toLocaleString("en-IN").padStart(11)}  ${String(c.final_action).padEnd(14)} ${c.status}`
    );
  }

  if (apply) {
    // Free up seq 0..4 for the spine. No unique constraint on (batch_id, seq),
    // so this needs no ordering games.
    const { data: existing } = await db.from("cases").select("id, seq").eq("batch_id", TARGET_BATCH);
    for (const c of existing ?? []) {
      if (SPINE.includes(c.id)) continue;
      await db.from("cases").update({ seq: c.seq + SPINE.length }).eq("id", c.id);
    }

    for (const [i, id] of SPINE.entries()) {
      await db.from("cases").update({ batch_id: TARGET_BATCH, seq: i }).eq("id", id);
      await db.from("signals").update({ batch_id: TARGET_BATCH }).eq("case_id", id);
    }
  }

  console.log("\nBatch totals:");
  await recomputeBatchTotals(TARGET_BATCH, apply);
  for (const b of sourceBatches) await recomputeBatchTotals(b, apply);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
