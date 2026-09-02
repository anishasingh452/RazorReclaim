import { getServiceClient } from "@/lib/db/service-client";
import { appendAudit } from "@/lib/langgraph/audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import { executeNode } from "@/lib/langgraph/nodes/execute";
import { verifyNode } from "@/lib/langgraph/nodes/verify";
import { recordDecisionMemory } from "@/lib/memory/decision-memory";
import type { CaseGraphState } from "@/lib/langgraph/state";
import type { ActionType } from "@/types/domain";

interface RequestedAction {
  selected_impact: { action_type: ActionType; recovery_probability: number; potential_recoverable_amount: number };
}

/**
 * Resumes a case after a human approves its escalation. Not a LangGraph
 * checkpoint resume (see escalate.ts for why) — this directly re-invokes
 * the same execute/verify node functions the graph itself uses, so the
 * approved path goes through identical real Razorpay/Resend/voice logic.
 *
 * Two distinct outcomes depending on what was actually being approved:
 *  - The Business Impact Engine's own top pick was already `escalate`
 *    (e.g. a large B2B receivable) — there's no further automated action to
 *    execute; approval means a human now owns outreach. Case moves to
 *    `escalated` (distinct from `awaiting_approval`).
 *  - Policy forced escalate over an automated pick (e.g. amount above the
 *    auto-approval limit) — approval authorizes running that original
 *    action for real.
 */
export async function resumeApprovedCase(approvalId: string, reviewer: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: approval, error: approvalError } = await supabase
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .single();
  if (approvalError || !approval) throw new Error(`resumeApprovedCase: approval not found: ${approvalError?.message}`);
  if (approval.status !== "pending") throw new Error(`resumeApprovedCase: approval ${approvalId} is not pending`);

  const { data: caseRecord, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", approval.case_id)
    .single();
  if (caseError || !caseRecord) throw new Error(`resumeApprovedCase: case not found: ${caseError?.message}`);

  await supabase
    .from("approvals")
    .update({ status: "approved", reviewer, reviewed_at: new Date().toISOString() })
    .eq("id", approvalId);

  const requested = approval.requested_action as unknown as RequestedAction;
  const originalAction = requested.selected_impact.action_type;

  await appendAudit(approval.case_id, AUDIT_EVENT.APPROVED, "human", { reviewer, original_action: originalAction });

  if (originalAction === "escalate") {
    // No further automated action possible — a human now owns this case.
    await supabase.from("cases").update({ status: "escalated" }).eq("id", approval.case_id);
    await supabase.from("executions").insert({
      case_id: approval.case_id,
      action_type: "escalate",
      provider: "none",
      external_ref: null,
      status: "success",
      idempotency_key: `${approval.case_id}:escalate:${Date.now()}`,
      request_payload: { note: "Approved for human-led outreach — no automated execution" },
      response_payload: null,
    });
    await recordDecisionMemory({
      customerId: caseRecord.customer_id,
      caseId: approval.case_id,
      riskType: caseRecord.risk_type,
      finalAction: "escalate",
      verified: false,
      amountRecovered: 0,
      amount: caseRecord.amount,
    });
    return;
  }

  await supabase.from("cases").update({ status: "in_progress" }).eq("id", approval.case_id);

  let state: CaseGraphState = {
    caseId: approval.case_id,
    caseRecord,
    evidence: [],
    rootCause: null,
    rootCauseModel: null,
    recommendation: null,
    recommendationModel: null,
    agentProposals: [],
    sharedContext: null,
    impactCandidates: [],
    selectedImpact: {
      action_type: requested.selected_impact.action_type,
      recovery_probability: requested.selected_impact.recovery_probability,
      potential_recoverable_amount: requested.selected_impact.potential_recoverable_amount,
      intervention_cost: 0,
      expected_recovery_value: 0,
      selected: true,
      feasible: true,
      exclusion_reason: null,
    },
    policyDecision: null,
    finalAction: originalAction,
    executionResult: null,
    verification: null,
  };

  const executeUpdate = await executeNode(state);
  state = { ...state, ...executeUpdate };

  if ((originalAction === "retry" || originalAction === "voice") && state.executionResult?.status === "success") {
    const verifyUpdate = await verifyNode(state);
    state = { ...state, ...verifyUpdate };
  }
}

export async function rejectApprovedCase(approvalId: string, reviewer: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: approval, error } = await supabase.from("approvals").select("*").eq("id", approvalId).single();
  if (error || !approval) throw new Error(`rejectApprovedCase: approval not found: ${error?.message}`);
  if (approval.status !== "pending") throw new Error(`rejectApprovedCase: approval ${approvalId} is not pending`);

  const { data: caseRecord } = await supabase.from("cases").select("*").eq("id", approval.case_id).single();

  await supabase
    .from("approvals")
    .update({ status: "rejected", reviewer, reviewed_at: new Date().toISOString() })
    .eq("id", approvalId);

  await supabase.from("cases").update({ status: "stopped" }).eq("id", approval.case_id);

  await appendAudit(approval.case_id, AUDIT_EVENT.REJECTED, "human", { reviewer });

  if (caseRecord) {
    await recordDecisionMemory({
      customerId: caseRecord.customer_id,
      caseId: approval.case_id,
      riskType: caseRecord.risk_type,
      finalAction: "stop",
      verified: false,
      amountRecovered: 0,
      amount: caseRecord.amount,
    });
  }
}
