// Shared vocabulary for the recovery pipeline, used by both the live batch
// run view (aggregate, event-driven) and the Case Investigation page
// (per-case, data-driven). Internal LangGraph node names map onto this
// externally-facing 8-stage narrative.

export type PipelineStageKey =
  | "signals"
  | "diagnosis"
  | "options"
  | "impact"
  | "policy"
  | "approval"
  | "execution"
  | "outcome";

export interface PipelineStageDef {
  key: PipelineStageKey;
  label: string;
  hint: string;
}

export const PIPELINE_STAGES: PipelineStageDef[] = [
  { key: "signals", label: "Signals", hint: "Raw gateway/checkout/subscription/receivable evidence" },
  { key: "diagnosis", label: "AI Diagnosis", hint: "LLM root-cause reasoning over the evidence" },
  { key: "options", label: "Options", hint: "AI's candidate recommendation" },
  { key: "impact", label: "Business Impact", hint: "Deterministic ERV across every feasible action" },
  { key: "policy", label: "Policy", hint: "Deterministic guardrails gate the ERV-selected action" },
  { key: "approval", label: "Human Approval", hint: "Only for cases policy routes to a human" },
  { key: "execution", label: "Execution", hint: "Real Razorpay/Resend call, or simulated retry" },
  { key: "outcome", label: "Outcome", hint: "Verified recovery result" },
];

const NODE_TO_STAGE: Record<string, PipelineStageKey> = {
  queued: "signals",
  detect: "signals",
  root_cause: "diagnosis",
  recommend: "options",
  // The governance nodes don't get their own externally-facing stage: agent
  // proposals ARE the options being weighed, and the final decision is the
  // policy gate's conclusion. Folding them in keeps the narrative at 8 steps.
  agent_proposals: "options",
  shared_context_conflict: "options",
  business_impact: "impact",
  policy: "policy",
  final_decision: "policy",
  escalate: "approval",
  execute: "execution",
  verify: "outcome",
  stop: "outcome",
  defer: "outcome",
};

export function nodeToPipelineStage(nodeName: string): PipelineStageKey | null {
  return NODE_TO_STAGE[nodeName] ?? null;
}

export type StageStatus = "done" | "active" | "pending" | "skipped";

const TERMINAL_STATUSES = new Set(["recovered", "closed", "stopped", "escalated", "failed"]);

/** Derives each pipeline stage's status for a single case from its stored data — used by the Case Investigation page. */
export function caseStageStatuses(input: {
  hasEvidence: boolean;
  hasRootCause: boolean;
  hasRecommendation: boolean;
  hasImpact: boolean;
  hasPolicy: boolean;
  approvalStatus: "pending" | "resolved" | "none";
  hasExecution: boolean;
  hasOutcome: boolean;
  caseStatus: string;
}): Record<PipelineStageKey, StageStatus> {
  const isTerminal = TERMINAL_STATUSES.has(input.caseStatus);

  return {
    signals: input.hasEvidence ? "done" : "pending",
    diagnosis: input.hasRootCause ? "done" : input.hasEvidence ? "active" : "pending",
    options: input.hasRecommendation ? "done" : input.hasRootCause ? "active" : "pending",
    impact: input.hasImpact ? "done" : input.hasRecommendation ? "active" : "pending",
    policy: input.hasPolicy ? "done" : input.hasImpact ? "active" : "pending",
    approval:
      input.approvalStatus === "resolved"
        ? "done"
        : input.approvalStatus === "pending"
          ? "active"
          : input.hasPolicy
            ? "skipped"
            : "pending",
    execution: input.hasExecution
      ? "done"
      : input.hasPolicy && input.approvalStatus !== "pending" && !isTerminal
        ? "active"
        : input.hasPolicy && (isTerminal || input.approvalStatus === "pending")
          ? "skipped"
          : "pending",
    outcome: input.hasOutcome || isTerminal ? "done" : input.hasExecution ? "active" : "pending",
  };
}
