import { getServiceClient } from "@/lib/db/service-client";
import { computeImpactScores, selectedAction } from "@/lib/impact/engine";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

export async function businessImpactNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.caseRecord) throw new Error("businessImpactNode: caseRecord missing from state");
  if (!state.rootCause) throw new Error("businessImpactNode: rootCause missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const { count: priorExecutionCount } = await supabase
    .from("executions")
    .select("*", { count: "exact", head: true })
    .eq("case_id", state.caseId);

  const candidates = computeImpactScores({
    amount: c.amount,
    riskType: c.risk_type,
    contactAttempts: c.contact_attempts,
    daysSinceFailure: c.days_since_failure,
    rootCause: state.rootCause,
    priorExecutionCount: priorExecutionCount ?? 0,
  });
  const winner = selectedAction(candidates);

  // The Candidate Action Engine's output — every action type considered,
  // feasible or not — logged BEFORE scoring, so the audit trail shows what
  // was in play prior to the ERV math.
  await appendAudit(state.caseId, AUDIT_EVENT.CANDIDATE_ACTIONS, "candidate_engine", {
    candidates: candidates.map((cand) => ({
      action: cand.action_type,
      feasible: cand.feasible,
      exclusion_reason: cand.exclusion_reason,
    })),
  });

  const { error } = await supabase.from("impact_scores").insert(
    candidates.map((cand) => ({
      case_id: state.caseId,
      action_type: cand.action_type,
      potential_recoverable_amount: cand.potential_recoverable_amount,
      recovery_probability: cand.recovery_probability,
      intervention_cost: cand.intervention_cost,
      expected_recovery_value: cand.expected_recovery_value,
      selected: cand.selected,
      feasible: cand.feasible,
      exclusion_reason: cand.exclusion_reason,
    }))
  );
  if (error) throw new Error(`businessImpactNode: failed to persist impact scores: ${error.message}`);

  const divergesFromLlm = state.recommendation && state.recommendation.suggested_action !== winner.action_type;
  const matchedProposals = (state.agentProposals ?? []).filter((p) => p.proposed_action === winner.action_type);

  await appendAudit(state.caseId, AUDIT_EVENT.ERV_CALCULATED, "impact_engine", {
    selected_action: winner.action_type,
    expected_recovery_value: winner.expected_recovery_value,
    recovery_probability: winner.recovery_probability,
    llm_suggested_action: state.recommendation?.suggested_action ?? null,
    diverges_from_llm_suggestion: divergesFromLlm,
    matched_agent_proposals: matchedProposals.map((p) => p.agent_name),
    reason: `Highest ERV among ${candidates.filter((c) => c.feasible).length} feasible candidates`,
    all_candidates: candidates
      .filter((c) => c.feasible)
      .map((c) => ({ action: c.action_type, erv: c.expected_recovery_value })),
  });

  if (state.agentProposals && state.agentProposals.length > 0) {
    await resolveAgentProposals(state.caseId, winner.action_type, state.agentProposals);
  }

  return { impactCandidates: candidates, selectedImpact: winner };
}

/**
 * The Business Impact Engine IS the conflict resolver ("apply policy +
 * business impact, select the winning strategy") — this reconciles the
 * agent_proposals/agent_conflicts records the earlier conflict-detection
 * node created against the ERV winner it just computed, rather than adding
 * a second decision-making step.
 */
async function resolveAgentProposals(
  caseId: string,
  winningAction: string,
  proposals: NonNullable<CaseGraphState["agentProposals"]>
): Promise<void> {
  const supabase = getServiceClient();
  const matched = proposals.filter((p) => p.proposed_action === winningAction);
  const unmatched = proposals.filter((p) => p.proposed_action !== winningAction);

  if (matched.length > 0) {
    await supabase
      .from("agent_proposals")
      .update({ status: "selected" })
      .in("id", matched.map((p) => p.id));
  }
  if (unmatched.length > 0) {
    await supabase
      .from("agent_proposals")
      .update({ status: "rejected_conflict" })
      .in("id", unmatched.map((p) => p.id));
  }

  const { data: pendingConflicts } = await supabase
    .from("agent_conflicts")
    .select("id")
    .eq("case_id", caseId)
    .is("resolution", null);

  if (pendingConflicts && pendingConflicts.length > 0) {
    await supabase
      .from("agent_conflicts")
      .update({
        resolution: matched.length > 0 ? "selected_winner" : "blocked_all",
        winning_proposal_id: matched[0]?.id ?? null,
      })
      .in("id", pendingConflicts.map((c) => c.id));
  }
}
