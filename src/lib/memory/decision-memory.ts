import { getServiceClient } from "@/lib/db/service-client";
import type { ActionType, DecisionMemory } from "@/types/domain";

export interface BuildSummaryInput {
  riskType: string;
  finalAction: ActionType | null;
  verified: boolean;
  amountRecovered: number;
  amount: number;
}

/** Pure text-generation logic — independently testable from the DB write. */
export function buildDecisionMemorySummary(input: BuildSummaryInput): string {
  const actionText = input.finalAction ? input.finalAction.replace(/_/g, " ") : "no action";
  if (input.verified) {
    return `${input.riskType.replace(/_/g, " ")} case resolved via ${actionText} — ₹${input.amountRecovered.toFixed(2)} recovered.`;
  }
  if (input.finalAction === "stop" || input.finalAction === "no_action") {
    return `${input.riskType.replace(/_/g, " ")} case closed via ${actionText} — ₹${input.amount.toFixed(2)} not pursued further.`;
  }
  return `${input.riskType.replace(/_/g, " ")} case took ${actionText} — outcome not yet verified.`;
}

export interface RecordDecisionMemoryInput extends BuildSummaryInput {
  customerId: string;
  caseId: string;
}

export async function recordDecisionMemory(input: RecordDecisionMemoryInput): Promise<DecisionMemory> {
  const supabase = getServiceClient();
  const summary = buildDecisionMemorySummary(input);

  const { data, error } = await supabase
    .from("decision_memory")
    .insert({
      customer_id: input.customerId,
      case_id: input.caseId,
      summary,
      final_action: input.finalAction,
      verified: input.verified,
      amount_recovered: input.amountRecovered,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`recordDecisionMemory: failed to persist: ${error?.message}`);
  return data as DecisionMemory;
}

/** Most recent decision-memory entries for a customer, newest first — the raw material for future reasoning enrichment. */
export async function getDecisionMemoryForCustomer(customerId: string, limit = 10): Promise<DecisionMemory[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("decision_memory")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getDecisionMemoryForCustomer: query failed: ${error.message}`);
  return (data ?? []) as DecisionMemory[];
}
