import { getServiceClient } from "@/lib/db/service-client";
import { explainInaction } from "@/lib/why-not-to-act/reason-engine";
import { toDecisionCategory } from "@/lib/decision/decision-category";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

const NON_ACT_ACTIONS = new Set(["stop", "no_action", "wait_and_retry"]);

/**
 * Runs after Policy + Governor, before routing to escalate/defer/execute.
 * Always logs FINAL_DECISION (the Command Center's 5-way ACT/WAIT/ESCALATE/
 * NO_ACTION/STOP meta-decision). For the three non-engaging outcomes, also
 * runs the "Why Not To Act" engine and persists a structured, queryable
 * explanation — reusing signals the ERV/policy engines already computed,
 * not a new calculation.
 */
export async function finalDecisionNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.finalAction) throw new Error("finalDecisionNode: finalAction missing from state");
  if (!state.caseRecord) throw new Error("finalDecisionNode: caseRecord missing from state");
  const category = toDecisionCategory(state.finalAction);

  await appendAudit(state.caseId, AUDIT_EVENT.FINAL_DECISION, "policy_engine", {
    final_action: state.finalAction,
    decision_category: category,
  });

  if (!NON_ACT_ACTIONS.has(state.finalAction)) return {};
  if (!state.rootCause) throw new Error("finalDecisionNode: rootCause missing from state");
  if (!state.selectedImpact) throw new Error("finalDecisionNode: selectedImpact missing from state");

  const supabase = getServiceClient();
  const bestFeasibleErv = (state.impactCandidates ?? [])
    .filter((c) => c.feasible && c.action_type !== "stop" && c.action_type !== "no_action")
    .reduce((max, c) => Math.max(max, c.expected_recovery_value), -Infinity);

  const explanation = explainInaction({
    finalAction: state.finalAction as "stop" | "no_action" | "wait_and_retry",
    rootCauseConfidence: state.rootCause.confidence,
    rootCauseCategory: state.rootCause.category,
    contactAttempts: state.caseRecord.contact_attempts,
    selectedCandidate: state.selectedImpact,
    bestFeasibleErv: bestFeasibleErv === -Infinity ? 0 : bestFeasibleErv,
    activePromise: state.sharedContext?.activePromise ?? null,
  });

  const { error } = await supabase.from("no_action_decisions").insert({
    case_id: state.caseId,
    reason_code: explanation.reasonCode,
    explanation: explanation.explanation,
    alternatives_considered: (state.impactCandidates ?? [])
      .filter((c) => c.feasible)
      .map((c) => ({ action: c.action_type, erv: c.expected_recovery_value })),
  });
  if (error) throw new Error(`finalDecisionNode: failed to persist no-action decision: ${error.message}`);

  await appendAudit(state.caseId, AUDIT_EVENT.WHY_NOT_TO_ACT, "reasoning_engine", {
    reason_code: explanation.reasonCode,
    explanation: explanation.explanation,
  });

  return {};
}
