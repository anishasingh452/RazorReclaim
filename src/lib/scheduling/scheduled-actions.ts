import { getServiceClient } from "@/lib/db/service-client";
import type { ActionType, ScheduledAction } from "@/types/domain";

/** Pure date math, independently testable from the DB write. */
export function computeScheduledFor(fromIso: string, delayHours: number): string {
  const from = new Date(fromIso);
  return new Date(from.getTime() + delayHours * 60 * 60 * 1000).toISOString();
}

export interface CreateScheduledActionInput {
  caseId: string;
  actionType: ActionType;
  scheduledFor: string;
  reason: string;
}

export async function createScheduledAction(input: CreateScheduledActionInput): Promise<ScheduledAction> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("scheduled_actions")
    .insert({
      case_id: input.caseId,
      action_type: input.actionType,
      scheduled_for: input.scheduledFor,
      reason: input.reason,
      status: "pending",
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createScheduledAction: failed to persist: ${error?.message}`);
  return data as ScheduledAction;
}

/** Scheduled actions whose time has come and haven't been executed or cancelled yet. */
export async function getDueScheduledActions(asOfIso: string = new Date().toISOString()): Promise<ScheduledAction[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("scheduled_actions")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", asOfIso)
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(`getDueScheduledActions: query failed: ${error.message}`);
  return (data ?? []) as ScheduledAction[];
}

export async function markScheduledActionExecuted(id: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("scheduled_actions")
    .update({ status: "executed", executed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`markScheduledActionExecuted: failed: ${error.message}`);
}

export async function cancelScheduledAction(id: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("scheduled_actions").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(`cancelScheduledAction: failed: ${error.message}`);
}
