import { getServiceClient } from "@/lib/db/service-client";
import type { CaseGraphState, CaseGraphUpdate } from "../state";

/**
 * Entry node — loads the case and its raw evidence. Risk-type classification
 * itself already happened at ingestion (the generator, or in a future real
 * integration, the source system); this node's job is to bring that case
 * into the graph's working state and mark it as being worked. SIGNAL_DETECTED
 * and CASE_CREATED are already recorded in the audit trail at the point the
 * case was actually created (src/lib/generator/seed-batch.ts) — this node
 * doesn't re-log a redundant, less-precise "detected" event.
 */
export async function detectNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  const supabase = getServiceClient();

  const { data: caseRecord, error: caseError } = await supabase
    .from("cases")
    .select("*")
    .eq("id", state.caseId)
    .single();
  if (caseError || !caseRecord) {
    throw new Error(`detectNode: case ${state.caseId} not found: ${caseError?.message}`);
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence")
    .select("*")
    .eq("case_id", state.caseId);
  if (evidenceError) {
    throw new Error(`detectNode: failed to load evidence: ${evidenceError.message}`);
  }

  await supabase.from("cases").update({ status: "in_progress" }).eq("id", state.caseId);

  return { caseRecord, evidence: evidence ?? [] };
}
