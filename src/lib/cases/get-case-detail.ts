import { getServiceClient } from "@/lib/db/service-client";
import type {
  Approval,
  AuditEvent,
  Case,
  Decision,
  Evidence,
  Execution,
  ImpactScore,
  PolicyCheck,
  Verification,
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
}

export async function getCaseDetail(id: string): Promise<CaseDetail | null> {
  const supabase = getServiceClient();

  const { data: caseRecord, error } = await supabase.from("cases").select("*").eq("id", id).single();
  if (error || !caseRecord) return null;

  const [evidence, decisions, impactScores, policyChecks, executions, verifications, auditLog, approvals] =
    await Promise.all([
      supabase.from("evidence").select("*").eq("case_id", id),
      supabase.from("decisions").select("*").eq("case_id", id).order("created_at"),
      supabase.from("impact_scores").select("*").eq("case_id", id).order("expected_recovery_value", { ascending: false }),
      supabase.from("policy_checks").select("*").eq("case_id", id).order("created_at"),
      supabase.from("executions").select("*").eq("case_id", id).order("created_at"),
      supabase.from("verifications").select("*").eq("case_id", id).order("verified_at"),
      supabase.from("audit_log").select("*").eq("case_id", id).order("created_at"),
      supabase.from("approvals").select("*").eq("case_id", id).order("created_at"),
    ]);

  return {
    case: caseRecord,
    evidence: evidence.data ?? [],
    decisions: decisions.data ?? [],
    impactScores: impactScores.data ?? [],
    policyChecks: policyChecks.data ?? [],
    executions: executions.data ?? [],
    verifications: verifications.data ?? [],
    auditLog: auditLog.data ?? [],
    approvals: approvals.data ?? [],
  };
}
