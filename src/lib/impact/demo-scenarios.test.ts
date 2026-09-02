import { describe, expect, it } from "vitest";
import { computeImpactScores, selectedAction } from "./engine";
import { evaluatePolicy } from "@/lib/policy/engine";

/**
 * Locks in the three flagship scenarios from the product brief end-to-end:
 * Business Impact Engine picks a candidate action -> Policy Engine gates it.
 * This is the exact behavior the live demo depends on, so it's pinned here
 * rather than left to be discovered by hand during a rehearsal.
 */
describe("Impact Engine + Policy Engine — flagship demo scenarios", () => {
  it("Case A: ₹50,000 failed payment, high-value customer, temporary failure -> retry/payment_link, allowed", () => {
    const candidates = computeImpactScores({
      amount: 50_000,
      riskType: "failed_payment",
      contactAttempts: 0,
      daysSinceFailure: 1,
      rootCause: { qualitative_recovery_probability: "high" },
    });
    const winner = selectedAction(candidates);
    expect(["retry", "payment_link"]).toContain(winner.action_type);
    expect(winner.expected_recovery_value).toBeGreaterThan(0);

    const decision = evaluatePolicy({
      amount: 50_000,
      contactAttempts: 0,
      candidateAction: winner.action_type,
      expectedRecoveryValue: winner.expected_recovery_value,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe(winner.action_type);
  });

  it("Case B: ₹2,000 failed payment, low recovery probability, already contacted 3 times -> STOP", () => {
    const candidates = computeImpactScores({
      amount: 2_000,
      riskType: "failed_payment",
      contactAttempts: 3,
      daysSinceFailure: 20,
      rootCause: { qualitative_recovery_probability: "very_low" },
    });
    const winner = selectedAction(candidates);

    const decision = evaluatePolicy({
      amount: 2_000,
      contactAttempts: 3,
      candidateAction: winner.action_type,
      expectedRecoveryValue: winner.expected_recovery_value,
      priorExecutionCount: 3,
      hoursSinceLastExecution: 48,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("stop");
  });

  it("Case C: ₹1,20,000 overdue B2B receivable -> HUMAN ESCALATION", () => {
    const candidates = computeImpactScores({
      amount: 120_000,
      riskType: "overdue_receivable",
      contactAttempts: 1,
      daysSinceFailure: 40,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    const winner = selectedAction(candidates);

    const decision = evaluatePolicy({
      amount: 120_000,
      contactAttempts: 1,
      candidateAction: winner.action_type,
      expectedRecoveryValue: winner.expected_recovery_value,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    // `allowed` reflects whether policy had to override the Impact Engine's
    // own pick — here escalate was already the ERV-maximizing choice, so
    // policy doesn't need to intervene. What matters for the demo is that
    // the final action is unambiguously escalate, routed to a human.
    expect(decision.action).toBe("escalate");
    expect(decision.requiresHuman).toBe(true);
  });

  it("Case C variant: even if the Impact Engine somehow favored an automated action, amount above the auto-approval limit still forces human escalation", () => {
    const decision = evaluatePolicy({
      amount: 120_000,
      contactAttempts: 0,
      candidateAction: "payment_link", // hypothetical: not what the engine actually picks, but policy must still gate it
      expectedRecoveryValue: 40_000,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("escalate");
    expect(decision.requiresHuman).toBe(true);
  });
});
