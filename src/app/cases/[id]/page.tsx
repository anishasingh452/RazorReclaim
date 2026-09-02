import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCaseDetail } from "@/lib/cases/get-case-detail";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  avatarTint,
  formatInrPrecise,
  initials,
  RISK_TYPE_COLOR,
  RISK_TYPE_LABEL,
  STATUS_COLOR,
  STATUS_DOT,
  STATUS_LABEL,
} from "@/lib/display";
import { caseStageStatuses } from "@/lib/pipeline";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import { DecisionComparison } from "@/components/case/decision-comparison";
import { ApprovalActions } from "@/components/case/approval-actions";
import type { ActionType, RootCauseResult, RecommendationResult } from "@/types/domain";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  if (!detail) notFound();

  const { case: c, evidence, decisions, impactScores, policyChecks, executions, verifications, auditLog, approvals } =
    detail;

  const rootCauseDecision = decisions.find((d) => d.stage === "root_cause");
  const recommendDecision = decisions.find((d) => d.stage === "recommend");
  const rootCause = rootCauseDecision?.ai_output as unknown as RootCauseResult | undefined;
  const recommendation = recommendDecision?.ai_output as unknown as RecommendationResult | undefined;
  const pendingApproval = approvals.find((a) => a.status === "pending");
  const selectedImpact = impactScores.find((s) => s.selected);
  const failedRules = policyChecks.filter((p) => !p.passed).map((p) => p.rule_name);
  const policyAllowed = policyChecks.length > 0 ? failedRules.length === 0 : null;

  const stageStatuses = caseStageStatuses({
    hasEvidence: evidence.length > 0,
    hasRootCause: !!rootCauseDecision,
    hasRecommendation: !!recommendDecision,
    hasImpact: impactScores.length > 0,
    hasPolicy: policyChecks.length > 0,
    approvalStatus: approvals.length === 0 ? "none" : pendingApproval ? "pending" : "resolved",
    hasExecution: executions.length > 0,
    hasOutcome: verifications.length > 0,
    caseStatus: c.status,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-300 transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to Command Center
      </Link>

      {/* Hero */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTint(c.customer_name)}`}
          >
            {initials(c.customer_name)}
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{c.customer_name}</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {c.customer_id} · {c.customer_email} · {c.customer_tier.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${RISK_TYPE_COLOR[c.risk_type]}`}>
            {RISK_TYPE_LABEL[c.risk_type]}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[c.status]}`}>
            <span className={`size-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
            {STATUS_LABEL[c.status]}
          </span>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Amount at risk" value={formatInrPrecise(c.amount)} />
        <StatCard label="Contact attempts" value={String(c.contact_attempts)} />
        <StatCard label="Days since failure" value={String(c.days_since_failure)} />
        <StatCard label="Final action" value={c.final_action ? ACTION_LABEL[c.final_action as ActionType] : "—"} />
      </div>

      {/* Pipeline */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Recovery Pipeline
        </div>
        <PipelineStepper statuses={stageStatuses} />
      </div>

      {/* The flagship: AI vs Engine vs Policy */}
      {(rootCause || selectedImpact) && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-5 space-y-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            How This Decision Was Made
          </div>
          <DecisionComparison
            aiAction={(recommendation?.suggested_action as ActionType) ?? null}
            aiConfidence={recommendation?.confidence ?? null}
            engineAction={selectedImpact?.action_type ?? null}
            engineErv={selectedImpact?.expected_recovery_value ?? null}
            engineProbability={selectedImpact?.recovery_probability ?? null}
            finalAction={(c.final_action as ActionType) ?? null}
            policyAllowed={policyAllowed}
            failedRules={failedRules}
          />
        </div>
      )}

      {pendingApproval && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-5">
          <div className="text-sm font-medium text-amber-300 mb-3">Awaiting human approval</div>
          <ApprovalActions approvalId={pendingApproval.id} />
        </div>
      )}

      {/* Reasoning narrative */}
      <div className="grid md:grid-cols-2 gap-4">
        <ReasoningCard title="Root Cause Diagnosis" model={rootCauseDecision?.model}>
          {rootCause ? (
            <>
              <p className="text-sm text-foreground">{rootCause.cause}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                <span>category: {rootCause.category}</span>
                <span>recovery: {rootCause.qualitative_recovery_probability}</span>
                <span>confidence: {rootCause.confidence.toFixed(2)}</span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {rootCause.evidence_summary?.map((e, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-blue-400/60">·</span>
                    {e}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span className="text-sm text-muted-foreground/50">Not yet diagnosed.</span>
          )}
        </ReasoningCard>

        <ReasoningCard title="AI Recommendation" model={recommendDecision?.model}>
          {recommendation ? (
            <>
              <span
                className={`inline-flex w-fit items-center rounded-md border px-2 py-1 text-xs font-medium ${ACTION_COLOR[recommendation.suggested_action]}`}
              >
                {ACTION_LABEL[recommendation.suggested_action]}
              </span>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {recommendation.evidence_summary?.map((e, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-blue-400/60">·</span>
                    {e}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span className="text-sm text-muted-foreground/50">No recommendation yet.</span>
          )}
        </ReasoningCard>
      </div>

      {/* Deep-dive tabs */}
      <Tabs defaultValue="impact">
        <TabsList>
          <TabsTrigger value="impact">Impact Ledger</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="policy">Policy Checks</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="impact" className="pt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Expected Recovery Value = Potential Recoverable Amount × Recovery Probability − Intervention Cost.
            Computed deterministically for every feasible action.
          </p>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Action</TableHead>
                <TableHead>Recoverable Amount</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Expected Recovery Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impactScores.map((s) => (
                <TableRow key={s.id} className={`border-white/[0.06] ${s.selected ? "bg-emerald-500/[0.06]" : ""}`}>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[s.action_type]}`}>
                      {ACTION_LABEL[s.action_type]}
                    </span>
                    {s.selected && <span className="ml-2 text-[10px] text-emerald-400 font-mono">SELECTED</span>}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-sm">{formatInrPrecise(s.potential_recoverable_amount)}</TableCell>
                  <TableCell className="tabular-nums font-mono text-sm">{(s.recovery_probability * 100).toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums font-mono text-sm">{formatInrPrecise(s.intervention_cost)}</TableCell>
                  <TableCell className="tabular-nums font-mono text-sm font-medium">{formatInrPrecise(s.expected_recovery_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="evidence" className="pt-4 space-y-3">
          {evidence.length === 0 && <span className="text-sm text-muted-foreground/50">No evidence recorded.</span>}
          {evidence.map((e) => (
            <div key={e.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">{e.source}</div>
              <pre className="text-xs font-mono bg-black/30 rounded p-3 overflow-x-auto text-zinc-300">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="policy" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Rule</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policyChecks.map((p) => (
                <TableRow key={p.id} className="border-white/[0.06]">
                  <TableCell className="font-mono text-xs">{p.rule_name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        p.passed
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-red-500/10 text-red-300 border-red-500/20"
                      }`}
                    >
                      {p.passed ? "PASSED" : "FAILED"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.detail}</TableCell>
                </TableRow>
              ))}
              {policyChecks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground/50">
                    No policy evaluation yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="execution" className="pt-4 space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Executions</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Action</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((e) => (
                  <TableRow key={e.id} className="border-white/[0.06]">
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[e.action_type]}`}>
                        {ACTION_LABEL[e.action_type]}
                      </span>
                    </TableCell>
                    <TableCell className="uppercase text-xs font-mono text-muted-foreground">{e.provider}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                          e.status === "success"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-red-500/10 text-red-300 border-red-500/20"
                        }`}
                      >
                        {e.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.external_ref ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {executions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground/50">No executions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Verifications</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Verified</TableHead>
                  <TableHead>Amount Recovered</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications.map((v) => (
                  <TableRow key={v.id} className="border-white/[0.06]">
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                          v.verified
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-white/[0.04] text-muted-foreground border-white/10"
                        }`}
                      >
                        {v.verified ? "VERIFIED" : "NOT VERIFIED"}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums font-mono text-sm">{formatInrPrecise(v.amount_recovered)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {v.source === "webhook" ? "Real Razorpay webhook" : v.source === "simulated_trigger" ? "Demo simulated" : "Poll"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(v.verified_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {verifications.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground/50">Not yet verified.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="pt-4">
          <div className="space-y-3">
            {auditLog.map((a) => (
              <div key={a.id} className="flex gap-3 text-sm border-l-2 border-white/10 pl-3">
                <div className="text-xs text-muted-foreground font-mono w-40 shrink-0 pt-0.5">
                  {new Date(a.created_at).toLocaleString()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.event_type}</span>
                    <span className="inline-flex items-center rounded-md border border-white/10 px-1.5 py-0 text-[10px] text-muted-foreground">
                      {a.actor}
                    </span>
                  </div>
                  <pre className="text-xs text-muted-foreground/70 mt-1 font-mono">{JSON.stringify(a.detail)}</pre>
                </div>
              </div>
            ))}
            {auditLog.length === 0 && <span className="text-sm text-muted-foreground/50">No audit events.</span>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold tabular-nums font-mono mt-0.5">{value}</div>
    </div>
  );
}

function ReasoningCard({
  title,
  model,
  children,
}: {
  title: string;
  model?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
      {model && <div className="text-[10px] text-muted-foreground/50 font-mono pt-1">model: {model}</div>}
    </div>
  );
}
