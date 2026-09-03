"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Demo control only. Fires the SAME verification path a real Razorpay
 * webhook would, against the real Payment Link this case already created —
 * there is no fake-success shortcut. The resulting verification is recorded
 * with source `simulated_trigger`, so the UI can always tell a demo-driven
 * recovery apart from a genuine webhook one.
 */
export function SimulatePaymentButton({ caseId }: { caseId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function simulate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/dev/simulate-payment/${caseId}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Simulation failed");
      toast.success("Payment verified — case recovered");
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
      {busy ? "Verifying…" : "Simulate customer payment"}
    </button>
  );
}
