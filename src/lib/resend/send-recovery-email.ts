import { getResendClient } from "./client";

export interface SendRecoveryEmailInput {
  /** The case's actual customer_email (may be a plus-addressed synthetic alias). */
  toIntended: string;
  customerName: string;
  amount: number;
  actionType: "payment_link" | "reminder";
  paymentLinkUrl: string;
}

export interface SentEmail {
  id: string;
  /** The address the email was actually delivered to (see sandbox note below). */
  to: string;
}

/**
 * Real Resend send. Resend's sandbox `from` domain (onboarding@resend.dev)
 * only accepts sends to the EXACT address verified on the account — unlike
 * Gmail, it does not treat `user+alias@gmail.com` as equivalent to
 * `user@gmail.com`. Until a custom domain is verified in Resend, every send
 * is routed to a single verified inbox (RESEND_SANDBOX_RECIPIENT, falling
 * back to DEMO_EMAIL_BASE) while the email body names the actual intended
 * synthetic customer, so the demo narrative stays traceable to the case
 * that triggered it without silently faking delivery.
 */
export async function sendRecoveryEmail(input: SendRecoveryEmailInput): Promise<SentEmail> {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) throw new Error("Missing RESEND_FROM_EMAIL");

  const usingSandboxDomain = from.endsWith("@resend.dev");
  const sandboxRecipient = process.env.RESEND_SANDBOX_RECIPIENT ?? process.env.DEMO_EMAIL_BASE;
  if (usingSandboxDomain && !sandboxRecipient) {
    throw new Error("Missing RESEND_SANDBOX_RECIPIENT/DEMO_EMAIL_BASE for sandbox routing");
  }
  const to = usingSandboxDomain ? sandboxRecipient! : input.toIntended;

  const amountStr = `₹${input.amount.toLocaleString("en-IN")}`;
  const subject =
    input.actionType === "payment_link"
      ? `Action needed: complete your ${amountStr} payment`
      : `Reminder: your payment of ${amountStr} is pending`;

  const bodyLine =
    input.actionType === "payment_link"
      ? "We noticed a recent payment didn't go through. You can complete it securely here:"
      : "This is a friendly reminder that your payment is still pending. You can complete it here:";

  const html = `
    <p>Hi ${escapeHtml(input.customerName)},</p>
    <p>${bodyLine}</p>
    <p><a href="${input.paymentLinkUrl}">${input.paymentLinkUrl}</a></p>
    <p>Amount: ${amountStr}</p>
    <hr/>
    <p style="color:#888;font-size:12px">RazorReclaim demo — intended recipient: ${escapeHtml(input.toIntended)}${usingSandboxDomain ? " (routed to sandbox-verified inbox)" : ""}</p>
  `;

  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) throw new Error(`Resend send failed: ${result.error.message}`);

  return { id: result.data!.id, to };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
