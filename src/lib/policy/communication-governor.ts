import type { CommunicationGovernorResult, PromiseToPay } from "@/types/domain";
import { COOLDOWN_HOURS, HARASSMENT_HARD_CAP, MAX_COMMUNICATION_ATTEMPTS } from "./config";

export interface CommunicationGovernorInput {
  contactAttempts: number;
  hoursSinceLastExecution: number | null;
  /** A pending, not-yet-due promise-to-pay means contacting again now would contradict the customer's own commitment. */
  activePromise: PromiseToPay | null;
}

/**
 * Central, reusable pre-check any agent can call before sending a
 * communication (email/link/voice) — independent of, but numerically
 * consistent with, the deterministic caps evaluatePolicy() enforces as the
 * final gate on the actual selected action. This function exists so that
 * OTHER agents (not just the one recovery pipeline) have one shared place
 * to ask "is it okay for me to contact this customer right now", rather
 * than every agent re-implementing its own cooldown/frequency logic.
 */
export function communicationGovernor(input: CommunicationGovernorInput): CommunicationGovernorResult {
  if (input.contactAttempts >= HARASSMENT_HARD_CAP) {
    return { decision: "BLOCK", reason: `Hard cap of ${HARASSMENT_HARD_CAP} contact attempts already reached.` };
  }

  if (input.activePromise) {
    const promisedDate = new Date(input.activePromise.promised_date);
    if (promisedDate.getTime() > Date.now()) {
      return {
        decision: "DELAY",
        reason: `An active promise-to-pay exists for ${input.activePromise.promised_date} — contacting now would contradict it.`,
      };
    }
  }

  if (input.contactAttempts >= MAX_COMMUNICATION_ATTEMPTS) {
    return {
      decision: "BLOCK",
      reason: `${input.contactAttempts}/${MAX_COMMUNICATION_ATTEMPTS} communication attempts already used.`,
    };
  }

  if (input.hoursSinceLastExecution !== null && input.hoursSinceLastExecution < COOLDOWN_HOURS) {
    return {
      decision: "DELAY",
      reason: `Only ${input.hoursSinceLastExecution}h since the last contact (< ${COOLDOWN_HOURS}h cooldown).`,
    };
  }

  return { decision: "ALLOW", reason: "Within communication frequency, cooldown, and promise-to-pay constraints." };
}
