import { getServiceClient } from "@/lib/db/service-client";
import { getDecisionMemoryForCustomer } from "./decision-memory";
import type { PromiseToPay, ScheduledAction, SharedCaseContext } from "@/types/domain";

/**
 * Pulls everything an agent (or the Communication Governor) should know
 * before proposing or contacting a customer: prior decisions for this
 * customer across all their cases, any still-pending promise-to-pay,
 * pending scheduled follow-ups, and execution/cooldown history for THIS
 * case. Pure aggregation over existing tables — no new state, no
 * duplicated computation.
 */
export async function getSharedCaseContext(caseId: string): Promise<SharedCaseContext> {
  const supabase = getServiceClient();

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("customer_id")
    .eq("id", caseId)
    .single();
  if (caseError || !caseRow) throw new Error(`getSharedCaseContext: case not found: ${caseError?.message}`);

  const [priorDecisions, promiseRows, scheduledRows, executionRows] = await Promise.all([
    getDecisionMemoryForCustomer(caseRow.customer_id),
    supabase
      .from("promises_to_pay")
      .select("*")
      .eq("case_id", caseId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("scheduled_actions").select("*").eq("case_id", caseId).eq("status", "pending"),
    supabase.from("executions").select("created_at").eq("case_id", caseId).order("created_at", { ascending: false }),
  ]);

  const activePromise = ((promiseRows.data ?? [])[0] as PromiseToPay | undefined) ?? null;
  const pendingScheduledActions = (scheduledRows.data ?? []) as ScheduledAction[];
  const executions = executionRows.data ?? [];

  const priorExecutionCount = executions.length;
  const hoursSinceLastExecution =
    executions.length > 0 ? Math.round((Date.now() - new Date(executions[0].created_at).getTime()) / 3_600_000) : null;

  return {
    customerId: caseRow.customer_id,
    priorDecisions,
    activePromise,
    pendingScheduledActions,
    priorExecutionCount,
    hoursSinceLastExecution,
  };
}
