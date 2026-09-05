"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Demo control only, and deliberately not a "simulate a payment" button: it
 * re-runs the SAME verification path a real Razorpay webhook would, against
 * the real Payment Link this case already created, and can only report what
 * Razorpay says. If the link is unpaid, nothing is recorded and the button
 * says so. A verification it does produce is recorded with source
 * `simulated_trigger`, so the UI can always tell a presenter-triggered
 * confirmation apart from a genuine webhook one.
 */
export function SimulatePaymentButton({ caseId }: { caseId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function simulate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/dev/simulate-payment/${caseId}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not check the payment link");
      // A 200 does not mean the money arrived — only that Razorpay answered.
      if (!body.verified) {
        toast.info(body.message ?? "Razorpay does not report this link as paid yet.");
        return;
      }
      toast.success("Razorpay confirms payment — case recovered");
      router.refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={simulate}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-emerald-500/30 hover:text-emerald-300 disabled:pointer-events-none disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <CreditCard className="size-3" />}
      {busy ? "Checking Razorpay…" : "Check payment status"}
    </button>
  );
}
