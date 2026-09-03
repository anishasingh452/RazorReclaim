import { Bot, Check, Radio, Zap } from "lucide-react";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  CONFLICT_SEVERITY,
  CONFLICT_TYPE_COLOR,
  CONFLICT_TYPE_LABEL,
  agentLabel,
  conflictResolutionColor,
  conflictResolutionLabel,
} from "@/lib/display";
import type { AgentConflict, AgentProposal, AgentProposalStatus } from "@/types/domain";

const STATUS_TAG: Record<AgentProposalStatus, { label: string; className: string }> = {
  selected: { label: "ERV winner", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  rejected_conflict: { label: "Not selected", className: "border-white/10 bg-white/[0.03] text-zinc-400" },
  rejected_governor: { label: "Governor blocked", className: "border-red-500/25 bg-red-500/10 text-red-300" },
  proposed: { label: "Proposed", className: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
};

const SEVERITY_RING: Record<1 | 2 | 3, string> = {
  1: "border-white/15 bg-white/[0.04] text-zinc-300",
  2: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  3: "border-red-500/30 bg-red-500/10 text-red-300",
};

/**
 * Multi-agent deliberation, staged as an actual confrontation: each agent's
 * proposal on one side, the detected conflict burning in the middle, and
 * the winner ringed in emerald. Conflict detection only flags the
 * disagreement — the Business Impact Engine's ERV is what settles it, which
 * is why the winner's badge says "ERV winner" and not "argued better."
 */
export function AgentArena({
  proposals,
  conflicts,
  className,
}: {
  proposals: AgentProposal[];
  conflicts: AgentConflict[];
  className?: string;
}) {
  if (proposals.length === 0) {
    return (
      <div className={`glass p-8 text-center text-sm text-muted-foreground ${className ?? ""}`}>
        No agent proposals recorded for this case yet.
      </div>
    );
  }

  const conflict = conflicts[0] ?? null;
  const pair = proposals.slice(0, 2);
  const rest = proposals.slice(2);

  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
        <ProposalCard proposal={pair[0]} delay={0} />
        <ArenaNode conflict={conflict} />
        {pair[1] ? (
          <ProposalCard proposal={pair[1]} delay={140} />
        ) : (
          <div className="glass flex items-center justify-center p-4 text-xs text-muted-foreground">
            Single-agent case — nothing to reconcile.
          </div>
        )}
      </div>

      {rest.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((p, i) => (
            <ProposalCard key={p.id} proposal={p} delay={200 + i * 60} />
          ))}
        </div>
      )}

      {conflicts.map((c) => (
        <div key={c.id} className="inset-panel flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${CONFLICT_TYPE_COLOR[c.conflict_type]}`}
            >
              {CONFLICT_TYPE_LABEL[c.conflict_type]}
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${conflictResolutionColor(c.resolution)}`}
            >
              {conflictResolutionLabel(c.resolution)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {typeof c.detail?.message === "string" ? c.detail.message : "Conflict recorded."}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProposalCard({ proposal, delay }: { proposal: AgentProposal; delay: number }) {
  const isPrimary = proposal.agent_name === "ai_recovery_agent";
  const tag = STATUS_TAG[proposal.status];
  const won = proposal.status === "selected";
  const confidence = proposal.confidence ?? 0;

  return (
    <div
      className={`rise glass glass-hover flex flex-col gap-3 p-4 ${
        won ? "ring-1 ring-emerald-500/25 shadow-[0_0_50px_-30px_oklch(0.77_0.15_165)]" : ""
      }`}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex size-8 items-center justify-center rounded-lg border ${
              isPrimary
                ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
                : "border-violet-500/25 bg-violet-500/10 text-violet-300"
            }`}
          >
            {isPrimary ? <Bot className="size-4" /> : <Radio className="size-4" />}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{agentLabel(proposal.agent_name)}</div>
            <div className="micro-label mt-0.5">{isPrimary ? "LLM reasoning" : "Deterministic rules"}</div>
          </div>
        </div>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${tag.className}`}>
          {tag.label.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-sm font-semibold ${ACTION_COLOR[proposal.proposed_action]}`}
        >
          {ACTION_LABEL[proposal.proposed_action]}
        </span>
        {proposal.proposed_channel && (
          <span className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] text-muted-foreground">
            via {proposal.proposed_channel}
          </span>
        )}
      </div>

      {proposal.confidence !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="micro-label">Confidence</span>
            <span className="stat-value text-[11px] text-foreground/80">{(confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${isPrimary ? "bg-blue-400/70" : "bg-violet-400/70"}`}
              style={{ width: `${Math.max(confidence * 100, 2)}%` }}
            />
          </div>
        </div>
      )}

      <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">{proposal.rationale}</p>
    </div>
  );
}

/** The middle of the arena: consensus check, or a conflict burning between the two proposals. */
function ArenaNode({ conflict }: { conflict: AgentConflict | null }) {
  const severity = conflict ? CONFLICT_SEVERITY[conflict.conflict_type] : null;

  return (
    <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
      <span className="hidden h-8 w-px bg-gradient-to-b from-transparent to-white/10 md:block" />
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/10 md:hidden" />

      <span
        className={`relative flex size-10 items-center justify-center rounded-full border ${
          severity ? SEVERITY_RING[severity] : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        }`}
      >
        {severity ? <Zap className="size-4" /> : <Check className="size-4" />}
        {severity === 3 && <span className="absolute inset-0 animate-ping rounded-full bg-red-400/20" />}
      </span>

      <span className="hidden h-8 w-px bg-gradient-to-t from-transparent to-white/10 md:block" />
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/10 md:hidden" />
    </div>
  );
}
