import { getServiceClient } from "@/lib/db/service-client";

export interface PortfolioOpportunity {
  caseId: string;
  amount: number;
  daysSinceFailure: number;
  selectedErv: number;
  recoveryProbability: number;
}

export interface RankedOpportunity extends PortfolioOpportunity {
  priorityScore: number;
}

/**
 * Ranks opportunities across a whole batch by where the system's next
 * action creates the greatest overall business impact — NOT by treating
 * every case independently. Reuses each case's already-computed Expected
 * Recovery Value (from the Business Impact Engine) as the primary driver;
 * this is composition over that engine's output, not a duplicate
 * calculation. A mild urgency multiplier favors cases whose recovery
 * window is visibly closing (probability decays with days_since_failure
 * in the impact engine itself, so a case that's both aging AND still
 * ERV-positive is one worth acting on before that window closes further).
 */
export function rankPortfolio(opportunities: PortfolioOpportunity[]): RankedOpportunity[] {
  return opportunities
    .map((o) => {
      const urgencyFactor = 1 + Math.min(o.daysSinceFailure / 60, 1) * 0.5; // up to +50% at 60+ days
      return { ...o, priorityScore: round2(o.selectedErv * urgencyFactor) };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** DB-backed convenience wrapper: pulls each case's selected impact candidate for a batch and ranks them. */
export async function getPortfolioRanking(batchId: string): Promise<RankedOpportunity[]> {
  const supabase = getServiceClient();

  const { data: cases, error: casesError } = await supabase
    .from("cases")
    .select("id, amount, days_since_failure")
    .eq("batch_id", batchId);
  if (casesError) throw new Error(`getPortfolioRanking: failed to load cases: ${casesError.message}`);
  if (!cases || cases.length === 0) return [];

  const caseIds = cases.map((c) => c.id);
  const { data: scores, error: scoresError } = await supabase
    .from("impact_scores")
    .select("case_id, expected_recovery_value, recovery_probability")
    .in("case_id", caseIds)
    .eq("selected", true);
  if (scoresError) throw new Error(`getPortfolioRanking: failed to load impact scores: ${scoresError.message}`);

  const scoreByCase = new Map((scores ?? []).map((s) => [s.case_id, s]));

  const opportunities: PortfolioOpportunity[] = cases
    .filter((c) => scoreByCase.has(c.id))
    .map((c) => {
      const s = scoreByCase.get(c.id)!;
      return {
        caseId: c.id,
        amount: c.amount,
        daysSinceFailure: c.days_since_failure,
        selectedErv: s.expected_recovery_value,
        recoveryProbability: s.recovery_probability,
      };
    });

  return rankPortfolio(opportunities);
}
