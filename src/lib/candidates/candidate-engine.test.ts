import { describe, expect, it } from "vitest";
import { enumerateCandidates, feasibleActionTypes } from "./candidate-engine";

describe("enumerateCandidates", () => {
  it("returns all 8 unified action types for every risk type", () => {
    const riskTypes = ["failed_payment", "subscription_failure", "checkout_abandonment", "overdue_receivable"] as const;
    for (const rt of riskTypes) {
      const candidates = enumerateCandidates(rt);
      expect(candidates.map((c) => c.action_type).sort()).toEqual(
        ["escalate", "no_action", "payment_link", "reminder", "retry", "stop", "voice", "wait_and_retry"].sort()
      );
    }
  });

  it("every infeasible candidate carries a non-empty exclusion reason, every feasible one has none", () => {
    for (const rt of ["failed_payment", "subscription_failure", "checkout_abandonment", "overdue_receivable"] as const) {
      for (const c of enumerateCandidates(rt)) {
        if (c.feasible) expect(c.exclusion_reason).toBeNull();
        else expect(c.exclusion_reason).toBeTruthy();
      }
    }
  });

  // Locks in exact parity with the feasibility matrix the Business Impact
  // Engine has always used (src/lib/impact/engine.ts's prior inline
  // feasibleAutomatedActions) — this refactor must not silently change
  // which actions are considered for which risk type.
  it("matches the pre-existing feasibility matrix for failed_payment (all four automated actions)", () => {
    expect(feasibleActionTypes("failed_payment")).toEqual(
      expect.arrayContaining(["retry", "payment_link", "reminder", "wait_and_retry"])
    );
  });

  it("matches the pre-existing feasibility matrix for subscription_failure (no payment_link)", () => {
    const feasible = feasibleActionTypes("subscription_failure");
    expect(feasible).toEqual(expect.arrayContaining(["retry", "reminder", "wait_and_retry"]));
    expect(feasible).not.toContain("payment_link");
  });

  it("matches the pre-existing feasibility matrix for checkout_abandonment (payment_link/reminder only among automated)", () => {
    const feasible = feasibleActionTypes("checkout_abandonment");
    expect(feasible).toEqual(expect.arrayContaining(["payment_link", "reminder"]));
    expect(feasible).not.toContain("retry");
    expect(feasible).not.toContain("wait_and_retry");
  });

  it("matches the pre-existing feasibility matrix for overdue_receivable (payment_link/reminder only among automated)", () => {
    const feasible = feasibleActionTypes("overdue_receivable");
    expect(feasible).toEqual(expect.arrayContaining(["payment_link", "reminder"]));
    expect(feasible).not.toContain("retry");
    expect(feasible).not.toContain("wait_and_retry");
  });

  it("voice is universally feasible — a phone call is always a valid channel", () => {
    for (const rt of ["failed_payment", "subscription_failure", "checkout_abandonment", "overdue_receivable"] as const) {
      expect(feasibleActionTypes(rt)).toContain("voice");
    }
  });

  it("escalate, stop, and no_action are always feasible universal fallbacks", () => {
    for (const rt of ["failed_payment", "subscription_failure", "checkout_abandonment", "overdue_receivable"] as const) {
      const feasible = feasibleActionTypes(rt);
      expect(feasible).toEqual(expect.arrayContaining(["escalate", "stop", "no_action"]));
    }
  });
});
