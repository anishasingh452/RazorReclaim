// Core domain types shared across the reasoning, policy, impact, and execution layers.
// These mirror the Supabase schema in supabase/migrations/0001_init.sql.

export type RiskType =
  | "failed_payment"
  | "checkout_abandonment"
  | "subscription_failure"
  | "overdue_receivable";

export type CustomerTier = "retail" | "smb" | "b2b";

export type CaseStatus =
  | "open"
  | "in_progress"
  | "awaiting_approval"
  | "escalated"
  | "stopped"
  | "recovered"
  | "closed"
  | "failed";

export type ActionType =
  | "retry"
  | "payment_link"
  | "reminder"
  | "wait_and_retry"
  | "escalate"
  | "stop"
  | "voice"
  | "no_action";

export interface Case {
  id: string;
  batch_id: string;
  seq: number;
  customer_name: string;
  customer_id: string;
  customer_email: string;
  customer_tier: CustomerTier;
  amount: number;
  currency: string;
  risk_type: RiskType;
  contact_attempts: number;
  days_since_failure: number;
  is_synthetic: boolean;
  status: CaseStatus;
  final_action: ActionType | null;
  signal_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SignalStatus = "new" | "linked" | "ignored";

/** A raw, pre-case detection event. A case is created FROM a signal, not the other way around. */
export interface Signal {
  id: string;
  batch_id: string | null;
  case_id: string | null;
  source: "gateway" | "checkout_funnel" | "subscription_engine" | "receivable_ledger" | "razorpay_webhook" | "manual";
  signal_type: string;
  payload: Record<string, unknown>;
  status: SignalStatus;
  detected_at: string;
  created_at: string;
}

/** Case row enriched with its selected Business Impact Engine candidate — what the Command Center table displays. */
export interface CaseWithImpact extends Case {
  selectedRecoveryProbability: number | null;
  selectedExpectedRecoveryValue: number | null;
}

export interface Evidence {
  id: string;
  case_id: string;
  source: "gateway" | "checkout_funnel" | "subscription_engine" | "receivable_ledger" | "customer_profile";
  payload: Record<string, unknown>;
  created_at: string;
}

export type DecisionStage = "root_cause" | "recommend";

export interface Decision {
  id: string;
  case_id: string;
  stage: DecisionStage;
  ai_output: Record<string, unknown>;
  confidence: number | null;
  reasoning: string;
  model: string;
  created_at: string;
}

/** Structured output contract for the root_cause_node LLM call. */
export interface RootCauseResult {
  cause: string;
  category:
    | "temporary_gateway_failure"
    | "insufficient_funds"
    | "card_expired_or_invalid"
    | "customer_abandoned"
    | "bank_declined"
    | "subscription_mandate_failed"
    | "invoice_dispute"
    | "unknown";
  qualitative_recovery_probability: "very_low" | "low" | "medium" | "high" | "very_high";
  confidence: number; // 0..1
  /** 1-4 short, concrete, evidence-grounded bullet points — not free-form chain-of-thought. */
  evidence_summary: string[];
}

/** Structured output contract for the recommend_node LLM call. */
export interface RecommendationResult {
  suggested_action: ActionType;
  /** 1-4 short, concrete, evidence-grounded bullet points — not free-form chain-of-thought. */
  evidence_summary: string[];
  confidence: number; // 0..1
}

export interface ImpactScore {
  id: string;
  case_id: string;
  action_type: ActionType;
  potential_recoverable_amount: number;
  recovery_probability: number;
  intervention_cost: number;
  expected_recovery_value: number;
  selected: boolean;
  /** false when the Candidate Action Engine ruled this action out before any scoring (e.g. retry doesn't apply to a receivable). */
  feasible: boolean;
  exclusion_reason: string | null;
  created_at: string;
}

export interface PolicyCheck {
  id: string;
  case_id: string;
  rule_name: string;
  passed: boolean;
  detail: string;
  created_at: string;
}

export interface PolicyDecision {
  allowed: boolean;
  action: ActionType;
  requiresHuman: boolean;
  requiresStop: boolean;
  checks: Omit<PolicyCheck, "id" | "case_id" | "created_at">[];
}

export type ExecutionProvider = "razorpay" | "resend" | "simulated" | "none";
export type ExecutionStatus = "pending" | "success" | "failed";

export interface Execution {
  id: string;
  case_id: string;
  action_type: ActionType;
  provider: ExecutionProvider;
  external_ref: string | null;
  status: ExecutionStatus;
  idempotency_key: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
}

export type VerificationSource = "webhook" | "simulated_trigger" | "poll";

export interface Verification {
  id: string;
  case_id: string;
  execution_id: string;
  verified: boolean;
  amount_recovered: number;
  source: VerificationSource;
  verified_at: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Approval {
  id: string;
  case_id: string;
  requested_action: Record<string, unknown>;
  status: ApprovalStatus;
  reviewer: string | null;
  reviewed_at: string | null;
  langgraph_thread_id: string;
  created_at: string;
}

export type AuditActor =
  | "ai_agent"
  | "policy_engine"
  | "impact_engine"
  | "candidate_engine"
  | "human"
  | "system"
  | "conflict_engine"
  | "reasoning_engine";

export interface AuditEvent {
  id: string;
  case_id: string;
  event_type: string;
  actor: AuditActor;
  detail: Record<string, unknown>;
  model_version: string | null;
  prev_hash: string | null;
  hash: string | null;
  created_at: string;
}

export type ScheduledActionStatus = "pending" | "executed" | "cancelled";

export interface ScheduledAction {
  id: string;
  case_id: string;
  action_type: ActionType;
  scheduled_for: string;
  status: ScheduledActionStatus;
  reason: string | null;
  created_at: string;
  executed_at: string | null;
}

export type VoiceCallStatus = "completed" | "no_answer" | "voicemail" | "declined";
export type VoiceCallOutcome = "promise_to_pay" | "refused" | "callback_requested" | "no_response" | "resolved";

export interface VoiceInteraction {
  id: string;
  case_id: string;
  execution_id: string | null;
  provider: "simulated" | "real";
  call_status: VoiceCallStatus;
  duration_seconds: number;
  outcome: VoiceCallOutcome;
  transcript_summary: string | null;
  /** Populated only when a real ElevenLabs TTS clip backs this interaction — null means pure simulation. */
  audio_url: string | null;
  created_at: string;
}

export type PromiseToPayStatus = "pending" | "kept" | "broken";

export interface PromiseToPay {
  id: string;
  case_id: string;
  voice_interaction_id: string | null;
  promised_amount: number;
  promised_date: string;
  status: PromiseToPayStatus;
  created_at: string;
  resolved_at: string | null;
}

/** A durable, cross-case summary keyed by customer — decision memory for future reasoning. */
export interface DecisionMemory {
  id: string;
  customer_id: string;
  case_id: string;
  summary: string;
  final_action: ActionType | null;
  verified: boolean;
  amount_recovered: number;
  created_at: string;
}

// ============================================================
// Agent Command Center — governance layer above individual recovery
// actions: multiple agents may propose actions on the same case; this
// layer decides which one (if any) actually happens.
// ============================================================

/** The 5-way meta-decision the Command Center makes for every case. */
export type DecisionCategory = "ACT" | "WAIT" | "ESCALATE" | "NO_ACTION" | "STOP";

export type AgentProposalStatus = "proposed" | "selected" | "rejected_conflict" | "rejected_governor";

export interface AgentProposal {
  id: string;
  case_id: string;
  agent_name: string;
  proposed_action: ActionType;
  proposed_channel: string | null;
  confidence: number | null;
  rationale: string;
  status: AgentProposalStatus;
  created_at: string;
}

export type ConflictType = "duplicate_action" | "conflicting_action" | "competing_channel" | "contradictory_strategy";
export type ConflictResolution = "selected_winner" | "blocked_all" | "deferred";

export interface AgentConflict {
  id: string;
  case_id: string;
  conflict_type: ConflictType;
  proposal_ids: string[];
  resolution: ConflictResolution | null;
  winning_proposal_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export type NoActionReasonCode =
  | "likely_natural_recovery"
  | "already_contacted"
  | "active_promise_exists"
  | "communication_fatigue_risk"
  | "cost_exceeds_value"
  | "insufficient_confidence"
  | "other";

export interface NoActionDecision {
  id: string;
  case_id: string;
  reason_code: NoActionReasonCode;
  explanation: string;
  alternatives_considered: Record<string, unknown>[];
  created_at: string;
}

/** ALLOW: proceed. DELAY: wait, don't block outright. BLOCK: do not contact through this channel now. */
export type GovernorDecision = "ALLOW" | "DELAY" | "BLOCK";

export interface CommunicationGovernorResult {
  decision: GovernorDecision;
  reason: string;
}

/** Aggregated cross-agent context pulled before any agent proposes or communicates. */
export interface SharedCaseContext {
  customerId: string;
  priorDecisions: DecisionMemory[];
  activePromise: PromiseToPay | null;
  pendingScheduledActions: ScheduledAction[];
  priorExecutionCount: number;
  hoursSinceLastExecution: number | null;
}

// ============================================================
// Read models — shapes the API layer composes for the UI. These are
// projections over existing tables (joined/ranked/verified), never new
// state of their own.
// ============================================================

/** One case's place in the batch-wide priority ranking, joined with the display fields the UI needs. */
export interface RankedPortfolioOpportunity {
  caseId: string;
  customerName: string;
  customerTier: CustomerTier;
  riskType: RiskType;
  status: CaseStatus;
  finalAction: ActionType | null;
  amount: number;
  daysSinceFailure: number;
  recoveryProbability: number;
  selectedErv: number;
  priorityScore: number;
}

export interface ConflictProposalSummary {
  id: string;
  agentName: string;
  proposedAction: ActionType;
  proposedChannel: string | null;
  confidence: number | null;
  rationale: string;
  status: AgentProposalStatus;
}

/** A conflict with everything needed to render it standalone, outside its case page. */
export interface ConflictFeedItem {
  id: string;
  caseId: string;
  customerName: string;
  amount: number;
  riskType: RiskType;
  conflictType: ConflictType;
  resolution: ConflictResolution | null;
  winningProposalId: string | null;
  proposals: ConflictProposalSummary[];
  message: string | null;
  createdAt: string;
}

/** Result of re-verifying a case's hash-chained audit trail on read. */
export interface AuditChainIntegrity {
  intact: boolean;
  /** Index of the first row whose hash doesn't reconcile, or null when the chain is whole. */
  brokenAtIndex: number | null;
  chainedRows: number;
  unchainedRows: number;
}

/** A decision-memory entry joined with a thumbnail of the case it came from. */
export interface CustomerHistoryEntry extends DecisionMemory {
  case_risk_type: RiskType | null;
  case_amount: number | null;
  case_status: CaseStatus | null;
}

export type BatchStatus = "pending" | "running" | "completed" | "failed";

export interface Batch {
  id: string;
  name: string;
  seed: string;
  concurrency: number;
  total_cases: number;
  total_at_risk: number;
  total_expected_recovery_value: number;
  total_recovered: number;
  status: BatchStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Per-case graph state threaded through the LangGraph workflow. */
export interface CaseGraphState {
  case: Case;
  evidence: Evidence[];
  rootCause: RootCauseResult | null;
  recommendation: RecommendationResult | null;
  impactScores: Omit<ImpactScore, "id" | "case_id" | "created_at">[];
  selectedImpact: Omit<ImpactScore, "id" | "case_id" | "created_at"> | null;
  policyDecision: PolicyDecision | null;
  executionResult: Execution | null;
  verification: Verification | null;
}

/** SSE event shape streamed from the batch orchestrator to the client. */
export interface BatchStreamEvent {
  type: "stage_transition" | "batch_metric" | "batch_complete";
  batchId: string;
  caseId?: string;
  stage?: string;
  status?: string;
  timestamp: string;
  detail?: Record<string, unknown>;
}
