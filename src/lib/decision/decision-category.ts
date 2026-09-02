import type { ActionType, DecisionCategory } from "@/types/domain";

const ACT_ACTIONS: ActionType[] = ["retry", "payment_link", "reminder", "voice"];

/** Collapses the 8-way unified action vocabulary into the Command Center's 5-way meta-decision. */
export function toDecisionCategory(action: ActionType): DecisionCategory {
  if (ACT_ACTIONS.includes(action)) return "ACT";
  if (action === "wait_and_retry") return "WAIT";
  if (action === "escalate") return "ESCALATE";
  if (action === "no_action") return "NO_ACTION";
  return "STOP";
}
