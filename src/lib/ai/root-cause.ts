import { getChatModel, currentModelName } from "./provider";
import { rootCauseSchema } from "./schemas";
import type { Evidence, RiskType, RootCauseResult } from "@/types/domain";

export interface RootCauseInput {
  riskType: RiskType;
  amount: number;
  customerTier: string;
  contactAttempts: number;
  daysSinceFailure: number;
  evidence: Pick<Evidence, "source" | "payload">[];
}

export interface RootCauseOutput {
  result: RootCauseResult;
  model: string;
}

const SYSTEM_PROMPT = `You are the Root Cause Agent inside RazorReclaim, an AI revenue recovery system for a payments company.

You are given raw signals about ONE revenue-at-risk case: gateway/checkout/subscription/receivable data plus a customer profile. You do NOT get told the "reason" up front — you must infer it from the signals, the same way you would from real production data.

Reason like a fintech operations analyst: correlate the signals (decline codes, funnel step, mandate status, days overdue, contact history, customer tenure) into a specific, evidence-grounded diagnosis.

Your qualitative_recovery_probability must reflect the evidence honestly — a case with a hard decline (FRAUD_SUSPECTED, DO_NOT_HONOR), many prior contact attempts, and long elapsed time should read as low/very_low, not medium, regardless of amount. Amount does not affect recoverability — it only affects how much is at stake.

Respond with ONLY the structured fields requested. Do not include a preamble, chain-of-thought, or <think> tags. evidence_summary must be short, concrete bullet points that cite specific evidence values — not a restatement of these instructions.`;

export async function runRootCauseReasoning(input: RootCauseInput): Promise<RootCauseOutput> {
  const model = getChatModel(0.2).withStructuredOutput(rootCauseSchema, {
    name: "root_cause_diagnosis",
  });

  const userPrompt = [
    `Risk type: ${input.riskType}`,
    `Amount at risk: ₹${input.amount.toLocaleString("en-IN")}`,
    `Customer tier: ${input.customerTier}`,
    `Prior contact attempts: ${input.contactAttempts}`,
    `Days since failure: ${input.daysSinceFailure}`,
    ``,
    `Evidence:`,
    ...input.evidence.map((e) => `- [${e.source}] ${JSON.stringify(e.payload)}`),
  ].join("\n");

  const result = (await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ])) as unknown as RootCauseResult;

  return { result, model: currentModelName() };
}
