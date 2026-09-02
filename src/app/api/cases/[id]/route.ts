import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";

/** Full case detail for the Case Investigation page: everything the audit trail has. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: caseRecord, error: caseError } = await supabase.from("cases").select("*").eq("id", id).single();
  if (caseError || !caseRecord) return NextResponse.json({ error: "Case not found" }, { status: 404 });

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

  return NextResponse.json({
    case: caseRecord,
    evidence: evidence.data ?? [],
    decisions: decisions.data ?? [],
    impactScores: impactScores.data ?? [],
    policyChecks: policyChecks.data ?? [],
    executions: executions.data ?? [],
    verifications: verifications.data ?? [],
    auditLog: auditLog.data ?? [],
    approvals: approvals.data ?? [],
  });
}
