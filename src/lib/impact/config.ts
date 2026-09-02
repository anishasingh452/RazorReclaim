// Tunable constants for the Business Impact Engine. Kept separate from the
// math so thresholds can be justified/adjusted without touching logic.

export const QUALITATIVE_PROBABILITY: Record<
  "very_low" | "low" | "medium" | "high" | "very_high",
  number
> = {
  very_low: 0.05,
  low: 0.2,
  medium: 0.45,
  high: 0.7,
  very_high: 0.9,
};

/** How effective each action type is at converting the base recovery probability. */
export const ACTION_EFFECTIVENESS: Record<
  "retry" | "payment_link" | "reminder" | "wait_and_retry",
  number
> = {
  retry: 1.0,
  payment_link: 0.9,
  reminder: 0.5,
  wait_and_retry: 0.6,
};

/**
 * Escalation hands the case to a human negotiator — probability is a fixed
 * operational baseline, deliberately NOT derived from the AI's qualitative
 * signal. A human doesn't meaningfully out-recover a well-understood,
 * technically-fixable failure (e.g. "temporary gateway timeout") beyond what
 * an automated retry already achieves — human touch mainly pays off on
 * relationship/negotiation friction, which isn't what qualitative_recovery_
 * probability measures. Coupling the two would make escalate mathematically
 * dominate every high-confidence case, which is not the intended behavior:
 * escalation should win on cost/value grounds (large amounts where even a
 * flat probability beats automated options) or via policy (amount over the
 * auto-approval limit), not by borrowing the AI's optimism about automation.
 */
export const ESCALATE_RECOVERY_PROBABILITY = 0.5;

/** Fixed nominal cost (INR) per automated intervention. */
export const INTERVENTION_COST: Record<
  "retry" | "payment_link" | "reminder" | "wait_and_retry",
  number
> = {
  retry: 0,
  payment_link: 15,
  reminder: 5,
  wait_and_retry: 0,
};

/**
 * Escalation cost models real analyst/account-manager time, not a token fee —
 * it must be heavy enough that escalating a low-value case is never
 * economically attractive, only winning on genuinely large amounts or when
 * automated options are unavailable/unattractive.
 */
export const ESCALATE_COST_RATE = 0.02; // 2% of case amount
export const ESCALATE_COST_MIN = 2000;
export const ESCALATE_COST_MAX = 8000;

/** Recovery probability decays as contact attempts pile up (diminishing returns). */
export function attemptDecay(contactAttempts: number): number {
  return Math.max(0, 1 - 0.15 * Math.min(contactAttempts, 5));
}

/** Recovery probability decays with elapsed time since the original failure. */
export function timeDecay(daysSinceFailure: number): number {
  return Math.exp(-daysSinceFailure / 60);
}

export function escalateCost(amount: number): number {
  return Math.min(ESCALATE_COST_MAX, Math.max(ESCALATE_COST_MIN, amount * ESCALATE_COST_RATE));
}
