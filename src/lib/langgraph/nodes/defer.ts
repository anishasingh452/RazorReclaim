import { getServiceClient } from "@/lib/db/service-client";
import { computeScheduledFor, createScheduledAction } from "@/lib/scheduling/scheduled-actions";
import { COOLDOWN_HOURS } from "@/lib/policy/config";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * Cooldown-deferred or voluntarily wait_and_retry cases — no execution
 * attempted, case stays open for a future run. Also books a concrete
 * scheduled_actions row for when the cooldown lapses, so "wait" is a real,
 * queryable future commitment rather than a silent no-op.
 */
export async function deferNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  const supabase = getServiceClient();
  await supabase.from("cases").update({ status: "open" }).eq("id", state.caseId);

  const scheduledFor = computeScheduledFor(new Date().toISOString(), COOLDOWN_HOURS);
  await createScheduledAction({
    caseId: state.caseId,
    actionType: state.finalAction ?? "wait_and_retry",
    scheduledFor,
    reason: "Cooldown period active — deferring to the next eligible attempt window",
  });

  await appendAudit(state.caseId, AUDIT_EVENT.DEFERRED, "policy_engine", {
    final_action: state.finalAction,
    scheduled_for: scheduledFor,
  });

  return {};
}
