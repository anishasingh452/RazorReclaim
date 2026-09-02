import type { ImpactScore, RiskType, RootCauseResult } from "@/types/domain";
import {
  ACTION_EFFECTIVENESS,
  ESCALATE_RECOVERY_PROBABILITY,
  INTERVENTION_COST,
  QUALITATIVE_PROBABILITY,
  attemptDecay,
  escalateCost,
  timeDecay,
} from "./config";

export interface ImpactEngineInput {
  amount: number;
  riskType: RiskType;
  contactAttempts: number;
  daysSinceFailure: number;
  rootCause: Pick<RootCauseResult, "qualitative_recovery_probability">;
}

export type ImpactCandidate = Omit<ImpactScore, "id" | "case_id" | "created_at">;

type AutomatedAction = "retry" | "payment_link" | "reminder" | "wait_and_retry";

/**
 * Which actions are even feasible to consider for a given risk type.
 * `escalate` and `stop` are always feasible fallbacks.
 */
function feasibleAutomatedActions(riskType: RiskType): AutomatedAction[] {
  switch (riskType) {
    case "failed_payment":
      return ["retry", "payment_link", "reminder", "wait_and_retry"];
    case "subscription_failure":
      return ["retry", "reminder", "wait_and_retry"];
    case "checkout_abandonment":
      return ["payment_link", "reminder"];
    case "overdue_receivable":
      return ["payment_link", "reminder"];
  }
}

/**
 * Deterministic Expected Recovery Value calculation — no LLM involvement.
 * ERV = potential_recoverable_amount * recovery_probability - intervention_cost
 *
 * The LLM's qualitative_recovery_probability (from root_cause_node) is the
 * only AI-influenced input, and it is clamped into a fixed numeric table
 * before any arithmetic touches it — the model never emits the number that
 * drives money math directly.
 */
export function computeImpactScores(input: ImpactEngineInput): ImpactCandidate[] {
  const { amount, riskType, contactAttempts, daysSinceFailure, rootCause } = input;

  const baseProbability = QUALITATIVE_PROBABILITY[rootCause.qualitative_recovery_probability];
  const decay = attemptDecay(contactAttempts) * timeDecay(daysSinceFailure);

  const candidates: ImpactCandidate[] = [];

  for (const action of feasibleAutomatedActions(riskType)) {
    const recovery_probability = clamp01(baseProbability * ACTION_EFFECTIVENESS[action] * decay);
    const intervention_cost = INTERVENTION_COST[action];
    const potential_recoverable_amount = amount;
    const expected_recovery_value = round2(
      potential_recoverable_amount * recovery_probability - intervention_cost
    );
    candidates.push({
      action_type: action,
      potential_recoverable_amount,
      recovery_probability: round3(recovery_probability),
      intervention_cost,
      expected_recovery_value,
      selected: false,
    });
  }

  // escalate: fixed operational baseline probability, cost scales with case value
  const escCost = round2(escalateCost(amount));
  candidates.push({
    action_type: "escalate",
    potential_recoverable_amount: amount,
    recovery_probability: round3(ESCALATE_RECOVERY_PROBABILITY),
    intervention_cost: escCost,
    expected_recovery_value: round2(amount * ESCALATE_RECOVERY_PROBABILITY - escCost),
    selected: false,
  });

  // stop: by definition, zero cost and zero recoverable amount attempted —
  // the deterministic floor every other action is measured against.
  candidates.push({
    action_type: "stop",
    potential_recoverable_amount: 0,
    recovery_probability: 0,
    intervention_cost: 0,
    expected_recovery_value: 0,
    selected: false,
  });

  const winner = candidates.reduce((best, c) =>
    c.expected_recovery_value > best.expected_recovery_value ? c : best
  );
  winner.selected = true;

  return candidates;
}

export function selectedAction(candidates: ImpactCandidate[]): ImpactCandidate {
  const selected = candidates.find((c) => c.selected);
  if (!selected) throw new Error("computeImpactScores produced no selected candidate");
  return selected;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(0.97, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
