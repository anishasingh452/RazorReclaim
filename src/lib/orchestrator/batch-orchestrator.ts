import pLimit from "p-limit";
import { getServiceClient } from "@/lib/db/service-client";
import { runCaseGraph } from "@/lib/langgraph/run-case";
import type { BatchStreamEvent } from "@/types/domain";

export interface RunBatchOptions {
  batchId: string;
  /** Overrides the batch's own `concurrency` column when provided. */
  concurrency?: number;
  onEvent?: (event: BatchStreamEvent) => void;
}

export interface BatchRunSummary {
  batchId: string;
  casesProcessed: number;
  casesFailed: number;
  totalRecovered: number;
  totalExpectedRecoveryValue: number;
  durationMs: number;
}

/**
 * Fans out isolated per-case LangGraph executions with bounded concurrency.
 * Only `open` cases are picked up, so a batch can be safely re-run after a
 * partial failure or after human approvals resolve — already-processed
 * cases are left untouched. This is a genuinely live execution: every call
 * here re-runs the real LLM + policy + impact pipeline, nothing is replayed
 * from a prior run.
 */
export async function runBatch(options: RunBatchOptions): Promise<BatchRunSummary> {
  const supabase = getServiceClient();
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("*")
    .eq("id", options.batchId)
    .single();
  if (batchError || !batch) throw new Error(`runBatch: batch not found: ${batchError?.message}`);

  const concurrency = options.concurrency ?? batch.concurrency ?? 6;

  const { data: openCases, error: casesError } = await supabase
    .from("cases")
    .select("id, seq")
    .eq("batch_id", options.batchId)
    .eq("status", "open")
    .order("seq");
  if (casesError) throw new Error(`runBatch: failed to load cases: ${casesError.message}`);

  const t0 = Date.now();
  await supabase
    .from("batches")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", options.batchId);

  let casesFailed = 0;

  if (openCases && openCases.length > 0) {
    const limit = pLimit(concurrency);

    await Promise.allSettled(
      openCases.map((c) =>
        limit(async () => {
          emit(options, { caseId: c.id, stage: "queued", status: "started" });
          try {
            await runCaseGraph(c.id, (nodeName) => {
              emit(options, { caseId: c.id, stage: nodeName, status: "completed" });
            });
          } catch (err) {
            casesFailed += 1;
            await supabase.from("cases").update({ status: "failed" }).eq("id", c.id);
            await supabase.from("audit_log").insert({
              case_id: c.id,
              event_type: "case_processing_failed",
              actor: "system",
              detail: { error: String(err) },
            });
            emit(options, { caseId: c.id, stage: "error", status: "failed", detail: { error: String(err) } });
          }
        })
      )
    );
  }

  const metrics = await computeBatchMetrics(options.batchId);
  await supabase
    .from("batches")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_recovered: metrics.totalRecovered,
      total_expected_recovery_value: metrics.totalExpectedRecoveryValue,
    })
    .eq("id", options.batchId);

  const durationMs = Date.now() - t0;
  const summary: BatchRunSummary = {
    batchId: options.batchId,
    casesProcessed: (openCases?.length ?? 0) - casesFailed,
    casesFailed,
    totalRecovered: metrics.totalRecovered,
    totalExpectedRecoveryValue: metrics.totalExpectedRecoveryValue,
    durationMs,
  };

  emit(options, { caseId: undefined, stage: "batch_complete", status: "completed", type: "batch_complete", detail: { ...summary } });

  return summary;
}

function emit(
  options: RunBatchOptions,
  partial: { caseId?: string; stage: string; status: string; type?: BatchStreamEvent["type"]; detail?: Record<string, unknown> }
) {
  options.onEvent?.({
    type: partial.type ?? "stage_transition",
    batchId: options.batchId,
    caseId: partial.caseId,
    stage: partial.stage,
    status: partial.status,
    timestamp: new Date().toISOString(),
    detail: partial.detail,
  });
}

/**
 * Sums recovered amounts and selected expected-recovery-value across every
 * case in the batch (not just the current run's cases) — a batch can be
 * resumed across multiple runBatch calls, so totals must reflect all of it.
 */
async function computeBatchMetrics(batchId: string) {
  const supabase = getServiceClient();

  const { data: cases } = await supabase.from("cases").select("id").eq("batch_id", batchId);
  const caseIds = (cases ?? []).map((c) => c.id);
  if (caseIds.length === 0) return { totalRecovered: 0, totalExpectedRecoveryValue: 0 };

  const { data: verifications } = await supabase
    .from("verifications")
    .select("amount_recovered, verified, case_id")
    .in("case_id", caseIds);

  const totalRecovered = round2(
    (verifications ?? []).filter((v) => v.verified).reduce((sum, v) => sum + Number(v.amount_recovered), 0)
  );

  const { data: impactScores } = await supabase
    .from("impact_scores")
    .select("expected_recovery_value, selected, case_id")
    .in("case_id", caseIds)
    .eq("selected", true);

  const totalExpectedRecoveryValue = round2(
    (impactScores ?? []).reduce((sum, s) => sum + Number(s.expected_recovery_value), 0)
  );

  return { totalRecovered, totalExpectedRecoveryValue };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
