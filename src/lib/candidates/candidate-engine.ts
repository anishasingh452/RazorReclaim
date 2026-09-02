import type { ActionType, RiskType } from "@/types/domain";

export interface CandidateAction {
  action_type: ActionType;
  feasible: boolean;
  exclusion_reason: string | null;
}

/** Actions the Business Impact Engine actually scores when feasible for this risk type. */
const AUTOMATED_ACTIONS: ActionType[] = ["retry", "payment_link", "reminder", "voice", "wait_and_retry"];

/** Always feasible regardless of risk type — universal fallbacks/escalation paths. */
const UNIVERSAL_ACTIONS: ActionType[] = ["escalate", "stop", "no_action"];

const RISK_TYPE_FEASIBILITY: Record<RiskType, Partial<Record<ActionType, string>>> = {
  // value = exclusion reason when NOT feasible for this risk type. Absent = feasible.
  failed_payment: {},
  subscription_failure: {
    payment_link: "Subscription billing is mandate-driven — a one-off payment link doesn't fix a revoked/failed mandate.",
  },
  checkout_abandonment: {
    retry: "No prior payment attempt exists to retry — the customer never completed checkout.",
    wait_and_retry: "There is no scheduled charge to wait on; the cart is simply abandoned.",
  },
  overdue_receivable: {
    retry: "A receivable isn't a card/UPI charge — there is no payment instrument to silently retry.",
    wait_and_retry: "Receivables age on a billing cycle already reflected in days_since_failure; a silent retry doesn't apply.",
  },
};

/**
 * The Candidate Action Engine's job is purely enumeration: for a given risk
 * type, which of the 8 unified action types are even in play, and why not
 * for the rest. Scoring (ERV) happens downstream in the Business Impact
 * Engine — kept separate so "what could we have done" and "what's it worth"
 * are independently inspectable and testable.
 */
export function enumerateCandidates(riskType: RiskType): CandidateAction[] {
  const candidates: CandidateAction[] = [];

  for (const action of AUTOMATED_ACTIONS) {
    const reason = RISK_TYPE_FEASIBILITY[riskType][action];
    candidates.push({ action_type: action, feasible: !reason, exclusion_reason: reason ?? null });
  }
  for (const action of UNIVERSAL_ACTIONS) {
    candidates.push({ action_type: action, feasible: true, exclusion_reason: null });
  }

  return candidates;
}

export function feasibleActionTypes(riskType: RiskType): ActionType[] {
  return enumerateCandidates(riskType)
    .filter((c) => c.feasible)
    .map((c) => c.action_type);
}
