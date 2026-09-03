import Link from "next/link";
import { ArrowUpRight, CircleCheck, GitBranch, TriangleAlert } from "lucide-react";
import { getServiceClient } from "@/lib/db/service-client";
import { ApprovalActions } from "@/components/case/approval-actions";
import { DecisionComparison } from "@/components/case/decision-comparison";
import {
  RISK_TYPE_COLOR,
  RISK_TYPE_LABEL,
  avatarTint,
  formatInrCompact,
  formatInrPrecise,
  initials,
  timeAgo,
} from "@/lib/display";
import type { ActionType, RiskType } from "@/types/domain";

interface RequestedAction {
  selected_impact?: { action_type: ActionType; expected_recovery_value: number; recovery_probability: number };
  policy_decision?: { allowed: boolean; checks?: { rule_name: string; passed: boolean }[] };
  llm_recommendation?: { suggested_action: ActionType; confidence: number };
}

interface ApprovalRow {
  id: string;
  case_id: string;
  requested_action: RequestedAction;
  created_at: string;
  cases: {
    id: string;
    customer_name: string;
    amount: number;
    risk_type: RiskType;
    customer_tier: string;
  } | null;
}

export default async function ApprovalsPage() {
  const supabase = getServiceClient();

  const { data } = await supabase
    .from("approvals")
    .select("id, case_id, requested_action, created_at, cases(id, customer_name, amount, risk_type, customer_tier)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const approvals = (data ?? []) as unknown as ApprovalRow[];
  const totalAtRisk = approvals.reduce((sum, a) => sum + (a.cases?.amount ?? 0), 0);

  // Flag escalations that ALSO carry an unresolved agent disagreement — a
  // reviewer should know the two agents didn't agree either.
  const caseIds = approvals.map((a) => a.case_id);
  const { data: conflictRows } = caseIds.length
    ? await supabase.from("agent_conflicts").select("case_id").in("case_id", caseIds).is("resolution", null)
    : { data: [] };
  const conflicted = new Set((conflictRows ?? []).map((c) => c.case_id));

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-8 md:px-8">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.18em] text-amber-400 uppercase">
            <TriangleAlert className="size-3" />
            Human in the loop
          </div>
          <h1 className="text-luminous text-3xl font-semibold tracking-tight">Approval Queue</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Cases the Policy Engine deliberately pulled out of automation — above the auto-approval limit, or where a
            guardrail demanded a human read the situation first.
          </p>
        </div>

        {approvals.length > 0 && (
          <div className="glass px-4 py-3 text-right">
            <div className="micro-label text-amber-300/80">Awaiting decision</div>
            <div className="stat-value mt-1 text-xl font-semibold text-amber-300">
              {approvals.length} · {formatInrCompact(totalAtRisk)}
            </div>
          </div>
        )}
      </div>

      {approvals.length === 0 && (
        <div className="rise glass flex flex-col items-center gap-3 py-20 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <CircleCheck className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            Queue clear — nothing is currently waiting on a human decision.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {approvals.map((approval, i) => {
          const ra = approval.requested_action ?? {};
          const failedRules = ra.policy_decision?.checks?.filter((c) => !c.passed).map((c) => c.rule_name) ?? [];

          return (
            <section
              key={approval.id}
              className="rise glass space-y-4 p-5"
              style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/cases/${approval.case_id}`} className="group flex items-center gap-3">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${avatarTint(approval.cases?.customer_name ?? "?")}`}
                  >
                    {initials(approval.cases?.customer_name ?? "?")}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium transition-colors group-hover:text-emerald-300">
                      {approval.cases?.customer_name ?? "Unknown customer"}
                      <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {approval.cases && (
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium ${RISK_TYPE_COLOR[approval.cases.risk_type]}`}
                        >
                          {RISK_TYPE_LABEL[approval.cases.risk_type]}
                        </span>
                      )}
                      <span className="micro-label">{approval.cases?.customer_tier}</span>
                      {conflicted.has(approval.case_id) && (
                        <span className="inline-flex items-center gap-1 rounded border border-violet-500/25 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-300">
                          <GitBranch className="size-2.5" />
                          Agents disagreed
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="text-right">
                  <div className="stat-value text-lg font-semibold">
                    {approval.cases ? formatInrPrecise(approval.cases.amount) : "—"}
                  </div>
                  <div className="stat-value text-[10.5px] text-muted-foreground/60">
                    waiting {timeAgo(approval.created_at)}
                  </div>
                </div>
              </div>

              <DecisionComparison
                aiAction={ra.llm_recommendation?.suggested_action ?? null}
                aiConfidence={ra.llm_recommendation?.confidence ?? null}
                engineAction={ra.selected_impact?.action_type ?? null}
                engineErv={ra.selected_impact?.expected_recovery_value ?? null}
                engineProbability={ra.selected_impact?.recovery_probability ?? null}
                finalAction="escalate"
                policyAllowed={ra.policy_decision?.allowed ?? null}
                failedRules={failedRules}
              />

              <ApprovalActions approvalId={approval.id} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
