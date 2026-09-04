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
// variety, not tied to any data meaning. Kept almost neutral on purpose:
// these sit in every table row next to badges that DO mean something, and a
// six-colour rainbow of decorative initials is the first thing that makes a
// dense list look unserious. Just enough hue to tell two rows apart.
const AVATAR_TINTS = [
  "bg-white/[0.06] text-zinc-300",
  "bg-emerald-500/10 text-emerald-200/90",
  "bg-sky-500/10 text-sky-200/90",
  "bg-white/[0.04] text-zinc-400",
  "bg-indigo-400/10 text-indigo-200/90",
  "bg-teal-500/10 text-teal-200/90",
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

/**
 * Badge tones. Every chip in the product is built from this short list
 * rather than reaching for an arbitrary Tailwind hue, which is what keeps a
 * row of four badges from looking like a pride flag.
 *
 * The set is deliberately small: emerald carries the brand and the only
 * unambiguously good news (money recovered), amber means "a human should
 * look", rose means "this ended badly", indigo means "a person owns this
 * now", and everything procedural is neutral. Backgrounds stay at ~8% and
 * text at the -200/-300 range so a dense table reads as data, not signage.
 */
const TONE = {
  neutral: "bg-white/[0.05] text-zinc-300 border-white/10",
  quiet: "bg-white/[0.03] text-zinc-400 border-white/[0.08]",
  faint: "bg-white/[0.03] text-zinc-500 border-white/[0.07]",
  brand: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  teal: "bg-teal-500/10 text-teal-200 border-teal-500/20",
  steel: "bg-sky-500/[0.08] text-sky-200 border-sky-500/20",
  indigo: "bg-indigo-400/[0.08] text-indigo-200 border-indigo-400/20",
  amber: "bg-amber-500/[0.08] text-amber-200 border-amber-500/20",
  rose: "bg-rose-500/[0.08] text-rose-200 border-rose-500/20",
} as const;

export const STATUS_COLOR: Record<CaseStatus, string> = {
  open: TONE.neutral,
  in_progress: TONE.steel,
  awaiting_approval: TONE.amber,
  escalated: TONE.indigo,
  stopped: TONE.quiet,
  recovered: TONE.brand,
  closed: TONE.faint,
  failed: TONE.rose,
};

export const STATUS_DOT: Record<CaseStatus, string> = {
  open: "bg-zinc-500",
  in_progress: "bg-sky-400/80",
  awaiting_approval: "bg-amber-400/80",
  escalated: "bg-indigo-300/80",
  stopped: "bg-zinc-500",
  recovered: "bg-emerald-400",
  closed: "bg-zinc-600",
  failed: "bg-rose-400/80",
};

export const ACTION_COLOR: Record<ActionType, string> = {
  retry: TONE.steel,
  payment_link: TONE.brand,
  reminder: TONE.teal,
  wait_and_retry: TONE.quiet,
  escalate: TONE.indigo,
  stop: TONE.rose,
  voice: TONE.teal,
  no_action: TONE.faint,
};

export const RISK_TYPE_COLOR: Record<RiskType, string> = {
  failed_payment: TONE.rose,
  checkout_abandonment: TONE.amber,
  subscription_failure: TONE.indigo,
  overdue_receivable: TONE.steel,
};

/** Confidence/probability band -> color, for the AI-confidence style readouts. */
export function confidenceColor(p: number): string {
  if (p >= 0.7) return "text-emerald-300";
  if (p >= 0.4) return "text-amber-300";
  return "text-rose-300";
}

// ============================================================
// Agent Command Center vocabulary — the governance layer's labels and
// colors. Same palette discipline as above: emerald = engine/positive,
// steel blue = AI reasoning, amber = policy/attention, indigo = human,
// rose = terminal/blocked, zinc = deliberate inaction.
// ============================================================

/**
 * Raw color values for SVG/canvas visuals, where Tailwind classes can't
 * reach. Kept in lockstep with the --signal-* tokens in globals.css: these
 * are the same colours, just in a form a `fill`/`stroke` attribute accepts.
 */
export const SIGNAL_COLOR = {
  ai: "oklch(0.68 0.085 245)",
  engine: "oklch(0.74 0.12 168)",
  policy: "oklch(0.76 0.1 78)",
  human: "oklch(0.66 0.075 280)",
  stop: "oklch(0.62 0.115 22)",
  voice: "oklch(0.72 0.085 195)",
  neutral: "oklch(1 0 0 / 0.2)",
} as const;

/** Per-action fill for bar/rank visuals — mirrors ACTION_COLOR's hues. */
export const ACTION_FILL: Record<ActionType, string> = {
  retry: "oklch(0.7 0.075 240)",
  payment_link: SIGNAL_COLOR.engine,
  reminder: "oklch(0.72 0.075 200)",
  wait_and_retry: "oklch(0.58 0.015 286)",
  escalate: SIGNAL_COLOR.human,
  stop: SIGNAL_COLOR.stop,
  voice: SIGNAL_COLOR.voice,
  no_action: "oklch(0.48 0.008 286)",
};

export const DECISION_CATEGORY_LABEL: Record<DecisionCategory, string> = {
  ACT: "Act",
  WAIT: "Wait",
  ESCALATE: "Escalate",
  NO_ACTION: "No Action",
  STOP: "Stop",
};

export const DECISION_CATEGORY_COLOR: Record<DecisionCategory, string> = {
  ACT: TONE.brand,
  WAIT: TONE.neutral,
  ESCALATE: TONE.indigo,
  NO_ACTION: TONE.quiet,
  STOP: TONE.rose,
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
  duplicate_action: TONE.neutral,
  conflicting_action: TONE.amber,
  competing_channel: TONE.amber,
  contradictory_strategy: TONE.rose,
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
  if (resolution === "selected_winner") return TONE.brand;
  if (resolution === "blocked_all") return TONE.rose;
  if (resolution === "deferred") return TONE.neutral;
  return TONE.amber;
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
  ALLOW: TONE.brand,
  DELAY: TONE.amber,
  BLOCK: TONE.rose,
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
  promise_to_pay: TONE.brand,
  refused: TONE.rose,
  callback_requested: TONE.amber,
  no_response: TONE.quiet,
  resolved: TONE.brand,
};

export const PROMISE_STATUS_LABEL: Record<PromiseToPayStatus, string> = {
  pending: "Pending",
  kept: "Kept",
  broken: "Broken",
};

export const PROMISE_STATUS_COLOR: Record<PromiseToPayStatus, string> = {
  pending: TONE.amber,
  kept: TONE.brand,
  broken: TONE.rose,
};

export const SCHEDULED_STATUS_LABEL: Record<ScheduledActionStatus, string> = {
  pending: "Scheduled",
  executed: "Executed",
  cancelled: "Cancelled",
};

export const SCHEDULED_STATUS_COLOR: Record<ScheduledActionStatus, string> = {
  pending: TONE.amber,
  executed: TONE.brand,
  cancelled: TONE.quiet,
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
  ai_agent: TONE.steel,
  reasoning_engine: TONE.steel,
  policy_engine: TONE.amber,
  conflict_engine: TONE.amber,
  impact_engine: TONE.brand,
  candidate_engine: TONE.brand,
  human: TONE.indigo,
  system: TONE.quiet,
};

export const AUDIT_ACTOR_DOT: Record<AuditActor, string> = {
  ai_agent: "bg-sky-400/80",
  reasoning_engine: "bg-sky-400/80",
  policy_engine: "bg-amber-400/80",
  conflict_engine: "bg-amber-400/80",
  impact_engine: "bg-emerald-400",
  candidate_engine: "bg-emerald-400",
  human: "bg-indigo-300/80",
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
