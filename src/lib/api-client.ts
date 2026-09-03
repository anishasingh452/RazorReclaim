import type {
  Batch,
  BatchStreamEvent,
  CaseWithImpact,
  ConflictFeedItem,
  RankedPortfolioOpportunity,
} from "@/types/domain";

export async function fetchBatches(): Promise<Batch[]> {
  const res = await fetch("/api/batches");
  if (!res.ok) throw new Error("Failed to load batches");
  const data = await res.json();
  return data.batches;
}

export interface BatchDetail {
  batch: Batch;
  totalCases: number;
  statusBreakdown: Record<string, number>;
  actionBreakdown: Record<string, number>;
}

export async function fetchBatchDetail(batchId: string): Promise<BatchDetail> {
  const res = await fetch(`/api/batches/${batchId}`);
  if (!res.ok) throw new Error("Failed to load batch detail");
  return res.json();
}

export async function createBatch(input: {
  name: string;
  caseCount: number;
  concurrency?: number;
}): Promise<{ batch: Batch }> {
  const res = await fetch("/api/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to create batch");
  return res.json();
}

export async function fetchCases(params: {
  batchId?: string;
  status?: string;
  riskType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ cases: CaseWithImpact[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.batchId) qs.set("batchId", params.batchId);
  if (params.status) qs.set("status", params.status);
  if (params.riskType) qs.set("riskType", params.riskType);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`/api/cases?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to load cases");
  return res.json();
}

export async function fetchPortfolio(batchId: string): Promise<RankedPortfolioOpportunity[]> {
  const res = await fetch(`/api/batches/${batchId}/portfolio`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to load portfolio ranking");
  const data = await res.json();
  return data.opportunities;
}

export async function fetchConflicts(params: { batchId?: string; resolved?: boolean } = {}): Promise<
  ConflictFeedItem[]
> {
  const qs = new URLSearchParams();
  if (params.batchId) qs.set("batchId", params.batchId);
  if (params.resolved !== undefined) qs.set("resolved", String(params.resolved));
  const res = await fetch(`/api/conflicts?${qs.toString()}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to load conflicts");
  const data = await res.json();
  return data.conflicts;
}

/**
 * Consumes the SSE-formatted `POST /api/batches/:id/run` response body
 * directly (not the browser's EventSource, which can't POST) and invokes
 * `onEvent` for each event as it streams in — a genuinely live run, not a
 * replay.
 */
export async function runBatchStream(
  batchId: string,
  onEvent: (event: BatchStreamEvent) => void
): Promise<void> {
  const res = await fetch(`/api/batches/${batchId}/run`, { method: "POST" });
  if (!res.ok || !res.body) throw new Error("Failed to start batch run");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const dataLine = line.split("\n").find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const event = JSON.parse(dataLine.slice("data: ".length)) as BatchStreamEvent;
        onEvent(event);
      } catch {
        // ignore malformed chunk boundary
      }
    }
  }
}
