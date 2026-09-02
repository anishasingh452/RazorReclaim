import { config } from "dotenv";
config({ path: ".env.local" });

import Razorpay from "razorpay";

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");
  if (!keyId.startsWith("rzp_test_")) throw new Error(`Expected a Test Mode key (rzp_test_...), got: ${keyId}`);

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  console.log("Creating a test Payment Link...");
  const link = await razorpay.paymentLink.create({
    amount: 50000, // paise = ₹500.00
    currency: "INR",
    description: "RazorReclaim connectivity test",
    customer: {
      name: "Test Customer",
      email: "test@example.com",
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
  });

  console.log("Payment Link created:");
  console.log(`  id:          ${link.id}`);
  console.log(`  short_url:   ${link.short_url}`);
  console.log(`  status:      ${link.status}`);
  console.log(`  amount:      ₹${(link.amount as number) / 100}`);

  console.log("\nFetching it back to confirm read access...");
  const fetched = await razorpay.paymentLink.fetch(link.id);
  console.log(`  fetched status: ${fetched.status}`);

  console.log("\nRazorpay Test Mode connectivity: OK");
}

main().catch((err) => {
  console.error("test-razorpay failed:", err);
  process.exit(1);
});
