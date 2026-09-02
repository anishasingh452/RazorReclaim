-- RazorReclaim core schema
-- Layers: batches/cases (domain) -> evidence -> decisions/impact_scores (reasoning)
-- -> policy_checks (deterministic gate) -> executions/verifications (real+simulated actions)
-- -> audit_log (canonical trail) -> approvals (human-in-the-loop)

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- batches
-- ============================================================
create table batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  seed text not null,
  concurrency int not null default 6,
  total_cases int not null default 0,
  total_at_risk numeric(14,2) not null default 0,
  total_expected_recovery_value numeric(14,2) not null default 0,
  total_recovered numeric(14,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_batches_updated_at before update on batches
  for each row execute function set_updated_at();

-- ============================================================
-- cases
-- ============================================================
create table cases (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  seq int not null, -- position within batch, for deterministic display order

  customer_name text not null,
  customer_id text not null,
  customer_email text not null,
  customer_tier text not null check (customer_tier in ('retail','smb','b2b')),

  amount numeric(14,2) not null,
  currency text not null default 'INR',

  risk_type text not null check (
    risk_type in ('failed_payment','checkout_abandonment','subscription_failure','overdue_receivable')
  ),

  contact_attempts int not null default 0,
  days_since_failure int not null default 0,

  is_synthetic boolean not null default true,

  status text not null default 'open' check (
    status in ('open','in_progress','awaiting_approval','escalated','stopped','recovered','closed','failed')
  ),

  final_action text check (
    final_action in ('retry','payment_link','reminder','wait_and_retry','escalate','stop')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cases_batch on cases(batch_id);
create index idx_cases_status on cases(batch_id, status);
create index idx_cases_risk_type on cases(batch_id, risk_type);
create trigger trg_cases_updated_at before update on cases
  for each row execute function set_updated_at();

-- ============================================================
-- evidence — raw signals fed to the root-cause reasoning node
-- (never contains a pre-labeled "true reason"; generator emits
--  decline codes / funnel events / retry history only)
-- ============================================================
create table evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  source text not null, -- e.g. 'gateway', 'checkout_funnel', 'subscription_engine', 'receivable_ledger'
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index idx_evidence_case on evidence(case_id);

-- ============================================================
-- decisions — structured LLM outputs per reasoning stage
-- ============================================================
create table decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  stage text not null check (stage in ('root_cause','recommend')),
  ai_output jsonb not null,
  confidence numeric(4,3), -- 0.000 - 1.000
  reasoning text not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index idx_decisions_case on decisions(case_id);

-- ============================================================
-- impact_scores — Business Impact Engine output (deterministic)
-- ERV = potential_recoverable_amount * recovery_probability - intervention_cost
-- ============================================================
create table impact_scores (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  action_type text not null check (
    action_type in ('retry','payment_link','reminder','wait_and_retry','escalate','stop')
  ),
  potential_recoverable_amount numeric(14,2) not null,
  recovery_probability numeric(4,3) not null,
  intervention_cost numeric(10,2) not null,
  expected_recovery_value numeric(14,2) not null,
  selected boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_impact_scores_case on impact_scores(case_id);

-- ============================================================
-- policy_checks — deterministic rule evaluations
-- ============================================================
create table policy_checks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  rule_name text not null,
  passed boolean not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index idx_policy_checks_case on policy_checks(case_id);

-- ============================================================
-- executions — real Razorpay/Resend calls or simulated retries
-- ============================================================
create table executions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  action_type text not null check (
    action_type in ('retry','payment_link','reminder','wait_and_retry','escalate','stop')
  ),
  provider text not null check (provider in ('razorpay','resend','simulated','none')),
  external_ref text, -- e.g. razorpay payment_link_id
  status text not null check (status in ('pending','success','failed')),
  idempotency_key text not null unique,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now()
);
create index idx_executions_case on executions(case_id);

-- ============================================================
-- verifications — outcome confirmation
-- source distinguishes real Razorpay webhook from demo-trigger
-- (both flow through the identical verification handler)
-- ============================================================
create table verifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  execution_id uuid not null references executions(id) on delete cascade,
  verified boolean not null,
  amount_recovered numeric(14,2) not null default 0,
  source text not null check (source in ('webhook','simulated_trigger','poll')),
  verified_at timestamptz not null default now()
);
create index idx_verifications_case on verifications(case_id);

-- ============================================================
-- approvals — human-in-the-loop, resumes LangGraph checkpoint
-- ============================================================
create table approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  requested_action jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer text,
  reviewed_at timestamptz,
  langgraph_thread_id text not null,
  created_at timestamptz not null default now()
);
create index idx_approvals_case on approvals(case_id);
create index idx_approvals_status on approvals(status);

-- ============================================================
-- audit_log — canonical, append-only trail for every stage
-- ============================================================
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  event_type text not null,
  actor text not null check (actor in ('ai_agent','policy_engine','impact_engine','human','system')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_log_case on audit_log(case_id, created_at);
