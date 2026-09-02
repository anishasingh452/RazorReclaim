import type { ActionType, CommunicationGovernorResult, RiskType } from "@/types/domain";
import { communicationGovernor, type CommunicationGovernorInput } from "@/lib/policy/communication-governor";

export interface ChannelStrategyInput {
  riskType: RiskType;
  amount: number;
  contactAttempts: number;
  governorInput: CommunicationGovernorInput;
}

export interface ChannelStrategyProposal {
  proposedAction: ActionType;
  proposedChannel: string | null;
  confidence: number;
  rationale: string;
  governorCheck: CommunicationGovernorResult;
}

/**
 * A second, deliberately simple and independent agent: cheap deterministic
 * business rules, no LLM call. Its purpose is to give conflict detection
 * something genuine to reconcile against the primary LLM-driven
 * recommendation — it is NOT meant to be a sophisticated recovery agent in
 * its own right (existing recovery actions are example agent capabilities,
 * not this product's differentiator). It self-censors communication-type
 * proposals through the Communication Governor before proposing them.
 */
export function proposeChannelStrategy(input: ChannelStrategyInput): ChannelStrategyProposal {
  const governorCheck = communicationGovernor(input.governorInput);

  let proposedAction: ActionType;
  let proposedChannel: string | null;
  let rationale: string;

  if (input.contactAttempts >= 2) {
    proposedAction = "escalate";
    proposedChannel = null;
    rationale = `${input.contactAttempts} prior contact attempts with no resolution — a human should take over rather than another automated touch.`;
  } else if (input.riskType === "overdue_receivable" && input.amount > 50_000) {
    proposedAction = "voice";
    proposedChannel = "voice";
    rationale = "Large B2B receivable — a direct call converts better than an email for this value tier.";
  } else if (input.riskType === "checkout_abandonment") {
    proposedAction = "reminder";
    proposedChannel = "email";
    rationale = "Cart abandonment responds well to a lightweight nudge rather than a harder ask.";
  } else if (input.riskType === "subscription_failure") {
    proposedAction = "retry";
    proposedChannel = null;
    rationale = "Subscription failures are frequently transient mandate/gateway issues worth a silent retry first.";
  } else {
    proposedAction = "payment_link";
    proposedChannel = "email";
    rationale = "Default channel-strategy play for a failed payment: a direct payment link.";
  }

  if (proposedChannel && governorCheck.decision !== "ALLOW") {
    // Self-censor: don't propose a communication action the governor
    // would immediately block/delay — fall back to a governance-aware choice.
    proposedAction = governorCheck.decision === "BLOCK" ? "no_action" : "wait_and_retry";
    proposedChannel = null;
    rationale = `Communication Governor returned ${governorCheck.decision}: ${governorCheck.reason}`;
  }

  return {
    proposedAction,
    proposedChannel,
    confidence: 0.6, // fixed — this is a rule-based agent, not a probabilistic model
    rationale,
    governorCheck,
  };
}
