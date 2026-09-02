import { describe, expect, it } from "vitest";
import { explainInaction, type ExplainInactionInput } from "./reason-engine";
import type { ImpactCandidate } from "@/lib/impact/engine";

function candidate(overrides: Partial<ImpactCandidate> = {}): ImpactCandidate {
  return {
    action_type: "no_action",
    potential_recoverable_amount: 0,
    recovery_probability: 0,
    intervention_cost: 0,
    expected_recovery_value: 0,
    selected: true,
    feasible: true,
    exclusion_reason: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ExplainInactionInput> = {}): ExplainInactionInput {
  return {
    finalAction: "no_action",
    rootCauseConfidence: 0.8,
    rootCauseCategory: "unknown",
    contactAttempts: 0,
    selectedCandidate: candidate(),
    bestFeasibleErv: 0,
    activePromise: null,
    ...overrides,
  };
}

describe("explainInaction", () => {
  it("prioritizes an active promise-to-pay above every other reason", () => {
    const result = explainInaction(
      baseInput({
        contactAttempts: 5, // would otherwise trigger communication_fatigue_risk
        activePromise: {
          id: "p1",
          case_id: "c1",
          voice_interaction_id: null,
          promised_amount: 500,
          promised_date: "2099-01-01",
          status: "pending",
          created_at: "2026-01-01T00:00:00.000Z",
          resolved_at: null,
        },
      })
    );
    expect(result.reasonCode).toBe("active_promise_exists");
    expect(result.explanation).toContain("500.00");
    expect(result.explanation).toContain("2099-01-01");
  });

  it("flags communication_fatigue_risk once contact attempts reach 3", () => {
    const result = explainInaction(baseInput({ contactAttempts: 3 }));
    expect(result.reasonCode).toBe("communication_fatigue_risk");
  });

  it("flags insufficient_confidence for a low-confidence diagnosis", () => {
    const result = explainInaction(baseInput({ rootCauseConfidence: 0.25 }));
    expect(result.reasonCode).toBe("insufficient_confidence");
  });

  it("flags likely_natural_recovery for a fresh transient-gateway-failure case", () => {
    const result = explainInaction(
      baseInput({ rootCauseCategory: "temporary_gateway_failure", contactAttempts: 0, rootCauseConfidence: 0.9 })
    );
    expect(result.reasonCode).toBe("likely_natural_recovery");
  });

  it("flags cost_exceeds_value when every feasible candidate's ERV is non-positive", () => {
    const result = explainInaction(
      baseInput({
        rootCauseCategory: "bank_declined",
        rootCauseConfidence: 0.9,
        contactAttempts: 1,
        bestFeasibleErv: -12.5,
        selectedCandidate: candidate({ expected_recovery_value: 0 }),
      })
    );
    expect(result.reasonCode).toBe("cost_exceeds_value");
  });

  it("falls back to `other` with a generic explanation when no specific reason applies", () => {
    const result = explainInaction(
      baseInput({
        rootCauseCategory: "bank_declined",
        rootCauseConfidence: 0.9,
        contactAttempts: 1,
        bestFeasibleErv: 50,
        selectedCandidate: candidate({ expected_recovery_value: 50 }),
      })
    );
    expect(result.reasonCode).toBe("other");
  });
});
