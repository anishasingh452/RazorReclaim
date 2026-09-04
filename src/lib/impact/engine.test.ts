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

  it("records risk-type-inappropriate actions as infeasible rather than omitting them (`retry` for checkout abandonment)", () => {
    const candidates = computeImpactScores({
      amount: 3_000,
      riskType: "checkout_abandonment",
      contactAttempts: 0,
      daysSinceFailure: 0,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    const retry = candidates.find((c) => c.action_type === "retry");
    expect(retry?.feasible).toBe(false);
    expect(retry?.exclusion_reason).toBeTruthy();
    expect(retry?.selected).toBe(false);
    expect(retry?.expected_recovery_value).toBe(0);
  });

  it("scores voice as a real candidate, universally feasible, priced between reminder and escalate", () => {
    const candidates = computeImpactScores({
      amount: 20_000,
      riskType: "overdue_receivable", // retry/wait_and_retry infeasible here, voice still is
      contactAttempts: 0,
      daysSinceFailure: 5,
      rootCause: { qualitative_recovery_probability: "high" },
    });
    const voice = candidates.find((c) => c.action_type === "voice")!;
    expect(voice.feasible).toBe(true);
    expect(voice.intervention_cost).toBe(60);
    expect(voice.expected_recovery_value).toBeGreaterThan(0);
  });

  it("uses `no_action` (not `stop`) as the zero-cost floor for a case with zero prior contact and zero prior executions", () => {
    const candidates = computeImpactScores({
      amount: 50,
      riskType: "checkout_abandonment",
      contactAttempts: 0,
      daysSinceFailure: 60,
      rootCause: { qualitative_recovery_probability: "very_low" },
      priorExecutionCount: 0,
    });
    const winner = selectedAction(candidates);
    expect(winner.action_type).toBe("no_action");

    const stop = candidates.find((c) => c.action_type === "stop")!;
    expect(stop.feasible).toBe(false);
    expect(stop.exclusion_reason).toBeTruthy();
  });

  it("uses `stop` (not `no_action`) as the floor once a case has prior contact attempts or executions", () => {
    const byAttempts = computeImpactScores({
      amount: 50,
      riskType: "checkout_abandonment",
      contactAttempts: 2,
      daysSinceFailure: 60,
      rootCause: { qualitative_recovery_probability: "very_low" },
      priorExecutionCount: 0,
    });
    expect(selectedAction(byAttempts).action_type).toBe("stop");
    const noActionByAttempts = byAttempts.find((c) => c.action_type === "no_action")!;
    expect(noActionByAttempts.feasible).toBe(false);

    const byExecutions = computeImpactScores({
      amount: 50,
      riskType: "checkout_abandonment",
      contactAttempts: 0,
      daysSinceFailure: 60,
      rootCause: { qualitative_recovery_probability: "very_low" },
      priorExecutionCount: 1,
    });
    expect(selectedAction(byExecutions).action_type).toBe("stop");
  });

  it("defaults priorExecutionCount to 0 when omitted, for backward compatibility with existing callers", () => {
    const candidates = computeImpactScores({
      amount: 50,
      riskType: "checkout_abandonment",
      contactAttempts: 0,
      daysSinceFailure: 60,
      rootCause: { qualitative_recovery_probability: "very_low" },
      // priorExecutionCount omitted entirely
    });
    expect(selectedAction(candidates).action_type).toBe("no_action");
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

  it("calls a high-value B2B receivable while it is still recoverable", () => {
    // What voice exists for: a large invoice, recently stalled, where one
    // live conversation clears the blocker for a fraction of an analyst's cost.
    const candidates = computeImpactScores({
      amount: 85_000,
      riskType: "overdue_receivable",
      contactAttempts: 0,
      daysSinceFailure: 6,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    expect(candidates.find((c) => c.selected)?.action_type).toBe("voice");
  });

  it("escalates a receivable automation has already chased", () => {
    // Once cheap channels have had their turn, the analyst's flat baseline
    // is earned and outweighs another automated touch.
    const candidates = computeImpactScores({
      amount: 85_000,
      riskType: "overdue_receivable",
      contactAttempts: 2,
      daysSinceFailure: 65,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    expect(candidates.find((c) => c.selected)?.action_type).toBe("escalate");
  });

  it("escalates a receivable the model has almost no hope for", () => {
    const candidates = computeImpactScores({
      amount: 85_000,
      riskType: "overdue_receivable",
      contactAttempts: 0,
      daysSinceFailure: 6,
      rootCause: { qualitative_recovery_probability: "very_low" },
    });
    expect(candidates.find((c) => c.selected)?.action_type).toBe("escalate");
  });

  it("does not boost voice outside the risk types where conversation is the blocker", () => {
    const failedPayment = computeImpactScores({
      amount: 20_000,
      riskType: "failed_payment",
      contactAttempts: 0,
      daysSinceFailure: 10,
      rootCause: { qualitative_recovery_probability: "medium" },
    });
    const voice = failedPayment.find((c) => c.action_type === "voice")!;
    const retry = failedPayment.find((c) => c.action_type === "retry")!;
    // A failed card payment is a technical failure — a silent retry still wins.
    expect(voice.recovery_probability).toBeLessThan(retry.recovery_probability);
    expect(failedPayment.find((c) => c.selected)?.action_type).not.toBe("voice");
  });

  it("discounts escalation on a case nobody has contacted yet", () => {
    const escalateProbabilityAt = (attempts: number) =>
      computeImpactScores({
        amount: 50_000,
        riskType: "failed_payment",
        contactAttempts: attempts,
        daysSinceFailure: 20,
        rootCause: { qualitative_recovery_probability: "medium" },
      }).find((c) => c.action_type === "escalate")!.recovery_probability;

    // Handing over an untouched case skips the cheaper options entirely.
    expect(escalateProbabilityAt(0)).toBeLessThan(escalateProbabilityAt(1));
  });

  it("erodes the escalation baseline as a case ages, but never to nothing", () => {
    const probabilityAt = (days: number) =>
      computeImpactScores({
        amount: 50_000,
        riskType: "failed_payment",
        contactAttempts: 1,
        daysSinceFailure: days,
        rootCause: { qualitative_recovery_probability: "medium" },
      }).find((c) => c.action_type === "escalate")!.recovery_probability;

    expect(probabilityAt(0)).toBeGreaterThan(probabilityAt(45));
    expect(probabilityAt(45)).toBeGreaterThan(probabilityAt(120));
    // A human keeps a floor of their baseline no matter how stale the case.
    expect(probabilityAt(3650)).toBeGreaterThan(0.15);
  });

  it("publishes rows whose own numbers reconcile — ERV recomputes exactly from the stored probability and cost", () => {
    // The impact ledger shows probability, cost and ERV side by side and
    // invites the reader to check the arithmetic. Pricing off an unrounded
    // probability while storing a rounded one would make every published
    // row fail that check by a few paise.
    for (const riskType of ["failed_payment", "checkout_abandonment", "subscription_failure", "overdue_receivable"] as const) {
      for (const attempts of [0, 2]) {
        const candidates = computeImpactScores({
          amount: 3579.9,
          riskType,
          contactAttempts: attempts,
          daysSinceFailure: 11,
          rootCause: { qualitative_recovery_probability: "medium" },
        });

        for (const c of candidates.filter((c) => c.feasible)) {
          const recomputed =
            Math.round((c.potential_recoverable_amount * c.recovery_probability - c.intervention_cost) * 100) / 100;
          expect(recomputed, `${riskType}/${attempts} attempts: ${c.action_type}`).toBe(c.expected_recovery_value);
        }
      }
    }
  });
});
