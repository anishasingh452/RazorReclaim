import { config } from "dotenv";
config({ path: ".env.local" });

import { verifyPaymentLinkPaid } from "../src/lib/razorpay/verify-payment";
import { getServiceClient } from "../src/lib/db/service-client";

async function main() {
  const paymentLinkId = process.argv[2];
  if (!paymentLinkId) throw new Error("usage: tsx scripts/test-verify.ts <payment_link_id>");

  const outcome = await verifyPaymentLinkPaid(paymentLinkId, "simulated_trigger");
  console.log("Outcome:", JSON.stringify(outcome, null, 2));

  if (!outcome.verified) {
    // Expected result for an unpaid link: nothing written, case untouched.
    console.log("\nNot verified — Razorpay does not report this link as paid, so nothing was recorded.");
    return;
  }

  const supabase = getServiceClient();
  const { data: caseRow } = await supabase
    .from("cases")
    .select("status")
    .eq("id", outcome.verification.case_id)
    .single();
  console.log("Case status after verification:", caseRow?.status);

  // Idempotency check: call again, should return the SAME verification, not a new one.
  const again = await verifyPaymentLinkPaid(paymentLinkId, "webhook");
  console.log(
    "\nSecond call (idempotency check) — same id?",
    again.verified && outcome.verification.id === again.verification.id
  );
}

main().catch((err) => {
  console.error("test-verify failed:", err);
  process.exit(1);
});
