"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBatch } from "@/lib/api-client";
import { toast } from "sonner";

export function NewBatchDialog({ onCreated }: { onCreated: (batchId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Revenue Recovery Batch");
  const [caseCount, setCaseCount] = useState(150);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const { batch } = await createBatch({ name, caseCount });
      toast.success(`Batch created — ${caseCount} synthetic cases seeded`);
      setOpen(false);
      onCreated(batch.id);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground">
            <Plus className="size-3.5" />
            New batch
          </button>
        }
      />
      <DialogContent className="border-white/10 bg-popover/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Seed a revenue-risk batch</DialogTitle>
          <DialogDescription>
            Generates a seeded, evidence-backed set of synthetic cases — mixed failed payments, abandoned checkouts,
            subscription failures and overdue receivables — and persists them. No AI runs yet; that starts when you
            press Run AI recovery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-count">Case count</Label>
            <Input
              id="case-count"
              type="number"
              min={1}
              max={500}
              value={caseCount}
              onChange={(e) => setCaseCount(Number(e.target.value))}
            />
            <p className="text-[11px] text-muted-foreground">50–200 keeps a live demo run under a minute.</p>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3.5 text-[13px] font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {creating && <Loader2 className="size-3.5 animate-spin" />}
            {creating ? "Seeding…" : "Create batch"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
