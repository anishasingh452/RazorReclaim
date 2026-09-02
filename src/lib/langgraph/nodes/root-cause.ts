import { getServiceClient } from "@/lib/db/service-client";
import { runRootCauseReasoning } from "@/lib/ai/root-cause";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

export async function rootCauseNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  const c = requireCase(state);
  const supabase = getServiceClient();

  const { result, model } = await runRootCauseReasoning({
    riskType: c.risk_type,
    amount: c.amount,
    customerTier: c.customer_tier,
    contactAttempts: c.contact_attempts,
    daysSinceFailure: c.days_since_failure,
    evidence: state.evidence,
  });

  const { error } = await supabase.from("decisions").insert({
    case_id: state.caseId,
    stage: "root_cause",
    ai_output: result,
    confidence: result.confidence,
    reasoning: result.evidence_summary.join(" | "),
    model,
  });
  if (error) throw new Error(`rootCauseNode: failed to persist decision: ${error.message}`);

  await appendAudit(
    state.caseId,
    AUDIT_EVENT.AI_DIAGNOSIS,
    "ai_agent",
    {
      category: result.category,
      qualitative_recovery_probability: result.qualitative_recovery_probability,
      confidence: result.confidence,
      evidence_summary: result.evidence_summary,
    },
    model
  );

  return { rootCause: result, rootCauseModel: model };
}

function requireCase(state: CaseGraphState) {
  if (!state.caseRecord) throw new Error("rootCauseNode: caseRecord missing from state");
  return state.caseRecord;
}
