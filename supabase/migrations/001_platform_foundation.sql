create extension if not exists pgcrypto;

create table if not exists public.modules (
  module_id text primary key,
  module_code text not null unique,
  module_name text not null,
  display_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  client_id text primary key,
  client_name text not null,
  industry text not null default '',
  business_model text not null default '',
  revenue_model text not null default '',
  company_size text not null default '',
  region text not null default '',
  primary_contact_name text not null default '',
  primary_contact_email text not null default '',
  notes text not null default '',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assessments (
  assessment_id text primary key,
  client_id text not null references public.clients(client_id) on delete cascade,
  assessment_name text not null,
  assessment_date date not null default current_date,
  version text not null default 'runtime-v1',
  status text not null default 'IN_PROGRESS',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_assessments_client_date on public.assessments (client_id, assessment_date desc);

create table if not exists public.assessment_modules (
  assessment_module_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_status text not null default 'NOT_STARTED',
  completion_pct numeric(6,2) not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  runtime_state jsonb not null default '{}'::jsonb,
  summary_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id)
);
create index if not exists idx_assessment_modules_assessment on public.assessment_modules (assessment_id, module_id);

create table if not exists public.reference_records (
  id uuid primary key default gen_random_uuid(),
  module_code text not null,
  record_type text not null,
  record_key text not null,
  parent_key text not null default '',
  order_index integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (module_code, record_type, record_key)
);
create index if not exists idx_reference_records_module_type on public.reference_records (module_code, record_type, order_index);

create table if not exists public.question_responses (
  response_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  domain_id text not null default '',
  workflow_id text not null default '',
  question_id text not null,
  score_1_to_5 numeric(6,2) not null default 0,
  score numeric(6,2) not null default 0,
  notes text not null default '',
  evidence_summary text not null default '',
  assessor_confidence text not null default '',
  is_complete boolean not null default false,
  scored_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, question_id)
);
create index if not exists idx_question_responses_module on public.question_responses (assessment_id, module_id, domain_id, workflow_id);

create table if not exists public.metric_captures (
  metric_capture_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  domain_id text not null default '',
  workflow_id text not null default '',
  metric_id text not null,
  metric_name text not null default '',
  baseline_value text not null default '',
  baseline_date text not null default '',
  current_value text not null default '',
  target_value text not null default '',
  variance_to_target text not null default '',
  unit text not null default '',
  trend_direction text not null default '',
  review_frequency text not null default '',
  owner_role text not null default '',
  rag_status text not null default '',
  evidence_strength text not null default '',
  source_system text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, metric_id, workflow_id)
);
create index if not exists idx_metric_captures_module on public.metric_captures (assessment_id, module_id, domain_id, workflow_id);

create table if not exists public.domain_scores (
  domain_score_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  domain_id text not null,
  domain_name text not null default '',
  raw_score_total numeric(12,2) not null default 0,
  max_score_total numeric(12,2) not null default 0,
  score_pct numeric(8,2) not null default 0,
  maturity_band text not null default '',
  questions_answered integer not null default 0,
  questions_total integer not null default 0,
  weight_pct numeric(8,2) not null default 0,
  weighted_score_pct numeric(8,2) not null default 0,
  is_complete boolean not null default false,
  calculated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (assessment_id, module_id, domain_id)
);
create index if not exists idx_domain_scores_module on public.domain_scores (assessment_id, module_id, score_pct desc);

create table if not exists public.module_scores (
  module_score_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  raw_score_total numeric(12,2) not null default 0,
  max_score_total numeric(12,2) not null default 0,
  score_pct numeric(8,2) not null default 0,
  maturity_band text not null default '',
  domains_completed integer not null default 0,
  domains_total integer not null default 0,
  questions_answered integer not null default 0,
  questions_total integer not null default 0,
  is_complete boolean not null default false,
  total_leakage numeric(16,2) not null default 0,
  avg_driver_score numeric(8,2) not null default 0,
  critical_exposures integer not null default 0,
  readiness_status text not null default '',
  calculated_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  unique (assessment_id, module_id)
);
create index if not exists idx_module_scores_assessment on public.module_scores (assessment_id, score_pct desc);

create table if not exists public.finding_instances (
  finding_instance_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  domain_id text not null default '',
  workflow_id text not null default '',
  question_id text not null default '',
  source_library_id text not null default '',
  severity_band text not null default '',
  finding_title text not null default '',
  finding_narrative text not null default '',
  business_impact text not null default '',
  likely_root_cause text not null default '',
  evidence_required text not null default '',
  evidence_strength text not null default '',
  is_priority boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_finding_instances_module on public.finding_instances (assessment_id, module_id, severity_band);

create table if not exists public.recommendation_instances (
  recommendation_instance_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  linked_finding_instance_id text not null default '',
  source_library_id text not null default '',
  recommendation_title text not null default '',
  recommendation_text text not null default '',
  expected_outcome text not null default '',
  implementation_notes text not null default '',
  priority_rank integer not null default 0,
  owner_role text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_recommendation_instances_module on public.recommendation_instances (assessment_id, module_id, priority_rank);

create table if not exists public.action_instances (
  action_instance_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  linked_recommendation_instance_id text not null default '',
  source_library_id text not null default '',
  action_title text not null default '',
  action_text text not null default '',
  owner_role text not null default '',
  action_deliverable text not null default '',
  success_measure text not null default '',
  effort_level text not null default '',
  timeline_band text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_action_instances_module on public.action_instances (assessment_id, module_id, owner_role);

create table if not exists public.roadmap_instances (
  roadmap_instance_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  linked_action_instance_id text not null default '',
  source_library_id text not null default '',
  phase_code text not null default '',
  phase_name text not null default '',
  initiative_title text not null default '',
  initiative_text text not null default '',
  owner_role text not null default '',
  priority_rank integer not null default 0,
  dependency_code text not null default '',
  dependency_summary text not null default '',
  target_outcome text not null default '',
  success_measure text not null default '',
  execution_status text not null default 'READY',
  status text not null default 'NOT_STARTED',
  progress_pct numeric(6,2) not null default 0,
  execution_notes text not null default '',
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_roadmap_instances_module on public.roadmap_instances (assessment_id, module_id, phase_code, priority_rank);

create table if not exists public.report_instances (
  report_instance_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  report_type text not null,
  module_scope text not null,
  file_name text not null default '',
  file_path text not null default '',
  generated_at timestamptz not null default timezone('utc', now()),
  generated_by text not null default 'system',
  report_version text not null default 'runtime-v1',
  report_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_report_instances_assessment on public.report_instances (assessment_id, generated_at desc);


-- v54 compatibility additions for legacy v53 frontend pages
create table if not exists public.success_measure_tracker (
  success_measure_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id),
  linked_metric_id text not null default '',
  metric_family text not null default '',
  linked_workflows text,
  baseline_value text not null default '',
  target_value text not null default '',
  current_value text not null default '',
  owner_role text,
  review_frequency text,
  roadmap_phase text,
  rag_rule text,
  why_it_matters text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, linked_metric_id, metric_family)
);

alter table if exists public.clients
  add column if not exists notes text not null default '';

alter table if exists public.domain_scores
  add column if not exists phase_name text not null default '',
  add column if not exists initiative_count integer not null default 0,
  add column if not exists blocked_count integer not null default 0,
  add column if not exists conditional_count integer not null default 0;

alter table if exists public.module_scores
  add column if not exists initiative_count integer not null default 0,
  add column if not exists source_module_count integer not null default 0,
  add column if not exists blocked_initiatives integer not null default 0,
  add column if not exists conditional_initiatives integer not null default 0,
  add column if not exists ready_initiatives integer not null default 0,
  add column if not exists pilot_ready_usecases integer not null default 0,
  add column if not exists conditional_usecases integer not null default 0,
  add column if not exists blocked_usecases integer not null default 0,
  add column if not exists recommended_usecases integer not null default 0,
  add column if not exists average_priority_score numeric(8,2) not null default 0;

alter table if exists public.recommendation_instances
  add column if not exists priority_level text;

alter table if exists public.action_instances
  add column if not exists indicative_timeline text,
  add column if not exists priority_level text;

alter table if exists public.roadmap_instances
  add column if not exists source_module_id text references public.modules(module_id),
  add column if not exists source_finding_instance_id text,
  add column if not exists source_action_instance_id text,
  add column if not exists initiative_description text,
  add column if not exists linked_metric_id text,
  add column if not exists baseline_value text not null default '',
  add column if not exists target_value text not null default '',
  add column if not exists review_frequency text,
  add column if not exists business_outcome text,
  add column if not exists execution_status text,
  add column if not exists dependency_summary text,
  add column if not exists priority_effective integer not null default 0,
  add column if not exists dependency_flags text not null default '',
  add column if not exists source_module_ids text not null default '',
  add column if not exists source_row_ids text not null default '';

create index if not exists idx_success_measure_tracker_assessment_module
  on public.success_measure_tracker (assessment_id, module_id);

insert into public.modules (module_id, module_code, module_name, display_order, is_active)
values
  ('MOD-OPS', 'OPS', 'Operational Audit', 1, true),
  ('MOD-LEAK', 'LEAK', 'Revenue Leakage', 2, true),
  ('MOD-DATA', 'DATA', 'Data Foundation', 3, true),
  ('MOD-AIR', 'AIR', 'AI Readiness', 4, true),
  ('MOD-AIUC', 'AIUC', 'AI Use Case Prioritisation', 5, true),
  ('MOD-ROADMAP', 'ROADMAP', 'Combined Transformation Roadmap', 6, true)
on conflict (module_id) do update
set module_code = excluded.module_code,
    module_name = excluded.module_name,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());
