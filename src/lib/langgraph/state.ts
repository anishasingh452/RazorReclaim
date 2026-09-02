import { Annotation } from "@langchain/langgraph";
import type {
  ActionType,
  Case,
  Evidence,
  Execution,
  PolicyDecision,
  RecommendationResult,
  RootCauseResult,
  Verification,
} from "@/types/domain";
import type { ImpactCandidate } from "@/lib/impact/engine";

/**
 * Per-case LangGraph state. Every node reads a subset of this and returns a
 * partial update. Deliberately plain-data (no callbacks/closures) so this
 * stays checkpointer-safe if a durable checkpointer is added later.
 */
export const CaseGraphAnnotation = Annotation.Root({
  caseId: Annotation<string>(),
  caseRecord: Annotation<Case | null>({ reducer: (_l, r) => r, default: () => null }),
  evidence: Annotation<Evidence[]>({ reducer: (_l, r) => r, default: () => [] }),

  rootCause: Annotation<RootCauseResult | null>({ reducer: (_l, r) => r, default: () => null }),
  rootCauseModel: Annotation<string | null>({ reducer: (_l, r) => r, default: () => null }),

  recommendation: Annotation<RecommendationResult | null>({ reducer: (_l, r) => r, default: () => null }),
  recommendationModel: Annotation<string | null>({ reducer: (_l, r) => r, default: () => null }),

  impactCandidates: Annotation<ImpactCandidate[]>({ reducer: (_l, r) => r, default: () => [] }),
  selectedImpact: Annotation<ImpactCandidate | null>({ reducer: (_l, r) => r, default: () => null }),

  policyDecision: Annotation<PolicyDecision | null>({ reducer: (_l, r) => r, default: () => null }),
  finalAction: Annotation<ActionType | null>({ reducer: (_l, r) => r, default: () => null }),

  executionResult: Annotation<Execution | null>({ reducer: (_l, r) => r, default: () => null }),
  verification: Annotation<Verification | null>({ reducer: (_l, r) => r, default: () => null }),
});

export type CaseGraphState = typeof CaseGraphAnnotation.State;
export type CaseGraphUpdate = typeof CaseGraphAnnotation.Update;
