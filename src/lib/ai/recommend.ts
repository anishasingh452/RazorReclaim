import { getChatModel, currentModelName } from "./provider";
import { recommendationSchema } from "./schemas";
import type { RecommendationResult, RiskType, RootCauseResult } from "@/types/domain";

export interface RecommendInput {
  riskType: RiskType;
  amount: number;
  customerTier: string;
  contactAttempts: number;
  daysSinceFailure: number;
  rootCause: RootCauseResult;
}

export interface RecommendOutput {
  result: RecommendationResult;
  model: string;
}

const SYSTEM_PROMPT = `You are the Intervention Agent inside RazorReclaim, an AI revenue recovery system.

Given a case's root-cause diagnosis, propose the single best next action from: retry, payment_link, reminder, wait_and_retry, escalate, stop.

Guidance:
- retry: only sensible for failed_payment/subscription_failure with a technical, likely-transient cause (gateway timeout, network error) and few prior attempts.
- payment_link: good general-purpose recovery action when the customer needs to take a new payment action.
- reminder: a lighter-touch nudge, use when confidence in recovery is moderate and a full payment link isn't yet warranted, or as a first touch.
- wait_and_retry: use when the case is very fresh and an immediate action is premature.
- escalate: use when the case needs human judgment — large sums, disputes, invoice negotiations, or repeated failures where automation clearly isn't working.
- stop: use when the evidence suggests further attempts are very unlikely to recover money (e.g. fraud suspected, customer clearly disengaged, already heavily contacted).

This is a RECOMMENDATION only — a separate deterministic system will compute the actual expected monetary value of each option and may select a different action than the one you suggest. Give your honest best judgment regardless; do not try to guess what the deterministic system will pick.

Respond with ONLY the structured fields requested. Do not include a preamble, chain-of-thought, or <think> tags. evidence_summary must be short, concrete bullet points — not a restatement of these instructions.`;

export async function runRecommendation(input: RecommendInput): Promise<RecommendOutput> {
  const model = getChatModel(0.2).withStructuredOutput(recommendationSchema, {
    name: "intervention_recommendation",
  });

  const userPrompt = [
    `Risk type: ${input.riskType}`,
    `Amount at risk: ₹${input.amount.toLocaleString("en-IN")}`,
    `Customer tier: ${input.customerTier}`,
    `Prior contact attempts: ${input.contactAttempts}`,
    `Days since failure: ${input.daysSinceFailure}`,
    ``,
    `Root cause diagnosis:`,
    `- Cause: ${input.rootCause.cause}`,
    `- Category: ${input.rootCause.category}`,
    `- Qualitative recovery probability: ${input.rootCause.qualitative_recovery_probability}`,
    `- Diagnosis confidence: ${input.rootCause.confidence}`,
    `- Evidence: ${input.rootCause.evidence_summary.join("; ")}`,
  ].join("\n");

  const result = (await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ])) as unknown as RecommendationResult;

  return { result, model: currentModelName() };
}
