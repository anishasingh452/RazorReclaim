"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <DialogTrigger render={<Button variant="outline" size="sm">New Batch</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a revenue-risk batch</DialogTitle>
          <DialogDescription>
            Generates a seeded, evidence-based synthetic batch (mixed failed payments, checkout
            abandonment, subscription failures, and overdue receivables) and persists it to the
            database. No AI reasoning runs yet — that happens when you press Run AI Recovery.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input id="batch-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-count">Case count (50–200 recommended)</Label>
            <Input
              id="case-count"
              type="number"
              min={1}
              max={500}
              value={caseCount}
              onChange={(e) => setCaseCount(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Seeding…" : "Create batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
