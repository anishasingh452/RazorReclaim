import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getServiceClient } from "@/lib/db/service-client";
import { ApprovalActions } from "@/components/case/approval-actions";
import { DecisionComparison } from "@/components/case/decision-comparison";
import { avatarTint, formatInrPrecise, initials, RISK_TYPE_COLOR, RISK_TYPE_LABEL } from "@/lib/display";
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
  const totalAtRisk = approvals.reduce((s, a) => s + (a.cases?.amount ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-300 transition-colors">
        <ArrowLeft className="size-3.5" /> Back to Command Center
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-1">
            <AlertTriangle className="size-3" />
            Human-in-the-loop
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
          <p className="text-sm text-muted-foreground max-w-xl mt-1">
            Cases the Policy Engine routed to a human — above the auto-approval limit, or where the AI&apos;s own
            top pick already required human judgment.
          </p>
        </div>
        {approvals.length > 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wide text-amber-300/80">Pending decisions</div>
            <div className="text-xl font-semibold font-mono text-amber-300">
              {approvals.length} · {formatInrPrecise(totalAtRisk)}
            </div>
          </div>
        )}
      </div>

      {approvals.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-16 text-center text-sm text-muted-foreground">
          No cases currently awaiting approval.
        </div>
      )}

      <div className="space-y-4">
        {approvals.map((a) => {
          const ra = a.requested_action ?? {};
          const failedRules = ra.policy_decision?.checks?.filter((c) => !c.passed).map((c) => c.rule_name) ?? [];
          return (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <Link href={`/cases/${a.case_id}`} className="flex items-center gap-3 group">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(a.cases?.customer_name ?? "?")}`}
                  >
                    {initials(a.cases?.customer_name ?? "?")}
                  </span>
                  <div>
                    <div className="text-sm font-medium group-hover:text-emerald-300 transition-colors">
                      {a.cases?.customer_name ?? "Unknown customer"}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.cases && (
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-medium ${RISK_TYPE_COLOR[a.cases.risk_type]}`}>
                          {RISK_TYPE_LABEL[a.cases.risk_type]}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground uppercase">{a.cases?.customer_tier}</span>
                    </div>
                  </div>
                </Link>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums font-mono">
                    {a.cases ? formatInrPrecise(a.cases.amount) : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{new Date(a.created_at).toLocaleString()}</div>
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

              <ApprovalActions approvalId={a.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
