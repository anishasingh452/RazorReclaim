import { describe, expect, it } from "vitest";
import { proposeChannelStrategy, type ChannelStrategyInput } from "./channel-strategy-agent";

function input(overrides: Partial<ChannelStrategyInput> = {}): ChannelStrategyInput {
  return {
    riskType: "failed_payment",
    amount: 5000,
    contactAttempts: 0,
    governorInput: { contactAttempts: 0, hoursSinceLastExecution: null, activePromise: null },
    ...overrides,
  };
}

describe("proposeChannelStrategy", () => {
  it("proposes escalate once contact attempts reach 2, regardless of risk type", () => {
    const result = proposeChannelStrategy(input({ contactAttempts: 2 }));
    expect(result.proposedAction).toBe("escalate");
  });

  it("proposes voice for a large overdue B2B receivable", () => {
    const result = proposeChannelStrategy(
      input({ riskType: "overdue_receivable", amount: 80_000, contactAttempts: 0 })
    );
    expect(result.proposedAction).toBe("voice");
    expect(result.proposedChannel).toBe("voice");
  });

  it("proposes reminder for checkout abandonment", () => {
    const result = proposeChannelStrategy(input({ riskType: "checkout_abandonment" }));
    expect(result.proposedAction).toBe("reminder");
  });

  it("proposes retry for subscription failure", () => {
    const result = proposeChannelStrategy(input({ riskType: "subscription_failure" }));
    expect(result.proposedAction).toBe("retry");
  });

  it("defaults to payment_link for a small failed_payment case", () => {
    const result = proposeChannelStrategy(input({ riskType: "failed_payment", amount: 1000 }));
    expect(result.proposedAction).toBe("payment_link");
  });

  it("self-censors to no_action when the governor would BLOCK the proposed communication", () => {
    const result = proposeChannelStrategy(
      input({
        riskType: "checkout_abandonment", // would normally propose reminder (a comms action)
        contactAttempts: 1,
        governorInput: { contactAttempts: 5, hoursSinceLastExecution: null, activePromise: null }, // hard cap -> BLOCK
      })
    );
    expect(result.proposedAction).toBe("no_action");
    expect(result.rationale).toMatch(/Governor/);
  });

  it("self-censors to wait_and_retry when the governor would DELAY", () => {
    const result = proposeChannelStrategy(
      input({
        riskType: "checkout_abandonment",
        contactAttempts: 1,
        governorInput: { contactAttempts: 1, hoursSinceLastExecution: 2, activePromise: null }, // cooldown -> DELAY
      })
    );
    expect(result.proposedAction).toBe("wait_and_retry");
  });

  it("does not self-censor non-communication proposals (e.g. retry) based on the governor", () => {
    const result = proposeChannelStrategy(
      input({
        riskType: "subscription_failure", // proposes retry, no channel
        contactAttempts: 0,
        governorInput: { contactAttempts: 5, hoursSinceLastExecution: null, activePromise: null }, // would BLOCK comms
      })
    );
    expect(result.proposedAction).toBe("retry");
  });
});
