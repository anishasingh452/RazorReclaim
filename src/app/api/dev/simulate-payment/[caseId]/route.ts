import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";
import { verifyPaymentLinkPaid } from "@/lib/razorpay/verify-payment";

/**
 * Demo control: simulates a customer completing a real Razorpay Payment
 * Link, for cases where the presenter isn't manually paying via Razorpay's
 * test checkout during the live demo. This calls the EXACT SAME
 * verifyPaymentLinkPaid() function the real webhook calls — there is no
 * separate "fake success" path. The only difference recorded is
 * `verifications.source: 'simulated_trigger'` vs `'webhook'`, so the UI can
 * always show which cases were verified by a real Razorpay event and which
 * were demo-triggered.
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

  const verification = await verifyPaymentLinkPaid(execution.external_ref, "simulated_trigger");
  return NextResponse.json({ verification });
}
