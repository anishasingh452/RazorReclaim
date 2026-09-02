import type { RiskType } from "@/types/domain";

export interface CollectionsScriptInput {
  customerName: string;
  amount: number;
  riskType: RiskType;
  contactAttempts: number;
}

const OPENING_BY_ATTEMPTS = (attempts: number) =>
  attempts === 0
    ? "Main RazorReclaim se baat kar raha hoon."
    : "Main RazorReclaim se dubara call kar raha hoon.";

const CONTEXT_BY_RISK_TYPE: Record<RiskType, (amount: string) => string> = {
  failed_payment: (amount) => `Aapka ${amount} ka payment complete nahi ho paya.`,
  checkout_abandonment: (amount) => `Aapne ${amount} ka order start kiya tha, lekin payment complete nahi hua.`,
  subscription_failure: (amount) => `Aapka subscription ka ${amount} ka payment fail ho gaya hai.`,
  overdue_receivable: (amount) => `Aapka ${amount} ka invoice abhi tak pending hai.`,
};

/**
 * Builds a short, natural Hinglish collections script for a case — the real
 * text fed to ElevenLabs' TTS API for a genuine (not scripted-sounding)
 * audio artifact. Pure and deterministic given the same input, independent
 * of the actual audio synthesis call.
 */
export function buildCollectionsScript(input: CollectionsScriptInput): string {
  const amountText = `₹${input.amount.toLocaleString("en-IN")}`;
  const greeting = `Namaste ${input.customerName} ji,`;
  const opening = OPENING_BY_ATTEMPTS(input.contactAttempts);
  const context = CONTEXT_BY_RISK_TYPE[input.riskType](amountText);
  const ask = "Kya aap ise aaj complete kar sakte hain? Agar koi dikkat ho to bataiye, hum madad kar sakte hain.";

  return `${greeting} ${opening} ${context} ${ask}`;
}
