import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db/service-client";
import type { AgentProposal, ConflictFeedItem, ConflictProposalSummary } from "@/types/domain";

interface ConflictRow {
  id: string;
  case_id: string;
  conflict_type: ConflictFeedItem["conflictType"];
  proposal_ids: string[];
  resolution: ConflictFeedItem["resolution"];
  winning_proposal_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  cases: { customer_name: string; amount: number; risk_type: ConflictFeedItem["riskType"]; batch_id: string } | null;
}

/**
 * Cross-case feed of agent conflicts, each hydrated with the proposals that
 * disagreed so a conflict card can render standalone (outside its case page).
 * Filters: `batchId`, and `resolved=true|false`.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const batchId = params.get("batchId");
  const resolved = params.get("resolved");
  const limit = Math.min(Number(params.get("limit") ?? "100"), 300);

  const supabase = getServiceClient();
  let query = supabase
    .from("agent_conflicts")
    .select("*, cases!inner(customer_name, amount, risk_type, batch_id)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (batchId) query = query.eq("cases.batch_id", batchId);
  if (resolved === "true") query = query.not("resolution", "is", null);
  if (resolved === "false") query = query.is("resolution", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as ConflictRow[];
  const proposalIds = [...new Set(rows.flatMap((r) => r.proposal_ids ?? []))];

  let proposalsById = new Map<string, AgentProposal>();
  if (proposalIds.length > 0) {
    const { data: proposals, error: proposalError } = await supabase
      .from("agent_proposals")
      .select("*")
      .in("id", proposalIds);
    if (proposalError) return NextResponse.json({ error: proposalError.message }, { status: 500 });
    proposalsById = new Map(((proposals ?? []) as AgentProposal[]).map((p) => [p.id, p]));
  }

  const conflicts: ConflictFeedItem[] = rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    customerName: r.cases?.customer_name ?? "Unknown customer",
    amount: r.cases?.amount ?? 0,
    riskType: r.cases?.risk_type ?? "failed_payment",
    conflictType: r.conflict_type,
    resolution: r.resolution,
    winningProposalId: r.winning_proposal_id,
    proposals: (r.proposal_ids ?? []).flatMap<ConflictProposalSummary>((pid) => {
      const p = proposalsById.get(pid);
      if (!p) return [];
      return [
        {
          id: p.id,
          agentName: p.agent_name,
          proposedAction: p.proposed_action,
          proposedChannel: p.proposed_channel,
          confidence: p.confidence,
          rationale: p.rationale,
          status: p.status,
        },
      ];
    }),
    message: typeof r.detail?.message === "string" ? r.detail.message : null,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ conflicts });
}
