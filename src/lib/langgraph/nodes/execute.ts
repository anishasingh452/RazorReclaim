import { getServiceClient } from "@/lib/db/service-client";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * PLACEHOLDER for Step 5/6 testing — real Razorpay Payment Links and Resend
 * emails are wired in Step 7. For now every action is recorded as a
 * `simulated` execution so the graph shape, routing, and persistence are
 * fully exercised end-to-end before real API calls are introduced.
 */
export async function executeNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.finalAction) throw new Error("executeNode: finalAction missing from state");
  const supabase = getServiceClient();

  const idempotencyKey = `${state.caseId}:${state.finalAction}:${Date.now()}`;

  const { data: execution, error } = await supabase
    .from("executions")
    .insert({
      case_id: state.caseId,
      action_type: state.finalAction,
      provider: "simulated",
      external_ref: null,
      status: "success",
      idempotency_key: idempotencyKey,
      request_payload: { action: state.finalAction, note: "Step 5/6 placeholder — real integration lands in Step 7" },
      response_payload: null,
    })
    .select()
    .single();
  if (error || !execution) throw new Error(`executeNode: failed to persist execution: ${error?.message}`);

  await appendAudit(state.caseId, "action_executed", "system", {
    action_type: state.finalAction,
    provider: "simulated",
    execution_id: execution.id,
  });

  return { executionResult: execution };
}
