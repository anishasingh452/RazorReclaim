import type { ActionType, CaseStatus, RiskType } from "@/types/domain";

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatInrPrecise(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatInrCompact(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`;
  return `₹${amount.toFixed(0)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Deterministic avatar tint from the customer's name — purely cosmetic
// variety, not tied to any data meaning.
const AVATAR_TINTS = [
  "bg-emerald-500/15 text-emerald-300",
  "bg-blue-500/15 text-blue-300",
  "bg-violet-500/15 text-violet-300",
  "bg-amber-500/15 text-amber-300",
  "bg-rose-500/15 text-rose-300",
  "bg-cyan-500/15 text-cyan-300",
] as const;

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export const RISK_TYPE_LABEL: Record<RiskType, string> = {
  failed_payment: "Failed Payment",
  checkout_abandonment: "Checkout Abandonment",
  subscription_failure: "Subscription Failure",
  overdue_receivable: "Overdue Receivable",
};

export const ACTION_LABEL: Record<ActionType, string> = {
  retry: "Retry",
  payment_link: "Payment Link",
  reminder: "Reminder",
  wait_and_retry: "Wait & Retry",
  escalate: "Escalate",
  stop: "Stop",
  voice: "Voice Call",
  no_action: "No Action",
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  awaiting_approval: "Awaiting Approval",
  escalated: "Escalated",
  stopped: "Stopped",
  recovered: "Recovered",
  closed: "Closed",
  failed: "Failed",
};

// Translucent, dark-surface-friendly badge classes: bg-*/15 + text-*-300 +
// a matching border. Consistent semantic palette across the whole app:
// emerald = money/recovered/positive, amber = pending/attention,
// red = stopped/failed/negative, blue = AI/automated, violet = human-in-loop.
export const STATUS_COLOR: Record<CaseStatus, string> = {
  open: "bg-white/[0.06] text-zinc-300 border-white/10",
  in_progress: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  awaiting_approval: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  escalated: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  stopped: "bg-white/[0.06] text-zinc-400 border-white/10",
  recovered: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  closed: "bg-white/[0.04] text-zinc-500 border-white/10",
  failed: "bg-red-500/10 text-red-300 border-red-500/20",
};

export const STATUS_DOT: Record<CaseStatus, string> = {
  open: "bg-zinc-500",
  in_progress: "bg-blue-400",
  awaiting_approval: "bg-amber-400",
  escalated: "bg-violet-400",
  stopped: "bg-zinc-500",
  recovered: "bg-emerald-400",
  closed: "bg-zinc-600",
  failed: "bg-red-400",
};

export const ACTION_COLOR: Record<ActionType, string> = {
  retry: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  payment_link: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  reminder: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  wait_and_retry: "bg-white/[0.06] text-zinc-400 border-white/10",
  escalate: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  stop: "bg-red-500/10 text-red-300 border-red-500/20",
  voice: "bg-teal-500/10 text-teal-300 border-teal-500/20",
  no_action: "bg-white/[0.04] text-zinc-500 border-white/10",
};

export const RISK_TYPE_COLOR: Record<RiskType, string> = {
  failed_payment: "bg-red-500/10 text-red-300 border-red-500/20",
  checkout_abandonment: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  subscription_failure: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  overdue_receivable: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

/** Confidence/probability band -> color, for the AI-confidence style readouts. */
export function confidenceColor(p: number): string {
  if (p >= 0.7) return "text-emerald-400";
  if (p >= 0.4) return "text-amber-400";
  return "text-red-400";
}
