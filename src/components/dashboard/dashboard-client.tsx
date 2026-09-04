"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  type BatchDetail,
  createBatch,
  fetchBatchDetail,
  fetchBatches,
  fetchCases,
  fetchConflicts,
  runBatchStream,
} from "@/lib/api-client";
import type { ActionType, Batch, BatchStreamEvent, CaseStatus, CaseWithImpact } from "@/types/domain";
import { DECISION_CATEGORY_LABEL, SIGNAL_COLOR, STATUS_LABEL, actionToCategory } from "@/lib/display";
import { KpiCards } from "./kpi-cards";
import { CommandCenterTable } from "./command-center-table";
import { LiveRunPanel } from "./live-run-panel";
import { NewBatchDialog } from "./new-batch-dialog";
import { BatchSwitcher } from "./batch-switcher";
import { SegmentBar, type Segment } from "@/components/viz/segment-bar";
import { DEFAULT_DEMO_CASE_COUNT } from "@/lib/generator/demo-config";

const FILTERS: { key: CaseStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting_approval", label: STATUS_LABEL.awaiting_approval },
  { key: "recovered", label: STATUS_LABEL.recovered },
  { key: "in_progress", label: STATUS_LABEL.in_progress },
  { key: "escalated", label: STATUS_LABEL.escalated },
  { key: "stopped", label: STATUS_LABEL.stopped },
  { key: "closed", label: STATUS_LABEL.closed },
  { key: "open", label: STATUS_LABEL.open },
];

const STATUS_SEGMENT_COLOR: Partial<Record<CaseStatus, string>> = {
  recovered: SIGNAL_COLOR.engine,
  awaiting_approval: SIGNAL_COLOR.policy,
  escalated: SIGNAL_COLOR.human,
  in_progress: SIGNAL_COLOR.ai,
  failed: SIGNAL_COLOR.stop,
  stopped: "oklch(0.5 0.01 286)",
  closed: "oklch(0.42 0.01 286)",
  open: "oklch(0.62 0.01 286)",
};

const CATEGORY_SEGMENT_COLOR: Record<string, string> = {
  ACT: SIGNAL_COLOR.engine,
  WAIT: "oklch(0.6 0.02 286)",
  ESCALATE: SIGNAL_COLOR.human,
  NO_ACTION: "oklch(0.45 0.01 286)",
  STOP: SIGNAL_COLOR.stop,
};

export function DashboardClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [cases, setCases] = useState<CaseWithImpact[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [loadingCases, setLoadingCases] = useState(false);
  const [creating, setCreating] = useState(false);
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
      const [d, c, conflicts] = await Promise.all([
        fetchBatchDetail(id),
        fetchCases({ batchId: id, limit: 200 }),
        fetchConflicts({ batchId: id }).catch(() => []),
      ]);
      setDetail(d);
      setCases(c.cases);
      setConflictCount(conflicts.length);
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
    setCreating(true);
    try {
      const { batch } = await createBatch({
        name: `Batch ${new Date().toLocaleString("en-IN")}`,
        caseCount: DEFAULT_DEMO_CASE_COUNT,
      });
      toast.success(`${DEFAULT_DEMO_CASE_COUNT}-case batch seeded`);
      await loadBatches();
      setBatchId(batch.id);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleRun() {
    if (!batchId) return;
    setRunning(true);
    setEvents([]);
    setStageCounts({});
    setFilter("all");

    // Refresh the table and KPIs mid-run so the page visibly fills in as the
    // orchestrator works, rather than sitting still until the stream closes.
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
  const inFlightCount = detail?.statusBreakdown.in_progress ?? 0;
  const totalCases = detail?.totalCases ?? 0;
  // Only cases the graph has finished with count as processed — see KpiCards.
  const processed = totalCases - openCount - inFlightCount;

  const filteredCases = useMemo(
    () => (filter === "all" ? cases : cases.filter((c) => c.status === filter)),
    [cases, filter]
  );

  const statusSegments: Segment[] = useMemo(
    () =>
      Object.entries(detail?.statusBreakdown ?? {}).map(([status, value]) => ({
        key: status,
        label: STATUS_LABEL[status as CaseStatus] ?? status,
        value,
        color: STATUS_SEGMENT_COLOR[status as CaseStatus] ?? SIGNAL_COLOR.neutral,
      })),
    [detail]
  );

  const decisionSegments: Segment[] = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const [action, count] of Object.entries(detail?.actionBreakdown ?? {})) {
      const category = actionToCategory(action as ActionType);
      byCategory[category] = (byCategory[category] ?? 0) + count;
    }
    return Object.entries(byCategory).map(([category, value]) => ({
      key: category,
      label: DECISION_CATEGORY_LABEL[category as keyof typeof DECISION_CATEGORY_LABEL] ?? category,
      value,
      color: CATEGORY_SEGMENT_COLOR[category] ?? SIGNAL_COLOR.neutral,
    }));
  }, [detail]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-8 md:px-8">
      {/* Hero */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-emerald-400 uppercase">
            <Sparkles className="size-3" />
            Razorpay Agent Command Center
          </div>
          <h1 className="text-luminous text-3xl font-semibold tracking-tight">Decision Intelligence Inbox</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Every case below is diagnosed by an LLM, priced by a deterministic value engine, governed by policy, and
            executed for real — live, in front of you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BatchSwitcher batches={batches} value={batchId} onChange={setBatchId} />
          <NewBatchDialog onCreated={handleCreated} />
          <button
            onClick={handleQuickCreate}
            disabled={creating}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-50"
          >
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            Quick {DEFAULT_DEMO_CASE_COUNT}
          </button>
          <button
            onClick={handleRun}
            disabled={!batchId || running || openCount === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/12 px-3.5 text-[13px] font-semibold text-emerald-300 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:opacity-40"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {running ? "Running…" : `Run AI recovery${openCount ? ` (${openCount})` : ""}`}
          </button>
        </div>
      </div>

      <KpiCards detail={detail} conflictCount={conflictCount} />

      <LiveRunPanel
        running={running}
        events={events}
        stageCounts={stageCounts}
        processed={processed}
        total={totalCases}
      />

      {/* Portfolio composition */}
      {totalCases > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <section className="rise glass p-4" style={{ "--d": "80ms" } as React.CSSProperties}>
            <div className="micro-label mb-3">Case status composition</div>
            <SegmentBar segments={statusSegments} total={totalCases} />
          </section>
          <section className="rise glass p-4" style={{ "--d": "140ms" } as React.CSSProperties}>
            <div className="micro-label mb-3">Decision mix</div>
            {decisionSegments.length > 0 ? (
              <SegmentBar segments={decisionSegments} total={processed} />
            ) : (
              <p className="text-xs text-muted-foreground">
                No decisions yet — run the batch to see how the agents resolve it.
              </p>
            )}
          </section>
        </div>
      )}

      {/* Inbox */}
      <section className="rise glass" style={{ "--d": "200ms" } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <h2 className="text-sm font-medium">Recovery inbox</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const count = f.key === "all" ? cases.length : cases.filter((c) => c.status === f.key).length;
              if (f.key !== "all" && count === 0) return null;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    filter === f.key
                      ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-300"
                      : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className="stat-value ml-1.5 text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <CommandCenterTable cases={filteredCases} loading={loadingCases && cases.length === 0} />
      </section>
    </div>
  );
}
