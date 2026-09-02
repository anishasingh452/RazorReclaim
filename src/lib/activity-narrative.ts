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
        accent: "text-blue-300",
      };
    case "recommend":
      return { text: `AI recommends — ${name}: ${humanize(d.suggestedAction as string)}`, accent: "text-blue-300" };
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
        accent: "text-violet-300",
      };
    case "verify":
      return d.verified
        ? { text: `Recovered — ${name}: ${formatInrCompact(Number(d.amountRecovered ?? 0))} confirmed`, accent: "text-emerald-300" }
        : { text: `Not yet recovered — ${name}`, accent: "text-zinc-400" };
    case "escalate":
      return { text: `Escalated to human — ${name}`, accent: "text-violet-300" };
    case "stop":
      return { text: `Stopped — ${name}: not worth pursuing further`, accent: "text-red-300" };
    case "defer":
      return { text: `Deferred — ${name}: cooldown active`, accent: "text-zinc-400" };
    case "error":
      return { text: `Error — ${name}: ${String(d.error ?? "unknown error")}`, accent: "text-red-400" };
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
