import type { ActionType, CaseStatus, ExecutionStatus } from "@/types/domain";

/**
 * How long a case can sit `in_progress` with no forward progress before it's
 * treated as interrupted rather than merely slow. Sized off the LLM
 * providers this app actually runs against, not a guess: a single local
 * Ollama call has been observed to take 60-90s+, and a case can involve two
 * back-to-back calls (root cause, then recommendation) before either lands
 * an audit event. Five minutes gives a wide margin above that ceiling so a
 * genuinely active — just slow — case is never mistaken for a dead one.
 */
export const STUCK_CASE_STALE_AFTER_MS = 5 * 60 * 1000;

export interface StuckCaseExecution {
  actionType: ActionType;
  status: ExecutionStatus;
}

export interface StuckCaseInput {
  /** The most recent timestamp (ISO) at which anything about this case changed — see computeLastActivityAt. */
  lastActivityAt: string;
  /** Caller-supplied "now", so classification is deterministic and testable. */
  now: number;
  /** This case's most recent execution row, if any. */
  latestExecution: StuckCaseExecution | null;
  /** Whether a verification row exists for that execution (only meaningful for retry/voice). */
  hasVerification: boolean;
  /** That verification's `verified` flag, if `hasVerification`. */
  verificationVerified: boolean | null;
  /** Whether a still-pending approval row exists for this case. */
  hasPendingApproval: boolean;
}

export type RecoveryAction =
  /** Not stale yet — may be an actively running graph invocation. Leave it alone. */
  | { type: "skip_active" }
  /** payment_link/reminder awaiting a real Razorpay webhook — this is the case's normal, possibly long-lived resting state, not a fault. */
  | { type: "skip_awaiting_webhook" }
  /** Nothing external ever happened for this attempt — safe to redo the whole decision from scratch. */
  | { type: "reset_to_open" }
  /** A real/simulated action already executed; only the (deterministic, side-effect-free) verification step is missing. */
  | { type: "resume_verify" }
  /** The durable outcome already exists (execution, verification, or approval) — only the case row's own status column was never updated to match it. */
  | { type: "correct_status"; status: CaseStatus };

/**
 * Decides what, if anything, to do about one case stuck at `status =
 * 'in_progress'`. Pure and side-effect-free so every branch is covered by a
 * plain unit test — see stuck-case-policy.test.ts.
 *
 * The governing rule throughout: never re-trigger a node that has a real or
 * simulated external side effect (executeNode) once its execution row
 * already exists. Every branch below either does nothing, completes a
 * side-effect-free step that was left unfinished, or restarts a case that
 * never got far enough to touch anything external.
 */
export function classifyStuckCase(input: StuckCaseInput): RecoveryAction {
  const exec = input.latestExecution;

  // payment_link / reminder never reach verifyNode — their outcome is
  // confirmed asynchronously by a real Razorpay webhook (or the demo
  // trigger). Sitting in_progress for hours is correct here, not stuck;
  // check this before staleness so it's never touched regardless of age.
  if (exec && (exec.actionType === "payment_link" || exec.actionType === "reminder") && exec.status !== "failed") {
    return { type: "skip_awaiting_webhook" };
  }

  const idleMs = input.now - new Date(input.lastActivityAt).getTime();
  if (idleMs < STUCK_CASE_STALE_AFTER_MS) return { type: "skip_active" };

  if (!exec) {
    // Nothing was ever executed for this attempt. If escalation already
    // created its approval record before the interruption, don't restart
    // the whole decision (that would risk a second approval row for the
    // same case) — just repair the status to match what already exists.
    if (input.hasPendingApproval) return { type: "correct_status", status: "awaiting_approval" };
    return { type: "reset_to_open" };
  }

  if (exec.status === "failed") return { type: "correct_status", status: "failed" };

  if (exec.actionType === "stop") return { type: "correct_status", status: "stopped" };
  if (exec.actionType === "no_action") return { type: "correct_status", status: "closed" };

  // Only retry / voice remain — both simulated, both deterministic (seeded
  // by case id), so completing or re-deriving their outcome is always safe.
  if (!input.hasVerification) return { type: "resume_verify" };
  return { type: "correct_status", status: input.verificationVerified ? "recovered" : "closed" };
}
