import { getServiceClient } from "@/lib/db/service-client";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

export async function stopNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  const supabase = getServiceClient();
  await supabase.from("cases").update({ status: "stopped" }).eq("id", state.caseId);

  await appendAudit(state.caseId, "recovery_stopped", "policy_engine", {
    reason: state.policyDecision?.checks.filter((c) => !c.passed).map((c) => c.rule_name) ?? [],
  });

  return {};
}
