import { getServiceClient } from "@/lib/db/service-client";
import { evaluatePolicy } from "@/lib/policy/engine";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

export async function policyNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.caseRecord) throw new Error("policyNode: caseRecord missing from state");
  if (!state.selectedImpact) throw new Error("policyNode: selectedImpact missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const { data: priorExecutions } = await supabase
    .from("executions")
    .select("created_at")
    .eq("case_id", state.caseId)
    .order("created_at", { ascending: false });

  const priorExecutionCount = priorExecutions?.length ?? 0;
  const hoursSinceLastExecution =
    priorExecutions && priorExecutions.length > 0
      ? Math.round((Date.now() - new Date(priorExecutions[0].created_at).getTime()) / 3_600_000)
      : null;

  const decision = evaluatePolicy({
    amount: c.amount,
    contactAttempts: c.contact_attempts,
    candidateAction: state.selectedImpact.action_type,
    expectedRecoveryValue: state.selectedImpact.expected_recovery_value,
    priorExecutionCount,
    hoursSinceLastExecution,
  });

  const { error } = await supabase.from("policy_checks").insert(
    decision.checks.map((check) => ({
      case_id: state.caseId,
      rule_name: check.rule_name,
      passed: check.passed,
      detail: check.detail,
    }))
  );
  if (error) throw new Error(`policyNode: failed to persist policy checks: ${error.message}`);

  await appendAudit(state.caseId, "policy_evaluated", "policy_engine", {
    candidate_action: state.selectedImpact.action_type,
    final_action: decision.action,
    allowed: decision.allowed,
    requires_human: decision.requiresHuman,
    requires_stop: decision.requiresStop,
    overridden_by_policy: !decision.allowed,
    failed_rules: decision.checks.filter((c) => !c.passed).map((c) => c.rule_name),
  });

  await supabase.from("cases").update({ final_action: decision.action }).eq("id", state.caseId);

  return { policyDecision: decision, finalAction: decision.action };
}
