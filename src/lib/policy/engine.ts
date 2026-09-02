import type { ActionType, PolicyCheck, PolicyDecision } from "@/types/domain";
import {
  AUTO_APPROVAL_LIMIT,
  COOLDOWN_HOURS,
  ESCALATE_INSTEAD_OF_STOP_THRESHOLD,
  HARASSMENT_HARD_CAP,
  MAX_COMMUNICATION_ATTEMPTS,
  MAX_RETRY_ATTEMPTS,
  MAX_TOTAL_EXECUTIONS,
} from "./config";

type PolicyCheckDraft = Omit<PolicyCheck, "id" | "case_id" | "created_at">;

export interface PolicyInput {
  amount: number;
  contactAttempts: number;
  /** Action the Business Impact Engine selected as ERV-maximizing. */
  candidateAction: ActionType;
  expectedRecoveryValue: number;
  /** Total executions already recorded for this case (any status). */
  priorExecutionCount: number;
  /** Hours since the most recent execution on this case, or null if none yet. */
  hoursSinceLastExecution: number | null;
}

const COMMUNICATION_ACTIONS: ActionType[] = ["payment_link", "reminder", "voice"];

/**
 * Every rule is evaluated and recorded for audit purposes, even after an
 * earlier rule has already determined the outcome — the policy_checks table
 * should show the full picture, not just the first failure.
 *
 * Precedence when multiple rules fail (highest wins):
 *   1. BOUNDED_EXECUTION            -> stop
 *   2. NO_REPEATED_HARASSMENT       -> stop
 *   3. STOP_ON_NEGATIVE_ERV         -> stop
 *   4. AMOUNT_ABOVE_AUTO_APPROVAL   -> escalate
 *   5. MAX_RETRY_ATTEMPTS           -> escalate (if amount high enough) else stop
 *   6. MAX_COMMUNICATION_ATTEMPTS   -> escalate (if amount high enough) else stop
 *   7. COOLDOWN_PERIOD_ACTIVE       -> defer (wait_and_retry, not terminal)
 */
export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const checks: PolicyCheckDraft[] = [];
  const isCommunication = COMMUNICATION_ACTIONS.includes(input.candidateAction);
  const isTerminalCandidate =
    input.candidateAction === "stop" || input.candidateAction === "escalate" || input.candidateAction === "no_action";

  // 1. Bounded execution — absolute ceiling regardless of action type.
  const boundedOk = input.priorExecutionCount < MAX_TOTAL_EXECUTIONS;
  checks.push({
    rule_name: "BOUNDED_EXECUTION",
    passed: boundedOk,
    detail: boundedOk
      ? `${input.priorExecutionCount}/${MAX_TOTAL_EXECUTIONS} executions used`
      : `Execution ceiling reached (${input.priorExecutionCount}/${MAX_TOTAL_EXECUTIONS}) — no further actions permitted`,
  });

  // 2. No repeated harassment — hard cap on contact attempts, independent of value.
  const harassmentOk = isTerminalCandidate || input.contactAttempts < HARASSMENT_HARD_CAP;
  checks.push({
    rule_name: "NO_REPEATED_HARASSMENT",
    passed: harassmentOk,
    detail: harassmentOk
      ? `${input.contactAttempts}/${HARASSMENT_HARD_CAP} contact attempts`
      : `Hard cap of ${HARASSMENT_HARD_CAP} contact attempts reached — further contact blocked unconditionally`,
  });

  // 3. Stop on negative expected value — ties the Business Impact Engine into policy.
  const ervOk = isTerminalCandidate || input.expectedRecoveryValue > 0;
  checks.push({
    rule_name: "STOP_ON_NEGATIVE_ERV",
    passed: ervOk,
    detail: ervOk
      ? `Expected recovery value ₹${input.expectedRecoveryValue.toFixed(2)} is positive`
      : `Expected recovery value ₹${input.expectedRecoveryValue.toFixed(2)} is not positive — no automated action is worth its cost`,
  });

  // 4. Amount above auto-approval limit — always requires a human, even if ERV is positive.
  const withinAutoLimit = isTerminalCandidate === false ? input.amount <= AUTO_APPROVAL_LIMIT : true;
  checks.push({
    rule_name: "AMOUNT_ABOVE_AUTO_APPROVAL_LIMIT",
    passed: withinAutoLimit,
    detail: withinAutoLimit
      ? `₹${input.amount.toLocaleString("en-IN")} is within the ₹${AUTO_APPROVAL_LIMIT.toLocaleString("en-IN")} auto-approval limit`
      : `₹${input.amount.toLocaleString("en-IN")} exceeds the ₹${AUTO_APPROVAL_LIMIT.toLocaleString("en-IN")} auto-approval limit — human approval required`,
  });

  // 5. Max retry attempts — blocks automated `retry` specifically.
  const isRetry = input.candidateAction === "retry";
  const retryOk = !isRetry || input.contactAttempts < MAX_RETRY_ATTEMPTS;
  checks.push({
    rule_name: "MAX_RETRY_ATTEMPTS",
    passed: retryOk,
    detail: retryOk
      ? `${input.contactAttempts}/${MAX_RETRY_ATTEMPTS} retry attempts`
      : `${input.contactAttempts}/${MAX_RETRY_ATTEMPTS} retry attempts reached — no further automated retries`,
  });

  // 6. Max communication attempts — blocks reminder/payment_link specifically.
  const commsOk = !isCommunication || input.contactAttempts < MAX_COMMUNICATION_ATTEMPTS;
  checks.push({
    rule_name: "MAX_COMMUNICATION_ATTEMPTS",
    passed: commsOk,
    detail: commsOk
      ? `${input.contactAttempts}/${MAX_COMMUNICATION_ATTEMPTS} communication attempts`
      : `${input.contactAttempts}/${MAX_COMMUNICATION_ATTEMPTS} communication attempts reached — no further messages`,
  });

  // 7. Cooldown period — soft block, defers rather than terminates.
  const cooldownOk =
    input.hoursSinceLastExecution === null || input.hoursSinceLastExecution >= COOLDOWN_HOURS;
  checks.push({
    rule_name: "COOLDOWN_PERIOD_ACTIVE",
    passed: cooldownOk,
    detail: cooldownOk
      ? input.hoursSinceLastExecution === null
        ? "No prior execution on this case"
        : `${input.hoursSinceLastExecution}h since last execution (>= ${COOLDOWN_HOURS}h cooldown)`
      : `Only ${input.hoursSinceLastExecution}h since last execution (< ${COOLDOWN_HOURS}h cooldown) — deferring`,
  });

  return resolveDecision(input, checks);
}

/**
 * Determines the final action by walking rules in precedence order, then
 * derives `requiresHuman`/`requiresStop` purely from that final action —
 * never from which branch produced it. This matters when the Business
 * Impact Engine's own candidate was already `escalate` or `stop` (e.g. a
 * ₹1,20,000 receivable where escalate is simply the highest-ERV choice):
 * that case must still surface as `requiresHuman: true` even though no
 * rule "overrode" anything, because reaching the human approval queue is a
 * property of the final action, not of whether policy intervened.
 */
function resolveDecision(input: PolicyInput, checks: PolicyCheckDraft[]): PolicyDecision {
  const passed = (name: string) => checks.find((c) => c.rule_name === name)?.passed ?? true;

  let finalAction: PolicyDecision["action"] = input.candidateAction;
  let overridden = false;

  if (!passed("BOUNDED_EXECUTION") || !passed("NO_REPEATED_HARASSMENT")) {
    finalAction = "stop";
    overridden = true;
  } else if (!passed("STOP_ON_NEGATIVE_ERV")) {
    finalAction = "stop";
    overridden = true;
  } else if (!passed("AMOUNT_ABOVE_AUTO_APPROVAL_LIMIT")) {
    finalAction = "escalate";
    overridden = true;
  } else if (!passed("MAX_RETRY_ATTEMPTS") || !passed("MAX_COMMUNICATION_ATTEMPTS")) {
    finalAction = input.amount >= ESCALATE_INSTEAD_OF_STOP_THRESHOLD ? "escalate" : "stop";
    overridden = true;
  } else if (!passed("COOLDOWN_PERIOD_ACTIVE")) {
    finalAction = "wait_and_retry";
    overridden = true;
  }

  return {
    allowed: !overridden,
    action: finalAction,
    requiresHuman: finalAction === "escalate",
    requiresStop: finalAction === "stop",
    checks,
  };
}
