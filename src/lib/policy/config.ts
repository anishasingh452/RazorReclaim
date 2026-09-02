// Deterministic policy thresholds — the guardrails no AI output can override.

/** Above this many prior attempts, no further automated retry is issued. */
export const MAX_RETRY_ATTEMPTS = 3;

/** Above this many prior contact attempts, no further communication is sent. */
export const MAX_COMMUNICATION_ATTEMPTS = 3;

/** Absolute hard cap — never contact a customer more than this, regardless of value. */
export const HARASSMENT_HARD_CAP = 5;

/** Case amounts above this require human approval before any auto-execution. */
export const AUTO_APPROVAL_LIMIT = 100_000;

/** Minimum hours between two executions on the same case. */
export const COOLDOWN_HOURS = 24;

/** Absolute ceiling on total execution attempts per case (safety net). */
export const MAX_TOTAL_EXECUTIONS = 5;

/** Above this amount, a blocked communication escalates to a human instead of stopping outright. */
export const ESCALATE_INSTEAD_OF_STOP_THRESHOLD = 20_000;
