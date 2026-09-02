import { getServiceClient } from "@/lib/db/service-client";
import type { AuditActor } from "@/types/domain";

/** Every graph node calls this at its key decision point — this table is the canonical audit trail. */
export async function appendAudit(
  caseId: string,
  eventType: string,
  actor: AuditActor,
  detail: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("audit_log").insert({
    case_id: caseId,
    event_type: eventType,
    actor,
    detail,
  });
  if (error) {
    throw new Error(`Failed to append audit log (${eventType}): ${error.message}`);
  }
}
