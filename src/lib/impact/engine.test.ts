import { describe, expect, it } from "vitest";
import { computeImpactScores, selectedAction } from "./engine";

describe("computeImpactScores", () => {
  it("favors a high-value case with high recovery probability and picks a positive-ERV action", () => {
    const candidates = computeImpactScores({
      amount: 50_000,
      riskType: "failed_payment",
      contactAttempts: 0,
      daysSinceFailure: 1,
      rootCause: { qualitative_recovery_probability: "high" },
    });
    const winner = selectedAction(candidates);
    expect(winner.expected_recovery_value).toBeGreaterThan(0);
    expect(["retry", "payment_link"]).toContain(winner.action_type);
  });

  it("a zero-cost action (retry) is still worth attempting even at low probability", () => {
    // Cost is nominal for automated retries, so unless probability is
    // effectively zero, retry's ERV stays positive — that's intentional:
    // there's no harm in trying a free action. It's the Policy Engine's
    // attempt/harassment caps, not raw ERV, that ultimately stop these cases.
    const candidates = computeImpactScores({
      amount: 2_000,
      riskType: "failed_payment",
      contactAttempts: 3,
      daysSinceFailure: 20,
      rootCause: { qualitative_recovery_probability: "very_low" },
    });
    const winner = selectedAction(candidates);
    expect(winner.action_type).toBe("retry");
    expect(winner.expected_recovery_value).toBeGreaterThan(0);
  });

  it("selects stop when only paid actions are feasible and their cost exceeds the discounted expected gain", () => {
    // checkout_abandonment only offers payment_link/reminder (both carry a
    // nominal cost) — with a tiny amount, low probability, and heavy decay,
    // the expected gain no longer covers even that nominal cost.
    const candidates = computeImpactScores({
      amount: 200,
      riskType: "checkout_abandonment",
      contactAttempts: 4,
      daysSinceFailure: 25,
      rootCause: { qualitative_recovery_probability: "very_low" },
    });
    const winner = selectedAction(candidates);
    expect(winner.action_type).toBe("stop");
    expect(winner.expected_recovery_value).toBe(0);
  });

  it("always produces exactly one selected candidate, and includes stop + escalate as universal fallbacks", () => {
    const candidates = computeImpactScores({
      amount: 120_000,
      riskType: "overdue_receivable",
      contactAttempts: 1,
      daysSinceFailure: 45,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    expect(candidates.filter((c) => c.selected)).toHaveLength(1);
    expect(candidates.map((c) => c.action_type)).toEqual(
      expect.arrayContaining(["stop", "escalate"])
    );
  });

  it("scales escalation cost with case amount, bounded to [2000, 8000]", () => {
    const small = computeImpactScores({
      amount: 10_000,
      riskType: "overdue_receivable",
      contactAttempts: 0,
      daysSinceFailure: 5,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    const large = computeImpactScores({
      amount: 1_000_000,
      riskType: "overdue_receivable",
      contactAttempts: 0,
      daysSinceFailure: 5,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    const escSmall = small.find((c) => c.action_type === "escalate")!;
    const escLarge = large.find((c) => c.action_type === "escalate")!;
    expect(escSmall.intervention_cost).toBe(2000); // floor
    expect(escLarge.intervention_cost).toBe(8000); // ceiling
  });

  it("only offers risk-type-appropriate automated actions (no `retry` for checkout abandonment)", () => {
    const candidates = computeImpactScores({
      amount: 3_000,
      riskType: "checkout_abandonment",
      contactAttempts: 0,
      daysSinceFailure: 0,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    expect(candidates.map((c) => c.action_type)).not.toContain("retry");
  });

  it("decays recovery probability as contact attempts increase, all else equal", () => {
    const fresh = computeImpactScores({
      amount: 20_000,
      riskType: "failed_payment",
      contactAttempts: 0,
      daysSinceFailure: 5,
      rootCause: { qualitative_recovery_probability: "high" },
    }).find((c) => c.action_type === "payment_link")!;
    const contacted = computeImpactScores({
      amount: 20_000,
      riskType: "failed_payment",
      contactAttempts: 3,
      daysSinceFailure: 5,
      rootCause: { qualitative_recovery_probability: "high" },
    }).find((c) => c.action_type === "payment_link")!;
    expect(contacted.recovery_probability).toBeLessThan(fresh.recovery_probability);
  });
});
