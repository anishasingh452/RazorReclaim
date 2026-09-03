"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const router = useRouter();

  async function act(action: "approve" | "reject") {
    setBusy(action);
    try {
      const res = await fetch(`/api/approvals/${approvalId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer: "demo-reviewer" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Failed to ${action}`);
      toast.success(action === "approve" ? "Approved — executing now" : "Rejected — case stopped");
      router.refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => act("approve")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2 text-[13px] font-medium text-emerald-300 shadow-[0_0_30px_-14px_oklch(0.77_0.15_165)] transition-all hover:border-emerald-400/50 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:opacity-50"
      >
        {busy === "approve" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {busy === "approve" ? "Approving…" : "Approve & execute"}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[13px] font-medium text-muted-foreground transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:pointer-events-none disabled:opacity-50"
      >
        {busy === "reject" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </button>
    </div>
  );
}
