import { getServiceClient } from "@/lib/db/service-client";
import { verifyNode } from "@/lib/langgraph/nodes/verify";
import { appendAudit } from "@/lib/langgraph/audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import { classifyStuckCase, type RecoveryAction } from "./stuck-case-policy";
import type { CaseGraphState } from "@/lib/langgraph/state";
import type { Case, CaseStatus } from "@/types/domain";
import type { ImpactCandidate } from "@/lib/impact/engine";

/**
 * Per-case working tables written between detectNode and the
 * execute/escalate/defer routing decision. Deliberately NOT audit_log (that
 * chain is never touched — see resetCaseForReprocessing) and NOT executions/
 * verifications/scheduled_actions/decision_memory/voice_interactions/
 * promises_to_pay (those record something that durably happened and must
 * never be erased).
 */
const REDOABLE_TABLES = [
  "decisions",
  "impact_scores",
  "policy_checks",
  "agent_proposals",
  "agent_conflicts",
  "no_action_decisions",
] as const;

export interface RecoverStuckCasesResult {
  recovered: number;
  skipped: number;
}

export interface RecoveredCaseEvent {
  caseId: string;
  action: RecoveryAction["type"];
}

/**
 * Finds every case in this batch stuck at `status = 'in_progress'` and
 * either repairs or safely restarts it. Called at the top of every
 * `runBatch` invocation — cheap when there's nothing to do (a single query
 * that returns empty for the overwhelmingly common case of a batch with no
 * interrupted run behind it), and self-healing when there is: a case this
 * function resets to `open` is picked up by the very same `runBatch` call's
 * normal `open`-cases query right after.
 *
 * Never re-triggers a real or simulated external action a second time — see
 * stuck-case-policy.ts for the full decision table and its reasoning.
 */
export async function recoverStuckCases(
  batchId: string,
  onEvent?: (event: RecoveredCaseEvent) => void,
  /** Overrides "now" for the staleness check — production callers never pass this; it exists so tests don't need to wait out a real 5-minute window. */
  now: number = Date.now()
): Promise<RecoverStuckCasesResult> {
  const supabase = getServiceClient();

  const { data: stuckCases, error } = await supabase
    .from("cases")
    .select("id, updated_at")
    .eq("batch_id", batchId)
    .eq("status", "in_progress");
  if (error) throw new Error(`recoverStuckCases: failed to load in_progress cases: ${error.message}`);
  if (!stuckCases || stuckCases.length === 0) return { recovered: 0, skipped: 0 };

  let recovered = 0;
  let skipped = 0;

  for (const stuck of stuckCases) {
    const [lastAuditRow, executionRows, pendingApprovalRows] = await Promise.all([
      supabase
        .from("audit_log")
        .select("created_at")
        .eq("case_id", stuck.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("executions").select("*").eq("case_id", stuck.id).order("created_at", { ascending: false }).limit(1),
      supabase.from("approvals").select("id").eq("case_id", stuck.id).eq("status", "pending").limit(1),
    ]);

    const latestExecutionRow = executionRows.data?.[0] ?? null;

    let hasVerification = false;
    let verificationVerified: boolean | null = null;
    if (latestExecutionRow && (latestExecutionRow.action_type === "retry" || latestExecutionRow.action_type === "voice")) {
      const { data: verification } = await supabase
        .from("verifications")
        .select("verified")
        .eq("execution_id", latestExecutionRow.id)
        .maybeSingle();
      hasVerification = !!verification;
      verificationVerified = verification?.verified ?? null;
    }

    const action = classifyStuckCase({
      lastActivityAt: computeLastActivityAt(stuck.updated_at, lastAuditRow.data?.created_at ?? null),
      now,
      latestExecution: latestExecutionRow
        ? { actionType: latestExecutionRow.action_type, status: latestExecutionRow.status }
        : null,
      hasVerification,
      verificationVerified,
      hasPendingApproval: (pendingApprovalRows.data?.length ?? 0) > 0,
    });

    switch (action.type) {
      case "skip_active":
      case "skip_awaiting_webhook":
        skipped++;
        continue;
      case "reset_to_open":
        await resetCaseForReprocessing(stuck.id);
        break;
      case "resume_verify":
        await resumeVerification(stuck.id, latestExecutionRow!);
        break;
      case "correct_status":
        await correctCaseStatus(stuck.id, action.status);
        break;
    }
    recovered++;
    onEvent?.({ caseId: stuck.id, action: action.type });
  }

  return { recovered, skipped };
}

/** The later of the case row's own `updated_at` and its most recent audit event — see stuck-case-policy.ts's staleness rationale. */
function computeLastActivityAt(caseUpdatedAt: string, lastAuditCreatedAt: string | null): string {
  if (!lastAuditCreatedAt) return caseUpdatedAt;
  return new Date(lastAuditCreatedAt).getTime() > new Date(caseUpdatedAt).getTime() ? lastAuditCreatedAt : caseUpdatedAt;
}

/**
 * Restarts a case's decision phase from scratch — safe because nothing
 * external ever happened for this attempt (classifyStuckCase only reaches
 * this branch when no execution row exists).
 *
 * A case can have gone through a fully-completed prior pass before this one
 * (deferNode returns a case to `open` after a complete pass, so a
 * subsequently-interrupted second attempt is possible) — that prior pass's
 * decisions/impact_scores/policy_checks/proposals rows are real history, not
 * debris, so only rows written AFTER the most recent `scheduled_actions`
 * entry (deferNode's own durable marker of "a pass completed here") are
 * cleared. With no such marker, this is a first attempt and everything is
 * this attempt's own incomplete data.
 *
 * audit_log itself is never touched — the interrupted attempt's events stay
 * in the permanent, hash-chained record forever; this function only ever
 * appends a new CASE_RECOVERED event on top of it.
 */
async function resetCaseForReprocessing(caseId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: lastCompletedPass } = await supabase
    .from("scheduled_actions")
    .select("created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const boundary = lastCompletedPass?.created_at ?? null;

  await appendAudit(caseId, AUDIT_EVENT.CASE_RECOVERED, "system", {
    reason: "Case was left in_progress by an interrupted run — clearing this attempt's partial reasoning and reprocessing.",
    cleared_rows_after: boundary,
  });

  await Promise.all(
    REDOABLE_TABLES.map((table) => {
      const query = supabase.from(table).delete().eq("case_id", caseId);
      return boundary ? query.gt("created_at", boundary) : query;
    })
  );

  // Cleared alongside the working tables above: it's a single mutable
  // column (not a history), and leaving a stale value from the discarded
  // attempt would show a decided-looking action badge on a case whose
  // status just went back to `open`.
  await supabase.from("cases").update({ status: "open", final_action: null }).eq("id", caseId);
}

/**
 * Completes verification for a case whose execution already succeeded but
 * whose verify step never ran — reuses the real verifyNode, which is
 * deterministic (seeded by case id), so this reproduces exactly the outcome
 * the interrupted run would have recorded. Only ever called once per case:
 * the caller only reaches this branch when no verification row exists yet.
 */
async function resumeVerification(
  caseId: string,
  execution: { id: string; action_type: string }
): Promise<void> {
  const supabase = getServiceClient();

  const [{ data: caseRecord, error: caseError }, { data: selectedImpact, error: impactError }] = await Promise.all([
    supabase.from("cases").select("*").eq("id", caseId).single(),
    supabase.from("impact_scores").select("*").eq("case_id", caseId).eq("selected", true).maybeSingle(),
  ]);
  if (caseError || !caseRecord) throw new Error(`resumeVerification: case ${caseId} not found: ${caseError?.message}`);
  if (impactError || !selectedImpact) {
    throw new Error(`resumeVerification: no selected impact score for case ${caseId}: ${impactError?.message}`);
  }

  await appendAudit(caseId, AUDIT_EVENT.CASE_RECOVERED, "system", {
    reason: "Execution had already completed before an interruption — resuming verification only, no action re-executed.",
    execution_id: execution.id,
  });

  const state: CaseGraphState = {
    caseId,
    caseRecord: caseRecord as Case,
    evidence: [],
    rootCause: null,
    rootCauseModel: null,
    recommendation: null,
    recommendationModel: null,
    agentProposals: [],
    sharedContext: null,
    impactCandidates: [],
    selectedImpact: selectedImpact as unknown as ImpactCandidate,
    policyDecision: null,
    finalAction: execution.action_type as CaseGraphState["finalAction"],
    executionResult: execution as unknown as CaseGraphState["executionResult"],
    verification: null,
  };

  await verifyNode(state);
}

async function correctCaseStatus(caseId: string, status: CaseStatus): Promise<void> {
  const supabase = getServiceClient();

  await appendAudit(caseId, AUDIT_EVENT.CASE_RECOVERED, "system", {
    reason: `This case's durable outcome already existed but its status column was never updated to match — correcting to '${String(status)}'.`,
  });

  await supabase.from("cases").update({ status }).eq("id", caseId);
}
