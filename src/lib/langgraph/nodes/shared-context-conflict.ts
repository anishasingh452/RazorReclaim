import { getServiceClient } from "@/lib/db/service-client";
import { getSharedCaseContext } from "@/lib/memory/shared-context";
import { detectConflicts } from "@/lib/agents/conflict-detection";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * Shared Agent Memory check, then Conflict Detection over this case's agent
 * proposals. Conflicts are recorded with `resolution: null` here —
 * resolution is the existing Business Impact Engine's job (it picks the
 * ERV-winning action regardless of which agent proposed it); this node
 * only flags what kind of disagreement existed, for the decision graph.
 */
export async function sharedContextConflictNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.agentProposals) throw new Error("sharedContextConflictNode: agentProposals missing from state");
  const supabase = getServiceClient();

  const sharedContext = await getSharedCaseContext(state.caseId);
  await appendAudit(state.caseId, AUDIT_EVENT.SHARED_MEMORY_CHECKED, "system", {
    prior_decisions_count: sharedContext.priorDecisions.length,
    has_active_promise: sharedContext.activePromise !== null,
    pending_scheduled_actions: sharedContext.pendingScheduledActions.length,
    prior_execution_count: sharedContext.priorExecutionCount,
  });

  const conflicts = detectConflicts(
    state.agentProposals.map((p) => ({
      id: p.id,
      agentName: p.agent_name,
      proposedAction: p.proposed_action,
      proposedChannel: p.proposed_channel,
    }))
  );

  if (conflicts.length > 0) {
    const { error } = await supabase.from("agent_conflicts").insert(
      conflicts.map((c) => ({
        case_id: state.caseId,
        conflict_type: c.conflictType,
        proposal_ids: c.proposalIds,
        resolution: null,
        winning_proposal_id: null,
        detail: { message: c.detail },
      }))
    );
    if (error) throw new Error(`sharedContextConflictNode: failed to persist conflicts: ${error.message}`);
  }

  await appendAudit(state.caseId, AUDIT_EVENT.CONFLICT_DETECTED, "conflict_engine", {
    conflict_count: conflicts.length,
    conflicts: conflicts.map((c) => ({ type: c.conflictType, detail: c.detail })),
  });

  return { sharedContext };
}
