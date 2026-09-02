import { z } from "zod";

// Structured-output contracts for the two LLM reasoning nodes. Kept as Zod
// schemas (not just TS types) so the model's response is validated, not
// trusted — a malformed/hallucinated field shape fails loudly rather than
// silently corrupting downstream deterministic math.
//
// `evidence_summary` (not a free-form "reasoning" paragraph) is deliberately
// a short, bounded list of concrete evidence-grounded points — explainable
// without exposing/relying on model chain-of-thought, and cheap for a local
// model to produce consistently within a tight latency budget.

const evidenceSummary = z
  .array(z.string().max(140))
  .min(1)
  .max(4)
  .describe("1-4 short, concrete, evidence-grounded bullet points (each under ~140 chars). No chain-of-thought, no filler — just the specific signals that drove the conclusion.");

export const rootCauseSchema = z.object({
  cause: z
    .string()
    .max(160)
    .describe("One short sentence stating why this case is at risk."),
  category: z.enum([
    "temporary_gateway_failure",
    "insufficient_funds",
    "card_expired_or_invalid",
    "customer_abandoned",
    "bank_declined",
    "subscription_mandate_failed",
    "invoice_dispute",
    "unknown",
  ]),
  qualitative_recovery_probability: z.enum(["very_low", "low", "medium", "high", "very_high"])
    .describe("Qualitative judgment of how likely this case is to be recovered by SOME intervention, based purely on the evidence signals."),
  confidence: z.number().min(0).max(1).describe("Confidence in this root-cause diagnosis, 0 to 1."),
  evidence_summary: evidenceSummary,
});

export const recommendationSchema = z.object({
  suggested_action: z.enum(["retry", "payment_link", "reminder", "wait_and_retry", "escalate", "stop"])
    .describe("The single best next action for this case, given the root cause and case context."),
  evidence_summary: evidenceSummary,
  confidence: z.number().min(0).max(1),
});
