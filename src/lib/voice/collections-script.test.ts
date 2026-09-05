import { describe, expect, it } from "vitest";
import { buildCollectionsScript, type ScriptLanguage } from "./collections-script";

describe("buildCollectionsScript", () => {
  it("greets the customer by name and speaks the amount as words a TTS engine can read", () => {
    const script = buildCollectionsScript({
      customerName: "Priya",
      amount: 3049,
      riskType: "failed_payment",
      contactAttempts: 0,
    });
    expect(script).toContain("Priya");
    expect(script).toContain("3,049 rupees");
    // The rupee symbol and Indian digit grouping were both mispronounced by
    // the TTS model, so neither may come back.
    expect(script).not.toContain("₹");
  });

  it("drops paise, which nobody reads aloud on a call", () => {
    const script = buildCollectionsScript({
      customerName: "Priya",
      amount: 67862.66,
      riskType: "overdue_receivable",
      contactAttempts: 0,
    });
    expect(script).toContain("67,863 rupees");
    expect(script).not.toContain(".66");
  });

  it("uses a fresh-outreach opening on the first attempt", () => {
    const script = buildCollectionsScript({
      customerName: "Rahul",
      amount: 1000,
      riskType: "failed_payment",
      contactAttempts: 0,
    });
    expect(script).toContain("this is a call from the RazorReclaim accounts team");
    expect(script).not.toContain("following up again");
  });

  it("uses a follow-up opening once there have been prior attempts", () => {
    const script = buildCollectionsScript({
      customerName: "Rahul",
      amount: 1000,
      riskType: "failed_payment",
      contactAttempts: 2,
    });
    expect(script).toContain("following up again");
  });

  it("keeps the Hinglish first/follow-up distinction for that language option", () => {
    const base = { customerName: "Rahul", amount: 1000, riskType: "failed_payment" as const, language: "hinglish" as const };
    expect(buildCollectionsScript({ ...base, contactAttempts: 0 })).toContain("baat kar raha hoon");
    expect(buildCollectionsScript({ ...base, contactAttempts: 0 })).not.toContain("dubara");
    expect(buildCollectionsScript({ ...base, contactAttempts: 2 })).toContain("dubara");
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

  it("defaults to English, which the TTS model reads most clearly", () => {
    const script = buildCollectionsScript({
      customerName: "Priya",
      amount: 500,
      riskType: "failed_payment",
      contactAttempts: 0,
    });
    expect(script).toContain("Hello Priya");
    expect(script).toContain("did not go through");
    expect(script).not.toContain("Namaste");
  });

  it("produces English, Hindi, and Hinglish variants that are distinct and correctly scripted", () => {
    const base = { customerName: "Priya", amount: 500, riskType: "failed_payment" as const, contactAttempts: 0 };

    const english = buildCollectionsScript({ ...base, language: "english" });
    expect(english).toContain("Hello Priya");
    expect(english).toContain("did not go through");
    expect(english).toContain("rupees");
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
