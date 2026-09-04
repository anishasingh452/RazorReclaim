import type { ActionType, ImpactScore, RiskType, RootCauseResult } from "@/types/domain";
import { enumerateCandidates } from "@/lib/candidates/candidate-engine";
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
  /**
   * Total prior executions recorded for this case — determines whether the
   * zero-cost floor candidate is `no_action` (never engaged) or `stop`
   * (already attempted at least once). Defaults to 0 for backward
   * compatibility with callers that predate this field.
   */
  priorExecutionCount?: number;
}

export type ImpactCandidate = Omit<ImpactScore, "id" | "case_id" | "created_at">;

type AutomatedAction = "retry" | "payment_link" | "reminder" | "wait_and_retry" | "voice";
const AUTOMATED_ACTION_TYPES: AutomatedAction[] = ["retry", "payment_link", "reminder", "wait_and_retry", "voice"];

/**
 * Deterministic Expected Recovery Value calculation — no LLM involvement.
 * ERV = potential_recoverable_amount * recovery_probability - intervention_cost
 *
 * The LLM's qualitative_recovery_probability (from root_cause_node) is the
 * only AI-influenced input, and it is clamped into a fixed numeric table
 * before any arithmetic touches it — the model never emits the number that
 * drives money math directly.
 *
 * Every action the Candidate Action Engine enumerates is represented in the
 * output — feasible ones get a real ERV, infeasible ones get a zeroed-out
 * row carrying their exclusion reason, so the full "what was considered and
 * why" picture is always in the returned/persisted candidate set, not just
 * the winner.
 */
export function computeImpactScores(input: ImpactEngineInput): ImpactCandidate[] {
  const { amount, riskType, contactAttempts, daysSinceFailure, rootCause, priorExecutionCount = 0 } = input;

  const baseProbability = QUALITATIVE_PROBABILITY[rootCause.qualitative_recovery_probability];
  const decay = attemptDecay(contactAttempts) * timeDecay(daysSinceFailure);

  const candidates: ImpactCandidate[] = [];

  for (const def of enumerateCandidates(riskType)) {
    if (!AUTOMATED_ACTION_TYPES.includes(def.action_type as AutomatedAction)) continue;

    if (!def.feasible) {
      candidates.push(infeasibleCandidate(def.action_type, def.exclusion_reason!));
      continue;
    }

    const action = def.action_type as AutomatedAction;
    // Round the probability BEFORE pricing with it. The stored row is what
    // the impact ledger shows and what an auditor recomputes by hand; if ERV
    // came from the unrounded value, the published numbers wouldn't
    // reconcile with each other — a bad look for a decision the product
    // asks people to trust precisely because it's checkable arithmetic.
    const recovery_probability = round3(clamp01(baseProbability * ACTION_EFFECTIVENESS[action] * decay));
    const intervention_cost = INTERVENTION_COST[action];
    const expected_recovery_value = round2(amount * recovery_probability - intervention_cost);
    candidates.push({
      action_type: action,
      potential_recoverable_amount: amount,
      recovery_probability,
      intervention_cost,
      expected_recovery_value,
      selected: false,
      feasible: true,
      exclusion_reason: null,
    });
  }

  // escalate: fixed operational baseline probability, cost scales with case value
  const escCost = round2(escalateCost(amount));
  const escProbability = round3(ESCALATE_RECOVERY_PROBABILITY);
  candidates.push({
    action_type: "escalate",
    potential_recoverable_amount: amount,
    recovery_probability: escProbability,
    intervention_cost: escCost,
    expected_recovery_value: round2(amount * escProbability - escCost),
    selected: false,
    feasible: true,
    exclusion_reason: null,
  });

  // Zero-cost floor: `no_action` for a case that has never been engaged at
  // all, `stop` for one with prior contact/execution history. Mutually
  // exclusive by construction, so there's never an ERV tie between them —
  // exactly one is a real (feasible) candidate, the other is recorded as
  // excluded for this case's history.
  const isFresh = contactAttempts === 0 && priorExecutionCount === 0;
  candidates.push({
    action_type: isFresh ? "no_action" : "stop",
    potential_recoverable_amount: 0,
    recovery_probability: 0,
    intervention_cost: 0,
    expected_recovery_value: 0,
    selected: false,
    feasible: true,
    exclusion_reason: null,
  });
  candidates.push(
    infeasibleCandidate(
      isFresh ? "stop" : "no_action",
      isFresh
        ? "Case has no prior contact or execution history — stop implies abandoning a prior attempt that never happened."
        : "Case already has prior contact/execution history — no_action (never engaged) no longer applies."
    )
  );

  const winner = candidates
    .filter((c) => c.feasible)
    .reduce((best, c) => (c.expected_recovery_value > best.expected_recovery_value ? c : best));
  winner.selected = true;

  return candidates;
}

function infeasibleCandidate(action_type: ActionType, exclusion_reason: string): ImpactCandidate {
  return {
    action_type,
    potential_recoverable_amount: 0,
    recovery_probability: 0,
    intervention_cost: 0,
    expected_recovery_value: 0,
    selected: false,
    feasible: false,
    exclusion_reason,
  };
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
