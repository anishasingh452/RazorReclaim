import { getServiceClient } from "@/lib/db/service-client";
import { createRng } from "@/lib/generator/rng";
import { recordDecisionMemory } from "@/lib/memory/decision-memory";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * Synchronous verification for the two simulated action types (`retry`,
 * `voice`) — there's no real external system to await for either, so the
 * outcome is a deterministic (seeded by case id) draw against the selected
 * action's recovery probability. Real `payment_link`/`reminder` executions
 * never reach this node — their verification is asynchronous, via the real
 * Razorpay webhook or the demo simulate-payment trigger (both route through
 * src/lib/razorpay/verify-payment.ts instead).
 */
export async function verifyNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.executionResult) throw new Error("verifyNode: executionResult missing from state");
  if (!state.selectedImpact) throw new Error("verifyNode: selectedImpact missing from state");
  if (!state.caseRecord) throw new Error("verifyNode: caseRecord missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const rng = createRng(`${state.caseId}:verify`);
  const verified = rng() < state.selectedImpact.recovery_probability;
  const amountRecovered = verified ? state.selectedImpact.potential_recoverable_amount : 0;

  const { data: verification, error } = await supabase
    .from("verifications")
    .insert({
      case_id: state.caseId,
      execution_id: state.executionResult.id,
      verified,
      amount_recovered: amountRecovered,
      source: "simulated_trigger",
    })
    .select()
    .single();
  if (error || !verification) throw new Error(`verifyNode: failed to persist verification: ${error?.message}`);

  await supabase
    .from("cases")
    .update({ status: verified ? "recovered" : "closed" })
    .eq("id", state.caseId);

  await appendAudit(state.caseId, AUDIT_EVENT.OUTCOME_VERIFIED, "system", {
    verified,
    amount_recovered: amountRecovered,
    source: "simulated_trigger",
  });

  await recordDecisionMemory({
    customerId: c.customer_id,
    caseId: state.caseId,
    riskType: c.risk_type,
    finalAction: state.finalAction,
    verified,
    amountRecovered,
    amount: c.amount,
  });

  return { verification };
}
