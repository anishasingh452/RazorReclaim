import { getServiceClient } from "@/lib/db/service-client";
import { appendAudit } from "@/lib/langgraph/audit";
import type { Verification, VerificationSource } from "@/types/domain";

/**
 * The single verification code path for real Razorpay Payment Links —
 * called from BOTH the real webhook handler (source: 'webhook') and the
 * demo simulate-payment trigger (source: 'simulated_trigger'). There is
 * deliberately no separate "fake success" branch: whichever trigger fires,
 * the same function does the same DB writes, so the distinction between a
 * genuinely-paid case and a demo-simulated one is recorded only in
 * `verifications.source`, never in a different code path.
 */
export async function verifyPaymentLinkPaid(
  paymentLinkId: string,
  source: VerificationSource,
  amountPaidPaise?: number
): Promise<Verification> {
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
    throw new Error(`verifyPaymentLinkPaid: no execution found for payment_link ${paymentLinkId}`);
  }

  // Idempotency: a real webhook can retry, and a demo trigger could double-click —
  // never double-count recovered revenue for the same execution.
  const { data: existing } = await supabase
    .from("verifications")
    .select("*")
    .eq("execution_id", execution.id)
    .maybeSingle();
  if (existing) return existing as Verification;

  const { data: caseRow } = await supabase.from("cases").select("amount").eq("id", execution.case_id).single();
  const amountRecovered = amountPaidPaise != null ? amountPaidPaise / 100 : (caseRow?.amount ?? 0);

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

  await appendAudit(execution.case_id, "outcome_verified", "system", {
    verified: true,
    amount_recovered: amountRecovered,
    source,
    payment_link_id: paymentLinkId,
  });

  return verification as Verification;
}
