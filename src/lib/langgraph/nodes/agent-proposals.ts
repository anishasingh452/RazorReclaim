import { getServiceClient } from "@/lib/db/service-client";
import { proposeChannelStrategy } from "@/lib/agents/channel-strategy-agent";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";
import type { ActionType, AgentProposal } from "@/types/domain";

const COMMS_CHANNEL_BY_ACTION: Partial<Record<ActionType, string>> = {
  payment_link: "email",
  reminder: "email",
  voice: "voice",
};

/**
 * Formalizes the LLM's own recommendation as one agent's proposal, and asks
 * a second, independent, rule-based agent (channel_strategy_agent) for its
 * own — giving the next node (conflict detection) something genuine to
 * reconcile. The second agent self-censors through the Communication
 * Governor before proposing a channel, using lightweight cooldown/promise
 * context fetched here rather than the fuller cross-case shared-memory
 * pull (that happens next, for conflict/audit narrative purposes).
 */
export async function agentProposalsNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.caseRecord) throw new Error("agentProposalsNode: caseRecord missing from state");
  if (!state.recommendation) throw new Error("agentProposalsNode: recommendation missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const [{ data: promiseRows }, { data: execRows }] = await Promise.all([
    supabase
      .from("promises_to_pay")
      .select("*")
      .eq("case_id", state.caseId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("executions").select("created_at").eq("case_id", state.caseId).order("created_at", { ascending: false }),
  ]);
  const activePromise = promiseRows?.[0] ?? null;
  const hoursSinceLastExecution =
    execRows && execRows.length > 0
      ? Math.round((Date.now() - new Date(execRows[0].created_at).getTime()) / 3_600_000)
      : null;

  const channelStrategy = proposeChannelStrategy({
    riskType: c.risk_type,
    amount: c.amount,
    contactAttempts: c.contact_attempts,
    governorInput: { contactAttempts: c.contact_attempts, hoursSinceLastExecution, activePromise },
  });

  const proposalRows = [
    {
      case_id: state.caseId,
      agent_name: "ai_recovery_agent",
      proposed_action: state.recommendation.suggested_action,
      proposed_channel: COMMS_CHANNEL_BY_ACTION[state.recommendation.suggested_action] ?? null,
      confidence: state.recommendation.confidence,
      rationale: state.recommendation.evidence_summary.join(" "),
    },
    {
      case_id: state.caseId,
      agent_name: "channel_strategy_agent",
      proposed_action: channelStrategy.proposedAction,
      proposed_channel: channelStrategy.proposedChannel,
      confidence: channelStrategy.confidence,
      rationale: channelStrategy.rationale,
    },
  ];

  const { data: inserted, error } = await supabase.from("agent_proposals").insert(proposalRows).select();
  if (error || !inserted) throw new Error(`agentProposalsNode: failed to persist proposals: ${error?.message}`);

  for (const p of inserted) {
    await appendAudit(state.caseId, AUDIT_EVENT.AGENT_PROPOSAL, "ai_agent", {
      agent_name: p.agent_name,
      proposed_action: p.proposed_action,
      proposed_channel: p.proposed_channel,
      confidence: p.confidence,
    });
  }

  await appendAudit(state.caseId, AUDIT_EVENT.GOVERNOR_CHECKED, "policy_engine", {
    agent: "channel_strategy_agent",
    decision: channelStrategy.governorCheck.decision,
    reason: channelStrategy.governorCheck.reason,
  });

  return { agentProposals: inserted as AgentProposal[] };
}
