"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  type BatchDetail,
  createBatch,
  fetchBatchDetail,
  fetchBatches,
  fetchCases,
  runBatchStream,
} from "@/lib/api-client";
import type { Batch, BatchStreamEvent, CaseStatus, CaseWithImpact } from "@/types/domain";
import { STATUS_LABEL } from "@/lib/display";
import { KpiCards } from "./kpi-cards";
import { CommandCenterTable } from "./command-center-table";
import { LiveRunPanel } from "./live-run-panel";
import { NewBatchDialog } from "./new-batch-dialog";

const FILTERS: { key: CaseStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting_approval", label: STATUS_LABEL.awaiting_approval },
  { key: "recovered", label: STATUS_LABEL.recovered },
  { key: "in_progress", label: STATUS_LABEL.in_progress },
  { key: "escalated", label: STATUS_LABEL.escalated },
  { key: "stopped", label: STATUS_LABEL.stopped },
  { key: "open", label: STATUS_LABEL.open },
];

export function DashboardClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [cases, setCases] = useState<CaseWithImpact[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<BatchStreamEvent[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<CaseStatus | "all">("all");
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
    setFilter("all");

    pollRef.current = setInterval(() => loadBatchAndCases(batchId), 2000);

    try {
      await runBatchStream(batchId, (event) => {
        setEvents((prev) => [...prev.slice(-300), event]);
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
  const filteredCases = useMemo(
    () => (filter === "all" ? cases : cases.filter((c) => c.status === filter)),
    [cases, filter]
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-emerald-400">
            <Sparkles className="size-3" />
            AI Recovery Command Center
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Decision Intelligence Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Every case below is ranked, diagnosed, and priced by real-time AI + deterministic engines — not a
            static dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            value={batchId ?? ""}
            onChange={(e) => setBatchId(e.target.value)}
          >
            {batches.length === 0 && <option value="">No batches yet</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id} className="bg-zinc-900">
                {b.name} ({b.total_cases} cases · {b.status})
              </option>
            ))}
          </select>
          <NewBatchDialog onCreated={handleCreated} />
          <Button size="sm" variant="secondary" onClick={handleQuickCreate}>
            Quick 150-case batch
          </Button>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={!batchId || running || openCount === 0}
            className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
          >
            <Play className="size-3.5" />
            {running ? "Running…" : `Run AI Recovery${openCount ? ` (${openCount} open)` : ""}`}
          </Button>
        </div>
      </div>

      <KpiCards detail={detail} />

      <LiveRunPanel running={running} events={events} stageCounts={stageCounts} />

      <div className="rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-medium">Recovery Command Center</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  filter === f.key
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                    : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <CommandCenterTable cases={filteredCases} loading={loadingCases} />
      </div>
    </div>
  );
}
