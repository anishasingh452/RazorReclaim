import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const { data: batch, error } = await supabase.from("batches").select("*").eq("id", id).single();
  if (error || !batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

  const { count: totalCases } = await supabase
    .from("cases")
    .select("*", { count: "exact", head: true })
    .eq("batch_id", id);

  const { data: statusCounts } = await supabase.from("cases").select("status").eq("batch_id", id);
  const statusBreakdown = (statusCounts ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const { data: actionCounts } = await supabase.from("cases").select("final_action").eq("batch_id", id);
  const actionBreakdown = (actionCounts ?? []).reduce<Record<string, number>>((acc, c) => {
    if (c.final_action) acc[c.final_action] = (acc[c.final_action] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    batch,
    totalCases: totalCases ?? 0,
    statusBreakdown,
    actionBreakdown,
  });
}
