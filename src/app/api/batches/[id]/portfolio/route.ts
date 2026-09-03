import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";
import { getPortfolioRanking } from "@/lib/portfolio/priority-optimizer";
import type { Case, RankedPortfolioOpportunity } from "@/types/domain";

/**
 * Batch-wide priority ranking — reuses the existing Portfolio Priority
 * Optimizer verbatim (ERV × urgency) and only joins on the display fields
 * the UI needs. No ranking logic lives here.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const ranked = await getPortfolioRanking(id);
    if (ranked.length === 0) return NextResponse.json({ opportunities: [] });

    const supabase = getServiceClient();
    const { data: cases, error } = await supabase
      .from("cases")
      .select("id, customer_name, customer_tier, risk_type, status, final_action")
      .in(
        "id",
        ranked.map((r) => r.caseId)
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const byId = new Map((cases ?? []).map((c) => [c.id, c as Pick<Case, "id" | "customer_name" | "customer_tier" | "risk_type" | "status" | "final_action">]));

    const opportunities: RankedPortfolioOpportunity[] = ranked.flatMap((r) => {
      const c = byId.get(r.caseId);
      if (!c) return [];
      return [
        {
          caseId: r.caseId,
          customerName: c.customer_name,
          customerTier: c.customer_tier,
          riskType: c.risk_type,
          status: c.status,
          finalAction: c.final_action,
          amount: r.amount,
          daysSinceFailure: r.daysSinceFailure,
          recoveryProbability: r.recoveryProbability,
          selectedErv: r.selectedErv,
          priorityScore: r.priorityScore,
        },
      ];
    });

    return NextResponse.json({ opportunities });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
