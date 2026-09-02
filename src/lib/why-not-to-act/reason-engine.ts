import type { NoActionReasonCode, PromiseToPay } from "@/types/domain";
import type { ImpactCandidate } from "@/lib/impact/engine";

export interface ExplainInactionInput {
  finalAction: "stop" | "no_action" | "wait_and_retry";
  rootCauseConfidence: number;
  rootCauseCategory: string;
  contactAttempts: number;
  selectedCandidate: ImpactCandidate;
  bestFeasibleErv: number;
  activePromise: PromiseToPay | null;
}

export interface InactionExplanation {
  reasonCode: NoActionReasonCode;
  explanation: string;
}

/**
 * The "Why Not To Act" engine. Deliberately NOT a new decision-making
 * calculation — it classifies a WAIT/NO_ACTION/STOP decision the existing
 * ERV + policy engines already made, into one specific, human-readable
 * reason, using signals those engines already produced (ERV table, root
 * cause confidence/category, contact history, active promises). Precedence
 * reflects which explanation is most specific/actionable first.
 */
export function explainInaction(input: ExplainInactionInput): InactionExplanation {
  if (input.activePromise) {
    return {
      reasonCode: "active_promise_exists",
      explanation: `Customer already committed to pay ₹${input.activePromise.promised_amount.toFixed(2)} by ${input.activePromise.promised_date} — contacting again now would contradict that promise rather than support it.`,
    };
  }

  if (input.contactAttempts >= 3) {
    return {
      reasonCode: "communication_fatigue_risk",
      explanation: `${input.contactAttempts} prior contact attempts already made — further outreach risks fatigue/complaint without meaningfully improving recovery odds.`,
    };
  }

  if (input.rootCauseConfidence < 0.4) {
    return {
      reasonCode: "insufficient_confidence",
      explanation: `Root-cause diagnosis confidence is only ${(input.rootCauseConfidence * 100).toFixed(0)}% — acting on a low-confidence read of the situation risks a wasted or wrong intervention.`,
    };
  }

  if (input.rootCauseCategory === "temporary_gateway_failure" && input.contactAttempts === 0) {
    return {
      reasonCode: "likely_natural_recovery",
      explanation: "Diagnosed as a transient technical failure with no prior attempts — many such payments recover on their own via the customer's or gateway's normal retry, without needing an active intervention.",
    };
  }

  if (input.selectedCandidate.expected_recovery_value <= 0 && input.bestFeasibleErv <= 0) {
    return {
      reasonCode: "cost_exceeds_value",
      explanation: `Every feasible intervention's expected recovery value is at or below zero (best: ₹${input.bestFeasibleErv.toFixed(2)}) — the cost of acting exceeds what it's expected to recover.`,
    };
  }

  return {
    reasonCode: "other",
    explanation: `Deterministically selected ${input.finalAction} as the highest-expected-value option among the candidates considered.`,
  };
}
