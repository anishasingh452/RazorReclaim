import { config } from "dotenv";
config({ path: ".env.local" });

import { verifyPaymentLinkPaid } from "../src/lib/razorpay/verify-payment";
import { getServiceClient } from "../src/lib/db/service-client";

async function main() {
  const paymentLinkId = process.argv[2];
  if (!paymentLinkId) throw new Error("usage: tsx scripts/test-verify.ts <payment_link_id>");

  const verification = await verifyPaymentLinkPaid(paymentLinkId, "simulated_trigger");
  console.log("Verification:", JSON.stringify(verification, null, 2));

  const supabase = getServiceClient();
  const { data: caseRow } = await supabase.from("cases").select("status").eq("id", verification.case_id).single();
  console.log("Case status after verification:", caseRow?.status);

  // Idempotency check: call again, should return the SAME verification, not a new one.
  const verification2 = await verifyPaymentLinkPaid(paymentLinkId, "webhook");
  console.log("\nSecond call (idempotency check) — same id?", verification.id === verification2.id);
}

main().catch((err) => {
  console.error("test-verify failed:", err);
  process.exit(1);
});
