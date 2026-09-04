import type { BatchStreamEvent } from "@/types/domain";
import { formatInrCompact } from "@/lib/display";

export interface NarrativeLine {
  text: string;
  accent: string;
}

/** Turns a raw SSE stage_transition event into a human-readable activity line, à la a live ops feed. */
export function narrateEvent(event: BatchStreamEvent): NarrativeLine {
  const d = event.detail ?? {};
  const name = (d.customerName as string) ?? "case";
  const amount = typeof d.amount === "number" ? formatInrCompact(d.amount) : null;

  switch (event.stage) {
    case "queued":
      return { text: `Queued — ${name}${amount ? ` · ${amount}` : ""} · ${riskLabel(d.riskType)}`, accent: "text-zinc-400" };
    case "detect":
      return { text: `Loading signals — ${name}`, accent: "text-zinc-400" };
    case "root_cause":
      return {
        text: `Diagnosed — ${name}: ${humanize(d.category as string)} (${humanize(d.recoveryProbability as string)} recovery odds)`,
        accent: "text-sky-300",
      };
    case "recommend":
      return { text: `AI recommends — ${name}: ${humanize(d.suggestedAction as string)}`, accent: "text-sky-300" };
    case "agent_proposals": {
      const actions = Array.isArray(d.proposedActions) ? (d.proposedActions as string[]) : [];
      const unique = [...new Set(actions)];
      return {
        text:
          unique.length > 1
            ? `Agents disagree — ${name}: ${unique.map(humanize).join(" vs ")}`
            : `Agents agree — ${name}: ${humanize(unique[0])}`,
        accent: unique.length > 1 ? "text-amber-300" : "text-indigo-300",
      };
    }
    case "shared_context_conflict": {
      const prior = Number(d.priorDecisions ?? 0);
      const promise = d.hasActivePromise ? ", active promise on file" : "";
      return {
        text: `Shared memory checked — ${name}: ${prior === 0 ? "no prior history" : `${prior} prior decision${prior === 1 ? "" : "s"}`}${promise}`,
        accent: "text-indigo-300",
      };
    }
    case "final_decision":
      return { text: `Command Center finalized — ${name}`, accent: "text-emerald-300" };
    case "business_impact":
      return {
        text: `Business Impact Engine selected — ${name}: ${humanize(d.selectedAction as string)} (ERV ${formatInrCompact(Number(d.erv ?? 0))})`,
        accent: "text-emerald-300",
      };
    case "policy":
      if (d.requiresHuman) return { text: `Policy escalated — ${name}: routed to human approval`, accent: "text-amber-300" };
      if (d.allowed) return { text: `Policy approved — ${name}: proceeding with ${humanize(d.finalAction as string)}`, accent: "text-emerald-300" };
      return { text: `Policy blocked — ${name}: ${humanize(d.finalAction as string)}`, accent: "text-amber-300" };
    case "execute":
      return {
        text: `Executing — ${name}: ${humanize(d.actionType as string)}${d.provider === "razorpay" ? " via real Razorpay link" : ""}`,
        accent: "text-indigo-300",
      };
    case "verify":
      return d.verified
        ? { text: `Recovered — ${name}: ${formatInrCompact(Number(d.amountRecovered ?? 0))} confirmed`, accent: "text-emerald-300" }
        : { text: `Not yet recovered — ${name}`, accent: "text-zinc-400" };
    case "escalate":
      return { text: `Escalated to human — ${name}`, accent: "text-indigo-300" };
    case "stop":
      return { text: `Stopped — ${name}: not worth pursuing further`, accent: "text-rose-300" };
    case "defer":
      return { text: `Deferred — ${name}: cooldown active`, accent: "text-zinc-400" };
    case "error":
      return { text: `Error — ${name}: ${String(d.error ?? "unknown error")}`, accent: "text-rose-400" };
    case "batch_complete": {
      const recovered = typeof d.totalRecovered === "number" ? formatInrCompact(d.totalRecovered) : null;
      const seconds = typeof d.durationMs === "number" ? (d.durationMs / 1000).toFixed(1) : null;
      const failed = typeof d.casesFailed === "number" && d.casesFailed > 0 ? ` · ${d.casesFailed} failed` : "";
      return {
        text: `Batch complete — ${d.casesProcessed ?? 0} cases decided${
          recovered ? ` · ${recovered} recovered` : ""
        }${failed}${seconds ? ` · ${seconds}s` : ""}`,
        accent: "text-emerald-300",
      };
    }
    default:
      return { text: `${name} → ${event.stage}`, accent: "text-zinc-400" };
  }
}

function humanize(s?: string): string {
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

function riskLabel(riskType: unknown): string {
  return typeof riskType === "string" ? humanize(riskType) : "case";
}
