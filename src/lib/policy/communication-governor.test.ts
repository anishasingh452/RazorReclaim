import { describe, expect, it } from "vitest";
import { communicationGovernor } from "./communication-governor";
import type { PromiseToPay } from "@/types/domain";

function ptp(overrides: Partial<PromiseToPay> = {}): PromiseToPay {
  return {
    id: "ptp-1",
    case_id: "case-1",
    voice_interaction_id: null,
    promised_amount: 1000,
    promised_date: "2099-01-01",
    status: "pending",
    created_at: "2026-01-01T00:00:00.000Z",
    resolved_at: null,
    ...overrides,
  };
}

describe("communicationGovernor", () => {
  it("allows a fresh case with no history", () => {
    const result = communicationGovernor({ contactAttempts: 0, hoursSinceLastExecution: null, activePromise: null });
    expect(result.decision).toBe("ALLOW");
  });

  it("blocks once the harassment hard cap is reached, regardless of anything else", () => {
    const result = communicationGovernor({ contactAttempts: 5, hoursSinceLastExecution: 999, activePromise: null });
    expect(result.decision).toBe("BLOCK");
    expect(result.reason).toMatch(/hard cap/i);
  });

  it("blocks once the communication attempt cap is reached", () => {
    const result = communicationGovernor({ contactAttempts: 3, hoursSinceLastExecution: 999, activePromise: null });
    expect(result.decision).toBe("BLOCK");
    expect(result.reason).toMatch(/communication attempts/i);
  });

  it("delays (does not block outright) when the cooldown hasn't elapsed", () => {
    const result = communicationGovernor({ contactAttempts: 1, hoursSinceLastExecution: 3, activePromise: null });
    expect(result.decision).toBe("DELAY");
    expect(result.reason).toMatch(/cooldown/i);
  });

  it("delays when an active, not-yet-due promise-to-pay exists", () => {
    const result = communicationGovernor({
      contactAttempts: 0,
      hoursSinceLastExecution: null,
      activePromise: ptp({ promised_date: "2099-01-01" }),
    });
    expect(result.decision).toBe("DELAY");
    expect(result.reason).toMatch(/promise-to-pay/i);
  });

  it("does not delay for a promise-to-pay whose date has already passed (it's broken, not active)", () => {
    const result = communicationGovernor({
      contactAttempts: 0,
      hoursSinceLastExecution: null,
      activePromise: ptp({ promised_date: "2020-01-01" }),
    });
    expect(result.decision).toBe("ALLOW");
  });

  it("harassment hard cap takes precedence over an active promise", () => {
    const result = communicationGovernor({
      contactAttempts: 5,
      hoursSinceLastExecution: null,
      activePromise: ptp({ promised_date: "2099-01-01" }),
    });
    expect(result.decision).toBe("BLOCK");
  });
});
