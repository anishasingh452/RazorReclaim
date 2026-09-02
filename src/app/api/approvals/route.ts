import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("approvals")
    .select("*, cases(id, customer_name, amount, risk_type, customer_tier, batch_id)")
    .eq("status", status)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ approvals: data });
}
