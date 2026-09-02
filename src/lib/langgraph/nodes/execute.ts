import { getServiceClient } from "@/lib/db/service-client";
import { createPaymentLinkForCase } from "@/lib/razorpay/create-payment-link";
import { sendRecoveryEmail } from "@/lib/resend/send-recovery-email";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";
import type { ExecutionProvider, ExecutionStatus } from "@/types/domain";

/**
 * Real dispatch:
 *  - payment_link / reminder: real Razorpay Test Mode Payment Link + real
 *    Resend email. Verification for these is asynchronous (webhook or the
 *    demo simulate-payment trigger) — this node does NOT guess an outcome.
 *  - retry: simulated. There's no real customer payment method to retry
 *    against in a synthetic dataset, so this stays a clearly-labeled
 *    placeholder; its outcome is determined synchronously by verifyNode.
 * `wait_and_retry` never reaches this node — the graph routes it to `defer`.
 */
export async function executeNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.finalAction) throw new Error("executeNode: finalAction missing from state");
  if (!state.caseRecord) throw new Error("executeNode: caseRecord missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const idempotencyKey = `${state.caseId}:${state.finalAction}:${Date.now()}`;

  let provider: ExecutionProvider = "simulated";
  let externalRef: string | null = null;
  let status: ExecutionStatus = "success";
  let requestPayload: Record<string, unknown> = { action: state.finalAction };
  let responsePayload: Record<string, unknown> | null = null;

  if (state.finalAction === "payment_link" || state.finalAction === "reminder") {
    try {
      const link = await createPaymentLinkForCase(c);
      const email = await sendRecoveryEmail({
        toIntended: c.customer_email,
        customerName: c.customer_name,
        amount: c.amount,
        actionType: state.finalAction,
        paymentLinkUrl: link.short_url,
      });
      provider = "razorpay";
      externalRef = link.id;
      requestPayload = { action: state.finalAction, payment_link_id: link.id, short_url: link.short_url };
      responsePayload = { razorpay_status: link.status, resend_email_id: email.id, resend_delivered_to: email.to };
    } catch (err) {
      status = "failed";
      responsePayload = { error: String(err) };
    }
  }
  // retry: leave provider="simulated", status="success" — see doc comment above.

  const { data: execution, error } = await supabase
    .from("executions")
    .insert({
      case_id: state.caseId,
      action_type: state.finalAction,
      provider,
      external_ref: externalRef,
      status,
      idempotency_key: idempotencyKey,
      request_payload: requestPayload,
      response_payload: responsePayload,
    })
    .select()
    .single();
  if (error || !execution) throw new Error(`executeNode: failed to persist execution: ${error?.message}`);

  if (status === "failed") {
    await supabase.from("cases").update({ status: "failed" }).eq("id", state.caseId);
  }

  await appendAudit(state.caseId, "action_executed", "system", {
    action_type: state.finalAction,
    provider,
    external_ref: externalRef,
    status,
  });

  return { executionResult: execution };
}
