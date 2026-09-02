"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      toast.success(action === "approve" ? "Approved — executing" : "Rejected — case stopped");
      router.refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => act("approve")}
        disabled={busy !== null}
        className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
      >
        {busy === "approve" ? "Approving…" : "Approve"}
      </Button>
      <Button variant="outline" onClick={() => act("reject")} disabled={busy !== null} className="border-white/15">
        {busy === "reject" ? "Rejecting…" : "Reject"}
      </Button>
    </div>
  );
}
