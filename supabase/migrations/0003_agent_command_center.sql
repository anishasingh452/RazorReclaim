-- Razorpay Agent Command Center — governance layer above the existing
-- recovery pipeline. Purely additive: new tables + a widened audit_log
-- actor CHECK constraint. Nothing existing is dropped, renamed, or altered
-- in a breaking way.

-- ============================================================
-- agent_proposals — every agent's proposed action for a case, before
-- conflict detection / ERV scoring / policy decide what actually happens.
-- The existing single LLM recommendation becomes one proposal among
-- possibly several (e.g. a lightweight rule-based second agent).
-- ============================================================
create table agent_proposals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  agent_name text not null,
  proposed_action text not null check (
    proposed_action in ('retry','payment_link','reminder','wait_and_retry','escalate','stop','voice','no_action')
  ),
  proposed_channel text,
  confidence numeric(4,3),
  rationale text not null,
  status text not null default 'proposed' check (
    status in ('proposed','selected','rejected_conflict','rejected_governor')
  ),
  created_at timestamptz not null default now()
);
create index idx_agent_proposals_case on agent_proposals(case_id);

-- ============================================================
-- agent_conflicts — detected disagreement/overlap between two or more
-- proposals for the same case. Resolution is filled in once the existing
-- Business Impact Engine picks a winner (that engine IS the resolver —
-- this table just records that a conflict existed and how it settled).
-- ============================================================
create table agent_conflicts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  conflict_type text not null check (
    conflict_type in ('duplicate_action','conflicting_action','competing_channel','contradictory_strategy')
  ),
  proposal_ids uuid[] not null,
  resolution text check (resolution in ('selected_winner','blocked_all','deferred')),
  winning_proposal_id uuid references agent_proposals(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_agent_conflicts_case on agent_conflicts(case_id);

-- ============================================================
-- no_action_decisions — the "Why Not To Act" engine's structured output.
-- Explains, with a specific reason code, why WAIT/NO_ACTION/STOP was
-- chosen over engaging the customer. Derived from data the existing
-- ERV/policy engines already computed, never a separate calculation.
-- ============================================================
create table no_action_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  reason_code text not null check (reason_code in (
    'likely_natural_recovery',
    'already_contacted',
    'active_promise_exists',
    'communication_fatigue_risk',
    'cost_exceeds_value',
    'insufficient_confidence',
    'other'
  )),
  explanation text not null,
  alternatives_considered jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_no_action_decisions_case on no_action_decisions(case_id);

-- ============================================================
-- audit_log actor vocabulary — two new actors for the new nodes
-- (conflict_engine, reasoning_engine). All prior actors untouched.
-- ============================================================
alter table audit_log drop constraint if exists audit_log_actor_check;
alter table audit_log add constraint audit_log_actor_check
  check (actor in (
    'ai_agent','policy_engine','impact_engine','candidate_engine',
    'human','system','conflict_engine','reasoning_engine'
  ));
