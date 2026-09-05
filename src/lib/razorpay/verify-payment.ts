import { getServiceClient } from "@/lib/db/service-client";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { appendAudit } from "@/lib/langgraph/audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import { recordDecisionMemory } from "@/lib/memory/decision-memory";
import type { Verification, VerificationSource } from "@/types/domain";

/** What Razorpay itself says about a payment link, right now. */
export interface PaymentLinkStatus {
  paid: boolean;
  status: string;
  amountPaidPaise: number;
}

/**
 * Asks Razorpay for a payment link's actual state. This is the only thing
 * allowed to decide whether money arrived — never the caller, and never the
 * fact that a button was pressed.
 */
export async function fetchPaymentLinkStatus(paymentLinkId: string): Promise<PaymentLinkStatus> {
  const link = (await getRazorpayClient().paymentLink.fetch(paymentLinkId)) as unknown as {
    status?: string;
    amount_paid?: number;
  };
  const amountPaidPaise = link.amount_paid ?? 0;
  return {
    paid: link.status === "paid" || amountPaidPaise > 0,
    status: link.status ?? "unknown",
    amountPaidPaise,
  };
}

export type VerifyOutcome =
  | { verified: true; verification: Verification }
  | { verified: false; reason: "not_paid"; status: string }
  | { verified: false; reason: "no_execution" };

/**
 * The single verification code path for real Razorpay Payment Links —
 * called from BOTH the real webhook handler (source: 'webhook') and the demo
 * trigger (source: 'simulated_trigger').
 *
 * Both callers land here, and BOTH are checked against Razorpay before
 * anything is written. The demo trigger does not assert that a payment
 * happened; it only asks the same question the webhook answers, at a moment
 * of the presenter's choosing. If the link has not actually been paid,
 * nothing is recorded and the case stays exactly where it was.
 *
 * This was previously wrong in a way that mattered: the function wrote
 * `verified: true` and marked the case recovered without asking Razorpay
 * anything, so pressing the demo button "recovered" revenue that had never
 * been paid. For a product whose whole claim is that outcomes are verified
 * rather than assumed, that was the worst possible bug to ship.
 */
export async function verifyPaymentLinkPaid(
  paymentLinkId: string,
  source: VerificationSource
): Promise<VerifyOutcome> {
  const supabase = getServiceClient();

  const { data: execution, error: execError } = await supabase
    .from("executions")
    .select("*")
    .eq("external_ref", paymentLinkId)
    .eq("provider", "razorpay")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (execError || !execution) {
    return { verified: false, reason: "no_execution" };
  }

  // Idempotency: a real webhook can retry, and a demo trigger could be
  // double-clicked — never double-count recovered revenue for the same
  // execution. Only a successful verification is terminal; a recorded
  // "checked, not paid yet" must not block a later genuine payment.
  const { data: existing } = await supabase
    .from("verifications")
    .select("*")
    .eq("execution_id", execution.id)
    .eq("verified", true)
    .maybeSingle();
  if (existing) return { verified: true, verification: existing as Verification };

  // The authority on whether money moved is Razorpay, not this process.
  const link = await fetchPaymentLinkStatus(paymentLinkId);
  if (!link.paid) {
    return { verified: false, reason: "not_paid", status: link.status };
  }

  const { data: caseRow } = await supabase
    .from("cases")
    .select("amount, customer_id, risk_type, final_action")
    .eq("id", execution.case_id)
    .single();

  // Razorpay's own figure, not the invoice amount — a partial payment must
  // not be recorded as a full recovery.
  const amountRecovered = link.amountPaidPaise / 100;

  const { data: verification, error: verifyError } = await supabase
    .from("verifications")
    .insert({
      case_id: execution.case_id,
      execution_id: execution.id,
      verified: true,
      amount_recovered: amountRecovered,
      source,
    })
    .select()
    .single();
  if (verifyError || !verification) {
    throw new Error(`verifyPaymentLinkPaid: failed to persist verification: ${verifyError?.message}`);
  }

  await supabase.from("cases").update({ status: "recovered" }).eq("id", execution.case_id);

  await appendAudit(execution.case_id, AUDIT_EVENT.OUTCOME_VERIFIED, "system", {
    verified: true,
    amount_recovered: amountRecovered,
    source,
    payment_link_id: paymentLinkId,
    razorpay_status: link.status,
  });

  if (caseRow) {
    await recordDecisionMemory({
      customerId: caseRow.customer_id,
      caseId: execution.case_id,
      riskType: caseRow.risk_type,
      finalAction: caseRow.final_action,
      verified: true,
      amountRecovered,
      amount: caseRow.amount,
    });
  }

  return { verified: true, verification: verification as Verification };
}
