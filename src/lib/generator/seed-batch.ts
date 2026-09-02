import { getServiceClient } from "@/lib/db/service-client";
import { generateBatch, type GenerateBatchConfig } from "./case-generator";
import { buildAuditChain } from "@/lib/audit/hash-chain";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { Batch, RiskType, Signal } from "@/types/domain";

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

const SIGNAL_SOURCE_BY_RISK_TYPE: Record<RiskType, Signal["source"]> = {
  failed_payment: "gateway",
  checkout_abandonment: "checkout_funnel",
  subscription_failure: "subscription_engine",
  overdue_receivable: "receivable_ledger",
};

const SIGNAL_TYPE_BY_RISK_TYPE: Record<RiskType, string> = {
  failed_payment: "payment.failed",
  checkout_abandonment: "checkout.abandoned",
  subscription_failure: "subscription.payment_failed",
  overdue_receivable: "invoice.overdue",
};

/** Supabase/PostgREST bulk inserts in one chunk this size to stay well clear of request-size limits. */
const BULK_CHUNK_SIZE = 500;

async function insertInChunks(
  table: string,
  rows: Record<string, unknown>[],
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + BULK_CHUNK_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`);
  }
}

/**
 * Generates a deterministic synthetic batch and persists it as a real
 * detection pipeline would: a `signals` row per case (SIGNAL_DETECTED) that
 * a `cases` row is then created FROM (CASE_CREATED), each case's raw
 * evidence, and the opening two links of that case's hash-chained audit
 * trail — built locally and bulk-inserted rather than N sequential
 * appendAudit() round trips, since every case's chain starts fresh from
 * genesis at seed time. No reasoning/policy/execution happens here (that's
 * the LangGraph layer).
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

  // 1. Signals — the raw detection event each case is created FROM. `seq` is
  // carried in the payload purely so we can correlate returned rows back to
  // their originating generated case without depending on insert-order.
  const signalRows = generated.cases.map((c) => ({
    batch_id: batch.id,
    source: SIGNAL_SOURCE_BY_RISK_TYPE[c.risk_type],
    signal_type: SIGNAL_TYPE_BY_RISK_TYPE[c.risk_type],
    payload: { seq: c.seq, amount: c.amount, customer_tier: c.customer_tier },
    status: "new" as const,
  }));

  const { data: insertedSignals, error: signalsError } = await supabase
    .from("signals")
    .insert(signalRows)
    .select("id, payload");
  if (signalsError || !insertedSignals) {
    throw new Error(`Failed to insert signals: ${signalsError?.message}`);
  }
  const seqToSignalId = new Map<number, string>(
    insertedSignals.map((s) => [(s.payload as { seq: number }).seq, s.id])
  );
  const seqToSignalRow = new Map(generated.cases.map((c, i) => [c.seq, signalRows[i]]));

  // 2. Cases — created FROM their signal.
  const caseRows = generated.cases.map((c) => ({
    batch_id: batch.id,
    seq: c.seq,
    signal_id: seqToSignalId.get(c.seq) ?? null,
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
    .select("id, seq, signal_id");

  if (casesError || !insertedCases) {
    throw new Error(`Failed to insert cases: ${casesError?.message}`);
  }

  const seqToId = new Map<number, string>(insertedCases.map((c) => [c.seq, c.id]));

  // 3. Link the signal back to the case it produced (bulk upsert — one round
  // trip). Postgres builds upsert as INSERT ... ON CONFLICT DO UPDATE, so
  // the payload must satisfy every NOT NULL column even though this path is
  // conceptually just an update — the original row data is carried along
  // rather than sending only the two changed fields.
  const signalLinkRows = insertedCases
    .filter((c) => c.signal_id)
    .map((c) => {
      const original = seqToSignalRow.get(c.seq)!;
      return { id: c.signal_id as string, ...original, case_id: c.id, status: "linked" as const };
    });
  if (signalLinkRows.length > 0) {
    const { error: linkError } = await supabase.from("signals").upsert(signalLinkRows);
    if (linkError) throw new Error(`Failed to link signals to cases: ${linkError.message}`);
  }

  // 4. Evidence.
  const evidenceRows = generated.cases.flatMap((c) => {
    const caseId = seqToId.get(c.seq);
    if (!caseId) return [];
    return c.evidence.map((e) => ({
      case_id: caseId,
      source: e.source,
      payload: e.payload,
    }));
  });
  await insertInChunks("evidence", evidenceRows, supabase);

  // 5. Opening audit chain: SIGNAL_DETECTED -> CASE_CREATED per case.
  const auditDrafts = generated.cases.flatMap((c) => {
    const caseId = seqToId.get(c.seq);
    if (!caseId) return [];
    return [
      {
        case_id: caseId,
        event_type: AUDIT_EVENT.SIGNAL_DETECTED,
        actor: "system" as const,
        detail: { source: SIGNAL_SOURCE_BY_RISK_TYPE[c.risk_type], signal_type: SIGNAL_TYPE_BY_RISK_TYPE[c.risk_type] },
      },
      {
        case_id: caseId,
        event_type: AUDIT_EVENT.CASE_CREATED,
        actor: "system" as const,
        detail: { risk_type: c.risk_type, amount: c.amount, customer_tier: c.customer_tier },
      },
    ];
  });
  const auditRows = buildAuditChain(auditDrafts);
  await insertInChunks("audit_log", auditRows as unknown as Record<string, unknown>[], supabase);

  return { batch, caseCount: generated.caseCount, totalAtRisk: generated.totalAtRisk };
}
