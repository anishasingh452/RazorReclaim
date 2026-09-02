import { describe, expect, it } from "vitest";
import { simulateVoiceCall } from "./simulate-call";

describe("simulateVoiceCall", () => {
  it("is deterministic for the same case id", () => {
    const a = simulateVoiceCall({ caseId: "case-abc", amount: 5000, recoveryProbability: 0.6 });
    const b = simulateVoiceCall({ caseId: "case-abc", amount: 5000, recoveryProbability: 0.6 });
    expect(a).toEqual(b);
  });

  it("differs across case ids (not a constant)", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      simulateVoiceCall({ caseId: `case-${i}`, amount: 5000, recoveryProbability: 0.5 })
    );
    const outcomes = new Set(results.map((r) => r.outcome));
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it("only sets promiseToPay when outcome is promise_to_pay, and vice versa", () => {
    for (let i = 0; i < 50; i++) {
      const r = simulateVoiceCall({ caseId: `case-check-${i}`, amount: 1000, recoveryProbability: 0.5 });
      if (r.outcome === "promise_to_pay") {
        expect(r.promiseToPay).not.toBeNull();
        expect(r.promiseToPay!.promisedAmount).toBe(1000);
      } else {
        expect(r.promiseToPay).toBeNull();
      }
    }
  });

  it("no_answer and voicemail outcomes always have outcome=no_response and no promise", () => {
    for (let i = 0; i < 50; i++) {
      const r = simulateVoiceCall({ caseId: `case-conn-${i}`, amount: 1000, recoveryProbability: 0.9 });
      if (r.call_status === "no_answer" || r.call_status === "voicemail") {
        expect(r.outcome).toBe("no_response");
        expect(r.promiseToPay).toBeNull();
      }
    }
  });

  it("higher recovery probability yields a higher promise-to-pay rate across many cases", () => {
    const low = Array.from({ length: 300 }, (_, i) =>
      simulateVoiceCall({ caseId: `low-${i}`, amount: 1000, recoveryProbability: 0.05 })
    );
    const high = Array.from({ length: 300 }, (_, i) =>
      simulateVoiceCall({ caseId: `high-${i}`, amount: 1000, recoveryProbability: 0.9 })
    );
    const rate = (rs: typeof low) => rs.filter((r) => r.outcome === "promise_to_pay").length / rs.length;
    expect(rate(high)).toBeGreaterThan(rate(low));
  });

  it("duration is 0 for no_answer, positive for every other call_status", () => {
    for (let i = 0; i < 50; i++) {
      const r = simulateVoiceCall({ caseId: `dur-${i}`, amount: 1000, recoveryProbability: 0.5 });
      if (r.call_status === "no_answer") expect(r.duration_seconds).toBe(0);
      else expect(r.duration_seconds).toBeGreaterThan(0);
    }
  });
});
