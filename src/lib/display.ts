import type { ActionType, CaseStatus, RiskType } from "@/types/domain";

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatInrPrecise(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// Tailwind class pairs (bg/text) — deliberately muted, fintech-neutral palette.
export const STATUS_COLOR: Record<CaseStatus, string> = {
  open: "bg-neutral-100 text-neutral-700",
  in_progress: "bg-blue-100 text-blue-700",
  awaiting_approval: "bg-amber-100 text-amber-800",
  escalated: "bg-purple-100 text-purple-700",
  stopped: "bg-neutral-200 text-neutral-600",
  recovered: "bg-emerald-100 text-emerald-700",
  closed: "bg-neutral-100 text-neutral-500",
  failed: "bg-red-100 text-red-700",
};

export const ACTION_COLOR: Record<ActionType, string> = {
  retry: "bg-sky-100 text-sky-700",
  payment_link: "bg-emerald-100 text-emerald-700",
  reminder: "bg-cyan-100 text-cyan-700",
  wait_and_retry: "bg-neutral-100 text-neutral-600",
  escalate: "bg-purple-100 text-purple-700",
  stop: "bg-red-100 text-red-700",
};

export const RISK_TYPE_COLOR: Record<RiskType, string> = {
  failed_payment: "bg-red-50 text-red-700 border-red-200",
  checkout_abandonment: "bg-orange-50 text-orange-700 border-orange-200",
  subscription_failure: "bg-violet-50 text-violet-700 border-violet-200",
  overdue_receivable: "bg-amber-50 text-amber-800 border-amber-200",
};
