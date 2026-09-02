import { getServiceClient } from "@/lib/db/service-client";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * Terminal node for the human-approval path. No true LangGraph interrupt/
 * checkpoint here: the deployment target is Vercel serverless + Supabase over
 * REST (no durable direct-Postgres connection for a LangGraph checkpointer),
 * so an in-memory interrupt would be lost the moment this invocation ends —
 * a human approving minutes later is a different process entirely. Instead,
 * this node persists a real, durable `approvals` row and ends the graph
 * cleanly; a separate `resumeApprovedCase` function (Step 10) picks the case
 * back up from Supabase state when a human actually approves or rejects.
 */
export async function escalateNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.selectedImpact) throw new Error("escalateNode: selectedImpact missing from state");
  if (!state.policyDecision) throw new Error("escalateNode: policyDecision missing from state");
  const supabase = getServiceClient();

  const { error: approvalError } = await supabase.from("approvals").insert({
    case_id: state.caseId,
    requested_action: {
      selected_impact: state.selectedImpact,
      policy_decision: state.policyDecision,
      llm_recommendation: state.recommendation,
    },
    status: "pending",
    langgraph_thread_id: state.caseId,
  });
  if (approvalError) throw new Error(`escalateNode: failed to create approval: ${approvalError.message}`);

  await supabase.from("cases").update({ status: "awaiting_approval" }).eq("id", state.caseId);

  await appendAudit(state.caseId, "escalated_to_human", "policy_engine", {
    reason: state.policyDecision.checks.filter((c) => !c.passed).map((c) => c.rule_name),
    expected_recovery_value: state.selectedImpact.expected_recovery_value,
  });

  return {};
}
