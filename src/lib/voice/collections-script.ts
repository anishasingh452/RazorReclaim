import type { RiskType } from "@/types/domain";

export type ScriptLanguage = "english" | "hindi" | "hinglish";

export interface CollectionsScriptInput {
  customerName: string;
  amount: number;
  riskType: RiskType;
  contactAttempts: number;
  language?: ScriptLanguage;
}

interface ScriptParts {
  greeting: (name: string) => string;
  opening: (attempts: number) => string;
  context: Record<RiskType, (amount: string) => string>;
  ask: string;
}

const PARTS_BY_LANGUAGE: Record<ScriptLanguage, ScriptParts> = {
  english: {
    greeting: (name) => `Hello ${name},`,
    opening: (attempts) =>
      attempts === 0
        ? "this is RazorReclaim calling."
        : "this is RazorReclaim calling again.",
    context: {
      failed_payment: (amount) => `Your payment of ${amount} did not go through.`,
      checkout_abandonment: (amount) => `You started an order of ${amount}, but the payment wasn't completed.`,
      subscription_failure: (amount) => `Your subscription payment of ${amount} has failed.`,
      overdue_receivable: (amount) => `Your invoice of ${amount} is still pending.`,
    },
    ask: "Could you complete it today? If there's an issue, let us know — we're happy to help.",
  },
  hindi: {
    greeting: (name) => `नमस्ते ${name} जी,`,
    opening: (attempts) =>
      attempts === 0 ? "मैं RazorReclaim से बात कर रहा हूँ।" : "मैं RazorReclaim से दोबारा कॉल कर रहा हूँ।",
    context: {
      failed_payment: (amount) => `आपका ${amount} का भुगतान पूरा नहीं हो पाया।`,
      checkout_abandonment: (amount) => `आपने ${amount} का ऑर्डर शुरू किया था, लेकिन भुगतान पूरा नहीं हुआ।`,
      subscription_failure: (amount) => `आपकी सब्सक्रिप्शन का ${amount} का भुगतान असफल हो गया है।`,
      overdue_receivable: (amount) => `आपका ${amount} का इनवॉइस अभी तक लंबित है।`,
    },
    ask: "क्या आप इसे आज पूरा कर सकते हैं? अगर कोई दिक्कत हो तो बताइए, हम मदद कर सकते हैं।",
  },
  hinglish: {
    greeting: (name) => `Namaste ${name} ji,`,
    opening: (attempts) =>
      attempts === 0
        ? "Main RazorReclaim se baat kar raha hoon."
        : "Main RazorReclaim se dubara call kar raha hoon.",
    context: {
      failed_payment: (amount) => `Aapka ${amount} ka payment complete nahi ho paya.`,
      checkout_abandonment: (amount) => `Aapne ${amount} ka order start kiya tha, lekin payment complete nahi hua.`,
      subscription_failure: (amount) => `Aapka subscription ka ${amount} ka payment fail ho gaya hai.`,
      overdue_receivable: (amount) => `Aapka ${amount} ka invoice abhi tak pending hai.`,
    },
    ask: "Kya aap ise aaj complete kar sakte hain? Agar koi dikkat ho to bataiye, hum madad kar sakte hain.",
  },
};

/**
 * Builds a short, natural collections script for a case in the requested
 * language (English, Hindi, or Hinglish — default Hinglish) — the real text
 * fed to ElevenLabs' TTS API for a genuine (not scripted-sounding) audio
 * artifact. Pure and deterministic given the same input, independent of the
 * actual audio synthesis call.
 */
export function buildCollectionsScript(input: CollectionsScriptInput): string {
  const parts = PARTS_BY_LANGUAGE[input.language ?? "hinglish"];
  const amountText = `₹${input.amount.toLocaleString("en-IN")}`;
  const greeting = parts.greeting(input.customerName);
  const opening = parts.opening(input.contactAttempts);
  const context = parts.context[input.riskType](amountText);

  return `${greeting} ${opening} ${context} ${parts.ask}`;
}
