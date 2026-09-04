import { createRng, choice, uniformInt, weightedChoice, logNormalRange, round2, type Rng } from "./rng";
import { generateEvidenceForCase, tenureBiasForTier, type GeneratedEvidence } from "./evidence";
import { AUTO_APPROVAL_LIMIT } from "@/lib/policy/config";
import type { CustomerTier, RiskType } from "@/types/domain";

export interface GeneratedCase {
  seq: number;
  customer_name: string;
  customer_id: string;
  customer_email: string;
  customer_tier: CustomerTier;
  amount: number;
  currency: "INR";
  risk_type: RiskType;
  contact_attempts: number;
  days_since_failure: number;
  is_synthetic: true;
  evidence: GeneratedEvidence[];
}

export interface GenerateBatchConfig {
  seed: string;
  caseCount: number; // 50-200
  demoEmailBase: string; // e.g. anishasingh452@gmail.com
  demoEmailPoolSize: number;
}

export interface GeneratedBatch {
  seed: string;
  caseCount: number;
  cases: GeneratedCase[];
  totalAtRisk: number;
}

const RISK_TYPE_WEIGHTS: readonly (readonly [RiskType, number])[] = [
  ["failed_payment", 40],
  ["checkout_abandonment", 25],
  ["subscription_failure", 20],
  ["overdue_receivable", 15],
];

const TIER_WEIGHTS_DEFAULT: readonly (readonly [CustomerTier, number])[] = [
  ["retail", 55],
  ["smb", 30],
  ["b2b", 15],
];

const TIER_WEIGHTS_RECEIVABLE: readonly (readonly [CustomerTier, number])[] = [
  ["retail", 5],
  ["smb", 25],
  ["b2b", 70],
];

const CONTACT_ATTEMPTS_WEIGHTS: readonly (readonly [number, number])[] = [
  [0, 40],
  [1, 25],
  [2, 15],
  [3, 12],
  [4, 8],
];

const AMOUNT_RANGE_BY_TIER: Record<CustomerTier, [number, number]> = {
  retail: [500, 5000],
  smb: [5000, 50000],
  b2b: [50000, 200000],
};

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditi", "Diya", "Kabir", "Meera", "Rohan", "Isha",
  "Arjun", "Ananya", "Sai", "Priya", "Vikram", "Neha", "Karan", "Riya",
  "Dev", "Tanya", "Rahul", "Simran",
] as const;

const LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Reddy", "Nair", "Gupta", "Khan", "Mehta",
  "Joshi", "Kapoor", "Chatterjee", "Rao", "Singh", "Bose", "Malhotra",
] as const;

function buildDemoEmailPool(base: string, size: number): string[] {
  const [local, domain] = base.split("@");
  if (!local || !domain) throw new Error(`Invalid DEMO_EMAIL_BASE: ${base}`);
  return Array.from({ length: size }, (_, i) => `${local}+cust${i + 1}@${domain}`);
}

function tierWeightsFor(riskType: RiskType) {
  return riskType === "overdue_receivable" ? TIER_WEIGHTS_RECEIVABLE : TIER_WEIGHTS_DEFAULT;
}

interface CustomerIdentity {
  customer_name: string;
  customer_id: string;
  customer_email: string;
}

/** Identities already used in this batch, kept per tier so a customer's tier stays coherent. */
type CustomerPools = Record<CustomerTier, CustomerIdentity[]>;

/**
 * Share of cases that belong to a customer the batch has already seen.
 * Without repeat customers, Shared Agent Memory — prior decisions, active
 * promises, the "we've dealt with this person before" check every agent
 * runs — has nothing to read, and a headline capability silently shows
 * empty on every case.
 */
const CUSTOMER_REUSE_RATE = 0.35;

function emptyCustomerPools(): CustomerPools {
  return { retail: [], smb: [], b2b: [] };
}

function mintCustomer(rng: Rng, emailPool: string[]): CustomerIdentity {
  return {
    customer_name: `${choice(rng, FIRST_NAMES)} ${choice(rng, LAST_NAMES)}`,
    customer_id: `CUST-${uniformInt(rng, 100000, 999999)}`,
    customer_email: choice(rng, emailPool),
  };
}

function pickCustomer(rng: Rng, pools: CustomerPools, tier: CustomerTier, emailPool: string[]): CustomerIdentity {
  const pool = pools[tier];
  if (pool.length > 0 && rng() < CUSTOMER_REUSE_RATE) return choice(rng, pool);
  const identity = mintCustomer(rng, emailPool);
  pool.push(identity);
  return identity;
}

function generateOneCase(rng: Rng, seq: number, emailPool: string[], pools: CustomerPools): GeneratedCase {
  const risk_type = weightedChoice(rng, RISK_TYPE_WEIGHTS);
  const customer_tier = weightedChoice(rng, tierWeightsFor(risk_type));
  const [min, max] = AMOUNT_RANGE_BY_TIER[customer_tier];
  const amount = round2(logNormalRange(rng, min, max));

  const contact_attempts = weightedChoice(rng, CONTACT_ATTEMPTS_WEIGHTS);
  const days_since_failure =
    risk_type === "overdue_receivable" ? uniformInt(rng, 5, 90) : uniformInt(rng, 0, 30);

  const { customer_name, customer_id, customer_email } = pickCustomer(rng, pools, customer_tier, emailPool);

  const tenureBias = tenureBiasForTier(customer_tier);
  const evidence = generateEvidenceForCase(rng, risk_type, contact_attempts, days_since_failure, tenureBias);

  return {
    seq,
    customer_name,
    customer_id,
    customer_email,
    customer_tier,
    amount,
    currency: "INR",
    risk_type,
    contact_attempts,
    days_since_failure,
    is_synthetic: true,
    evidence,
  };
}

export function generateBatch(config: GenerateBatchConfig): GeneratedBatch {
  if (config.caseCount < 1 || config.caseCount > 500) {
    throw new Error("caseCount must be between 1 and 500");
  }
  const rng = createRng(config.seed);
  const emailPool = buildDemoEmailPool(config.demoEmailBase, config.demoEmailPoolSize);

  const pools = emptyCustomerPools();
  const cases: GeneratedCase[] = [];
  for (let i = 0; i < config.caseCount; i++) {
    cases.push(generateOneCase(rng, i, emailPool, pools));
  }

  // Guarantee at least one of each notable scenario type exists so the demo
  // always has a STOP candidate (3+ attempts) and an escalation candidate
  // (large B2B receivable) even on unlucky seeds/small batches.
  ensureScenarioCoverage(rng, cases, emailPool, pools);

  const totalAtRisk = round2(cases.reduce((s, c) => s + c.amount, 0));

  return { seed: config.seed, caseCount: config.caseCount, cases, totalAtRisk };
}

function ensureScenarioCoverage(rng: Rng, cases: GeneratedCase[], emailPool: string[], pools: CustomerPools) {
  const hasStopCandidate = cases.some((c) => c.contact_attempts >= 3);
  const hasEscalationCandidate = cases.some((c) => c.customer_tier === "b2b" && c.amount >= 80000);
  // A large invoice that has only just gone overdue and nobody has chased
  // yet — the case where a live call is the right first move rather than an
  // analyst's time. Random draws rarely produce one (receivables are ~13% of
  // cases and skew old), so the voice path would otherwise go unexercised.
  const hasVoiceCandidate = cases.some(
    (c) =>
      c.risk_type === "overdue_receivable" &&
      c.contact_attempts === 0 &&
      c.days_since_failure <= 14 &&
      c.amount >= 50_000 &&
      c.amount <= AUTO_APPROVAL_LIMIT
  );

  if (!hasStopCandidate && cases.length > 0) {
    const idx = uniformInt(rng, 0, cases.length - 1);
    const contact_attempts = 4;
    const risk_type: RiskType = "failed_payment";
    const days_since_failure = uniformInt(rng, 0, 30);
    // Forcing the tier means the previous identity no longer belongs here —
    // take one from the pool for the tier this case is being moved into.
    cases[idx] = {
      ...cases[idx],
      ...pickCustomer(rng, pools, "retail", emailPool),
      contact_attempts,
      risk_type,
      amount: round2(logNormalRange(rng, 500, 5000)),
      customer_tier: "retail",
      days_since_failure,
      evidence: generateEvidenceForCase(rng, risk_type, contact_attempts, days_since_failure, tenureBiasForTier("retail")),
    };
  }
  if (!hasEscalationCandidate && cases.length > 1) {
    const idx = uniformInt(rng, 0, cases.length - 1);
    const risk_type: RiskType = "overdue_receivable";
    const days_since_failure = uniformInt(rng, 30, 90);
    cases[idx] = {
      ...cases[idx],
      ...pickCustomer(rng, pools, "b2b", emailPool),
      customer_tier: "b2b",
      risk_type,
      amount: round2(logNormalRange(rng, 80000, 200000)),
      days_since_failure,
      evidence: generateEvidenceForCase(rng, risk_type, cases[idx].contact_attempts, days_since_failure, tenureBiasForTier("b2b")),
    };
  }
  if (!hasVoiceCandidate && cases.length > 2) {
    // Pick a slot that isn't already carrying one of the guaranteed
    // scenarios above, so coverage additions don't overwrite each other.
    const idx = cases.findIndex((c) => c.contact_attempts < 3 && !(c.customer_tier === "b2b" && c.amount >= 80000));
    if (idx !== -1) {
      const risk_type: RiskType = "overdue_receivable";
      const days_since_failure = uniformInt(rng, 5, 14);
      cases[idx] = {
        ...cases[idx],
        ...pickCustomer(rng, pools, "b2b", emailPool),
        customer_tier: "b2b",
        risk_type,
        amount: round2(logNormalRange(rng, 55_000, 95_000)),
        contact_attempts: 0,
        days_since_failure,
        evidence: generateEvidenceForCase(rng, risk_type, 0, days_since_failure, tenureBiasForTier("b2b")),
      };
    }
  }
}
