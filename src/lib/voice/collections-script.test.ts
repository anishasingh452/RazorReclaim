import { describe, expect, it } from "vitest";
import { buildCollectionsScript, type ScriptLanguage } from "./collections-script";

describe("buildCollectionsScript", () => {
  it("greets the customer by name and includes the formatted amount", () => {
    const script = buildCollectionsScript({
      customerName: "Priya",
      amount: 3049,
      riskType: "failed_payment",
      contactAttempts: 0,
    });
    expect(script).toContain("Priya");
    expect(script).toContain("₹3,049");
  });

  it("uses a fresh-outreach opening on the first attempt", () => {
    const script = buildCollectionsScript({
      customerName: "Rahul",
      amount: 1000,
      riskType: "failed_payment",
      contactAttempts: 0,
    });
    expect(script).toContain("baat kar raha hoon");
    expect(script).not.toContain("dubara");
  });

  it("uses a follow-up opening once there have been prior attempts", () => {
    const script = buildCollectionsScript({
      customerName: "Rahul",
      amount: 1000,
      riskType: "failed_payment",
      contactAttempts: 2,
    });
    expect(script).toContain("dubara");
  });

  it("produces risk-type-specific context for every risk type", () => {
    const riskTypes = ["failed_payment", "checkout_abandonment", "subscription_failure", "overdue_receivable"] as const;
    const scripts = riskTypes.map((rt) =>
      buildCollectionsScript({ customerName: "Test", amount: 500, riskType: rt, contactAttempts: 0 })
    );
    expect(new Set(scripts).size).toBe(riskTypes.length); // all distinct
  });

  it("is deterministic for identical input", () => {
    const input = { customerName: "Priya", amount: 500, riskType: "failed_payment" as const, contactAttempts: 1 };
    expect(buildCollectionsScript(input)).toBe(buildCollectionsScript(input));
  });

  it("defaults to Hinglish when no language is given", () => {
    const script = buildCollectionsScript({
      customerName: "Priya",
      amount: 500,
      riskType: "failed_payment",
      contactAttempts: 0,
    });
    expect(script).toContain("Namaste");
    expect(script).toContain("payment complete nahi ho paya");
  });

  it("produces English, Hindi, and Hinglish variants that are distinct and correctly scripted", () => {
    const base = { customerName: "Priya", amount: 500, riskType: "failed_payment" as const, contactAttempts: 0 };

    const english = buildCollectionsScript({ ...base, language: "english" });
    expect(english).toContain("Hello Priya");
    expect(english).toContain("did not go through");
    expect(english).not.toMatch(/[ऀ-ॿ]/); // no Devanagari

    const hindi = buildCollectionsScript({ ...base, language: "hindi" });
    expect(hindi).toMatch(/[ऀ-ॿ]/); // contains Devanagari
    expect(hindi).toContain("नमस्ते Priya");

    const hinglish = buildCollectionsScript({ ...base, language: "hinglish" });
    expect(hinglish).toContain("Namaste Priya");
    expect(hinglish).not.toMatch(/[ऀ-ॿ]/);

    expect(new Set([english, hindi, hinglish]).size).toBe(3);
  });

  it("produces risk-type-specific context in every language", () => {
    const languages: ScriptLanguage[] = ["english", "hindi", "hinglish"];
    for (const language of languages) {
      const riskTypes = ["failed_payment", "checkout_abandonment", "subscription_failure", "overdue_receivable"] as const;
      const scripts = riskTypes.map((rt) =>
        buildCollectionsScript({ customerName: "Test", amount: 500, riskType: rt, contactAttempts: 0, language })
      );
      expect(new Set(scripts).size).toBe(riskTypes.length);
    }
  });
});
