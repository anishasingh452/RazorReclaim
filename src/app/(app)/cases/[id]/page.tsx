import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Radio, Sparkles, Stethoscope } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCaseDetail } from "@/lib/cases/get-case-detail";
import {
  ACTION_COLOR,
  ACTION_LABEL,
  DECISION_CATEGORY_COLOR,
  DECISION_CATEGORY_LABEL,
  RISK_TYPE_COLOR,
  RISK_TYPE_LABEL,
  SCHEDULED_STATUS_COLOR,
  SCHEDULED_STATUS_LABEL,
  STATUS_COLOR,
  STATUS_DOT,
  STATUS_LABEL,
  actionToCategory,
  avatarTint,
  formatInrPrecise,
  initials,
} from "@/lib/display";
import { caseStageStatuses } from "@/lib/pipeline";
import { PipelineStepper } from "@/components/pipeline/pipeline-stepper";
import { DecisionComparison } from "@/components/case/decision-comparison";
import { ApprovalActions } from "@/components/case/approval-actions";
import { WhyNotToAct } from "@/components/case/why-not-to-act";
import { AgentArena } from "@/components/case/agent-arena";
import { DecisionGraph } from "@/components/case/decision-graph";
import { PolicyRails } from "@/components/case/policy-rails";
import { VoicePanel } from "@/components/case/voice-panel";
import { CustomerMemory } from "@/components/case/customer-memory";
import { SimulatePaymentButton } from "@/components/case/simulate-payment-button";
import { ErvBars } from "@/components/viz/erv-bars";
import { RadialGauge } from "@/components/viz/radial-gauge";
import type {
  ActionType,
  ExecutionProvider,
  RecommendationResult,
  RootCauseResult,
  VerificationSource,
} from "@/types/domain";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCaseDetail(id);
  if (!detail) notFound();

  const {
    case: c,
    evidence,
    decisions,
    impactScores,
    policyChecks,
    executions,
    verifications,
    auditLog,
    approvals,
    agentProposals,
    agentConflicts,
    noActionDecision,
    scheduledActions,
    voiceInteractions,
    promisesToPay,
    customerHistory,
    auditChainIntegrity,
  } = detail;

  const rootCauseDecision = decisions.find((d) => d.stage === "root_cause");
  const recommendDecision = decisions.find((d) => d.stage === "recommend");
  const rootCause = rootCauseDecision?.ai_output as unknown as RootCauseResult | undefined;
  const recommendation = recommendDecision?.ai_output as unknown as RecommendationResult | undefined;
  const pendingApproval = approvals.find((a) => a.status === "pending");
  const selectedImpact = impactScores.find((s) => s.selected);
  const failedRules = policyChecks.filter((p) => !p.passed).map((p) => p.rule_name);
  const policyAllowed = policyChecks.length > 0 ? failedRules.length === 0 : null;
  const category = c.final_action ? actionToCategory(c.final_action) : null;
  const activePromise = promisesToPay.find((p) => p.status === "pending") ?? null;
  const hasRealPaymentLink = executions.some((e) => e.provider === "razorpay" && e.status === "success");
  const isRecovered = verifications.some((v) => v.verified);

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
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-8 md:px-8">
      <Link
        href="/command-center"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-emerald-300"
      >
        <ArrowLeft className="size-3.5" /> Command Center
      </Link>

      {/* Hero */}
      <header className="rise glass relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-20 size-72 rounded-full bg-emerald-500/[0.03] blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${avatarTint(c.customer_name)}`}
            >
              {initials(c.customer_name)}
            </span>
            <div className="min-w-0">
              <h1 className="text-luminous truncate text-xl font-semibold tracking-tight">{c.customer_name}</h1>
              <p className="stat-value mt-0.5 truncate text-xs text-muted-foreground">
                {c.customer_id} · {c.customer_email} · {c.customer_tier.toUpperCase()}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${RISK_TYPE_COLOR[c.risk_type]}`}
                >
                  {RISK_TYPE_LABEL[c.risk_type]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[c.status]}`}
                >
                  <span className={`size-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                  {STATUS_LABEL[c.status]}
                </span>
                {category && (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${DECISION_CATEGORY_COLOR[category]}`}
                  >
                    {DECISION_CATEGORY_LABEL[category].toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {selectedImpact && <RadialGauge value={selectedImpact.recovery_probability} label="recovery" size={78} />}
            <div className="text-right">
              <div className="micro-label">{isRecovered ? "Recovered" : "At risk"}</div>
              <div
                className={`stat-value mt-1 text-2xl font-semibold ${isRecovered ? "text-emerald-300" : "text-foreground"}`}
              >
                {formatInrPrecise(c.amount)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {c.contact_attempts} contact attempt{c.contact_attempts === 1 ? "" : "s"} · {c.days_since_failure}d old
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Pipeline */}
      <section className="rise glass p-5" style={{ "--d": "60ms" } as React.CSSProperties}>
        <div className="micro-label mb-4">Recovery pipeline</div>
        <PipelineStepper statuses={stageStatuses} />
      </section>

      {/* Flagship: three voices in one decision */}
      {(rootCause || selectedImpact) && (
        <section className="rise glass p-5" style={{ "--d": "120ms" } as React.CSSProperties}>
          <div className="micro-label mb-4">How this decision was made</div>
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
        </section>
      )}

      {noActionDecision && <WhyNotToAct decision={noActionDecision} finalAction={c.final_action} />}

      {pendingApproval && (
        <section className="rise glass border-amber-500/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="micro-label text-amber-300/80">Human decision required</div>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                Policy routed this case out of automation. Approving resumes execution from where the graph paused.
              </p>
            </div>
            <ApprovalActions approvalId={pendingApproval.id} />
          </div>
        </section>
      )}

      <CustomerMemory customerName={c.customer_name} history={customerHistory} activePromise={activePromise} />

      {/* Reasoning */}
      <div className="grid gap-4 md:grid-cols-2">
        <ReasoningCard
          icon={<Stethoscope className="size-3.5" />}
          title="Root cause diagnosis"
          tone="border-sky-500/20 bg-sky-500/[0.08] text-sky-200"
          model={rootCauseDecision?.model}
          delay={180}
        >
          {rootCause ? (
            <>
              <p className="text-sm leading-relaxed text-foreground/90">{rootCause.cause}</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip label="category" value={rootCause.category.replace(/_/g, " ")} />
                <Chip label="odds" value={rootCause.qualitative_recovery_probability.replace(/_/g, " ")} />
                <Chip label="confidence" value={`${(rootCause.confidence * 100).toFixed(0)}%`} />
              </div>
              <EvidenceList items={rootCause.evidence_summary} />
            </>
          ) : (
            <span className="text-sm text-muted-foreground/50">Not yet diagnosed.</span>
          )}
        </ReasoningCard>

        <ReasoningCard
          icon={<Sparkles className="size-3.5" />}
          title="AI recommendation"
          tone="border-indigo-400/20 bg-indigo-400/[0.08] text-indigo-200"
          model={recommendDecision?.model}
          delay={230}
        >
          {recommendation ? (
            <>
              <span
                className={`inline-flex w-fit items-center rounded-lg border px-2.5 py-1 text-sm font-semibold ${ACTION_COLOR[recommendation.suggested_action]}`}
              >
                {ACTION_LABEL[recommendation.suggested_action]}
              </span>
              <EvidenceList items={recommendation.evidence_summary} />
            </>
          ) : (
            <span className="text-sm text-muted-foreground/50">No recommendation yet.</span>
          )}
        </ReasoningCard>
      </div>

      {/* Deep dive */}
      <Tabs defaultValue="agents" className="rise" style={{ "--d": "280ms" } as React.CSSProperties}>
        <TabsList variant="line" className="flex-wrap">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="impact">Impact ledger</TabsTrigger>
          <TabsTrigger value="policy">Guardrails</TabsTrigger>
          <TabsTrigger value="execution">Execution</TabsTrigger>
          {voiceInteractions.length > 0 && <TabsTrigger value="voice">Voice</TabsTrigger>}
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="graph">Decision graph</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="pt-5">
          <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Two independent agents propose an action for every case. Conflict detection only flags the disagreement —
            the deterministic Business Impact Engine picks the winner on expected value, regardless of which agent
            proposed it.
          </p>
          <AgentArena proposals={agentProposals} conflicts={agentConflicts} />
        </TabsContent>

        <TabsContent value="impact" className="pt-5">
          <p className="mb-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Expected Recovery Value = recoverable amount × recovery probability − intervention cost. Computed
            deterministically for every feasible action, independent of anything the LLM said.
          </p>
          {impactScores.length > 0 ? (
            <ErvBars scores={impactScores} />
          ) : (
            <div className="glass p-10 text-center text-sm text-muted-foreground">No candidate actions scored yet.</div>
          )}
        </TabsContent>

        <TabsContent value="policy" className="pt-5">
          <PolicyRails checks={policyChecks} />
        </TabsContent>

        <TabsContent value="execution" className="space-y-5 pt-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="micro-label">Executions</div>
              {hasRealPaymentLink && !isRecovered && <SimulatePaymentButton caseId={c.id} />}
            </div>
            {executions.length === 0 && (
              <div className="glass p-8 text-center text-sm text-muted-foreground">Nothing executed yet.</div>
            )}
            {executions.map((e) => (
              <div key={e.id} className="glass flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[e.action_type]}`}
                >
                  {ACTION_LABEL[e.action_type]}
                </span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                    e.provider === "razorpay" || e.provider === "resend"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-zinc-400"
                  }`}
                >
                  {e.provider === "razorpay" || e.provider === "resend" ? `real · ${e.provider}` : e.provider}
                </span>
                <span
                  className={`text-[11px] font-medium ${e.status === "success" ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {e.status}
                </span>
                {e.external_ref && (
                  <span className="stat-value text-[10.5px] text-muted-foreground/60">{e.external_ref}</span>
                )}
                <span className="stat-value ml-auto text-[10.5px] text-muted-foreground/50">
                  {new Date(e.created_at).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="micro-label">Verifications</div>
            {verifications.length === 0 && (
              <div className="glass p-8 text-center text-sm text-muted-foreground">Outcome not yet verified.</div>
            )}
            {verifications.map((v) => (
              <div key={v.id} className="glass flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    v.verified
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-zinc-400"
                  }`}
                >
                  {v.verified ? "Verified" : "Not verified"}
                </span>
                <span className="stat-value text-sm font-semibold text-emerald-300">
                  {formatInrPrecise(v.amount_recovered)}
                </span>
                <span className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 text-[10.5px] text-muted-foreground">
                  {verificationSourceLabel(v.source, executions.find((e) => e.id === v.execution_id)?.provider)}
                </span>
                <span className="stat-value ml-auto text-[10.5px] text-muted-foreground/50">
                  {new Date(v.verified_at).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>

          {scheduledActions.length > 0 && (
            <div className="space-y-2">
              <div className="micro-label">Scheduled follow-ups</div>
              {scheduledActions.map((s) => (
                <div key={s.id} className="glass flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLOR[s.action_type]}`}
                  >
                    {ACTION_LABEL[s.action_type]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-medium ${SCHEDULED_STATUS_COLOR[s.status]}`}
                  >
                    {SCHEDULED_STATUS_LABEL[s.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.reason}</span>
                  <span className="stat-value ml-auto text-[10.5px] text-muted-foreground/50">
                    {new Date(s.scheduled_for).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {voiceInteractions.length > 0 && (
          <TabsContent value="voice" className="pt-5">
            <VoicePanel interactions={voiceInteractions} promises={promisesToPay} />
          </TabsContent>
        )}

        <TabsContent value="evidence" className="space-y-3 pt-5">
          {evidence.length === 0 && (
            <div className="glass p-10 text-center text-sm text-muted-foreground">No evidence recorded.</div>
          )}
          {evidence.map((e) => (
            <div key={e.id} className="glass p-4">
              <div className="micro-label mb-2.5 flex items-center gap-1.5">
                <Radio className="size-3" />
                {e.source.replace(/_/g, " ")}
              </div>
              <pre className="inset-panel overflow-x-auto p-3 text-[11px] leading-relaxed text-zinc-300">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="graph" className="pt-5">
          <DecisionGraph events={auditLog} integrity={auditChainIntegrity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReasoningCard({
  icon,
  title,
  tone,
  model,
  delay,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tone: string;
  model?: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rise glass glass-hover flex flex-col gap-3 p-5"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span className={`flex size-6 items-center justify-center rounded-md border ${tone}`}>{icon}</span>
        <span className="micro-label">{title}</span>
      </div>
      {children}
      {model && <div className="stat-value mt-auto pt-1 text-[10px] text-muted-foreground/40">{model}</div>}
    </section>
  );
}

/**
 * `simulated_trigger` covers two genuinely different things: the pipeline's
 * own deterministic outcome for a retry/voice action (nothing external to
 * wait on), and a human pressing the demo button against a REAL Razorpay
 * payment link. Labelling both "demo-triggered" blurs precisely the
 * real-vs-simulated line this product is built to keep visible, so the
 * linked execution's provider disambiguates them.
 */
function verificationSourceLabel(source: VerificationSource, provider: ExecutionProvider | undefined): string {
  if (source === "webhook") return "Real Razorpay webhook";
  if (source === "poll") return "Polled";
  return provider === "razorpay" ? "Demo-triggered on a real link" : "Simulated outcome";
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 text-[10.5px]">
      <span className="text-muted-foreground/60">{label}</span>
      <span className="stat-value text-foreground/80">{value}</span>
    </span>
  );
}

function EvidenceList({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-400/50" />
          {item}
        </li>
      ))}
    </ul>
  );
}
