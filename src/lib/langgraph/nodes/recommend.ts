import { getServiceClient } from "@/lib/db/service-client";
import { runRecommendation } from "@/lib/ai/recommend";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

export async function recommendNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.caseRecord) throw new Error("recommendNode: caseRecord missing from state");
  if (!state.rootCause) throw new Error("recommendNode: rootCause missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const { result, model } = await runRecommendation({
    riskType: c.risk_type,
    amount: c.amount,
    customerTier: c.customer_tier,
    contactAttempts: c.contact_attempts,
    daysSinceFailure: c.days_since_failure,
    rootCause: state.rootCause,
  });

  const { error } = await supabase.from("decisions").insert({
    case_id: state.caseId,
    stage: "recommend",
    ai_output: result,
    confidence: result.confidence,
    reasoning: result.evidence_summary.join(" | "),
    model,
  });
  if (error) throw new Error(`recommendNode: failed to persist decision: ${error.message}`);

  await appendAudit(state.caseId, "action_recommended", "ai_agent", {
    suggested_action: result.suggested_action,
    confidence: result.confidence,
    model,
  });

  return { recommendation: result, recommendationModel: model };
}
