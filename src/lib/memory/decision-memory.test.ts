import { describe, expect, it } from "vitest";
import { buildDecisionMemorySummary } from "./decision-memory";

describe("buildDecisionMemorySummary", () => {
  it("summarizes a verified recovery with the amount actually recovered", () => {
    const s = buildDecisionMemorySummary({
      riskType: "failed_payment",
      finalAction: "retry",
      verified: true,
      amountRecovered: 2461.77,
      amount: 2461.77,
    });
    expect(s).toContain("failed payment");
    expect(s).toContain("retry");
    expect(s).toContain("2461.77");
  });

  it("summarizes a stopped case using the case amount, not amountRecovered", () => {
    const s = buildDecisionMemorySummary({
      riskType: "checkout_abandonment",
      finalAction: "stop",
      verified: false,
      amountRecovered: 0,
      amount: 999.5,
    });
    expect(s).toContain("closed");
    expect(s).toContain("stop");
    expect(s).toContain("999.50");
  });

  it("summarizes a no_action case distinctly from stop, but with the same 'closed' framing", () => {
    const s = buildDecisionMemorySummary({
      riskType: "overdue_receivable",
      finalAction: "no_action",
      verified: false,
      amountRecovered: 0,
      amount: 50,
    });
    expect(s).toContain("no action");
  });

  it("falls back to an 'outcome not yet verified' summary for an unresolved case", () => {
    const s = buildDecisionMemorySummary({
      riskType: "subscription_failure",
      finalAction: "payment_link",
      verified: false,
      amountRecovered: 0,
      amount: 1200,
    });
    expect(s).toContain("not yet verified");
  });

  it("handles a null finalAction gracefully", () => {
    const s = buildDecisionMemorySummary({
      riskType: "failed_payment",
      finalAction: null,
      verified: false,
      amountRecovered: 0,
      amount: 100,
    });
    expect(s).toContain("no action");
  });
});
