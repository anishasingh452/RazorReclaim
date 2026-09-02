import { getServiceClient } from "@/lib/db/service-client";
import { appendAudit } from "../audit";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/** Cooldown-deferred or voluntarily wait_and_retry cases — no execution attempted, case stays open for a future run. */
export async function deferNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  const supabase = getServiceClient();
  await supabase.from("cases").update({ status: "open" }).eq("id", state.caseId);

  await appendAudit(state.caseId, "deferred", "policy_engine", {
    final_action: state.finalAction,
  });

  return {};
}
