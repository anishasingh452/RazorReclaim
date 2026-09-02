import { getServiceClient } from "@/lib/db/service-client";
import { computeImpactScores, selectedAction } from "@/lib/impact/engine";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

export async function businessImpactNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.caseRecord) throw new Error("businessImpactNode: caseRecord missing from state");
  if (!state.rootCause) throw new Error("businessImpactNode: rootCause missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const candidates = computeImpactScores({
    amount: c.amount,
    riskType: c.risk_type,
    contactAttempts: c.contact_attempts,
    daysSinceFailure: c.days_since_failure,
    rootCause: state.rootCause,
  });
  const winner = selectedAction(candidates);

  const { error } = await supabase.from("impact_scores").insert(
    candidates.map((cand) => ({
      case_id: state.caseId,
      action_type: cand.action_type,
      potential_recoverable_amount: cand.potential_recoverable_amount,
      recovery_probability: cand.recovery_probability,
      intervention_cost: cand.intervention_cost,
      expected_recovery_value: cand.expected_recovery_value,
      selected: cand.selected,
    }))
  );
  if (error) throw new Error(`businessImpactNode: failed to persist impact scores: ${error.message}`);

  const divergesFromLlm = state.recommendation && state.recommendation.suggested_action !== winner.action_type;

  await appendAudit(state.caseId, "business_impact_scored", "impact_engine", {
    selected_action: winner.action_type,
    expected_recovery_value: winner.expected_recovery_value,
    recovery_probability: winner.recovery_probability,
    llm_suggested_action: state.recommendation?.suggested_action ?? null,
    diverges_from_llm_suggestion: divergesFromLlm,
    all_candidates: candidates.map((c) => ({ action: c.action_type, erv: c.expected_recovery_value })),
  });

  return { impactCandidates: candidates, selectedImpact: winner };
}
