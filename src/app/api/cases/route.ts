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
  let query = supabase.from("cases").select("*", { count: "exact" }).order("seq", { ascending: true });

  if (batchId) query = query.eq("batch_id", batchId);
  if (status) query = query.eq("status", status);
  if (riskType) query = query.eq("risk_type", riskType);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cases: data, total: count ?? 0 });
}
