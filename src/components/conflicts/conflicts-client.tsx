"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, GitBranch, Handshake, Radio, Zap } from "lucide-react";
import { toast } from "sonner";
import { BatchSwitcher } from "@/components/dashboard/batch-switcher";
import { fetchBatches, fetchConflicts } from "@/lib/api-client";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  CONFLICT_SEVERITY,
  CONFLICT_TYPE_COLOR,
  CONFLICT_TYPE_LABEL,
  RISK_TYPE_LABEL,
  agentLabel,
  conflictResolutionColor,
  conflictResolutionLabel,
  formatInrPrecise,
  timeAgo,
} from "@/lib/display";
import type { Batch, ConflictFeedItem, ConflictProposalSummary } from "@/types/domain";

type Filter = "all" | "unresolved" | "resolved";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unresolved", label: "Unresolved" },
  { key: "resolved", label: "Resolved" },
];

export function ConflictsClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictFeedItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBatches()
      .then((data) => {
        setBatches(data);
        if (data.length > 0) setBatchId((current) => current ?? data[0].id);
        else setLoading(false);
      })
      .catch((err) => {
        toast.error(String(err));
        setLoading(false);
      });
  }, []);

  const load = useCallback(async (id: string, f: Filter) => {
    setLoading(true);
    try {
      setConflicts(await fetchConflicts({ batchId: id, resolved: f === "all" ? undefined : f === "resolved" }));
    } catch (err) {
      toast.error(String(err));
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on batch/filter change
    if (batchId) load(batchId, filter);
  }, [batchId, filter, load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-8 md:px-8">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-indigo-300 uppercase">
            <GitBranch className="size-3" />
            Agent governance
          </div>
          <h1 className="text-luminous text-3xl font-semibold tracking-tight">Agent Conflicts</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Every disagreement between the AI Recovery Agent and the Channel Strategy Agent — and how the Business
            Impact Engine settled it. Detection flags the clash; expected value decides the winner.
          </p>
        </div>
        <BatchSwitcher batches={batches} value={batchId} onChange={setBatchId} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              filter === f.key
                ? "border-indigo-400/25 bg-indigo-400/10 text-indigo-200"
                : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        {!loading && (
          <span className="stat-value ml-auto text-[11px] text-muted-foreground/60">
            {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-40 animate-pulse" />
          ))}
        </div>
      ) : conflicts.length === 0 ? (
        <div className="rise glass flex flex-col items-center gap-3 py-20 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <Handshake className="size-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            {filter === "all"
              ? "No conflicts recorded for this batch — the agents have been in full agreement, or the batch hasn't run yet."
              : `No ${filter} conflicts in this batch.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((conflict, i) => (
            <ConflictCard key={conflict.id} conflict={conflict} delay={i * 60} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConflictCard({ conflict, delay }: { conflict: ConflictFeedItem; delay: number }) {
  const severity = CONFLICT_SEVERITY[conflict.conflictType];

  return (
    <section className="rise glass glass-hover p-5" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link href={`/cases/${conflict.caseId}`} className="group min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium transition-colors group-hover:text-emerald-300">
            {conflict.customerName}
            <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="stat-value text-[12.5px] text-muted-foreground">{formatInrPrecise(conflict.amount)}</span>
            <span className="text-[11px] text-muted-foreground/70">{RISK_TYPE_LABEL[conflict.riskType]}</span>
            <span className="stat-value text-[10.5px] text-muted-foreground/50">{timeAgo(conflict.createdAt)}</span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${CONFLICT_TYPE_COLOR[conflict.conflictType]}`}
          >
            {severity === 3 && <Zap className="size-3" />}
            {CONFLICT_TYPE_LABEL[conflict.conflictType]}
          </span>
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${conflictResolutionColor(conflict.resolution)}`}
          >
            {conflictResolutionLabel(conflict.resolution)}
          </span>
        </div>
      </div>

      {conflict.proposals.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {conflict.proposals.map((proposal) => (
            <MiniProposal
              key={proposal.id}
              proposal={proposal}
              won={conflict.winningProposalId === proposal.id || proposal.status === "selected"}
            />
          ))}
        </div>
      )}

      {conflict.message && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">{conflict.message}</p>
      )}
    </section>
  );
}

function MiniProposal({ proposal, won }: { proposal: ConflictProposalSummary; won: boolean }) {
  const isPrimary = proposal.agentName === "ai_recovery_agent";

  return (
    <div
      className={`inset-panel flex flex-col gap-2 p-3 ${
        won ? "border-emerald-500/25 bg-emerald-500/[0.05]" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex size-6 items-center justify-center rounded-md border ${
            isPrimary
              ? "border-sky-500/20 bg-sky-500/[0.08] text-sky-200"
              : "border-indigo-400/20 bg-indigo-400/[0.08] text-indigo-200"
          }`}
        >
          {isPrimary ? <Bot className="size-3" /> : <Radio className="size-3" />}
        </span>
        <span className="truncate text-[12px] font-medium">{agentLabel(proposal.agentName)}</span>
        {won && (
          <span className="ml-auto shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] font-semibold text-emerald-300">
            WON
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[proposal.proposedAction]}`}
        >
          {ACTION_LABEL[proposal.proposedAction]}
        </span>
        {proposal.proposedChannel && (
          <span className="text-[10.5px] text-muted-foreground/70">via {proposal.proposedChannel}</span>
        )}
        {proposal.confidence !== null && (
          <span className="stat-value ml-auto text-[10.5px] text-muted-foreground/60">
            {(proposal.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/70">{proposal.rationale}</p>
    </div>
  );
}
