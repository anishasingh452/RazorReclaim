import { describe, expect, it } from "vitest";
import { rankPortfolio, type PortfolioOpportunity } from "./priority-optimizer";

function opp(overrides: Partial<PortfolioOpportunity> = {}): PortfolioOpportunity {
  return { caseId: "c1", amount: 10_000, daysSinceFailure: 0, selectedErv: 1000, recoveryProbability: 0.5, ...overrides };
}

describe("rankPortfolio", () => {
  it("ranks a higher-ERV case above a lower-ERV case, all else equal", () => {
    const ranked = rankPortfolio([
      opp({ caseId: "low", selectedErv: 100 }),
      opp({ caseId: "high", selectedErv: 5000 }),
    ]);
    expect(ranked[0].caseId).toBe("high");
    expect(ranked[1].caseId).toBe("low");
  });

  it("applies an urgency boost to older cases, capable of overtaking a slightly higher-ERV fresh case", () => {
    const ranked = rankPortfolio([
      opp({ caseId: "fresh", selectedErv: 1000, daysSinceFailure: 0 }),
      opp({ caseId: "aging", selectedErv: 1400, daysSinceFailure: 60 }), // 1400 * 1.5 = 2100 > 1000 * 1.0
    ]);
    expect(ranked[0].caseId).toBe("aging");
  });

  it("caps the urgency multiplier at 60+ days (doesn't grow unbounded)", () => {
    const ranked = rankPortfolio([opp({ caseId: "c1", selectedErv: 1000, daysSinceFailure: 60 })]);
    const ranked2 = rankPortfolio([opp({ caseId: "c1", selectedErv: 1000, daysSinceFailure: 200 })]);
    expect(ranked[0].priorityScore).toBe(ranked2[0].priorityScore);
  });

  it("preserves every opportunity in the output (no filtering)", () => {
    const ranked = rankPortfolio([opp({ caseId: "a" }), opp({ caseId: "b" }), opp({ caseId: "c" })]);
    expect(ranked).toHaveLength(3);
  });

  it("handles negative ERV correctly (still ranked, just lower)", () => {
    const ranked = rankPortfolio([opp({ caseId: "neg", selectedErv: -50 }), opp({ caseId: "pos", selectedErv: 10 })]);
    expect(ranked[0].caseId).toBe("pos");
    expect(ranked[1].caseId).toBe("neg");
  });
});
