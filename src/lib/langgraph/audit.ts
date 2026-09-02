import { getServiceClient } from "@/lib/db/service-client";
import { computeAuditHash, GENESIS_HASH } from "@/lib/audit/hash-chain";
import type { AuditActor } from "@/types/domain";

/**
 * Every graph node calls this at its key decision point — this table is the
 * canonical audit trail. Each row is hash-chained to the previous row for
 * the same case (per src/lib/audit/hash-chain.ts), so the trail is
 * tamper-evident: altering or deleting a past row breaks verifyChain().
 */
export async function appendAudit(
  caseId: string,
  eventType: string,
  actor: AuditActor,
  detail: Record<string, unknown> = {},
  modelVersion: string | null = null
): Promise<void> {
  const supabase = getServiceClient();

  const { data: last } = await supabase
    .from("audit_log")
    .select("hash")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = last?.hash ?? GENESIS_HASH;
  const createdAt = new Date().toISOString();
  const hash = computeAuditHash(prevHash, {
    case_id: caseId,
    event_type: eventType,
    actor,
    detail,
    model_version: modelVersion,
    created_at: createdAt,
  });

  const { error } = await supabase.from("audit_log").insert({
    case_id: caseId,
    event_type: eventType,
    actor,
    detail,
    model_version: modelVersion,
    prev_hash: prevHash,
    hash,
    created_at: createdAt,
  });
  if (error) {
    throw new Error(`Failed to append audit log (${eventType}): ${error.message}`);
  }
}
