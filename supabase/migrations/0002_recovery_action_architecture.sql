-- Recovery Action Architecture v2
-- Adds: signals (pre-case detection), a Candidate Action Engine's full
-- feasible/infeasible record on impact_scores, scheduled_actions,
-- promises_to_pay, voice_interactions, decision_memory, and a hash-chained
-- audit trail. Purely additive — no existing column is dropped or renamed,
-- so every existing query/row keeps working unchanged.

-- ============================================================
-- signals — raw pre-case detection events. A case is created FROM a
-- signal (SIGNAL_DETECTED -> CASE_CREATED), rather than existing a priori.
-- ============================================================
create table signals (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id) on delete cascade,
  case_id uuid references cases(id) on delete set null,
  source text not null, -- gateway | checkout_funnel | subscription_engine | receivable_ledger | razorpay_webhook | manual
  signal_type text not null, -- e.g. payment.failed, checkout.abandoned, subscription.payment_failed, invoice.overdue
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'linked', 'ignored')),
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_signals_batch on signals(batch_id);
create index idx_signals_case on signals(case_id);

alter table cases add column signal_id uuid references signals(id) on delete set null;

-- ============================================================
-- Unified Recovery Action vocabulary — extend the existing action_type
-- CHECK constraints (additively) with VOICE and NO_ACTION. Existing
-- values (retry, payment_link, reminder, wait_and_retry, escalate, stop)
-- are untouched, so no existing row or code path is affected.
-- ============================================================
alter table cases drop constraint if exists cases_final_action_check;
alter table cases add constraint cases_final_action_check
  check (final_action in ('retry','payment_link','reminder','wait_and_retry','escalate','stop','voice','no_action'));

alter table executions drop constraint if exists executions_action_type_check;
alter table executions add constraint executions_action_type_check
  check (action_type in ('retry','payment_link','reminder','wait_and_retry','escalate','stop','voice','no_action'));

alter table impact_scores drop constraint if exists impact_scores_action_type_check;
alter table impact_scores add constraint impact_scores_action_type_check
  check (action_type in ('retry','payment_link','reminder','wait_and_retry','escalate','stop','voice','no_action'));

-- ============================================================
-- Candidate Action Engine — impact_scores now records EVERY action type
-- the engine considered, not just the feasible ones it scored, so the
-- audit trail can show why an action was never in the running at all.
-- ============================================================
alter table impact_scores add column feasible boolean not null default true;
alter table impact_scores add column exclusion_reason text;

-- ============================================================
-- scheduled_actions — future-dated follow-ups (e.g. a deferred
-- cooldown-driven retry, or a post-promise-to-pay check-in).
-- ============================================================
create table scheduled_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  action_type text not null check (
    action_type in ('retry','payment_link','reminder','wait_and_retry','escalate','stop','voice','no_action')
  ),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','executed','cancelled')),
  reason text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);
create index idx_scheduled_actions_case on scheduled_actions(case_id);
create index idx_scheduled_actions_due on scheduled_actions(status, scheduled_for);

-- ============================================================
-- voice_interactions — simulated AI/agent voice calls (no real telephony
-- provider is wired up; `provider` mirrors the real/simulated pattern used
-- elsewhere in the system so a real integration can slot in later).
-- ============================================================
create table voice_interactions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  execution_id uuid references executions(id) on delete set null,
  provider text not null default 'simulated' check (provider in ('simulated','real')),
  call_status text not null check (call_status in ('completed','no_answer','voicemail','declined')),
  duration_seconds int not null default 0,
  outcome text not null check (outcome in ('promise_to_pay','refused','callback_requested','no_response','resolved')),
  transcript_summary text,
  created_at timestamptz not null default now()
);
create index idx_voice_interactions_case on voice_interactions(case_id);

-- ============================================================
-- promises_to_pay — a commitment captured during an interaction
-- (typically voice, but not exclusively).
-- ============================================================
create table promises_to_pay (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  voice_interaction_id uuid references voice_interactions(id) on delete set null,
  promised_amount numeric(14,2) not null,
  promised_date date not null,
  status text not null default 'pending' check (status in ('pending','kept','broken')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_promises_to_pay_case on promises_to_pay(case_id);

-- ============================================================
-- decision_memory — durable, cross-case summary keyed by customer, so
-- future reasoning can be informed by a customer's recovery history.
-- ============================================================
create table decision_memory (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null,
  case_id uuid not null references cases(id) on delete cascade,
  summary text not null,
  final_action text,
  verified boolean not null default false,
  amount_recovered numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);
create index idx_decision_memory_customer on decision_memory(customer_id, created_at desc);

-- ============================================================
-- audit_log — proper audit trail: model version + tamper-evident,
-- per-case hash chain (each row's hash covers its own content plus the
-- previous row's hash for the same case; the first row per case chains
-- from the literal string 'GENESIS'). Nullable so existing pre-migration
-- rows remain valid; only rows written after this migration are chained.
-- ============================================================
alter table audit_log add column model_version text;
alter table audit_log add column prev_hash text;
alter table audit_log add column hash text;
alter table audit_log drop constraint if exists audit_log_actor_check;
alter table audit_log add constraint audit_log_actor_check
  check (actor in ('ai_agent','policy_engine','impact_engine','candidate_engine','human','system'));
