import { getServiceClient } from "@/lib/db/service-client";
import { generateBatch, type GenerateBatchConfig } from "./case-generator";
import type { Batch } from "@/types/domain";

export interface SeedBatchInput {
  name: string;
  seed: string;
  caseCount: number;
  concurrency?: number;
}

export interface SeedBatchResult {
  batch: Batch;
  caseCount: number;
  totalAtRisk: number;
}

/**
 * Generates a deterministic synthetic batch and persists it: one `batches`
 * row, N `cases` rows, and each case's raw evidence rows. Pure insert —
 * no reasoning/policy/execution happens here (that's the LangGraph layer).
 */
export async function seedBatch(input: SeedBatchInput): Promise<SeedBatchResult> {
  const demoEmailBase = process.env.DEMO_EMAIL_BASE;
  const demoEmailPoolSize = Number(process.env.DEMO_EMAIL_POOL_SIZE ?? "10");
  if (!demoEmailBase) throw new Error("Missing DEMO_EMAIL_BASE env var");

  const config: GenerateBatchConfig = {
    seed: input.seed,
    caseCount: input.caseCount,
    demoEmailBase,
    demoEmailPoolSize,
  };
  const generated = generateBatch(config);

  const supabase = getServiceClient();

  const { data: batchRow, error: batchError } = await supabase
    .from("batches")
    .insert({
      name: input.name,
      seed: input.seed,
      concurrency: input.concurrency ?? 6,
      total_cases: generated.caseCount,
      total_at_risk: generated.totalAtRisk,
      status: "pending",
    })
    .select()
    .single();

  if (batchError || !batchRow) {
    throw new Error(`Failed to insert batch: ${batchError?.message}`);
  }
  const batch = batchRow as Batch;

  const caseRows = generated.cases.map((c) => ({
    batch_id: batch.id,
    seq: c.seq,
    customer_name: c.customer_name,
    customer_id: c.customer_id,
    customer_email: c.customer_email,
    customer_tier: c.customer_tier,
    amount: c.amount,
    currency: c.currency,
    risk_type: c.risk_type,
    contact_attempts: c.contact_attempts,
    days_since_failure: c.days_since_failure,
    is_synthetic: true,
    status: "open",
  }));

  const { data: insertedCases, error: casesError } = await supabase
    .from("cases")
    .insert(caseRows)
    .select("id, seq");

  if (casesError || !insertedCases) {
    throw new Error(`Failed to insert cases: ${casesError?.message}`);
  }

  const seqToId = new Map<number, string>(insertedCases.map((c) => [c.seq, c.id]));

  const evidenceRows = generated.cases.flatMap((c) => {
    const caseId = seqToId.get(c.seq);
    if (!caseId) return [];
    return c.evidence.map((e) => ({
      case_id: caseId,
      source: e.source,
      payload: e.payload,
    }));
  });

  const { error: evidenceError } = await supabase.from("evidence").insert(evidenceRows);
  if (evidenceError) {
    throw new Error(`Failed to insert evidence: ${evidenceError.message}`);
  }

  return { batch, caseCount: generated.caseCount, totalAtRisk: generated.totalAtRisk };
}
