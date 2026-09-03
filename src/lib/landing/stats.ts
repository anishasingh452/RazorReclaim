import { getServiceClient } from "@/lib/db/service-client";

export interface LandingStats {
  casesDecided: number;
  amountAtRisk: number;
  amountRecovered: number;
  agentProposals: number;
  chainedAuditEvents: number;
}

/**
 * Real figures from the live database for the landing page's proof strip —
 * not illustrative placeholders. Returns null if anything is unreachable so
 * the marketing page degrades to its copy rather than failing to render.
 */
export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    const supabase = getServiceClient();

    const [batches, decided, proposals, audit] = await Promise.all([
      supabase.from("batches").select("total_at_risk, total_recovered"),
      supabase.from("cases").select("id", { count: "exact", head: true }).not("final_action", "is", null),
      supabase.from("agent_proposals").select("id", { count: "exact", head: true }),
      supabase.from("audit_log").select("id", { count: "exact", head: true }).not("hash", "is", null),
    ]);

    if (batches.error) return null;

    const totals = (batches.data ?? []).reduce(
      (acc, b) => ({
        atRisk: acc.atRisk + Number(b.total_at_risk ?? 0),
        recovered: acc.recovered + Number(b.total_recovered ?? 0),
      }),
      { atRisk: 0, recovered: 0 }
    );

    return {
      casesDecided: decided.count ?? 0,
      amountAtRisk: totals.atRisk,
      amountRecovered: totals.recovered,
      agentProposals: proposals.count ?? 0,
      chainedAuditEvents: audit.count ?? 0,
    };
  } catch {
    return null;
  }
}
