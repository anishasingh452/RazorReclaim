import { createRng } from "@/lib/generator/rng";
import type { VoiceCallOutcome, VoiceCallStatus } from "@/types/domain";

export interface SimulatedCallInput {
  caseId: string;
  amount: number;
  recoveryProbability: number;
}

export interface SimulatedCallResult {
  call_status: VoiceCallStatus;
  duration_seconds: number;
  outcome: VoiceCallOutcome;
  transcript_summary: string;
  /** Set only when outcome === 'promise_to_pay'. */
  promiseToPay: { promisedAmount: number; promisedInDays: number } | null;
}

/**
 * No real telephony provider is wired up (none was in scope) — this is a
 * clearly-labeled simulation, deterministic per case id so repeated runs
 * during testing/demo are reproducible, and its outcome distribution is
 * anchored to the same recovery_probability the Business Impact Engine
 * already computed rather than an unrelated random draw.
 */
export function simulateVoiceCall(input: SimulatedCallInput): SimulatedCallResult {
  const rng = createRng(`${input.caseId}:voice`);
  const p = input.recoveryProbability;

  // Call connection itself succeeds most of the time; failure modes first.
  const connectRoll = rng();
  if (connectRoll < 0.12) {
    return {
      call_status: "no_answer",
      duration_seconds: 0,
      outcome: "no_response",
      transcript_summary: "Call not answered after multiple rings.",
      promiseToPay: null,
    };
  }
  if (connectRoll < 0.22) {
    return {
      call_status: "voicemail",
      duration_seconds: 12,
      outcome: "no_response",
      transcript_summary: "Reached voicemail; left a callback message.",
      promiseToPay: null,
    };
  }

  // Connected — outcome distribution scales with recovery_probability.
  const outcomeRoll = rng();
  const duration_seconds = 45 + Math.floor(rng() * 180);

  if (outcomeRoll < p) {
    const promisedInDays = 2 + Math.floor(rng() * 6);
    return {
      call_status: "completed",
      duration_seconds,
      outcome: "promise_to_pay",
      transcript_summary: `Customer confirmed intent to pay; committed to settling within ${promisedInDays} days.`,
      promiseToPay: { promisedAmount: input.amount, promisedInDays },
    };
  }
  if (outcomeRoll < p + (1 - p) * 0.4) {
    return {
      call_status: "completed",
      duration_seconds,
      outcome: "callback_requested",
      transcript_summary: "Customer asked to be contacted again at a later time.",
      promiseToPay: null,
    };
  }
  if (outcomeRoll < p + (1 - p) * 0.7) {
    return {
      call_status: "declined",
      duration_seconds,
      outcome: "refused",
      transcript_summary: "Customer declined to commit to payment during the call.",
      promiseToPay: null,
    };
  }
  return {
    call_status: "completed",
    duration_seconds,
    outcome: "resolved",
    transcript_summary: "Issue discussed and resolved on the call without a firm payment commitment.",
    promiseToPay: null,
  };
}
