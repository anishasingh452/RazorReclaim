import type {
  ActionType,
  AuditActor,
  CaseStatus,
  ConflictResolution,
  ConflictType,
  DecisionCategory,
  GovernorDecision,
  NoActionReasonCode,
  PromiseToPayStatus,
  RiskType,
  ScheduledActionStatus,
  VoiceCallOutcome,
  VoiceCallStatus,
} from "@/types/domain";

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

// ============================================================
// Agent Command Center vocabulary — the governance layer's labels and
// colors. Same palette discipline as above: emerald = engine/positive,
// blue = AI reasoning, amber = policy/attention, violet = human,
// red = terminal/blocked, zinc = deliberate inaction.
// ============================================================

/** Raw color values for SVG/canvas visuals, where Tailwind classes can't reach. */
export const SIGNAL_COLOR = {
  ai: "oklch(0.7 0.15 250)",
  engine: "oklch(0.77 0.15 165)",
  policy: "oklch(0.8 0.16 85)",
  human: "oklch(0.7 0.16 300)",
  stop: "oklch(0.65 0.2 25)",
  voice: "oklch(0.75 0.13 195)",
  neutral: "oklch(1 0 0 / 0.22)",
} as const;

/** Per-action fill for bar/rank visuals — mirrors ACTION_COLOR's hues. */
export const ACTION_FILL: Record<ActionType, string> = {
  retry: "oklch(0.72 0.14 235)",
  payment_link: SIGNAL_COLOR.engine,
  reminder: "oklch(0.76 0.12 205)",
  wait_and_retry: "oklch(0.6 0.02 286)",
  escalate: SIGNAL_COLOR.human,
  stop: SIGNAL_COLOR.stop,
  voice: SIGNAL_COLOR.voice,
  no_action: "oklch(0.5 0.01 286)",
};

export const DECISION_CATEGORY_LABEL: Record<DecisionCategory, string> = {
  ACT: "Act",
  WAIT: "Wait",
  ESCALATE: "Escalate",
  NO_ACTION: "No Action",
  STOP: "Stop",
};

export const DECISION_CATEGORY_COLOR: Record<DecisionCategory, string> = {
  ACT: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  WAIT: "bg-white/[0.06] text-zinc-300 border-white/10",
  ESCALATE: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  NO_ACTION: "bg-white/[0.04] text-zinc-400 border-white/10",
  STOP: "bg-red-500/10 text-red-300 border-red-500/20",
};

/** The 8 actions collapse into 5 meta-decisions — mirrors toDecisionCategory() on the server. */
export function actionToCategory(action: ActionType): DecisionCategory {
  if (action === "retry" || action === "payment_link" || action === "reminder" || action === "voice") return "ACT";
  if (action === "wait_and_retry") return "WAIT";
  if (action === "escalate") return "ESCALATE";
  if (action === "no_action") return "NO_ACTION";
  return "STOP";
}

export const CONFLICT_TYPE_LABEL: Record<ConflictType, string> = {
  duplicate_action: "Duplicate action",
  conflicting_action: "Conflicting action",
  competing_channel: "Competing channel",
  contradictory_strategy: "Contradictory strategy",
};

export const CONFLICT_TYPE_COLOR: Record<ConflictType, string> = {
  duplicate_action: "bg-white/[0.06] text-zinc-300 border-white/10",
  conflicting_action: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  competing_channel: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  contradictory_strategy: "bg-red-500/10 text-red-300 border-red-500/20",
};

/** How severe a conflict looks — drives the intensity of the collision visual. */
export const CONFLICT_SEVERITY: Record<ConflictType, 1 | 2 | 3> = {
  duplicate_action: 1,
  competing_channel: 2,
  conflicting_action: 2,
  contradictory_strategy: 3,
};

export function conflictResolutionLabel(resolution: ConflictResolution | null): string {
  if (resolution === "selected_winner") return "Resolved by ERV";
  if (resolution === "blocked_all") return "All blocked";
  if (resolution === "deferred") return "Deferred";
  return "Pending resolution";
}

export function conflictResolutionColor(resolution: ConflictResolution | null): string {
  if (resolution === "selected_winner") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (resolution === "blocked_all") return "bg-red-500/10 text-red-300 border-red-500/20";
  if (resolution === "deferred") return "bg-white/[0.06] text-zinc-300 border-white/10";
  return "bg-amber-500/10 text-amber-300 border-amber-500/20";
}

export const NO_ACTION_REASON_LABEL: Record<NoActionReasonCode, string> = {
  likely_natural_recovery: "Likely to self-resolve",
  already_contacted: "Already contacted",
  active_promise_exists: "Active promise-to-pay",
  communication_fatigue_risk: "Contact fatigue risk",
  cost_exceeds_value: "Cost exceeds value",
  insufficient_confidence: "Low diagnostic confidence",
  other: "Highest-value option available",
};

export const GOVERNOR_LABEL: Record<GovernorDecision, string> = {
  ALLOW: "Allow",
  DELAY: "Delay",
  BLOCK: "Block",
};

export const GOVERNOR_COLOR: Record<GovernorDecision, string> = {
  ALLOW: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  DELAY: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  BLOCK: "bg-red-500/10 text-red-300 border-red-500/20",
};

export const VOICE_STATUS_LABEL: Record<VoiceCallStatus, string> = {
  completed: "Completed",
  no_answer: "No answer",
  voicemail: "Voicemail",
  declined: "Declined",
};

export const VOICE_OUTCOME_LABEL: Record<VoiceCallOutcome, string> = {
  promise_to_pay: "Promise to pay",
  refused: "Refused",
  callback_requested: "Callback requested",
  no_response: "No response",
  resolved: "Resolved on call",
};

export const VOICE_OUTCOME_COLOR: Record<VoiceCallOutcome, string> = {
  promise_to_pay: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  refused: "bg-red-500/10 text-red-300 border-red-500/20",
  callback_requested: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  no_response: "bg-white/[0.06] text-zinc-400 border-white/10",
  resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export const PROMISE_STATUS_LABEL: Record<PromiseToPayStatus, string> = {
  pending: "Pending",
  kept: "Kept",
  broken: "Broken",
};

export const PROMISE_STATUS_COLOR: Record<PromiseToPayStatus, string> = {
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  kept: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  broken: "bg-red-500/10 text-red-300 border-red-500/20",
};

export const SCHEDULED_STATUS_LABEL: Record<ScheduledActionStatus, string> = {
  pending: "Scheduled",
  executed: "Executed",
  cancelled: "Cancelled",
};

export const SCHEDULED_STATUS_COLOR: Record<ScheduledActionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  executed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  cancelled: "bg-white/[0.06] text-zinc-400 border-white/10",
};

export const AGENT_LABEL: Record<string, string> = {
  ai_recovery_agent: "AI Recovery Agent",
  channel_strategy_agent: "Channel Strategy Agent",
};

export function agentLabel(name: string): string {
  return AGENT_LABEL[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export const AUDIT_ACTOR_LABEL: Record<AuditActor, string> = {
  ai_agent: "AI Agent",
  reasoning_engine: "Reasoning Engine",
  policy_engine: "Policy Engine",
  conflict_engine: "Conflict Engine",
  impact_engine: "Impact Engine",
  candidate_engine: "Candidate Engine",
  human: "Human",
  system: "System",
};

/** Actor -> accent, so the Decision Graph reads as a story of who acted when. */
export const AUDIT_ACTOR_COLOR: Record<AuditActor, string> = {
  ai_agent: "text-blue-300 border-blue-500/25 bg-blue-500/10",
  reasoning_engine: "text-blue-300 border-blue-500/25 bg-blue-500/10",
  policy_engine: "text-amber-300 border-amber-500/25 bg-amber-500/10",
  conflict_engine: "text-amber-300 border-amber-500/25 bg-amber-500/10",
  impact_engine: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
  candidate_engine: "text-emerald-300 border-emerald-500/25 bg-emerald-500/10",
  human: "text-violet-300 border-violet-500/25 bg-violet-500/10",
  system: "text-zinc-400 border-white/10 bg-white/[0.05]",
};

export const AUDIT_ACTOR_DOT: Record<AuditActor, string> = {
  ai_agent: "bg-blue-400",
  reasoning_engine: "bg-blue-400",
  policy_engine: "bg-amber-400",
  conflict_engine: "bg-amber-400",
  impact_engine: "bg-emerald-400",
  candidate_engine: "bg-emerald-400",
  human: "bg-violet-400",
  system: "bg-zinc-500",
};

/** Canonical audit events rendered as sentences a non-engineer can follow. */
export const AUDIT_EVENT_LABEL: Record<string, string> = {
  SIGNAL_DETECTED: "Signal detected",
  CASE_CREATED: "Case opened",
  AI_DIAGNOSIS: "AI diagnosed root cause",
  AI_RECOMMENDATION: "AI recommended an action",
  AGENT_PROPOSAL: "Agent proposed an action",
  SHARED_MEMORY_CHECKED: "Shared memory checked",
  CONFLICT_DETECTED: "Conflict detection ran",
  CANDIDATE_ACTIONS: "Candidate actions enumerated",
  ERV_CALCULATED: "Expected recovery value calculated",
  GOVERNOR_CHECKED: "Communication governor checked",
  POLICY_CHECKED: "Policy guardrails evaluated",
  WHY_NOT_TO_ACT: "Why-not-to-act explained",
  FINAL_DECISION: "Final decision made",
  ESCALATED_TO_HUMAN: "Escalated to human",
  APPROVED: "Approved by human",
  REJECTED: "Rejected by human",
  ACTION_EXECUTED: "Action executed",
  OUTCOME_VERIFIED: "Outcome verified",
  DEFERRED: "Deferred for cooldown",
  PROCESSING_FAILED: "Processing failed",
};

export function auditEventLabel(eventType: string): string {
  return AUDIT_EVENT_LABEL[eventType] ?? eventType.replace(/_/g, " ").toLowerCase();
}

/** Compact relative time ("4m ago") for feeds where absolute timestamps are noise. */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
