import type { ActionType, ConflictType } from "@/types/domain";

export interface ProposalForConflictCheck {
  id: string;
  agentName: string;
  proposedAction: ActionType;
  proposedChannel: string | null;
}

export interface DetectedConflict {
  conflictType: ConflictType;
  proposalIds: string[];
  detail: string;
}

const ENGAGEMENT_ACTIONS: ActionType[] = ["retry", "payment_link", "reminder", "voice", "escalate"];
const TERMINAL_ACTIONS: ActionType[] = ["stop", "no_action"];
const COMMUNICATION_ACTIONS: ActionType[] = ["payment_link", "reminder", "voice"];

/**
 * Pure classification of disagreement/overlap between two or more agents'
 * proposals for the same case. This does NOT decide a winner — resolution
 * is the existing Business Impact Engine's job (ERV picks the best action
 * regardless of which agent proposed it); this just flags what kind of
 * conflict existed so it's visible in the decision graph. Returns one
 * DetectedConflict per pairwise-distinct concern, or an empty array when
 * there's nothing to reconcile (0 or 1 proposal, or full consensus).
 */
export function detectConflicts(proposals: ProposalForConflictCheck[]): DetectedConflict[] {
  if (proposals.length < 2) return [];

  const conflicts: DetectedConflict[] = [];
  const distinctActions = new Set(proposals.map((p) => p.proposedAction));

  if (distinctActions.size === 1) {
    // Full agreement is still worth recording — independent agents
    // converging on the same action must be deduplicated to a single
    // execution, not run twice.
    conflicts.push({
      conflictType: "duplicate_action",
      proposalIds: proposals.map((p) => p.id),
      detail: `${proposals.length} agents (${proposals.map((p) => p.agentName).join(", ")}) independently proposed the same action (${proposals[0].proposedAction}).`,
    });
    return conflicts;
  }

  const proposingEngagement = proposals.filter((p) => ENGAGEMENT_ACTIONS.includes(p.proposedAction));
  const proposingTerminal = proposals.filter((p) => TERMINAL_ACTIONS.includes(p.proposedAction));
  if (proposingEngagement.length > 0 && proposingTerminal.length > 0) {
    conflicts.push({
      conflictType: "contradictory_strategy",
      proposalIds: proposals.map((p) => p.id),
      detail: `${proposingEngagement.map((p) => `${p.agentName} proposes ${p.proposedAction}`).join(", ")} directly contradicts ${proposingTerminal
        .map((p) => `${p.agentName} proposing ${p.proposedAction}`)
        .join(", ")}.`,
    });
    return conflicts;
  }

  const commsProposals = proposals.filter((p) => COMMUNICATION_ACTIONS.includes(p.proposedAction));
  const distinctChannels = new Set(commsProposals.map((p) => p.proposedChannel ?? p.proposedAction));
  if (commsProposals.length > 1 && distinctChannels.size > 1) {
    conflicts.push({
      conflictType: "competing_channel",
      proposalIds: commsProposals.map((p) => p.id),
      detail: `Multiple agents propose contacting the customer via different channels at once: ${commsProposals
        .map((p) => `${p.agentName} -> ${p.proposedChannel ?? p.proposedAction}`)
        .join(", ")}.`,
    });
    return conflicts;
  }

  // Different actions, same general category, no direct contradiction —
  // still a real disagreement about strategy.
  conflicts.push({
    conflictType: "conflicting_action",
    proposalIds: proposals.map((p) => p.id),
    detail: `Agents disagree on the best action: ${proposals.map((p) => `${p.agentName} -> ${p.proposedAction}`).join(", ")}.`,
  });
  return conflicts;
}
