import Link from "next/link";
import { getServiceClient } from "@/lib/db/service-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalActions } from "@/components/case/approval-actions";
import { formatInrPrecise, RISK_TYPE_COLOR, RISK_TYPE_LABEL } from "@/lib/display";
import type { RiskType } from "@/types/domain";

interface ApprovalRow {
  id: string;
  case_id: string;
  requested_action: { policy_decision?: { checks?: { rule_name: string; passed: boolean }[] } };
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="text-sm text-neutral-500">
          Cases the Policy Engine routed to a human — above the auto-approval limit, or where the
          AI&apos;s own top pick already required human judgment.
        </p>
      </div>

      {approvals.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-400">
            No cases currently awaiting approval.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {approvals.map((a) => {
          const failedRules = a.requested_action?.policy_decision?.checks?.filter((c) => !c.passed) ?? [];
          return (
            <Card key={a.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm">
                    <Link href={`/cases/${a.case_id}`} className="hover:underline">
                      {a.cases?.customer_name ?? "Unknown customer"}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    {a.cases && (
                      <Badge variant="outline" className={RISK_TYPE_COLOR[a.cases.risk_type]}>
                        {RISK_TYPE_LABEL[a.cases.risk_type]}
                      </Badge>
                    )}
                    <span className="text-xs text-neutral-500 uppercase">{a.cases?.customer_tier}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold tabular-nums">
                    {a.cases ? formatInrPrecise(a.cases.amount) : "—"}
                  </div>
                  <div className="text-[11px] text-neutral-400">{new Date(a.created_at).toLocaleString()}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {failedRules.length > 0 && (
                  <div className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1.5">
                    Blocked by: {failedRules.map((r) => r.rule_name).join(", ")}
                  </div>
                )}
                <ApprovalActions approvalId={a.id} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
