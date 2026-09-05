import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";
import { verifyPaymentLinkPaid } from "@/lib/razorpay/verify-payment";

/**
 * Demo control: re-checks a real Razorpay Payment Link on demand, for when
 * the presenter would rather not wait for the webhook to arrive during a
 * live demo.
 *
 * It does NOT simulate a payment and cannot make one succeed. It calls the
 * same verifyPaymentLinkPaid() the webhook calls, which asks Razorpay for
 * the link's real status; if the link has not been paid, this returns 200
 * with verified:false and writes nothing. The only thing recorded when it
 * does succeed is `verifications.source: 'simulated_trigger'` instead of
 * 'webhook', so the UI can always show which cases were confirmed by a real
 * Razorpay event and which were confirmed by a presenter pressing the button.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = getServiceClient();

  const { data: execution, error } = await supabase
    .from("executions")
    .select("external_ref")
    .eq("case_id", caseId)
    .eq("provider", "razorpay")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !execution?.external_ref) {
    return NextResponse.json(
      { error: "No real Razorpay payment_link execution found for this case" },
      { status: 404 }
    );
  }

  const outcome = await verifyPaymentLinkPaid(execution.external_ref, "simulated_trigger");

  if (!outcome.verified) {
    return NextResponse.json({
      verified: false,
      reason: outcome.reason,
      message:
        outcome.reason === "not_paid"
          ? `Razorpay reports this link as "${outcome.status}" — not paid yet, so nothing was recorded.`
          : "No Razorpay execution found for this case.",
    });
  }

  return NextResponse.json({ verified: true, verification: outcome.verification });
}
