import { getServiceClient } from "@/lib/db/service-client";
import { verifyChain, type ChainedAuditRow } from "@/lib/audit/hash-chain";
import type {
  AgentConflict,
  AgentProposal,
  Approval,
  AuditChainIntegrity,
  AuditEvent,
  Case,
  CustomerHistoryEntry,
  Decision,
  Evidence,
  Execution,
  ImpactScore,
  NoActionDecision,
  PolicyCheck,
  PromiseToPay,
  ScheduledAction,
  Signal,
  Verification,
  VoiceInteraction,
} from "@/types/domain";

export interface CaseDetail {
  case: Case;
  evidence: Evidence[];
  decisions: Decision[];
  impactScores: ImpactScore[];
  policyChecks: PolicyCheck[];
  executions: Execution[];
  verifications: Verification[];
  auditLog: AuditEvent[];
  approvals: Approval[];
  // Agent Command Center layer — the governance record above the action itself.
  signal: Signal | null;
  agentProposals: AgentProposal[];
  agentConflicts: AgentConflict[];
  noActionDecision: NoActionDecision | null;
  scheduledActions: ScheduledAction[];
  voiceInteractions: VoiceInteraction[];
  promisesToPay: PromiseToPay[];
  customerHistory: CustomerHistoryEntry[];
  auditChainIntegrity: AuditChainIntegrity;
}

/**
 * Re-verifies the case's audit trail on every read, rather than trusting the
 * stored hashes. Rows written before the hash-chain migration have null
 * hashes and are excluded from verification (they're reported separately as
 * `unchainedRows` so the UI can be honest about partial coverage instead of
 * silently claiming a shorter chain is whole).
 */
function checkChainIntegrity(auditLog: AuditEvent[]): AuditChainIntegrity {
  const chained = auditLog.filter((a): a is AuditEvent & { prev_hash: string; hash: string } =>
    a.prev_hash !== null && a.hash !== null
  );
  const brokenAtIndex = chained.length > 0 ? verifyChain(chained as unknown as ChainedAuditRow[]) : null;

  return {
    intact: brokenAtIndex === null,
    brokenAtIndex,
    chainedRows: chained.length,
    unchainedRows: auditLog.length - chained.length,
  };
}

export async function getCaseDetail(id: string): Promise<CaseDetail | null> {
  const supabase = getServiceClient();

  const { data: caseRecord, error } = await supabase.from("cases").select("*").eq("id", id).single();
  if (error || !caseRecord) return null;

  const [
    evidence,
    decisions,
    impactScores,
    policyChecks,
    executions,
    verifications,
    auditLog,
    approvals,
    signal,
    agentProposals,
    agentConflicts,
    noActionDecisions,
    scheduledActions,
    voiceInteractions,
    promisesToPay,
    customerHistory,
  ] = await Promise.all([
    supabase.from("evidence").select("*").eq("case_id", id),
    supabase.from("decisions").select("*").eq("case_id", id).order("created_at"),
    supabase.from("impact_scores").select("*").eq("case_id", id).order("expected_recovery_value", { ascending: false }),
    supabase.from("policy_checks").select("*").eq("case_id", id).order("created_at"),
    supabase.from("executions").select("*").eq("case_id", id).order("created_at"),
    supabase.from("verifications").select("*").eq("case_id", id).order("verified_at"),
    supabase.from("audit_log").select("*").eq("case_id", id).order("created_at"),
    supabase.from("approvals").select("*").eq("case_id", id).order("created_at"),
    caseRecord.signal_id
      ? supabase.from("signals").select("*").eq("id", caseRecord.signal_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("agent_proposals").select("*").eq("case_id", id).order("created_at"),
    supabase.from("agent_conflicts").select("*").eq("case_id", id).order("created_at"),
    supabase.from("no_action_decisions").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("scheduled_actions").select("*").eq("case_id", id).order("scheduled_for"),
    supabase.from("voice_interactions").select("*").eq("case_id", id).order("created_at"),
    supabase.from("promises_to_pay").select("*").eq("case_id", id).order("created_at"),
    // The customer's cross-case memory, excluding this case — "what we've
    // already learned about this person" is only interesting as context.
    supabase
      .from("decision_memory")
      .select("*, cases(risk_type, amount, status)")
      .eq("customer_id", caseRecord.customer_id)
      .neq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const log = (auditLog.data ?? []) as AuditEvent[];

  return {
    case: caseRecord,
    evidence: evidence.data ?? [],
    decisions: decisions.data ?? [],
    impactScores: impactScores.data ?? [],
    policyChecks: policyChecks.data ?? [],
    executions: executions.data ?? [],
    verifications: verifications.data ?? [],
    auditLog: log,
    approvals: approvals.data ?? [],
    signal: (signal.data as Signal | null) ?? null,
    agentProposals: (agentProposals.data ?? []) as AgentProposal[],
    agentConflicts: (agentConflicts.data ?? []) as AgentConflict[],
    noActionDecision: ((noActionDecisions.data ?? [])[0] as NoActionDecision | undefined) ?? null,
    scheduledActions: (scheduledActions.data ?? []) as ScheduledAction[],
    voiceInteractions: (voiceInteractions.data ?? []) as VoiceInteraction[],
    promisesToPay: (promisesToPay.data ?? []) as PromiseToPay[],
    customerHistory: flattenHistory(customerHistory.data ?? []),
    auditChainIntegrity: checkChainIntegrity(log),
  };
}

type HistoryRow = Record<string, unknown> & {
  cases?: { risk_type: string; amount: number; status: string } | null;
};

/** Flattens PostgREST's embedded `cases` object up onto each memory row. */
function flattenHistory(rows: HistoryRow[]): CustomerHistoryEntry[] {
  return rows.map((row) => {
    const { cases, ...rest } = row;
    return {
      ...rest,
      case_risk_type: cases?.risk_type ?? null,
      case_amount: cases?.amount ?? null,
      case_status: cases?.status ?? null,
    } as CustomerHistoryEntry;
  });
}
