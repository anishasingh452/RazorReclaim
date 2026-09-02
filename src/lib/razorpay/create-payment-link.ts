import { getRazorpayClient } from "./client";
import type { Case } from "@/types/domain";

export interface CreatedPaymentLink {
  id: string;
  short_url: string;
  status: string;
}

/** Real Razorpay Test Mode Payment Link creation — this is a live API call. */
export async function createPaymentLinkForCase(
  c: Pick<Case, "id" | "batch_id" | "customer_name" | "customer_email" | "amount" | "currency">
): Promise<CreatedPaymentLink> {
  const razorpay = getRazorpayClient();
  const amountPaise = Math.round(c.amount * 100);

  const link = await razorpay.paymentLink.create({
    amount: amountPaise,
    currency: c.currency || "INR",
    description: `RazorReclaim recovery — case ${c.id.slice(0, 8)}`,
    customer: { name: c.customer_name, email: c.customer_email },
    // We send our own branded email via Resend rather than Razorpay's notification.
    notify: { sms: false, email: false },
    reminder_enable: false,
    reference_id: c.id,
    notes: { case_id: c.id, batch_id: c.batch_id, source: "razorreclaim" },
  });

  return { id: link.id, short_url: link.short_url, status: link.status };
}
