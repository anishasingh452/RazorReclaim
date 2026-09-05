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
    payload?: { payment_link?: { entity?: { id?: string } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (event.event === "payment_link.paid") {
    const paymentLinkId = event.payload?.payment_link?.entity?.id;
    if (paymentLinkId) {
      // Razorpay only emits this event for a link it considers paid, but the
      // verification still re-reads the link's status from the API rather
      // than trusting the payload — one code path, one source of truth, and
      // the recorded amount is always Razorpay's own figure.
      const outcome = await verifyPaymentLinkPaid(paymentLinkId, "webhook");
      if (!outcome.verified) {
        console.warn(
          `razorpay webhook: payment_link.paid for ${paymentLinkId} but the API does not report it paid (${
            outcome.reason === "not_paid" ? outcome.status : outcome.reason
          }) — nothing recorded.`
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
