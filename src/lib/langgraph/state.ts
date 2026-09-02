import { Annotation } from "@langchain/langgraph";
import type {
  ActionType,
  AgentProposal,
  Case,
  Evidence,
  Execution,
  PolicyDecision,
  RecommendationResult,
  RootCauseResult,
  SharedCaseContext,
  Verification,
} from "@/types/domain";
import type { ImpactCandidate } from "@/lib/impact/engine";

/**
 * Per-case LangGraph state. Every node reads a subset of this and returns a
 * partial update. Deliberately plain-data (no callbacks/closures) so this
 * stays checkpointer-safe if a durable checkpointer is added later.
 */
// Bare `Annotation<T>()` (no explicit reducer) uses the plain "last value
// wins" channel whose Update type is exactly T — no Overwrite-wrapper union
// to fight with when accumulating stream chunks in run-case.ts. Safe here
// because the graph's fixed node ordering guarantees every field is written
// by its producing node before any downstream node reads it.
export const CaseGraphAnnotation = Annotation.Root({
  caseId: Annotation<string>(),
  caseRecord: Annotation<Case | null>(),
  evidence: Annotation<Evidence[]>(),

  rootCause: Annotation<RootCauseResult | null>(),
  rootCauseModel: Annotation<string | null>(),

  recommendation: Annotation<RecommendationResult | null>(),
  recommendationModel: Annotation<string | null>(),

  // Agent Command Center — multiple agents' proposals + the cross-case
  // shared context consulted to reconcile/govern them.
  agentProposals: Annotation<AgentProposal[]>(),
  sharedContext: Annotation<SharedCaseContext | null>(),

  impactCandidates: Annotation<ImpactCandidate[]>(),
  selectedImpact: Annotation<ImpactCandidate | null>(),

  policyDecision: Annotation<PolicyDecision | null>(),
  finalAction: Annotation<ActionType | null>(),

  executionResult: Annotation<Execution | null>(),
  verification: Annotation<Verification | null>(),
});

export type CaseGraphState = typeof CaseGraphAnnotation.State;
export type CaseGraphUpdate = typeof CaseGraphAnnotation.Update;
