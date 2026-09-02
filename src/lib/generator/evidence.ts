import type { Rng } from "./rng";
import { bool, choice, uniformInt } from "./rng";
import type { Evidence, RiskType } from "@/types/domain";

type EvidencePayload = Evidence["payload"];
type EvidenceSource = Evidence["source"];

/**
 * IMPORTANT: these generators emit raw, gateway/funnel/ledger-style signals —
 * never a pre-labeled "true reason" or "recovery probability" field. The
 * root_cause LLM node infers cause from these signals the same way it would
 * from real production data. Correlations below (e.g. more decline severity
 * + more contact attempts => naturally reads as harder to recover) emerge
 * from realistic signal combinations, not from an injected answer key.
 */

const DECLINE_CODES = [
  "INSUFFICIENT_FUNDS",
  "CARD_EXPIRED",
  "ISSUER_TIMEOUT",
  "DO_NOT_HONOR",
  "INVALID_CVV",
  "NETWORK_ERROR",
  "FRAUD_SUSPECTED",
  "LIMIT_EXCEEDED",
] as const;

const PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet"] as const;

function gatewayEvidence(rng: Rng, contactAttempts: number): EvidencePayload {
  // more prior attempts skews toward harder-to-recover decline codes —
  // a realistic correlation, not an injected label.
  const hardCodes = ["FRAUD_SUSPECTED", "DO_NOT_HONOR", "LIMIT_EXCEEDED", "INSUFFICIENT_FUNDS"];
  const softCodes = ["ISSUER_TIMEOUT", "NETWORK_ERROR", "INVALID_CVV", "CARD_EXPIRED"];
  const pool = contactAttempts >= 2 ? hardCodes : contactAttempts >= 1 ? DECLINE_CODES : softCodes;
  return {
    bank_decline_code: choice(rng, pool),
    retry_count_last_24h: uniformInt(rng, 0, 3),
    payment_method: choice(rng, PAYMENT_METHODS),
    previous_successful_payments: uniformInt(rng, 0, 40),
    gateway_latency_ms: uniformInt(rng, 120, 4000),
  };
}

const FUNNEL_STEPS = ["cart", "address", "payment_method", "otp_verification", "processing"] as const;
const DEVICES = ["mobile_web", "desktop", "android_app", "ios_app"] as const;

function checkoutFunnelEvidence(rng: Rng): EvidencePayload {
  return {
    last_step_reached: choice(rng, FUNNEL_STEPS),
    time_on_payment_page_sec: uniformInt(rng, 5, 600),
    device_type: choice(rng, DEVICES),
    coupon_applied: bool(rng, 0.3),
    page_load_ms: uniformInt(rng, 400, 6000),
    previous_orders_count: uniformInt(rng, 0, 25),
  };
}

const MANDATE_STATUSES = ["active", "paused", "revoked", "pending_reauth"] as const;
const DUNNING_STAGES = ["stage_1_retry", "stage_2_notice", "stage_3_final_notice", "grace_period"] as const;

function subscriptionEvidence(rng: Rng, contactAttempts: number): EvidencePayload {
  return {
    mandate_status: contactAttempts >= 2 ? choice(rng, ["revoked", "pending_reauth"] as const) : choice(rng, MANDATE_STATUSES),
    failed_cycle_number: uniformInt(rng, 1, 4),
    dunning_stage: choice(rng, DUNNING_STAGES),
    last_successful_charge_days_ago: uniformInt(rng, 15, 400),
    plan_name: choice(rng, ["starter_monthly", "pro_monthly", "pro_annual", "team_monthly"] as const),
    auto_retry_scheduled: bool(rng, 0.6),
  };
}

function receivableEvidence(rng: Rng, daysSinceFailure: number): EvidencePayload {
  return {
    invoice_number: `INV-${uniformInt(rng, 10000, 99999)}`,
    due_date_days_ago: daysSinceFailure,
    payment_terms: choice(rng, ["net_15", "net_30", "net_45", "net_60"] as const),
    dispute_flag: bool(rng, 0.15),
    partial_payment_received: bool(rng, 0.2),
    account_manager_notes_summary: choice(rng, [
      "Customer requested extended terms",
      "Awaiting internal approval on their end",
      "No response to last two follow-ups",
      "Confirmed intent to pay, timing unclear",
      "Finance contact changed recently",
    ] as const),
  };
}

function customerProfileEvidence(rng: Rng, tenureBiasMonths: number): EvidencePayload {
  return {
    tenure_months: Math.max(1, tenureBiasMonths + uniformInt(rng, -6, 12)),
    ltv_score: uniformInt(rng, 1, 100),
    support_tickets_last_90d: uniformInt(rng, 0, 6),
    churn_risk_flag: bool(rng, 0.2),
  };
}

export interface GeneratedEvidence {
  source: EvidenceSource;
  payload: EvidencePayload;
}

export function generateEvidenceForCase(
  rng: Rng,
  riskType: RiskType,
  contactAttempts: number,
  daysSinceFailure: number,
  tenureBiasMonths: number
): GeneratedEvidence[] {
  const primary: GeneratedEvidence = (() => {
    switch (riskType) {
      case "failed_payment":
        return { source: "gateway", payload: gatewayEvidence(rng, contactAttempts) };
      case "checkout_abandonment":
        return { source: "checkout_funnel", payload: checkoutFunnelEvidence(rng) };
      case "subscription_failure":
        return { source: "subscription_engine", payload: subscriptionEvidence(rng, contactAttempts) };
      case "overdue_receivable":
        return { source: "receivable_ledger", payload: receivableEvidence(rng, daysSinceFailure) };
    }
  })();

  return [
    primary,
    { source: "customer_profile", payload: customerProfileEvidence(rng, tenureBiasMonths) },
  ];
}

// Used by the case generator to weight tenure realistically by tier.
export function tenureBiasForTier(tier: "retail" | "smb" | "b2b"): number {
  return tier === "b2b" ? 24 : tier === "smb" ? 12 : 4;
}
