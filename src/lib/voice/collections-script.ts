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
  /** Spoken currency word, appended after the digits. */
  currency: string;
}

/**
 * Amounts are spoken, not read, so they are formatted for a text-to-speech
 * engine rather than for a screen. "₹1,13,153.86" was being voiced with the
 * symbol mispronounced and the Indian digit grouping mangled; plain
 * international grouping with the currency spelled out as a word gives
 * "one hundred thirteen thousand, one hundred fifty-three rupees". Paise are
 * dropped because no one says them out loud on a collections call.
 */
function spokenAmount(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString("en-US")} ${currency}`;
}

const PARTS_BY_LANGUAGE: Record<ScriptLanguage, ScriptParts> = {
  english: {
    greeting: (name) => `Hello ${name},`,
    opening: (attempts) =>
      attempts === 0
        ? "this is a call from the RazorReclaim accounts team."
        : "this is the RazorReclaim accounts team, following up again.",
    context: {
      failed_payment: (amount) => `Your recent payment of ${amount} did not go through.`,
      checkout_abandonment: (amount) =>
        `You started an order for ${amount}, but the payment was never completed.`,
      subscription_failure: (amount) => `Your subscription renewal of ${amount} has failed.`,
      overdue_receivable: (amount) => `Your invoice for ${amount} is still outstanding.`,
    },
    ask: "Could you complete the payment today? If something is blocking it, please let us know and we will help you sort it out. Thank you for your time.",
    currency: "rupees",
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
    currency: "रुपये",
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
    currency: "rupees",
  },
};

/**
 * Builds a short, natural collections script for a case in the requested
 * language (English, Hindi, or Hinglish — default English) — the real text
 * fed to ElevenLabs' TTS API for a genuine (not scripted-sounding) audio
 * artifact. Pure and deterministic given the same input, independent of the
 * actual audio synthesis call.
 *
 * English is the default because the synthesised Hinglish read poorly: the
 * multilingual model applies English phonetics to romanised Hindi. Both other
 * languages remain available via VOICE_LANGUAGE.
 */
export function buildCollectionsScript(input: CollectionsScriptInput): string {
  const parts = PARTS_BY_LANGUAGE[input.language ?? "english"];
  const amountText = spokenAmount(input.amount, parts.currency);
  const greeting = parts.greeting(input.customerName);
  const opening = parts.opening(input.contactAttempts);
  const context = parts.context[input.riskType](amountText);

  return `${greeting} ${opening} ${context} ${parts.ask}`;
}
