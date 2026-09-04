/**
 * Canonical audit event vocabulary — this table IS the Decision Graph. Every
 * important event in a case's lifecycle uses one of these; the full chain a
 * run produces is:
 *
 *   SIGNAL_DETECTED -> CASE_CREATED -> AI_DIAGNOSIS -> AI_RECOMMENDATION
 *   -> AGENT_PROPOSAL(s) -> SHARED_MEMORY_CHECKED -> CONFLICT_DETECTED
 *   -> CANDIDATE_ACTIONS -> ERV_CALCULATED -> GOVERNOR_CHECKED
 *   -> POLICY_CHECKED -> [WHY_NOT_TO_ACT if applicable] -> FINAL_DECISION
 *   -> [ESCALATED_TO_HUMAN -> APPROVED|REJECTED] | ACTION_EXECUTED
 *   -> OUTCOME_VERIFIED
 *
 * CASE_RECOVERED is the exception to that linear shape: it can appear
 * anywhere a case was left in_progress by an interrupted run (a killed
 * server, a crashed process) and a later batch run found and repaired it.
 * See src/lib/orchestrator/recover-stuck-cases.ts.
 */
export const AUDIT_EVENT = {
  SIGNAL_DETECTED: "SIGNAL_DETECTED",
  CASE_CREATED: "CASE_CREATED",
  AI_DIAGNOSIS: "AI_DIAGNOSIS",
  AI_RECOMMENDATION: "AI_RECOMMENDATION",
  AGENT_PROPOSAL: "AGENT_PROPOSAL",
  SHARED_MEMORY_CHECKED: "SHARED_MEMORY_CHECKED",
  CONFLICT_DETECTED: "CONFLICT_DETECTED",
  CANDIDATE_ACTIONS: "CANDIDATE_ACTIONS",
  ERV_CALCULATED: "ERV_CALCULATED",
  GOVERNOR_CHECKED: "GOVERNOR_CHECKED",
  POLICY_CHECKED: "POLICY_CHECKED",
  WHY_NOT_TO_ACT: "WHY_NOT_TO_ACT",
  FINAL_DECISION: "FINAL_DECISION",
  ESCALATED_TO_HUMAN: "ESCALATED_TO_HUMAN",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ACTION_EXECUTED: "ACTION_EXECUTED",
  OUTCOME_VERIFIED: "OUTCOME_VERIFIED",
  DEFERRED: "DEFERRED",
  PROCESSING_FAILED: "PROCESSING_FAILED",
  CASE_RECOVERED: "CASE_RECOVERED",
} as const;

export type AuditEventType = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];
