import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./engine";

function check(decision: ReturnType<typeof evaluatePolicy>, ruleName: string) {
  const c = decision.checks.find((c) => c.rule_name === ruleName);
  if (!c) throw new Error(`rule ${ruleName} not evaluated`);
  return c;
}

describe("evaluatePolicy", () => {
  it("Case A: high-value fresh failure with positive ERV, low amount — allows the ERV-selected action", () => {
    const decision = evaluatePolicy({
      amount: 50_000,
      contactAttempts: 0,
      candidateAction: "payment_link",
      expectedRecoveryValue: 30_000,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe("payment_link");
    expect(decision.requiresHuman).toBe(false);
    expect(decision.requiresStop).toBe(false);
    expect(decision.checks).toHaveLength(7); // every rule recorded even though all pass
  });

  it("Case B: low value, low recovery probability, 3 prior attempts — policy forces STOP", () => {
    const decision = evaluatePolicy({
      amount: 2_000,
      contactAttempts: 3,
      candidateAction: "reminder",
      expectedRecoveryValue: -1, // ERV engine would already floor this near/at zero
      priorExecutionCount: 3,
      hoursSinceLastExecution: 48,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("stop");
    expect(decision.requiresStop).toBe(true);
    expect(check(decision, "MAX_COMMUNICATION_ATTEMPTS").passed).toBe(false);
  });

  it("Case C: high-value B2B receivable above auto-approval limit — forces human escalation even with positive ERV", () => {
    const decision = evaluatePolicy({
      amount: 120_000,
      contactAttempts: 1,
      candidateAction: "payment_link",
      expectedRecoveryValue: 60_000,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("escalate");
    expect(decision.requiresHuman).toBe(true);
    expect(check(decision, "AMOUNT_ABOVE_AUTO_APPROVAL_LIMIT").passed).toBe(false);
  });

  it("blocks communication but escalates instead of stopping when amount is above the escalate-instead-of-stop threshold", () => {
    const decision = evaluatePolicy({
      amount: 25_000,
      contactAttempts: 3,
      candidateAction: "payment_link",
      expectedRecoveryValue: 10_000,
      priorExecutionCount: 3,
      hoursSinceLastExecution: 48,
    });
    expect(decision.action).toBe("escalate");
    expect(decision.requiresHuman).toBe(true);
  });

  it("hard-caps harassment regardless of value or ERV once contact_attempts reaches the absolute ceiling", () => {
    const decision = evaluatePolicy({
      amount: 500_000,
      contactAttempts: 5,
      candidateAction: "escalate",
      expectedRecoveryValue: 200_000,
      priorExecutionCount: 5,
      hoursSinceLastExecution: 100,
    });
    // priorExecutionCount also hits the bounded-execution ceiling here —
    // both are terminal-stop rules, so stop wins regardless of which fires first.
    expect(decision.action).toBe("stop");
    expect(check(decision, "BOUNDED_EXECUTION").passed).toBe(false);
  });

  it("stops on negative expected recovery value even when every other rule passes", () => {
    const decision = evaluatePolicy({
      amount: 1_000,
      contactAttempts: 0,
      candidateAction: "reminder",
      expectedRecoveryValue: -5,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("stop");
    expect(check(decision, "STOP_ON_NEGATIVE_ERV").passed).toBe(false);
  });

  it("defers (does not terminate) when a cooldown is active", () => {
    const decision = evaluatePolicy({
      amount: 10_000,
      contactAttempts: 1,
      candidateAction: "payment_link",
      expectedRecoveryValue: 5_000,
      priorExecutionCount: 1,
      hoursSinceLastExecution: 3, // well under the 24h cooldown
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("wait_and_retry");
    expect(decision.requiresStop).toBe(false);
    expect(decision.requiresHuman).toBe(false);
  });

  it("enforces the bounded-execution ceiling as an absolute safety net", () => {
    const decision = evaluatePolicy({
      amount: 5_000,
      contactAttempts: 0,
      candidateAction: "retry",
      expectedRecoveryValue: 4_000,
      priorExecutionCount: 5,
      hoursSinceLastExecution: 200,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("stop");
    expect(check(decision, "BOUNDED_EXECUTION").passed).toBe(false);
  });

  it("blocks retry specifically once retry attempts are exhausted, independent of the communication cap", () => {
    const decision = evaluatePolicy({
      amount: 5_000,
      contactAttempts: 3,
      candidateAction: "retry",
      expectedRecoveryValue: 500,
      priorExecutionCount: 3,
      hoursSinceLastExecution: 48,
    });
    expect(decision.allowed).toBe(false);
    expect(check(decision, "MAX_RETRY_ATTEMPTS").passed).toBe(false);
    expect(check(decision, "MAX_COMMUNICATION_ATTEMPTS").passed).toBe(true); // retry isn't a communication action
  });

  it("never gates a stop or escalate candidate on communication/harassment rules", () => {
    const decision = evaluatePolicy({
      amount: 3_000,
      contactAttempts: 10,
      candidateAction: "stop",
      expectedRecoveryValue: 0,
      priorExecutionCount: 2,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe("stop");
  });

  it("treats `voice` as a communication action, subject to MAX_COMMUNICATION_ATTEMPTS", () => {
    const decision = evaluatePolicy({
      amount: 25_000,
      contactAttempts: 3,
      candidateAction: "voice",
      expectedRecoveryValue: 5_000,
      priorExecutionCount: 3,
      hoursSinceLastExecution: 48,
    });
    expect(decision.allowed).toBe(false);
    expect(check(decision, "MAX_COMMUNICATION_ATTEMPTS").passed).toBe(false);
    expect(check(decision, "MAX_RETRY_ATTEMPTS").passed).toBe(true); // voice isn't a retry
  });

  it("allows a fresh `voice` call under the communication cap", () => {
    const decision = evaluatePolicy({
      amount: 25_000,
      contactAttempts: 0,
      candidateAction: "voice",
      expectedRecoveryValue: 8_000,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe("voice");
  });

  it("never gates a `no_action` candidate on communication/harassment/amount rules, same as stop/escalate", () => {
    const decision = evaluatePolicy({
      amount: 500_000, // deliberately above the auto-approval limit
      contactAttempts: 0,
      candidateAction: "no_action",
      expectedRecoveryValue: 0,
      priorExecutionCount: 0,
      hoursSinceLastExecution: null,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.action).toBe("no_action");
    expect(decision.requiresHuman).toBe(false);
    expect(decision.requiresStop).toBe(false);
  });

  it("still applies BOUNDED_EXECUTION to a `no_action` candidate — no candidate is exempt from the absolute safety ceiling", () => {
    const decision = evaluatePolicy({
      amount: 500,
      contactAttempts: 0,
      candidateAction: "no_action",
      expectedRecoveryValue: 0,
      priorExecutionCount: 5,
      hoursSinceLastExecution: 200,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.action).toBe("stop");
  });
});
