import { getServiceClient } from "@/lib/db/service-client";
import { createRng } from "@/lib/generator/rng";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * PLACEHOLDER for Step 5/6 testing — real webhook/poll-driven verification
 * against Razorpay lands in Step 7, reusing this same persistence shape.
 * Outcome is a deterministic (seeded by case id) draw against the selected
 * action's recovery probability, so repeated test runs are reproducible.
 */
export async function verifyNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.executionResult) throw new Error("verifyNode: executionResult missing from state");
  if (!state.selectedImpact) throw new Error("verifyNode: selectedImpact missing from state");
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

  await appendAudit(state.caseId, "outcome_verified", "system", {
    verified,
    amount_recovered: amountRecovered,
    source: "simulated_trigger",
  });

  return { verification };
}
