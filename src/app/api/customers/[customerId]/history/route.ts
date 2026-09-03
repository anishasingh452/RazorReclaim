import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";
import type { CustomerHistoryEntry } from "@/types/domain";

/**
 * A customer's Shared Agent Memory across every case they've ever had —
 * the same data the case-detail endpoint embeds, addressable on its own for
 * views that don't start from a case.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("decision_memory")
    .select("*, cases(risk_type, amount, status)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const decisions: CustomerHistoryEntry[] = (data ?? []).map((row) => {
    const { cases, ...rest } = row as Record<string, unknown> & {
      cases?: { risk_type: string; amount: number; status: string } | null;
    };
    return {
      ...rest,
      case_risk_type: cases?.risk_type ?? null,
      case_amount: cases?.amount ?? null,
      case_status: cases?.status ?? null,
    } as CustomerHistoryEntry;
  });

  return NextResponse.json({ customerId, decisions });
}
