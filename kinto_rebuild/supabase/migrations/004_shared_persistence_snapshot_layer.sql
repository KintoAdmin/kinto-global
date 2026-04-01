create table if not exists public.assessment_question_facts (
  question_fact_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_code text not null,
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
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, question_id)
);
create index if not exists idx_assessment_question_facts_module on public.assessment_question_facts (assessment_id, module_id, domain_id, workflow_id);

create table if not exists public.assessment_metric_facts (
  metric_fact_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_code text not null,
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
  baseline_value_numeric numeric,
  current_value_numeric numeric,
  target_value_numeric numeric,
  variance_value_numeric numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, metric_id, workflow_id)
);
create index if not exists idx_assessment_metric_facts_module on public.assessment_metric_facts (assessment_id, module_id, domain_id, workflow_id);

create table if not exists public.assessment_roadmap_facts (
  roadmap_fact_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_code text not null,
  source_module_id text references public.modules(module_id),
  source_finding_instance_id text not null default '',
  source_action_instance_id text not null default '',
  phase_code text not null default 'P2',
  phase_name text not null default '',
  initiative_title text not null default '',
  initiative_description text not null default '',
  owner_role text not null default '',
  linked_metric_id text not null default '',
  baseline_value text not null default '',
  target_value text not null default '',
  review_frequency text not null default '',
  business_outcome text not null default '',
  priority_rank integer not null default 0,
  priority_effective integer not null default 0,
  status text not null default 'NOT_STARTED',
  progress_pct numeric(6,2) not null default 0,
  execution_status text not null default '',
  execution_notes text not null default '',
  last_reviewed_at timestamptz,
  dependency_flags text not null default '',
  dependency_summary text not null default '',
  source_module_ids text not null default '',
  source_row_ids text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, roadmap_fact_id)
);
create index if not exists idx_assessment_roadmap_facts_module on public.assessment_roadmap_facts (assessment_id, module_id, phase_code, priority_rank);

create table if not exists public.assessment_progress_facts (
  progress_fact_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_code text not null,
  roadmap_fact_id text not null,
  source_module_id text,
  linked_metric_id text not null default '',
  metric_family text not null default '',
  owner_role text not null default '',
  baseline_value text not null default '',
  current_value text not null default '',
  target_value text not null default '',
  roadmap_phase text not null default '',
  rag_rule text not null default '',
  review_frequency text not null default '',
  status text not null default 'NOT_STARTED',
  progress_pct numeric(6,2) not null default 0,
  execution_notes text not null default '',
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, roadmap_fact_id)
);
create index if not exists idx_assessment_progress_facts_module on public.assessment_progress_facts (assessment_id, module_id, roadmap_phase);

create table if not exists public.assessment_domain_snapshots (
  domain_snapshot_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_code text not null,
  domain_id text not null,
  domain_name text not null default '',
  score_pct numeric(8,2) not null default 0,
  maturity_band text not null default '',
  questions_answered integer not null default 0,
  questions_total integer not null default 0,
  is_complete boolean not null default false,
  snapshot_payload jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id, domain_id)
);
create index if not exists idx_assessment_domain_snapshots_module on public.assessment_domain_snapshots (assessment_id, module_id, score_pct desc);

create table if not exists public.assessment_module_snapshots (
  module_snapshot_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade,
  module_id text not null references public.modules(module_id) on delete cascade,
  module_code text not null,
  summary_payload jsonb not null default '{}'::jsonb,
  domain_scores_payload jsonb not null default '[]'::jsonb,
  findings_payload jsonb not null default '[]'::jsonb,
  recommendations_payload jsonb not null default '[]'::jsonb,
  actions_payload jsonb not null default '[]'::jsonb,
  roadmap_payload jsonb not null default '[]'::jsonb,
  metrics_payload jsonb not null default '[]'::jsonb,
  progress_payload jsonb not null default '[]'::jsonb,
  module_status text not null default 'NOT_STARTED',
  completion_pct numeric(6,2) not null default 0,
  score_pct numeric(8,2) not null default 0,
  maturity_band text not null default '',
  calculated_at timestamptz not null default timezone('utc', now()),
  unique (assessment_id, module_id)
);
create index if not exists idx_assessment_module_snapshots_assessment on public.assessment_module_snapshots (assessment_id, module_id);

create table if not exists public.assessment_snapshots (
  assessment_snapshot_id text primary key,
  assessment_id text not null references public.assessments(assessment_id) on delete cascade unique,
  summary_payload jsonb not null default '{}'::jsonb,
  module_cards_payload jsonb not null default '[]'::jsonb,
  roadmap_payload jsonb not null default '[]'::jsonb,
  progress_payload jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_assessment_snapshots_assessment on public.assessment_snapshots (assessment_id);
