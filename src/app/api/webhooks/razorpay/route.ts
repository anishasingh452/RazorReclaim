import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyPaymentLinkPaid } from "@/lib/razorpay/verify-payment";

/**
 * Real Razorpay webhook receiver. Configure this URL (Dashboard → Settings
 * → Webhooks) for the `payment_link.paid` event once the app has a public
 * URL (Vercel deploy, or an ngrok tunnel for local testing). Signature
 * verification uses RAZORPAY_WEBHOOK_SECRET, generated when the webhook is
 * created in the dashboard.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  const rawBody = await req.text();

  if (!signature || !Razorpay.validateWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: { payment_link?: { entity?: { id?: string } }; payment?: { entity?: { amount?: number } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (event.event === "payment_link.paid") {
    const paymentLinkId = event.payload?.payment_link?.entity?.id;
    const amountPaidPaise = event.payload?.payment?.entity?.amount;
    if (paymentLinkId) {
      await verifyPaymentLinkPaid(paymentLinkId, "webhook", amountPaidPaise);
    }
  }

  return NextResponse.json({ received: true });
}
