import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCaseDetail } from "@/lib/cases/get-case-detail";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  formatInrPrecise,
  RISK_TYPE_COLOR,
  RISK_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/display";
import { ApprovalActions } from "@/components/case/approval-actions";
import type { ActionType } from "@/types/domain";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  if (!detail) notFound();

  const { case: c, evidence, decisions, impactScores, policyChecks, executions, verifications, auditLog, approvals } =
    detail;

  const rootCauseDecision = decisions.find((d) => d.stage === "root_cause");
  const recommendDecision = decisions.find((d) => d.stage === "recommend");
  const rootCause = rootCauseDecision?.ai_output as Record<string, unknown> | undefined;
  const recommendation = recommendDecision?.ai_output as Record<string, unknown> | undefined;
  const pendingApproval = approvals.find((a) => a.status === "pending");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <Link href="/" className="text-xs text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{c.customer_name}</h1>
          <p className="text-sm text-neutral-500">
            {c.customer_id} · {c.customer_email} · {c.customer_tier.toUpperCase()} tier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={RISK_TYPE_COLOR[c.risk_type]}>
            {RISK_TYPE_LABEL[c.risk_type]}
          </Badge>
          <Badge className={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Amount at risk" value={formatInrPrecise(c.amount)} />
        <StatCard label="Contact attempts" value={String(c.contact_attempts)} />
        <StatCard label="Days since failure" value={String(c.days_since_failure)} />
        <StatCard
          label="Final action"
          value={c.final_action ? ACTION_LABEL[c.final_action as ActionType] : "—"}
        />
      </div>

      {pendingApproval && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-sm text-amber-900">Awaiting human approval</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalActions approvalId={pendingApproval.id} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="reasoning">
        <TabsList>
          <TabsTrigger value="reasoning">AI Reasoning</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="impact">Business Impact</TabsTrigger>
          <TabsTrigger value="policy">Policy Checks</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="reasoning" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Root Cause Diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {rootCause ? (
                <>
                  <div>
                    <span className="text-neutral-500">Cause:</span> {String(rootCause.cause)}
                  </div>
                  <div className="flex gap-4 text-neutral-600">
                    <span>Category: <span className="font-medium">{String(rootCause.category)}</span></span>
                    <span>Recovery probability: <span className="font-medium">{String(rootCause.qualitative_recovery_probability)}</span></span>
                    <span>Confidence: <span className="font-medium">{Number(rootCause.confidence).toFixed(2)}</span></span>
                  </div>
                  <ul className="list-disc pl-5 text-neutral-600 space-y-0.5">
                    {(rootCause.evidence_summary as string[] | undefined)?.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  <div className="text-xs text-neutral-400 pt-1">Model: {rootCauseDecision?.model}</div>
                </>
              ) : (
                <span className="text-neutral-400">Not yet diagnosed.</span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {recommendation ? (
                <>
                  <div>
                    Suggested action:{" "}
                    <Badge className={ACTION_COLOR[recommendation.suggested_action as ActionType]}>
                      {ACTION_LABEL[recommendation.suggested_action as ActionType]}
                    </Badge>
                  </div>
                  <ul className="list-disc pl-5 text-neutral-600 space-y-0.5">
                    {(recommendation.evidence_summary as string[] | undefined)?.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  <div className="text-xs text-neutral-400 pt-1">Model: {recommendDecision?.model}</div>
                </>
              ) : (
                <span className="text-neutral-400">No recommendation yet.</span>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="pt-4 space-y-3">
          {evidence.length === 0 && <span className="text-sm text-neutral-400">No evidence recorded.</span>}
          {evidence.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wide text-neutral-500">{e.source}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-neutral-50 rounded p-3 overflow-x-auto">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="impact" className="pt-4">
          <p className="text-xs text-neutral-500 mb-2">
            Expected Recovery Value = Potential Recoverable Amount × Recovery Probability − Intervention Cost.
            Computed deterministically for every feasible action; the highest-ERV action is selected
            (highlighted), independent of the AI&apos;s own suggestion above.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Recoverable Amount</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Expected Recovery Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impactScores.map((s) => (
                <TableRow key={s.id} className={s.selected ? "bg-emerald-50" : ""}>
                  <TableCell>
                    <Badge className={ACTION_COLOR[s.action_type]}>{ACTION_LABEL[s.action_type]}</Badge>
                    {s.selected && <span className="ml-2 text-[11px] text-emerald-700 font-medium">SELECTED</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatInrPrecise(s.potential_recoverable_amount)}</TableCell>
                  <TableCell className="tabular-nums">{(s.recovery_probability * 100).toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums">{formatInrPrecise(s.intervention_cost)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{formatInrPrecise(s.expected_recovery_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="policy" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policyChecks.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.rule_name}</TableCell>
                  <TableCell>
                    <Badge className={p.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                      {p.passed ? "PASSED" : "FAILED"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-neutral-600">{p.detail}</TableCell>
                </TableRow>
              ))}
              {policyChecks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-neutral-400">
                    No policy evaluation yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="execution" className="pt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Executions</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge className={ACTION_COLOR[e.action_type]}>{ACTION_LABEL[e.action_type]}</Badge>
                    </TableCell>
                    <TableCell className="uppercase text-xs">{e.provider}</TableCell>
                    <TableCell>
                      <Badge className={e.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.external_ref ?? "—"}</TableCell>
                    <TableCell className="text-xs text-neutral-500">{new Date(e.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {executions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-neutral-400">No executions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Verifications</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Verified</TableHead>
                  <TableHead>Amount Recovered</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Badge className={v.verified ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"}>
                        {v.verified ? "VERIFIED" : "NOT VERIFIED"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatInrPrecise(v.amount_recovered)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {v.source === "webhook" ? "Real Razorpay webhook" : v.source === "simulated_trigger" ? "Demo simulated" : "Poll"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-neutral-500">{new Date(v.verified_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {verifications.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-neutral-400">Not yet verified.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <div className="space-y-3">
            {auditLog.map((a) => (
              <div key={a.id} className="flex gap-3 text-sm border-l-2 border-neutral-200 pl-3">
                <div className="text-xs text-neutral-400 w-40 shrink-0 pt-0.5">
                  {new Date(a.created_at).toLocaleString()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.event_type}</span>
                    <Badge variant="outline" className="text-[10px]">{a.actor}</Badge>
                  </div>
                  <pre className="text-xs text-neutral-500 mt-1">{JSON.stringify(a.detail)}</pre>
                </div>
              </div>
            ))}
            {auditLog.length === 0 && <span className="text-sm text-neutral-400">No audit events.</span>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="py-3 gap-1">
      <CardContent className="px-4">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
