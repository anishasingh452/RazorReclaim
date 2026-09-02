"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { toast } from "sonner";
import {
  type BatchDetail,
  createBatch,
  fetchBatchDetail,
  fetchBatches,
  fetchCases,
  runBatchStream,
} from "@/lib/api-client";
import type { Batch, BatchStreamEvent, Case } from "@/types/domain";
import { KpiCards } from "./kpi-cards";
import { CommandCenterTable } from "./command-center-table";
import { LiveRunPanel } from "./live-run-panel";
import { NewBatchDialog } from "./new-batch-dialog";

export function DashboardClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<BatchStreamEvent[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBatches = useCallback(async () => {
    const data = await fetchBatches();
    setBatches(data);
    if (!batchId && data.length > 0) setBatchId(data[0].id);
  }, [batchId]);

  const loadBatchAndCases = useCallback(async (id: string) => {
    setLoadingCases(true);
    try {
      const [d, c] = await Promise.all([fetchBatchDetail(id), fetchCases({ batchId: id, limit: 200 })]);
      setDetail(d);
      setCases(c.cases);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount; no race condition risk here
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-batch-change; no race condition risk here
    if (batchId) loadBatchAndCases(batchId);
  }, [batchId, loadBatchAndCases]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleCreated(newBatchId: string) {
    await loadBatches();
    setBatchId(newBatchId);
  }

  async function handleQuickCreate() {
    try {
      const { batch } = await createBatch({ name: `Batch ${new Date().toLocaleString()}`, caseCount: 150 });
      toast.success("150-case batch seeded");
      await loadBatches();
      setBatchId(batch.id);
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function handleRun() {
    if (!batchId) return;
    setRunning(true);
    setEvents([]);
    setStageCounts({});

    // Periodically refresh the table/KPIs while the stream runs, so the
    // dashboard visibly updates as cases complete, not just at the end.
    pollRef.current = setInterval(() => loadBatchAndCases(batchId), 2500);

    try {
      await runBatchStream(batchId, (event) => {
        setEvents((prev) => [...prev.slice(-200), event]);
        if (event.stage) {
          setStageCounts((prev) => ({ ...prev, [event.stage!]: (prev[event.stage!] ?? 0) + 1 }));
        }
      });
      toast.success("Batch run complete");
    } catch (err) {
      toast.error(String(err));
    } finally {
      if (pollRef.current) clearInterval(pollRef.current);
      setRunning(false);
      await loadBatchAndCases(batchId);
    }
  }

  const openCount = detail?.statusBreakdown.open ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-neutral-500">AI Decision & Execution Layer for Revenue Recovery</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-lg border border-neutral-200 bg-white px-2.5 text-sm"
            value={batchId ?? ""}
            onChange={(e) => setBatchId(e.target.value)}
          >
            {batches.length === 0 && <option value="">No batches yet</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.total_cases} cases · {b.status})
              </option>
            ))}
          </select>
          <NewBatchDialog onCreated={handleCreated} />
          <Button size="sm" variant="secondary" onClick={handleQuickCreate}>
            Quick 150-case batch
          </Button>
          <Button size="sm" onClick={handleRun} disabled={!batchId || running || openCount === 0}>
            <Play className="size-3.5" />
            {running ? "Running…" : `Run AI Recovery${openCount ? ` (${openCount} open)` : ""}`}
          </Button>
        </div>
      </div>

      <KpiCards detail={detail} />

      <LiveRunPanel running={running} events={events} stageCounts={stageCounts} />

      <div className="rounded-lg border bg-white">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-medium">Recovery Command Center</h2>
          {detail && (
            <span className="text-xs text-neutral-400">
              {detail.totalCases} cases in this batch
            </span>
          )}
        </div>
        <CommandCenterTable cases={cases} loading={loadingCases} />
      </div>
    </div>
  );
}
