import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const batchId = params.get("batchId");
  const status = params.get("status");
  const riskType = params.get("riskType");
  const limit = Math.min(Number(params.get("limit") ?? "50"), 200);
  const offset = Number(params.get("offset") ?? "0");

  const supabase = getServiceClient();
  let query = supabase
    .from("cases")
    .select("*, impact_scores(recovery_probability, expected_recovery_value, selected)", { count: "exact" })
    .order("seq", { ascending: true });

  if (batchId) query = query.eq("batch_id", batchId);
  if (status) query = query.eq("status", status);
  if (riskType) query = query.eq("risk_type", riskType);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the embedded impact_scores array down to the single selected
  // candidate (if the case has been processed yet) for a compact "AI
  // confidence" style readout in the Command Center table.
  const cases = (data ?? []).map((c) => {
    const scores = (c.impact_scores ?? []) as { recovery_probability: number; expected_recovery_value: number; selected: boolean }[];
    const selected = scores.find((s) => s.selected) ?? null;
    const { impact_scores, ...rest } = c;
    void impact_scores;
    return {
      ...rest,
      selectedRecoveryProbability: selected?.recovery_probability ?? null,
      selectedExpectedRecoveryValue: selected?.expected_recovery_value ?? null,
    };
  });

  return NextResponse.json({ cases, total: count ?? 0 });
}
